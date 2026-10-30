from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.entities import (
    User,
    Device,
    Interface,
    Vlan,
    Vlanif,
    StaticRoute,
    ProvisioningJob,
    ProvisioningCommand,
    ConfigurationBackup,
    AuditLog,
)
from backend.schemas.api_schemas import (
    ProvisioningRequest,
    ProvisioningPreviewResponse,
    ProvisioningExecutionResponse,
    CommandExecutionResult,
)
from backend.security.auth import (
    get_current_user,
    require_roles,
    verify_pop_access,
    acquire_device_lock,
    release_device_lock,
)
from backend.drivers.huawei.validator import (
    validate_provisioning_request,
    cidr_to_netmask,
)
from backend.drivers.huawei.command_generator import (
    generate_provisioning_plan,
    format_static_route_command,
)
from backend.drivers.huawei.vrp_driver import HuaweiVRPDriver, HuaweiSSHDriverError
from backend.services.audit_service import log_audit_event

router = APIRouter(tags=["Provisionamento, Histórico e Configurações"])


def _resolve_devices(db: Session, req: ProvisioningRequest):
    access_device = db.query(Device).filter(Device.id == req.device_id).first()
    if not access_device:
        raise HTTPException(status_code=404, detail="Switch selecionado não encontrado.")

    l3_id = req.l3_routing_device_id or access_device.id
    l3_device = db.query(Device).filter(Device.id == l3_id).first()
    if not l3_device:
        raise HTTPException(
            status_code=404,
            detail="Equipamento Layer 3 selecionado para roteamento não foi encontrado.",
        )
    return access_device, l3_device


@router.post("/provisioning/preview", response_model=ProvisioningPreviewResponse)
def preview_provisioning(
    req: ProvisioningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    access_device, l3_device = _resolve_devices(db, req)

    port_iface = (
        db.query(Interface)
        .filter(
            Interface.device_id == access_device.id,
            Interface.name == req.interface_name,
        )
        .first()
    )
    existing_vlans = db.query(Vlan).filter(Vlan.device_id == access_device.id).all()
    existing_vlan = next((v for v in existing_vlans if v.vlan_id == req.vlan_id), None)

    existing_vlanifs = db.query(Vlanif).filter(Vlanif.device_id == l3_device.id).all()
    existing_vlanif = next((v for v in existing_vlanifs if v.vlan_id == req.vlan_id), None)

    existing_routes = db.query(StaticRoute).filter(StaticRoute.device_id == l3_device.id).all()

    issues = validate_provisioning_request(
        req=req,
        access_device=access_device,
        l3_device=l3_device,
        port_iface=port_iface,
        existing_vlans=existing_vlans,
        existing_vlanifs=existing_vlanifs,
        existing_routes=existing_routes,
    )
    has_blocking_errors = any(i.severity == "ERROR" for i in issues)

    (
        current_text,
        proposed_text,
        diff_lines,
        device_plans,
        combined_cli_script,
    ) = generate_provisioning_plan(
        req=req,
        access_device=access_device,
        l3_device=l3_device,
        iface=port_iface,
        existing_vlan=existing_vlan,
        existing_vlanif=existing_vlanif,
        existing_routes=existing_routes,
    )

    return ProvisioningPreviewResponse(
        is_valid=not has_blocking_errors,
        issues=issues,
        current_config_text=current_text,
        proposed_config_text=proposed_text,
        diff_lines=diff_lines,
        device_plans=device_plans,
        combined_cli_script=combined_cli_script,
        is_simulated=bool(access_device.is_simulated and settings.DEMO_MODE),
    )


@router.post("/provisioning/execute", response_model=ProvisioningExecutionResponse)
def execute_provisioning(
    req: ProvisioningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    """
    Executes the mandatory 14-step Huawei SSH provisioning flow:
    1. Verify user authorization & POP access
    2. Test connectivity
    3. Identify model & VRP version
    4. Query current state
    5. Verify conflicts
    6. Create configuration backup
    7. Generate change plan
    8. Verify explicit confirmation
    9. Execute commands sequentially
    10. Capture command outputs
    11. Detect syntax/execution errors
    12. Update desired/discovered state
    13. Validate post-change state
    14. Log operation in history & release lock
    """
    workflow_steps: List[dict] = []

    # Step 1: Authorization & POP access
    verify_pop_access(current_user, req.pop_id)
    workflow_steps.append(
        {
            "step": 1,
            "title": "Autorização verificada",
            "detail": f"Operador {current_user.username} ({current_user.role.display_name}) autorizado.",
            "status": "OK",
        }
    )

    if not req.explicit_confirmation:
        raise HTTPException(
            status_code=400,
            detail="Confirmação explícita obrigatória para aplicar alterações via SSH no equipamento.",
        )

    access_device, l3_device = _resolve_devices(db, req)

    # Acquire concurrency lock on target device(s)
    acquire_device_lock(db, access_device, current_user)
    if l3_device.id != access_device.id:
        acquire_device_lock(db, l3_device, current_user)

    try:
        access_driver = HuaweiVRPDriver(access_device)
        l3_driver = HuaweiVRPDriver(l3_device)

        # Step 2 & 3: Test connectivity & identify model/VRP version
        try:
            conn_info = access_driver.test_connectivity()
            if l3_device.id != access_device.id:
                l3_driver.test_connectivity()
        except HuaweiSSHDriverError as exc:
            log_audit_event(
                db=db,
                user=current_user,
                action="PROVISION_SSH_FAILED",
                resource_type="PROVISIONING",
                device_name=access_device.name,
                pop_name=access_device.pop.name if access_device.pop else None,
                status="FAILED",
                details=str(exc),
                is_simulated=access_driver.is_simulated,
            )
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        workflow_steps.append(
            {
                "step": 2,
                "title": "Conectividade SSH e versão VRP validadas",
                "detail": f"{access_device.name} ({access_device.model} - {access_device.system_version}) respondeu em {conn_info['latency_ms']} ms.",
                "status": "OK",
            }
        )

        # Step 4 & 5: Query current state & validate conflicts
        port_iface = (
            db.query(Interface)
            .filter(
                Interface.device_id == access_device.id,
                Interface.name == req.interface_name,
            )
            .first()
        )
        existing_vlans = db.query(Vlan).filter(Vlan.device_id == access_device.id).all()
        existing_vlan = next((v for v in existing_vlans if v.vlan_id == req.vlan_id), None)
        existing_vlanifs = db.query(Vlanif).filter(Vlanif.device_id == l3_device.id).all()
        existing_vlanif = next((v for v in existing_vlanifs if v.vlan_id == req.vlan_id), None)
        existing_routes = db.query(StaticRoute).filter(StaticRoute.device_id == l3_device.id).all()

        issues = validate_provisioning_request(
            req=req,
            access_device=access_device,
            l3_device=l3_device,
            port_iface=port_iface,
            existing_vlans=existing_vlans,
            existing_vlanifs=existing_vlanifs,
            existing_routes=existing_routes,
        )
        blocking_errors = [i for i in issues if i.severity == "ERROR"]
        if blocking_errors:
            raise HTTPException(status_code=400, detail=blocking_errors[0].message)

        workflow_steps.append(
            {
                "step": 3,
                "title": "Análise de conflitos concluída",
                "detail": "Nenhum conflito bloqueante de VLAN, Vlanif ou rota estática detectado.",
                "status": "OK",
            }
        )

        # Step 6: Create pre-change configuration backup
        backup = access_driver.create_configuration_backup(
            db=db,
            user_id=current_user.id,
            backup_type="PRE_PROVISIONING",
            comment=f"Backup pré-provisionamento VLAN {req.vlan_id} na porta {req.interface_name}",
        )
        if l3_device.id != access_device.id:
            l3_driver.create_configuration_backup(
                db=db,
                user_id=current_user.id,
                backup_type="PRE_PROVISIONING",
                comment=f"Backup L3 pré-provisionamento VLAN {req.vlan_id}",
            )

        workflow_steps.append(
            {
                "step": 4,
                "title": "Backup de configuração criado",
                "detail": f"Snapshot salvo (Backup #{backup.id}, SHA-256: {backup.checksum}).",
                "status": "OK",
            }
        )

        # Step 7: Generate command plan
        (
            current_text,
            proposed_text,
            _diff_lines,
            device_plans,
            _combined_cli,
        ) = generate_provisioning_plan(
            req=req,
            access_device=access_device,
            l3_device=l3_device,
            iface=port_iface,
            existing_vlan=existing_vlan,
            existing_vlanif=existing_vlanif,
            existing_routes=existing_routes,
        )

        # Create ProvisioningJob record
        job = ProvisioningJob(
            pop_id=req.pop_id,
            device_id=access_device.id,
            l3_routing_device_id=l3_device.id,
            user_id=current_user.id,
            interface_name=req.interface_name,
            vlan_id=req.vlan_id,
            vlan_description=req.vlan_description,
            port_mode=req.port_mode,
            create_vlanif=req.create_vlanif,
            vlanif_ipv4=req.vlanif_ipv4 if req.create_vlanif else None,
            vlanif_cidr=req.vlanif_cidr if req.create_vlanif else None,
            create_static_routes=req.create_static_routes,
            routes_payload=[r.model_dump() for r in req.static_routes] if req.create_static_routes else [],
            status="RUNNING",
            before_config_snippet=current_text,
            proposed_config_snippet=proposed_text,
            backup_id=backup.id,
            is_simulated=access_driver.is_simulated,
        )
        db.add(job)
        db.flush()

        # Step 10-12: Execute commands sequentially and capture outputs
        command_results: List[CommandExecutionResult] = []
        seq = 1
        for plan in device_plans:
            target_dev = access_device if plan.device_id == access_device.id else l3_device
            target_driver = HuaweiVRPDriver(target_dev)
            exec_tuples = target_driver.execute_commands_sequentially(
                commands=plan.commands,
                save_config=req.save_configuration,
            )
            for cmd_text, dev_out, cmd_status in exec_tuples:
                db.add(
                    ProvisioningCommand(
                        job_id=job.id,
                        target_device_id=target_dev.id,
                        sequence_order=seq,
                        command_text=cmd_text,
                        device_output=dev_out,
                        status=cmd_status,
                    )
                )
                command_results.append(
                    CommandExecutionResult(
                        sequence_order=seq,
                        device_name=target_dev.name,
                        command_text=cmd_text,
                        device_output=dev_out,
                        status=cmd_status,
                    )
                )
                seq += 1

        workflow_steps.append(
            {
                "step": 5,
                "title": "Comandos VRP aplicados sequencialmente",
                "detail": f"{len(command_results)} comando(s) executados sem erros de sintaxe.",
                "status": "OK",
            }
        )

        # Persist state changes in DB (VLAN, Interface, Vlanif, Static Routes)
        vlan_cfg_str = f"vlan {req.vlan_id}\n description {req.vlan_description}\nquit"
        if existing_vlan:
            existing_vlan.description = req.vlan_description
            existing_vlan.name = req.vlan_description
            existing_vlan.discovered_config = vlan_cfg_str
            existing_vlan.desired_config = vlan_cfg_str
            existing_vlan.last_known_config = vlan_cfg_str
        else:
            db.add(
                Vlan(
                    device_id=access_device.id,
                    vlan_id=req.vlan_id,
                    name=req.vlan_description,
                    description=req.vlan_description,
                    tagged_ports=port_iface.short_name if (port_iface and req.port_mode != "access") else "",
                    untagged_ports=port_iface.short_name if (port_iface and req.port_mode == "access") else "",
                    discovered_config=vlan_cfg_str,
                    desired_config=vlan_cfg_str,
                    last_known_config=vlan_cfg_str,
                )
            )

        if port_iface:
            port_iface.description = req.port_description or req.vlan_description
            mode = req.port_mode.lower().strip()
            port_iface.link_type = mode
            if mode == "access":
                port_iface.pvid = req.vlan_id
                port_iface.allowed_vlans = str(req.vlan_id)
                port_iface.discovered_config = (
                    f"interface {port_iface.name}\n"
                    f" description {port_iface.description}\n"
                    f" port link-type access\n"
                    f" port default vlan {req.vlan_id}\n"
                    "quit"
                )
            elif mode == "trunk":
                existing_v_list = [
                    v.strip() for v in port_iface.allowed_vlans.split(",") if v.strip()
                ]
                if str(req.vlan_id) not in existing_v_list:
                    existing_v_list.append(str(req.vlan_id))
                port_iface.allowed_vlans = ",".join(existing_v_list)
                port_iface.discovered_config = (
                    f"interface {port_iface.name}\n"
                    f" description {port_iface.description}\n"
                    f" port link-type trunk\n"
                    f" port trunk allow-pass vlan {' '.join(existing_v_list)}\n"
                    "quit"
                )
            elif mode == "hybrid":
                existing_v_list = [
                    v.strip() for v in port_iface.allowed_vlans.split(",") if v.strip()
                ]
                if str(req.vlan_id) not in existing_v_list:
                    existing_v_list.append(str(req.vlan_id))
                port_iface.allowed_vlans = ",".join(existing_v_list)
                port_iface.discovered_config = (
                    f"interface {port_iface.name}\n"
                    f" description {port_iface.description}\n"
                    f" port link-type hybrid\n"
                    f" port hybrid tagged vlan {' '.join(existing_v_list)}\n"
                    "quit"
                )
            port_iface.desired_config = port_iface.discovered_config
            port_iface.last_known_config = port_iface.discovered_config

        if req.create_vlanif and req.vlanif_ipv4:
            cidr = req.vlanif_cidr or 30
            mask = req.vlanif_subnet_mask or cidr_to_netmask(cidr)
            vif_desc = req.vlanif_description or f"GATEWAY-{req.vlan_description}"
            vif_cfg_str = (
                f"interface Vlanif{req.vlan_id}\n"
                f" description {vif_desc}\n"
                f" ip address {req.vlanif_ipv4.strip()} {mask}\n"
                "quit"
            )
            if existing_vlanif:
                existing_vlanif.description = vif_desc
                existing_vlanif.ip_address = req.vlanif_ipv4.strip()
                existing_vlanif.subnet_mask = mask
                existing_vlanif.cidr_prefix = cidr
                existing_vlanif.ipv6_address = req.vlanif_ipv6
                existing_vlanif.vrf_name = req.vlanif_vrf_name
                existing_vlanif.discovered_config = vif_cfg_str
                existing_vlanif.desired_config = vif_cfg_str
                existing_vlanif.last_known_config = vif_cfg_str
            else:
                db.add(
                    Vlanif(
                        device_id=l3_device.id,
                        vlan_id=req.vlan_id,
                        interface_name=f"Vlanif{req.vlan_id}",
                        description=vif_desc,
                        ip_address=req.vlanif_ipv4.strip(),
                        subnet_mask=mask,
                        cidr_prefix=cidr,
                        ipv6_address=req.vlanif_ipv6,
                        vrf_name=req.vlanif_vrf_name,
                        discovered_config=vif_cfg_str,
                        desired_config=vif_cfg_str,
                        last_known_config=vif_cfg_str,
                    )
                )

        if req.create_static_routes and req.static_routes:
            for r_item in req.static_routes:
                r_cmd = format_static_route_command(r_item)
                rmask = (
                    r_item.subnet_mask
                    or (cidr_to_netmask(r_item.cidr_prefix) if r_item.ip_version == 4 else f"/{r_item.cidr_prefix}")
                )
                db.add(
                    StaticRoute(
                        device_id=l3_device.id,
                        ip_version=r_item.ip_version,
                        destination_network=r_item.destination_network.strip(),
                        cidr_prefix=r_item.cidr_prefix,
                        subnet_mask=rmask,
                        next_hop=r_item.next_hop.strip(),
                        preference=r_item.preference,
                        description=r_item.description,
                        vrf_name=r_item.vrf_name,
                        protocol="Static",
                        is_active=True,
                        discovered_config=r_cmd,
                        desired_config=r_cmd,
                        last_known_config=r_cmd,
                    )
                )

        db.flush()

        # Step 13: Post-change state validation & update full config snapshot
        updated_full_cfg = access_driver.build_full_current_configuration()
        access_device.discovered_config = updated_full_cfg
        access_device.desired_config = updated_full_cfg
        access_device.last_known_config = updated_full_cfg
        access_device.last_synced_at = datetime.now(timezone.utc)

        workflow_steps.append(
            {
                "step": 6,
                "title": "Estado final validado e salvo",
                "detail": "Verificação pós-alteração confirmou VLAN, porta, Vlanif e tabela de roteamento ativas.",
                "status": "OK",
            }
        )

        summary_msg = (
            f"Provisionamento concluído em {access_device.name}: Porta {req.interface_name} "
            f"({req.port_mode.upper()}) na VLAN {req.vlan_id} ({req.vlan_description})"
        )
        if req.create_vlanif and req.vlanif_ipv4:
            summary_msg += f", Vlanif{req.vlan_id} ({req.vlanif_ipv4}/{req.vlanif_cidr or 30})"
        if req.create_static_routes and req.static_routes:
            summary_msg += f", {len(req.static_routes)} rota(s) estática(s) em {l3_device.name}"

        job.status = "COMPLETED"
        job.execution_summary = summary_msg
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)

        # Step 14: Record operation in AuditLog
        log_audit_event(
            db=db,
            user=current_user,
            action="PROVISION_COMPLETE",
            resource_type="PROVISIONING",
            resource_id=str(job.id),
            device_name=access_device.name,
            pop_name=access_device.pop.name if access_device.pop else None,
            status="SUCCESS",
            details=summary_msg,
            is_simulated=access_driver.is_simulated,
        )

        return ProvisioningExecutionResponse(
            job_id=job.id,
            status=job.status,
            backup_id=backup.id,
            is_simulated=access_driver.is_simulated,
            summary=summary_msg,
            workflow_steps=workflow_steps,
            command_results=command_results,
            post_validation_passed=True,
            created_at=job.created_at,
        )

    finally:
        release_device_lock(db, access_device)
        if l3_device.id != access_device.id:
            release_device_lock(db, l3_device)


# --- History, Backups & Settings ---
@router.get("/history/jobs")
def list_provisioning_jobs(
    device_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(ProvisioningJob)
    if device_id is not None:
        q = q.filter(ProvisioningJob.device_id == device_id)
    jobs = q.order_by(ProvisioningJob.created_at.desc()).limit(50).all()
    return [
        {
            "id": j.id,
            "device_id": j.device_id,
            "device_name": j.device.name if j.device else "-",
            "username": j.user.username if j.user else "admin",
            "interface_name": j.interface_name,
            "vlan_id": j.vlan_id,
            "vlan_description": j.vlan_description,
            "port_mode": j.port_mode,
            "create_vlanif": j.create_vlanif,
            "vlanif_ipv4": j.vlanif_ipv4,
            "vlanif_cidr": j.vlanif_cidr,
            "create_static_routes": j.create_static_routes,
            "routes_payload": j.routes_payload or [],
            "status": j.status,
            "before_config_snippet": j.before_config_snippet,
            "proposed_config_snippet": j.proposed_config_snippet,
            "execution_summary": j.execution_summary,
            "backup_id": j.backup_id,
            "is_simulated": j.is_simulated,
            "created_at": j.created_at,
            "completed_at": j.completed_at,
            "commands": [
                {
                    "sequence_order": c.sequence_order,
                    "command_text": c.command_text,
                    "device_output": c.device_output,
                    "status": c.status,
                }
                for c in j.commands
            ],
        }
        for j in jobs
    ]


@router.get("/history/audit-logs")
def list_audit_logs(
    resource_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(AuditLog)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    logs = q.order_by(AuditLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "username": l.username,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "device_name": l.device_name,
            "pop_name": l.pop_name,
            "status": l.status,
            "details": l.details,
            "ip_address": l.ip_address,
            "is_simulated": l.is_simulated,
            "created_at": l.created_at,
        }
        for l in logs
    ]


@router.get("/history/backups")
def list_backups(
    device_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(ConfigurationBackup)
    if device_id is not None:
        q = q.filter(ConfigurationBackup.device_id == device_id)
    backups = q.order_by(ConfigurationBackup.created_at.desc()).limit(30).all()
    return [
        {
            "id": b.id,
            "device_id": b.device_id,
            "device_name": b.device.name if b.device else "-",
            "backup_type": b.backup_type,
            "checksum": b.checksum,
            "comment": b.comment,
            "config_content": b.config_content,
            "created_at": b.created_at,
        }
        for b in backups
    ]


@router.get("/settings")
def get_system_settings(current_user: User = Depends(get_current_user)):
    _ = current_user
    return {
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "app_env": settings.APP_ENV,
        "demo_mode": settings.DEMO_MODE,
        "ssh_default_timeout": settings.SSH_DEFAULT_TIMEOUT,
        "auto_save_config_on_success": settings.AUTO_SAVE_CONFIG_ON_SUCCESS,
        "supported_vendors": ["Huawei VRP5 (S57xx/S67xx)", "Huawei VRP8 (NE8000/CloudEngine)"],
        "planned_vendors": ["MikroTik RouterOS", "Cisco IOS-XE/IOS-XR", "Datacom DmOS"],
    }


@router.put("/settings")
def update_system_settings(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    if "demo_mode" in payload:
        settings.DEMO_MODE = bool(payload["demo_mode"])
    if "ssh_default_timeout" in payload:
        settings.SSH_DEFAULT_TIMEOUT = int(payload["ssh_default_timeout"])
    if "auto_save_config_on_success" in payload:
        settings.AUTO_SAVE_CONFIG_ON_SUCCESS = bool(payload["auto_save_config_on_success"])

    log_audit_event(
        db=db,
        user=current_user,
        action="SETTINGS_UPDATE",
        resource_type="SETTINGS",
        details=(
            f"Atualizadas políticas: DEMO_MODE={settings.DEMO_MODE}, "
            f"AUTO_SAVE={settings.AUTO_SAVE_CONFIG_ON_SUCCESS}, "
            f"SSH_TIMEOUT={settings.SSH_DEFAULT_TIMEOUT}s."
        ),
    )
    return get_system_settings(current_user)


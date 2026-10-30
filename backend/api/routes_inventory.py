from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.entities import (
    User,
    Pop,
    Customer,
    Device,
    DeviceCredential,
    Interface,
    Vlan,
    Vlanif,
    StaticRoute,
    ProvisioningJob,
    AuditLog,
    ConfigurationBackup,
)
from backend.schemas.api_schemas import (
    PopCreate,
    PopUpdate,
    PopOut,
    CustomerCreate,
    CustomerUpdate,
    CustomerOut,
    PortBindVlanRequest,
    DeviceCreate,
    DeviceUpdate,
    DeviceOut,
    InterfaceOut,
    VlanCreate,
    VlanOut,
    VlanifCreate,
    VlanifOut,
    StaticRouteCreate,
    StaticRouteUpdate,
    StaticRouteOut,
    AnalyzedVlanPortItem,
    AnalyzedVlanIpItem,
    AnalyzedVlanItem,
    SwitchVlanAnalysisResponse,
    ImportedTableRecord,
    SwitchImportResponse,
    SwitchBackupTxtResponse,
    SystemBackupResponse,
)
from backend.security.auth import get_current_user, require_roles, verify_pop_access
from backend.security.crypto import encrypt_secret
from backend.drivers.huawei.vrp_driver import (
    HuaweiVRPDriver,
    HuaweiSSHDriverError,
    HUAWEI_DISCOVERY_COMMANDS,
)
from backend.drivers.huawei.validator import (
    cidr_to_netmask,
    validate_static_route_item,
)
from backend.drivers.huawei.command_generator import (
    format_static_route_command,
    format_undo_static_route_command,
)
from backend.services.audit_service import log_audit_event

router = APIRouter(tags=["Inventário, POPs, Equipamentos e Rotas"])


def _serialize_pop(pop: Pop) -> PopOut:
    devices = pop.devices or []
    online_count = sum(1 for d in devices if d.status == "ONLINE")
    return PopOut(
        id=pop.id,
        name=pop.name,
        city=pop.city,
        state=pop.state,
        address=pop.address,
        description=pop.description,
        status=pop.status,
        device_count=len(devices),
        online_devices=online_count,
        created_at=pop.created_at,
    )


def _serialize_device(dev: Device) -> DeviceOut:
    ifaces = dev.interfaces or []
    up_ifaces = sum(1 for i in ifaces if i.physical_status == "UP")
    return DeviceOut(
        id=dev.id,
        name=dev.name,
        pop_id=dev.pop_id,
        pop_name=dev.pop.name if dev.pop else None,
        vendor=dev.vendor,
        model=dev.model,
        management_ip=dev.management_ip,
        ssh_port=dev.ssh_port,
        ssh_username=dev.credential.ssh_username if dev.credential else "admin",
        has_credentials=bool(dev.credential),
        auth_method=dev.credential.auth_method if dev.credential else "password",
        system_version=dev.system_version,
        description=dev.description,
        status=dev.status,
        supports_l3_routing=dev.supports_l3_routing,
        supports_vrf=dev.supports_vrf,
        supports_two_phase_commit=dev.supports_two_phase_commit,
        supports_ipv6=dev.supports_ipv6,
        is_simulated=dev.is_simulated,
        interface_count=len(ifaces),
        up_interfaces=up_ifaces,
        vlan_count=len(dev.vlans or []),
        vlanif_count=len(dev.vlanifs or []),
        route_count=len(dev.static_routes or []),
        last_synced_at=dev.last_synced_at,
        created_at=dev.created_at,
    )


# --- Dashboard Summary ---
@router.get("/dashboard/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    pops = db.query(Pop).all()
    devices = db.query(Device).all()
    interfaces = db.query(Interface).all()
    vlans = db.query(Vlan).all()
    vlanifs = db.query(Vlanif).all()
    routes = db.query(StaticRoute).all()
    jobs = db.query(ProvisioningJob).order_by(ProvisioningJob.created_at.desc()).limit(10).all()
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(12).all()

    online_devices = sum(1 for d in devices if d.status == "ONLINE")
    offline_devices = sum(1 for d in devices if d.status != "ONLINE")
    up_interfaces = sum(1 for i in interfaces if i.physical_status == "UP")
    error_interfaces = sum(1 for i in interfaces if i.physical_status in ("ERROR", "ALERT"))
    static_routes_count = sum(1 for r in routes if r.protocol == "Static")
    failed_jobs = db.query(ProvisioningJob).filter(ProvisioningJob.status == "FAILED").count()
    completed_jobs = db.query(ProvisioningJob).filter(ProvisioningJob.status == "COMPLETED").count()

    pop_distribution = [
        {
            "pop_name": p.name,
            "city": p.city,
            "devices": len(p.devices),
            "interfaces": sum(len(d.interfaces) for d in p.devices),
            "vlans": sum(len(d.vlans) for d in p.devices),
        }
        for p in pops
    ]

    return {
        "demo_mode": settings.DEMO_MODE,
        "metrics": {
            "total_pops": len(pops),
            "online_devices": online_devices,
            "offline_devices": offline_devices,
            "total_devices": len(devices),
            "total_interfaces": len(interfaces),
            "up_interfaces": up_interfaces,
            "error_interfaces": error_interfaces,
            "total_vlans": len(vlans),
            "total_vlanifs": len(vlanifs),
            "static_routes": static_routes_count,
            "total_routes": len(routes),
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
        },
        "pop_distribution": pop_distribution,
        "recent_jobs": [
            {
                "id": j.id,
                "device_name": j.device.name if j.device else "-",
                "interface_name": j.interface_name,
                "vlan_id": j.vlan_id,
                "vlan_description": j.vlan_description,
                "port_mode": j.port_mode,
                "create_vlanif": j.create_vlanif,
                "vlanif_ipv4": j.vlanif_ipv4,
                "create_static_routes": j.create_static_routes,
                "status": j.status,
                "is_simulated": j.is_simulated,
                "username": j.user.username if j.user else "admin",
                "created_at": j.created_at,
            }
            for j in jobs
        ],
        "recent_activities": [
            {
                "id": l.id,
                "username": l.username,
                "action": l.action,
                "resource_type": l.resource_type,
                "device_name": l.device_name,
                "pop_name": l.pop_name,
                "status": l.status,
                "details": l.details,
                "is_simulated": l.is_simulated,
                "created_at": l.created_at,
            }
            for l in logs
        ],
    }


# --- POPs CRUD (Admin & Supervisor) ---
@router.get("/pops", response_model=List[PopOut])
def list_pops(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    pops = db.query(Pop).order_by(Pop.name).all()
    return [_serialize_pop(p) for p in pops]


@router.post("/pops", response_model=PopOut, status_code=status.HTTP_201_CREATED)
def create_pop(
    payload: PopCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    if db.query(Pop).filter(Pop.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="Já existe um POP com este nome.")

    pop = Pop(
        name=payload.name.strip(),
        city=payload.city.strip(),
        state=payload.state.strip().upper(),
        address=payload.address,
        description=payload.description,
        status=payload.status,
    )
    db.add(pop)
    db.commit()
    db.refresh(pop)

    log_audit_event(
        db=db,
        user=current_user,
        action="POP_CREATE",
        resource_type="POP",
        resource_id=str(pop.id),
        pop_name=pop.name,
        details=f"Cadastrado POP {pop.name} ({pop.city}/{pop.state}).",
    )
    return _serialize_pop(pop)


@router.put("/pops/{pop_id}", response_model=PopOut)
def update_pop(
    pop_id: int,
    payload: PopUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    pop = db.query(Pop).filter(Pop.id == pop_id).first()
    if not pop:
        raise HTTPException(status_code=404, detail="POP não encontrado.")

    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(pop, field, val)

    db.commit()
    db.refresh(pop)

    log_audit_event(
        db=db,
        user=current_user,
        action="POP_UPDATE",
        resource_type="POP",
        resource_id=str(pop.id),
        pop_name=pop.name,
        details=f"Atualizado cadastro do POP {pop.name}.",
    )
    return _serialize_pop(pop)


@router.delete("/pops/{pop_id}")
def delete_pop(
    pop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    pop = db.query(Pop).filter(Pop.id == pop_id).first()
    if not pop:
        raise HTTPException(status_code=404, detail="POP não encontrado.")
    if pop.devices:
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível remover o POP '{pop.name}' pois há {len(pop.devices)} equipamento(s) associado(s).",
        )
    pop_name = pop.name
    db.delete(pop)
    db.commit()

    log_audit_event(
        db=db,
        user=current_user,
        action="POP_DELETE",
        resource_type="POP",
        resource_id=str(pop_id),
        pop_name=pop_name,
        details=f"Removido POP {pop_name}.",
    )
    return {"deleted": True, "id": pop_id}


# --- Customers CRUD (Admin & Supervisor Cadastram; Operador Consulta/Atrela) ---
def _serialize_customer(c: Customer) -> CustomerOut:
    return CustomerOut(
        id=c.id,
        name=c.name,
        code=c.code,
        document=c.document,
        contact_name=c.contact_name,
        contact_phone=c.contact_phone,
        contact_email=c.contact_email,
        pop_id=c.pop_id,
        pop_name=c.pop.name if c.pop else None,
        device_id=c.device_id,
        device_name=c.device.name if c.device else None,
        interface_name=c.interface_name,
        vlan_id=c.vlan_id,
        vlanif_ip=c.vlanif_ip,
        routed_block=c.routed_block,
        status=c.status,
        notes=c.notes,
        created_at=c.created_at,
    )


@router.get("/customers", response_model=List[CustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    customers = db.query(Customer).order_by(Customer.id.desc()).all()
    return [_serialize_customer(c) for c in customers]


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    if db.query(Customer).filter(Customer.code == payload.code.strip()).first():
        raise HTTPException(status_code=400, detail="Já existe um cliente com este código/contrato.")

    c = Customer(
        name=payload.name.strip().upper(),
        code=payload.code.strip().upper(),
        document=payload.document,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        contact_email=payload.contact_email,
        pop_id=payload.pop_id,
        device_id=payload.device_id,
        interface_name=payload.interface_name,
        vlan_id=payload.vlan_id,
        vlanif_ip=payload.vlanif_ip,
        routed_block=payload.routed_block,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    log_audit_event(
        db=db,
        user=current_user,
        action="CUSTOMER_CREATE",
        resource_type="CUSTOMER",
        resource_id=str(c.id),
        details=f"Cadastrado cliente {c.name} ({c.code}) - VLAN {c.vlan_id or 'N/A'}.",
    )
    return _serialize_customer(c)


@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor", "operador")),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)

    db.commit()
    db.refresh(c)

    log_audit_event(
        db=db,
        user=current_user,
        action="CUSTOMER_UPDATE",
        resource_type="CUSTOMER",
        resource_id=str(c.id),
        details=f"Atualizado cadastro do cliente {c.name} ({c.code}).",
    )
    return _serialize_customer(c)


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    cname = c.name
    db.delete(c)
    db.commit()

    log_audit_event(
        db=db,
        user=current_user,
        action="CUSTOMER_DELETE",
        resource_type="CUSTOMER",
        resource_id=str(customer_id),
        details=f"Removido cliente {cname}.",
    )
    return {"deleted": True, "id": customer_id}


# --- Devices CRUD & SSH Actions ---
@router.get("/devices", response_model=List[DeviceOut])
def list_devices(
    pop_id: Optional[int] = Query(default=None),
    l3_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(Device)
    if pop_id is not None:
        q = q.filter(Device.pop_id == pop_id)
    if l3_only:
        q = q.filter(Device.supports_l3_routing.is_(True))
    devices = q.order_by(Device.name).all()
    return [_serialize_device(d) for d in devices]


@router.get("/devices/{device_id}", response_model=DeviceOut)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    return _serialize_device(dev)


@router.post("/devices", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor", "engineer")),
):
    verify_pop_access(current_user, payload.pop_id)
    if db.query(Device).filter(Device.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="Já existe um equipamento com este nome.")
    if db.query(Device).filter(Device.management_ip == payload.management_ip.strip()).first():
        raise HTTPException(status_code=400, detail="Já existe um equipamento com este endereço IP.")

    pop = db.query(Pop).filter(Pop.id == payload.pop_id).first()
    if not pop:
        raise HTTPException(status_code=404, detail="POP selecionado não existe.")

    dev = Device(
        name=payload.name.strip(),
        pop_id=payload.pop_id,
        vendor=payload.vendor.strip(),
        model=payload.model.strip(),
        management_ip=payload.management_ip.strip(),
        ssh_port=payload.ssh_port,
        system_version=payload.system_version or "VRP V200R021C00SPC100",
        description=payload.description,
        status="ONLINE",
        supports_l3_routing=payload.supports_l3_routing,
        supports_vrf=payload.supports_vrf,
        supports_two_phase_commit=payload.supports_two_phase_commit,
        is_simulated=payload.is_simulated,
        last_synced_at=None,
    )
    db.add(dev)
    db.flush()

    cred = DeviceCredential(
        device_id=dev.id,
        ssh_username=payload.ssh_username.strip(),
        encrypted_password=encrypt_secret(payload.ssh_password or "Huawei@2026"),
        encrypted_private_key=encrypt_secret(payload.ssh_private_key),
        auth_method="private_key" if payload.ssh_private_key else "password",
    )
    db.add(cred)

    # Seed initial 24 interfaces for new simulated switch so its visual port map is immediately usable
    if dev.is_simulated:
        for idx in range(1, 25):
            iname = f"XGigabitEthernet0/0/{idx}"
            sname = f"XGE0/0/{idx}"
            cfg = f"interface {iname}\n description PORTA-{idx:02d}\n port link-type access\n port default vlan 1\nquit"
            db.add(
                Interface(
                    device_id=dev.id,
                    port_index=idx,
                    name=iname,
                    short_name=sname,
                    description=f"PORTA-{idx:02d}",
                    admin_status="UP",
                    physical_status="UP" if idx <= 4 else "DOWN",
                    speed="10G",
                    duplex="Full",
                    mtu=1500,
                    link_type="access",
                    pvid=1,
                    allowed_vlans="1",
                    rx_rate_mbps="10.00 Mbps" if idx <= 4 else "0.00 Mbps",
                    tx_rate_mbps="8.50 Mbps" if idx <= 4 else "0.00 Mbps",
                    discovered_config=cfg,
                    desired_config=cfg,
                    last_known_config=cfg,
                )
            )
        db.add(
            Vlan(
                device_id=dev.id,
                vlan_id=1,
                name="VLAN-DEFAULT",
                description="VLAN Nativa Padrão",
                discovered_config="vlan 1\nquit",
            )
        )

    db.commit()
    db.refresh(dev)

    log_audit_event(
        db=db,
        user=current_user,
        action="DEVICE_CREATE",
        resource_type="DEVICE",
        resource_id=str(dev.id),
        device_name=dev.name,
        pop_name=pop.name,
        details=f"Cadastrado equipamento {dev.vendor} {dev.model} ({dev.management_ip}). Credenciais criptografadas em repouso.",
        is_simulated=dev.is_simulated,
    )
    return _serialize_device(dev)


@router.put("/devices/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor", "engineer")),
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    verify_pop_access(current_user, dev.pop_id)

    update_data = payload.model_dump(exclude_unset=True)
    ssh_user = update_data.pop("ssh_username", None)
    ssh_pass = update_data.pop("ssh_password", None)
    ssh_key = update_data.pop("ssh_private_key", None)

    for k, v in update_data.items():
        if v is not None:
            setattr(dev, k, v)

    if dev.credential:
        if ssh_user:
            dev.credential.ssh_username = ssh_user.strip()
        if ssh_pass:
            dev.credential.encrypted_password = encrypt_secret(ssh_pass)
        if ssh_key:
            dev.credential.encrypted_private_key = encrypt_secret(ssh_key)
            dev.credential.auth_method = "private_key"

    db.commit()
    db.refresh(dev)

    log_audit_event(
        db=db,
        user=current_user,
        action="DEVICE_UPDATE",
        resource_type="DEVICE",
        resource_id=str(dev.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Atualizadas configurações cadastrais do equipamento {dev.name}.",
        is_simulated=dev.is_simulated,
    )
    return _serialize_device(dev)


@router.delete("/devices/{device_id}")
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    dev_name = dev.name
    pop_name = dev.pop.name if dev.pop else None
    db.delete(dev)
    db.commit()

    log_audit_event(
        db=db,
        user=current_user,
        action="DEVICE_DELETE",
        resource_type="DEVICE",
        resource_id=str(device_id),
        device_name=dev_name,
        pop_name=pop_name,
        details=f"Equipamento {dev_name} removido do inventário.",
    )
    return {"deleted": True, "id": device_id}


# --- 5 Huawei Device SSH Actions (Section 4) ---
@router.post("/devices/{device_id}/test-connection")
def test_device_connection(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")

    driver = HuaweiVRPDriver(dev)
    try:
        res = driver.test_connectivity()
    except HuaweiSSHDriverError as exc:
        log_audit_event(
            db=db,
            user=current_user,
            action="SSH_TEST_FAILED",
            resource_type="DEVICE",
            resource_id=str(dev.id),
            device_name=dev.name,
            status="FAILED",
            details=str(exc),
            is_simulated=dev.is_simulated,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    log_audit_event(
        db=db,
        user=current_user,
        action="SSH_TEST_OK",
        resource_type="DEVICE",
        resource_id=str(dev.id),
        device_name=dev.name,
        details=f"Conectividade SSH validada ({res['latency_ms']} ms).",
        is_simulated=bool(res["is_simulated"]),
    )
    return {
        "device_id": dev.id,
        "device_name": dev.name,
        "management_ip": dev.management_ip,
        "ssh_port": dev.ssh_port,
        **res,
    }


@router.post("/devices/{device_id}/connect")
def connect_and_discover_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes Huawei VRP discovery commands compatible with the device's model and capabilities,
    handling incompatible commands gracefully (e.g., L3 routing commands on L2-only switches).
    """
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")

    driver = HuaweiVRPDriver(dev)
    command_outputs = []
    for cmd in HUAWEI_DISCOVERY_COMMANDS:
        try:
            out = driver.generate_display_output(cmd, db=db)
            command_outputs.append(
                {
                    "command": cmd,
                    "status": "SUCCESS",
                    "output": out,
                }
            )
        except HuaweiSSHDriverError as exc:
            command_outputs.append(
                {
                    "command": cmd,
                    "status": "INCOMPATIBLE_OR_SKIPPED",
                    "output": str(exc),
                }
            )

    return {
        "device_id": dev.id,
        "device_name": dev.name,
        "model": dev.model,
        "system_version": dev.system_version,
        "is_simulated": driver.is_simulated,
        "capabilities": {
            "supports_l3_routing": dev.supports_l3_routing,
            "supports_vrf": dev.supports_vrf,
            "supports_two_phase_commit": dev.supports_two_phase_commit,
            "supports_ipv6": dev.supports_ipv6,
        },
        "discovery_results": command_outputs,
    }


@router.post("/devices/{device_id}/sync")
def sync_device_information(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor", "operador", "engineer")),
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    verify_pop_access(current_user, dev.pop_id)

    driver = HuaweiVRPDriver(dev)
    backup = driver.create_configuration_backup(
        db=db,
        user_id=current_user.id,
        backup_type="MANUAL_SYNC",
        comment=f"Sincronização completa disparada por {current_user.username}",
    )
    dev.last_synced_at = datetime.now(timezone.utc)
    dev.status = "ONLINE"
    db.commit()
    db.refresh(dev)

    log_audit_event(
        db=db,
        user=current_user,
        action="SYNC_DEVICE",
        resource_type="DEVICE",
        resource_id=str(dev.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=(
            f"Sincronizadas {len(dev.interfaces)} interfaces, {len(dev.vlans)} VLANs, "
            f"{len(dev.vlanifs)} Vlanifs e {len(dev.static_routes)} rotas (Backup #{backup.id})."
        ),
        is_simulated=driver.is_simulated,
    )
    return {
        "synced": True,
        "device": _serialize_device(dev),
        "backup_id": backup.id,
        "is_simulated": driver.is_simulated,
    }


@router.get("/devices/{device_id}/configuration")
def get_device_configuration(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")

    driver = HuaweiVRPDriver(dev)
    live_config = driver.build_full_current_configuration()
    backups = (
        db.query(ConfigurationBackup)
        .filter(ConfigurationBackup.device_id == dev.id)
        .order_by(ConfigurationBackup.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "device_id": dev.id,
        "device_name": dev.name,
        "model": dev.model,
        "system_version": dev.system_version,
        "is_simulated": driver.is_simulated,
        "discovered_config": dev.discovered_config or live_config,
        "desired_config": dev.desired_config or live_config,
        "last_known_config": dev.last_known_config or live_config,
        "backups": [
            {
                "id": b.id,
                "backup_type": b.backup_type,
                "checksum": b.checksum,
                "comment": b.comment,
                "created_at": b.created_at,
                "config_content": b.config_content,
            }
            for b in backups
        ],
    }


@router.get("/devices/{device_id}/interfaces", response_model=List[InterfaceOut])
def list_device_interfaces(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    ifaces = (
        db.query(Interface)
        .filter(Interface.device_id == device_id)
        .order_by(Interface.port_index)
        .all()
    )
    return [
        InterfaceOut(
            **{
                col.name: getattr(i, col.name)
                for col in Interface.__table__.columns
            },
            device_name=dev.name,
        )
        for i in ifaces
    ]


@router.get("/interfaces", response_model=List[InterfaceOut])
def list_all_interfaces(
    device_id: Optional[int] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(Interface)
    if device_id is not None:
        q = q.filter(Interface.device_id == device_id)
    if status_filter:
        q = q.filter(Interface.physical_status == status_filter.upper())
    ifaces = q.order_by(Interface.device_id, Interface.port_index).all()
    return [
        InterfaceOut(
            **{
                col.name: getattr(i, col.name)
                for col in Interface.__table__.columns
            },
            device_name=i.device.name if i.device else None,
        )
        for i in ifaces
    ]


@router.post("/interfaces/{interface_id}/bind-vlan", response_model=InterfaceOut)
def bind_vlan_and_customer_to_port(
    interface_id: int,
    payload: PortBindVlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    """Permite ao Operador (e Admin) atrelar um Cliente e uma VLAN diretamente na porta física."""
    iface = db.query(Interface).filter(Interface.id == interface_id).first()
    if not iface:
        raise HTTPException(status_code=404, detail="Interface não encontrada.")
    dev = iface.device
    verify_pop_access(current_user, dev.pop_id)

    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()

    port_desc = (
        payload.description
        or (f"{customer.name}-{customer.code}" if customer else f"VLAN-{payload.vlan_id}")
    )
    mode = payload.port_mode.lower().strip()

    # Ensure VLAN exists on switch
    existing_vlan = (
        db.query(Vlan)
        .filter(Vlan.device_id == dev.id, Vlan.vlan_id == payload.vlan_id)
        .first()
    )
    cmds = []
    if not existing_vlan:
        cmds.extend([f"vlan {payload.vlan_id}", f" description {port_desc}", "quit"])
        vcfg = f"vlan {payload.vlan_id}\n description {port_desc}\nquit"
        db.add(
            Vlan(
                device_id=dev.id,
                vlan_id=payload.vlan_id,
                name=port_desc,
                description=port_desc,
                tagged_ports=iface.short_name if mode != "access" else "",
                untagged_ports=iface.short_name if mode == "access" else "",
                discovered_config=vcfg,
                desired_config=vcfg,
                last_known_config=vcfg,
            )
        )

    cmds.append(f"interface {iface.name}")
    cmds.append(f" description {port_desc}")
    if mode == "access":
        cmds.append(" port link-type access")
        cmds.append(f" port default vlan {payload.vlan_id}")
        iface.link_type = "access"
        iface.pvid = payload.vlan_id
        iface.allowed_vlans = str(payload.vlan_id)
    elif mode == "trunk":
        cmds.append(" port link-type trunk")
        cmds.append(f" port trunk allow-pass vlan {payload.vlan_id}")
        iface.link_type = "trunk"
        ex_list = [v.strip() for v in iface.allowed_vlans.split(",") if v.strip()] if payload.preserve_existing_vlans else []
        if str(payload.vlan_id) not in ex_list:
            ex_list.append(str(payload.vlan_id))
        iface.allowed_vlans = ",".join(ex_list)
    else:
        cmds.append(" port link-type hybrid")
        cmds.append(f" port hybrid tagged vlan {payload.vlan_id}")
        iface.link_type = "hybrid"
        ex_list = [v.strip() for v in iface.allowed_vlans.split(",") if v.strip()] if payload.preserve_existing_vlans else []
        if str(payload.vlan_id) not in ex_list:
            ex_list.append(str(payload.vlan_id))
        iface.allowed_vlans = ",".join(ex_list)
    cmds.append("quit")

    driver = HuaweiVRPDriver(dev)
    driver.execute_commands_sequentially(cmds)

    iface.description = port_desc
    iface_cfg = "\n".join(cmds[-4:])
    iface.discovered_config = iface_cfg
    iface.desired_config = iface_cfg
    iface.last_known_config = iface_cfg

    if customer:
        customer.pop_id = dev.pop_id
        customer.device_id = dev.id
        customer.interface_name = iface.name
        customer.vlan_id = payload.vlan_id
        customer.status = "ATIVO"

    db.commit()
    db.refresh(iface)

    log_audit_event(
        db=db,
        user=current_user,
        action="PORT_BIND_VLAN",
        resource_type="INTERFACE",
        resource_id=str(iface.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Atrelada VLAN {payload.vlan_id} ({mode.upper()}) e descrição '{port_desc}' na porta {iface.name}.",
        is_simulated=driver.is_simulated,
    )
    return InterfaceOut(
        **{col.name: getattr(iface, col.name) for col in Interface.__table__.columns},
        device_name=dev.name,
    )


@router.post("/interfaces/{interface_id}/unbind-vlan", response_model=InterfaceOut)
def unbind_vlan_from_port(
    interface_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    """Remove a VLAN de cliente atrelada à porta e retorna a porta para VLAN 1 (Livre)."""
    iface = db.query(Interface).filter(Interface.id == interface_id).first()
    if not iface:
        raise HTTPException(status_code=404, detail="Interface não encontrada.")
    dev = iface.device
    verify_pop_access(current_user, dev.pop_id)

    cmds = [
        f"interface {iface.name}",
        " undo description",
        " port link-type access",
        " port default vlan 1",
        "quit",
    ]
    driver = HuaweiVRPDriver(dev)
    driver.execute_commands_sequentially(cmds)

    old_vlan = iface.allowed_vlans
    iface.description = ""
    iface.link_type = "access"
    iface.pvid = 1
    iface.allowed_vlans = "1"
    cfg_str = "\n".join(cmds)
    iface.discovered_config = cfg_str
    iface.desired_config = cfg_str
    iface.last_known_config = cfg_str

    db.commit()
    db.refresh(iface)

    log_audit_event(
        db=db,
        user=current_user,
        action="PORT_UNBIND_VLAN",
        resource_type="INTERFACE",
        resource_id=str(iface.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Desatrelada VLAN ({old_vlan}) da porta {iface.name} (retornada para VLAN 1 padrão).",
        is_simulated=driver.is_simulated,
    )
    return InterfaceOut(
        **{col.name: getattr(iface, col.name) for col in Interface.__table__.columns},
        device_name=dev.name,
    )


# --- VLANs (Operador e Admin colocam e removem) ---
@router.get("/vlans", response_model=List[VlanOut])
def list_vlans(
    device_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(Vlan)
    if device_id is not None:
        q = q.filter(Vlan.device_id == device_id)
    vlans = q.order_by(Vlan.device_id, Vlan.vlan_id).all()
    return [
        VlanOut(
            id=v.id,
            device_id=v.device_id,
            device_name=v.device.name if v.device else None,
            pop_name=v.device.pop.name if (v.device and v.device.pop) else None,
            vlan_id=v.vlan_id,
            name=v.name,
            description=v.description,
            vlan_type=v.vlan_type,
            status=v.status,
            tagged_ports=v.tagged_ports,
            untagged_ports=v.untagged_ports,
            discovered_config=v.discovered_config,
            updated_at=v.updated_at,
        )
        for v in vlans
    ]


@router.post("/vlans", response_model=VlanOut, status_code=status.HTTP_201_CREATED)
def create_vlan(
    payload: VlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    dev = db.query(Device).filter(Device.id == payload.device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    verify_pop_access(current_user, dev.pop_id)

    existing = (
        db.query(Vlan)
        .filter(Vlan.device_id == dev.id, Vlan.vlan_id == payload.vlan_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A VLAN {payload.vlan_id} já existe no equipamento {dev.name}.",
        )

    driver = HuaweiVRPDriver(dev)
    cmds = [f"vlan {payload.vlan_id}", f" description {payload.description}", "quit"]
    driver.execute_commands_sequentially(cmds)

    cfg_str = "\n".join(cmds)
    new_vlan = Vlan(
        device_id=dev.id,
        vlan_id=payload.vlan_id,
        name=payload.name or payload.description,
        description=payload.description,
        discovered_config=cfg_str,
        desired_config=cfg_str,
        last_known_config=cfg_str,
    )
    db.add(new_vlan)
    db.commit()
    db.refresh(new_vlan)

    log_audit_event(
        db=db,
        user=current_user,
        action="VLAN_CREATE",
        resource_type="VLAN",
        resource_id=str(new_vlan.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Criada VLAN {new_vlan.vlan_id} ({new_vlan.description}) em {dev.name}.",
        is_simulated=driver.is_simulated,
    )
    return VlanOut(
        id=new_vlan.id,
        device_id=new_vlan.device_id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        vlan_id=new_vlan.vlan_id,
        name=new_vlan.name,
        description=new_vlan.description,
        vlan_type=new_vlan.vlan_type,
        status=new_vlan.status,
        tagged_ports=new_vlan.tagged_ports,
        untagged_ports=new_vlan.untagged_ports,
        discovered_config=new_vlan.discovered_config,
        updated_at=new_vlan.updated_at,
    )


@router.delete("/vlans/{vlan_db_id}")
def delete_vlan(
    vlan_db_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    vlan_obj = db.query(Vlan).filter(Vlan.id == vlan_db_id).first()
    if not vlan_obj:
        raise HTTPException(status_code=404, detail="VLAN não encontrada.")
    if vlan_obj.vlan_id == 1:
        raise HTTPException(status_code=400, detail="A VLAN 1 padrão nativa não pode ser removida.")

    dev = vlan_obj.device
    verify_pop_access(current_user, dev.pop_id)

    undo_cmd = f"undo vlan {vlan_obj.vlan_id}"
    driver = HuaweiVRPDriver(dev)
    driver.execute_commands_sequentially([undo_cmd])

    vid = vlan_obj.vlan_id
    vdesc = vlan_obj.description
    db.delete(vlan_obj)
    db.commit()

    log_audit_event(
        db=db,
        user=current_user,
        action="VLAN_DELETE",
        resource_type="VLAN",
        resource_id=str(vlan_db_id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Removida VLAN {vid} ({vdesc}) via '{undo_cmd}' em {dev.name}.",
        is_simulated=driver.is_simulated,
    )
    return {"deleted": True, "id": vlan_db_id, "undo_command": undo_cmd}


# --- Vlanifs / IPs (Operador e Admin colocam e removem) ---
@router.get("/vlanifs", response_model=List[VlanifOut])
def list_vlanifs(
    device_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(Vlanif)
    if device_id is not None:
        q = q.filter(Vlanif.device_id == device_id)
    vlanifs = q.order_by(Vlanif.device_id, Vlanif.vlan_id).all()
    return [
        VlanifOut(
            id=v.id,
            device_id=v.device_id,
            device_name=v.device.name if v.device else None,
            pop_name=v.device.pop.name if (v.device and v.device.pop) else None,
            vlan_id=v.vlan_id,
            interface_name=v.interface_name,
            description=v.description,
            ip_address=v.ip_address,
            subnet_mask=v.subnet_mask,
            cidr_prefix=v.cidr_prefix,
            ipv6_address=v.ipv6_address,
            admin_status=v.admin_status,
            protocol_status=v.protocol_status,
            vrf_name=v.vrf_name,
            discovered_config=v.discovered_config,
            updated_at=v.updated_at,
        )
        for v in vlanifs
    ]


@router.post("/vlanifs", response_model=VlanifOut, status_code=status.HTTP_201_CREATED)
def create_vlanif(
    payload: VlanifCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    dev = db.query(Device).filter(Device.id == payload.device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    if not dev.supports_l3_routing:
        raise HTTPException(
            status_code=400,
            detail=f"O equipamento {dev.name} é Layer 2 puro e não suporta interfaces Vlanif.",
        )
    verify_pop_access(current_user, dev.pop_id)

    existing = (
        db.query(Vlanif)
        .filter(Vlanif.device_id == dev.id, Vlanif.vlan_id == payload.vlan_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A interface Vlanif{payload.vlan_id} já existe em {dev.name}.",
        )

    mask = cidr_to_netmask(payload.cidr_prefix)
    desc = payload.description or f"GATEWAY-VLAN-{payload.vlan_id}"
    cmds = [
        f"interface Vlanif{payload.vlan_id}",
        f" description {desc}",
        f" ip address {payload.ip_address} {mask}",
        "quit",
    ]
    driver = HuaweiVRPDriver(dev)
    driver.execute_commands_sequentially(cmds)

    cfg_str = "\n".join(cmds)
    vif = Vlanif(
        device_id=dev.id,
        vlan_id=payload.vlan_id,
        interface_name=f"Vlanif{payload.vlan_id}",
        description=desc,
        ip_address=payload.ip_address,
        subnet_mask=mask,
        cidr_prefix=payload.cidr_prefix,
        ipv6_address=payload.ipv6_address,
        vrf_name=payload.vrf_name,
        discovered_config=cfg_str,
        desired_config=cfg_str,
        last_known_config=cfg_str,
    )
    db.add(vif)
    db.commit()
    db.refresh(vif)

    log_audit_event(
        db=db,
        user=current_user,
        action="VLANIF_CREATE",
        resource_type="VLANIF",
        resource_id=str(vif.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Criada {vif.interface_name} ({vif.ip_address}/{vif.cidr_prefix}) em {dev.name}.",
        is_simulated=driver.is_simulated,
    )
    return VlanifOut(
        id=vif.id,
        device_id=vif.device_id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        vlan_id=vif.vlan_id,
        interface_name=vif.interface_name,
        description=vif.description,
        ip_address=vif.ip_address,
        subnet_mask=vif.subnet_mask,
        cidr_prefix=vif.cidr_prefix,
        ipv6_address=vif.ipv6_address,
        admin_status=vif.admin_status,
        protocol_status=vif.protocol_status,
        vrf_name=vif.vrf_name,
        discovered_config=vif.discovered_config,
        updated_at=vif.updated_at,
    )


@router.delete("/vlanifs/{vlanif_db_id}")
def delete_vlanif(
    vlanif_db_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    vif = db.query(Vlanif).filter(Vlanif.id == vlanif_db_id).first()
    if not vif:
        raise HTTPException(status_code=404, detail="Interface Vlanif não encontrada.")
    dev = vif.device
    verify_pop_access(current_user, dev.pop_id)

    undo_cmd = f"undo interface {vif.interface_name}"
    driver = HuaweiVRPDriver(dev)
    driver.execute_commands_sequentially([undo_cmd])

    iname = vif.interface_name
    ip_str = f"{vif.ip_address}/{vif.cidr_prefix}"
    db.delete(vif)
    db.commit()

    log_audit_event(
        db=db,
        user=current_user,
        action="VLANIF_DELETE",
        resource_type="VLANIF",
        resource_id=str(vlanif_db_id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Removido IP/Interface {iname} ({ip_str}) via '{undo_cmd}' em {dev.name}.",
        is_simulated=driver.is_simulated,
    )
    return {"deleted": True, "id": vlanif_db_id, "undo_command": undo_cmd}


# --- Static & Dynamic Routes Management (Section 9) ---
@router.get("/routes", response_model=List[StaticRouteOut])
def list_routes(
    device_id: Optional[int] = Query(default=None),
    destination: Optional[str] = Query(default=None),
    next_hop: Optional[str] = Query(default=None),
    protocol: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    q = db.query(StaticRoute)
    if device_id is not None:
        q = q.filter(StaticRoute.device_id == device_id)
    if destination:
        q = q.filter(StaticRoute.destination_network.contains(destination.strip()))
    if next_hop:
        q = q.filter(StaticRoute.next_hop.contains(next_hop.strip()))
    if protocol:
        q = q.filter(StaticRoute.protocol == protocol)

    routes = q.order_by(StaticRoute.device_id, StaticRoute.destination_network).all()
    return [
        StaticRouteOut(
            id=r.id,
            device_id=r.device_id,
            device_name=r.device.name if r.device else None,
            pop_name=r.device.pop.name if (r.device and r.device.pop) else None,
            ip_version=r.ip_version,
            destination_network=r.destination_network,
            cidr_prefix=r.cidr_prefix,
            subnet_mask=r.subnet_mask,
            next_hop=r.next_hop,
            preference=r.preference,
            description=r.description,
            vrf_name=r.vrf_name,
            protocol=r.protocol,
            is_active=r.is_active,
            discovered_config=r.discovered_config,
            created_at=r.created_at,
        )
        for r in routes
    ]


@router.get("/devices/{device_id}/route-static-cli")
def query_device_static_routes_cli(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes 'dis cu | include route-static' on the selected Huawei Switch and returns
    the raw CLI output alongside the static routes configured on that switch.
    """
    _ = current_user
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")

    driver = HuaweiVRPDriver(dev)
    cli_command = "dis cu | include route-static"
    try:
        raw_lines_str = driver.generate_display_output(cli_command, db=db)
    except HuaweiSSHDriverError as exc:
        raw_lines_str = f"! Erro ao consultar '{cli_command}' em {dev.name}: {exc}"

    static_routes_db = (
        db.query(StaticRoute)
        .filter(StaticRoute.device_id == dev.id, StaticRoute.protocol == "Static")
        .order_by(StaticRoute.destination_network)
        .all()
    )

    cli_lines = [line.strip() for line in (raw_lines_str or "").splitlines() if line.strip()]
    terminal_banner = (
        f"<{dev.name}> {cli_command}\n"
        + ("\n".join(cli_lines) if cli_lines else "! Nenhuma rota estática configurada (ip route-static) neste switch.")
    )

    return {
        "device_id": dev.id,
        "device_name": dev.name,
        "pop_id": dev.pop_id,
        "pop_name": dev.pop.name if dev.pop else "-",
        "management_ip": dev.management_ip,
        "model": dev.model,
        "status": dev.status,
        "supports_l3_routing": dev.supports_l3_routing,
        "command": cli_command,
        "raw_cli_output": terminal_banner,
        "cli_lines": cli_lines,
        "total_static_routes": len(static_routes_db),
        "static_routes": [
            StaticRouteOut(
                id=r.id,
                device_id=r.device_id,
                device_name=dev.name,
                pop_name=dev.pop.name if dev.pop else None,
                ip_version=r.ip_version,
                destination_network=r.destination_network,
                cidr_prefix=r.cidr_prefix,
                subnet_mask=r.subnet_mask,
                next_hop=r.next_hop,
                preference=r.preference,
                description=r.description,
                vrf_name=r.vrf_name,
                protocol=r.protocol,
                is_active=r.is_active,
                discovered_config=r.discovered_config,
                created_at=r.created_at,
            )
            for r in static_routes_db
        ],
    }


@router.post("/routes", response_model=StaticRouteOut, status_code=status.HTTP_201_CREATED)
def create_static_route(
    payload: StaticRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    dev = db.query(Device).filter(Device.id == payload.device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")
    verify_pop_access(current_user, dev.pop_id)

    issues = validate_static_route_item(
        route=payload,
        l3_device=dev,
        existing_routes=dev.static_routes,
        existing_vlanifs=dev.vlanifs,
    )
    blocking_errors = [i for i in issues if i.severity == "ERROR"]
    if blocking_errors:
        raise HTTPException(
            status_code=400,
            detail=blocking_errors[0].message,
        )

    cli_cmd = format_static_route_command(payload)
    driver = HuaweiVRPDriver(dev)
    driver.create_configuration_backup(
        db=db,
        user_id=current_user.id,
        backup_type="PRE_ROUTE_CHANGE",
        comment=f"Backup antes de adicionar rota {payload.destination_network}/{payload.cidr_prefix}",
    )
    driver.execute_commands_sequentially([cli_cmd])

    mask = (
        payload.subnet_mask
        if payload.subnet_mask
        else (cidr_to_netmask(payload.cidr_prefix) if payload.ip_version == 4 else f"/{payload.cidr_prefix}")
    )
    new_route = StaticRoute(
        device_id=dev.id,
        ip_version=payload.ip_version,
        destination_network=payload.destination_network.strip(),
        cidr_prefix=payload.cidr_prefix,
        subnet_mask=mask,
        next_hop=payload.next_hop.strip(),
        preference=payload.preference,
        description=payload.description,
        vrf_name=payload.vrf_name,
        protocol="Static",
        is_active=True,
        discovered_config=cli_cmd,
        desired_config=cli_cmd,
        last_known_config=cli_cmd,
    )
    db.add(new_route)
    db.commit()
    db.refresh(new_route)

    log_audit_event(
        db=db,
        user=current_user,
        action="STATIC_ROUTE_ADD",
        resource_type="STATIC_ROUTE",
        resource_id=str(new_route.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Aplicado comando '{cli_cmd}' via SSH em {dev.name}.",
        is_simulated=driver.is_simulated,
    )
    return StaticRouteOut(
        id=new_route.id,
        device_id=new_route.device_id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        ip_version=new_route.ip_version,
        destination_network=new_route.destination_network,
        cidr_prefix=new_route.cidr_prefix,
        subnet_mask=new_route.subnet_mask,
        next_hop=new_route.next_hop,
        preference=new_route.preference,
        description=new_route.description,
        vrf_name=new_route.vrf_name,
        protocol=new_route.protocol,
        is_active=new_route.is_active,
        discovered_config=new_route.discovered_config,
        created_at=new_route.created_at,
    )


@router.put("/routes/{route_id}", response_model=StaticRouteOut)
def update_static_route(
    route_id: int,
    payload: StaticRouteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    route = db.query(StaticRoute).filter(StaticRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Rota não encontrada.")
    if route.protocol != "Static":
        raise HTTPException(
            status_code=400,
            detail=f"Rotas dinâmicas ou conectadas ({route.protocol}) não podem ser editadas manualmente.",
        )

    dev = route.device
    verify_pop_access(current_user, dev.pop_id)

    if payload.destination_network is not None:
        route.destination_network = payload.destination_network.strip()
    if payload.cidr_prefix is not None:
        route.cidr_prefix = payload.cidr_prefix
        if route.ip_version == 4:
            route.subnet_mask = cidr_to_netmask(payload.cidr_prefix)
    if payload.next_hop is not None:
        route.next_hop = payload.next_hop.strip()
    if payload.description is not None:
        route.description = payload.description.strip()
    if payload.preference is not None:
        route.preference = payload.preference
    if payload.vrf_name is not None:
        route.vrf_name = payload.vrf_name
    if payload.is_active is not None:
        route.is_active = payload.is_active

    db.commit()
    db.refresh(route)

    log_audit_event(
        db=db,
        user=current_user,
        action="STATIC_ROUTE_UPDATE",
        resource_type="STATIC_ROUTE",
        resource_id=str(route.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Atualizada rota estática {route.destination_network}/{route.cidr_prefix} -> {route.next_hop}.",
        is_simulated=dev.is_simulated,
    )
    return StaticRouteOut(
        id=route.id,
        device_id=route.device_id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        ip_version=route.ip_version,
        destination_network=route.destination_network,
        cidr_prefix=route.cidr_prefix,
        subnet_mask=route.subnet_mask,
        next_hop=route.next_hop,
        preference=route.preference,
        description=route.description,
        vrf_name=route.vrf_name,
        protocol=route.protocol,
        is_active=route.is_active,
        discovered_config=route.discovered_config,
        created_at=route.created_at,
    )


@router.delete("/routes/{route_id}")
def delete_static_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operador", "engineer")),
):
    route = db.query(StaticRoute).filter(StaticRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Rota não encontrada.")
    if route.protocol != "Static":
        raise HTTPException(
            status_code=400,
            detail=f"Apenas rotas estáticas podem ser removidas (protocolo atual: {route.protocol}).",
        )

    dev = route.device
    verify_pop_access(current_user, dev.pop_id)

    undo_cmd = format_undo_static_route_command(
        destination_network=route.destination_network,
        cidr_prefix=route.cidr_prefix,
        next_hop=route.next_hop,
        ip_version=route.ip_version,
        vrf_name=route.vrf_name,
    )
    driver = HuaweiVRPDriver(dev)
    driver.create_configuration_backup(
        db=db,
        user_id=current_user.id,
        backup_type="PRE_ROUTE_REMOVE",
        comment=f"Backup antes de remover rota {route.destination_network}/{route.cidr_prefix}",
    )
    driver.execute_commands_sequentially([undo_cmd])

    route_summary = f"{route.destination_network}/{route.cidr_prefix} -> {route.next_hop}"
    db.delete(route)
    db.commit()

    log_audit_event(
        db=db,
        user=current_user,
        action="STATIC_ROUTE_DELETE",
        resource_type="STATIC_ROUTE",
        resource_id=str(route_id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Removida rota estática {route_summary} via '{undo_cmd}'.",
        is_simulated=driver.is_simulated,
    )
    return {"deleted": True, "id": route_id, "undo_command": undo_cmd}


# =====================================================================
# 8. ANÁLISE COMPLETA DE VLANs, PORTAS E IPs NO SWITCH (VIA SSH)
# =====================================================================
@router.post("/devices/{device_id}/analyze-vlans", response_model=SwitchVlanAnalysisResponse)
def analyze_device_vlans_ports_and_ips(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import ipaddress

    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento Huawei não encontrado.")

    verify_pop_access(current_user, dev.pop_id)

    driver = HuaweiVRPDriver(dev)
    conn_info = driver.test_connectivity()
    latency_ms = float(conn_info.get("latency_ms", 14.2))

    # Fetch device entities
    db_vlans = db.query(Vlan).filter(Vlan.device_id == dev.id).order_by(Vlan.vlan_id.asc()).all()
    db_ifaces = db.query(Interface).filter(Interface.device_id == dev.id).order_by(Interface.port_index.asc()).all()
    db_vlanifs = db.query(Vlanif).filter(Vlanif.device_id == dev.id).order_by(Vlanif.vlan_id.asc()).all()
    db_routes = db.query(StaticRoute).filter(StaticRoute.device_id == dev.id).all()

    # If switch is L2 pure, also look up Vlanifs & StaticRoutes on L3 devices so the user sees the gateway IP if configured on Core/BNG
    all_l3_vlanifs = db.query(Vlanif).all() if not dev.supports_l3_routing else db_vlanifs
    all_l3_routes = db.query(StaticRoute).all() if not dev.supports_l3_routing else db_routes

    vlan_map = {v.vlan_id: v for v in db_vlans}
    all_vlan_ids = set(vlan_map.keys())

    for v_if in db_vlanifs:
        all_vlan_ids.add(v_if.vlan_id)

    # Map VLAN ID -> list of interfaces where it appears
    vlan_ports_map: dict[int, List[AnalyzedVlanPortItem]] = {}
    vlan_inferred_desc: dict[int, str] = {}

    for iface in db_ifaces:
        pvid = iface.pvid or 1
        allowed_set = set()
        for part in (iface.allowed_vlans or "1").split(","):
            part_s = part.strip()
            if part_s.isdigit():
                allowed_set.add(int(part_s))
        allowed_set.add(pvid)

        for vid in allowed_set:
            # Skip listing empty/free ports on Default VLAN 1 to keep the analysis focused on real usage
            is_free_default = (
                vid == 1
                and iface.link_type == "access"
                and pvid == 1
                and not (iface.description or "").strip()
            )
            if is_free_default:
                continue

            all_vlan_ids.add(vid)
            if iface.link_type == "access":
                tag_mode = "Untagged (Access)"
            elif pvid == vid and iface.link_type != "trunk":
                tag_mode = "Untagged (PVID)"
            else:
                tag_mode = "Tagged (Trunk)"

            if (
                vid != 1
                and iface.link_type == "access"
                and (iface.description or "").strip()
                and vid not in vlan_inferred_desc
            ):
                vlan_inferred_desc[vid] = iface.description.strip()

            vlan_ports_map.setdefault(vid, []).append(
                AnalyzedVlanPortItem(
                    interface_id=iface.id,
                    port_index=iface.port_index,
                    interface_name=iface.name,
                    short_name=iface.short_name or iface.name,
                    link_type=iface.link_type,
                    tag_mode=tag_mode,
                    physical_status=iface.physical_status,
                    speed=iface.speed or "10G",
                    port_description=(iface.description or "").strip() or "Sem descrição",
                )
            )

    # Map VLAN ID -> list of Vlanif IPs and associated static routes
    vlan_ips_map: dict[int, List[AnalyzedVlanIpItem]] = {}
    for vif in all_l3_vlanifs:
        if vif.device_id != dev.id and vif.vlan_id not in all_vlan_ids:
            continue
        routed_blocks: List[str] = []
        try:
            vif_net = ipaddress.IPv4Network(f"{vif.ip_address}/{vif.cidr_prefix}", strict=False)
            for rt in all_l3_routes:
                if rt.ip_version == 4:
                    try:
                        nh_ip = ipaddress.IPv4Address(rt.next_hop)
                        if nh_ip in vif_net:
                            lbl = f"{rt.destination_network}/{rt.cidr_prefix} -> {rt.next_hop}"
                            if rt.description:
                                lbl += f" ({rt.description})"
                            routed_blocks.append(lbl)
                    except ValueError:
                        pass
        except ValueError:
            pass

        iface_label = vif.interface_name
        if vif.device_id != dev.id and vif.device:
            iface_label = f"{vif.interface_name} (Roteador L3: {vif.device.name})"

        vlan_ips_map.setdefault(vif.vlan_id, []).append(
            AnalyzedVlanIpItem(
                vlanif_id=vif.id,
                interface_name=iface_label,
                ip_address=vif.ip_address,
                cidr_prefix=vif.cidr_prefix,
                subnet_mask=vif.subnet_mask,
                ipv6_address=vif.ipv6_address,
                description=vif.description or "",
                status=getattr(vif, "protocol_status", None) or getattr(vif, "admin_status", None) or "UP",
                vrf_name=vif.vrf_name,
                routed_blocks=routed_blocks,
            )
        )

    analyzed_vlans: List[AnalyzedVlanItem] = []
    cli_lines = [
        f"<{dev.name}> screen-length 0 temporary",
        "Info: The configuration takes effect on the current user terminal interface only.",
        f"<{dev.name}> display vlan",
        "The total number of vlans is : " + str(len(all_vlan_ids)),
        "--------------------------------------------------------------------------------",
        "U: Up;         D: Down;         TG: Tagged;         UT: Untagged;",
        "VID  Type    Status   Property  MAC-LRN Statistics Description",
        "--------------------------------------------------------------------------------",
    ]

    for vid in sorted(all_vlan_ids):
        v_obj = vlan_map.get(vid)
        v_name = v_obj.name if v_obj and v_obj.name else f"VLAN {vid:04d}"
        v_desc = (
            (v_obj.description if v_obj and v_obj.description else None)
            or vlan_inferred_desc.get(vid)
            or ("Default VLAN" if vid == 1 else f"VLAN-{vid}")
        )
        v_status = v_obj.status if v_obj and v_obj.status else "ACTIVE"
        ports_for_vlan = vlan_ports_map.get(vid, [])
        ips_for_vlan = vlan_ips_map.get(vid, [])

        analyzed_vlans.append(
            AnalyzedVlanItem(
                vlan_id=vid,
                vlan_name=v_name,
                vlan_description=v_desc,
                vlan_status=v_status,
                ports=ports_for_vlan,
                ips=ips_for_vlan,
            )
        )

        port_tags = ", ".join(
            f"{p.short_name}({'UT' if 'Untagged' in p.tag_mode else 'TG'}:{p.physical_status[0]})"
            for p in ports_for_vlan
        )
        cli_lines.append(
            f"{vid:<4} common  enable   default   enable  disable    {v_desc}  [{port_tags or 'Sem portas ativas'}]"
        )

    cli_lines.extend(
        [
            "",
            f"<{dev.name}> display ip interface brief",
            "Interface                         IP Address/Mask      Physical   Protocol  Description",
        ]
    )
    for vid in sorted(vlan_ips_map.keys()):
        for ip_item in vlan_ips_map[vid]:
            cli_lines.append(
                f"{ip_item.interface_name:<33} {ip_item.ip_address}/{ip_item.cidr_prefix:<15} up         up        {ip_item.description}"
            )

    unique_ports_count = len(
        {p.interface_id for item in analyzed_vlans for p in item.ports}
    )
    total_ips_count = sum(len(item.ips) for item in analyzed_vlans)

    log_audit_event(
        db=db,
        user=current_user,
        action="SWITCH_ANALYZE_VLANS",
        resource_type="DEVICE",
        resource_id=str(dev.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=(
            f"Análise SSH de VLANs executada em {dev.name}: "
            f"{len(analyzed_vlans)} VLANs, {unique_ports_count} portas mapeadas e {total_ips_count} IPs Vlanif."
        ),
        is_simulated=driver.is_simulated,
    )

    return SwitchVlanAnalysisResponse(
        device_id=dev.id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else "POP",
        model=dev.model,
        management_ip=dev.management_ip,
        system_version=dev.system_version or "VRP V200R021",
        is_simulated=driver.is_simulated,
        ssh_latency_ms=latency_ms,
        analyzed_at=datetime.now(timezone.utc),
        total_vlans=len(analyzed_vlans),
        total_ports_with_vlan=unique_ports_count,
        total_l3_ips=total_ips_count,
        vlans=analyzed_vlans,
        cli_transcript="\n".join(cli_lines),
    )


# =====================================================================
# 9. IMPORTAR DADOS DO SWITCH PARA PREENCHER AUTOMATICAMENTE AS TABELAS
# =====================================================================
@router.post("/devices/{device_id}/import-from-switch", response_model=SwitchImportResponse)
def import_device_data_into_system_tables(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import ipaddress

    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento Huawei não encontrado.")

    verify_pop_access(current_user, dev.pop_id)
    driver = HuaweiVRPDriver(dev)
    driver.test_connectivity()

    db_ifaces = db.query(Interface).filter(Interface.device_id == dev.id).order_by(Interface.port_index.asc()).all()
    db_vlans = db.query(Vlan).filter(Vlan.device_id == dev.id).all()
    db_vlanifs = db.query(Vlanif).filter(Vlanif.device_id == dev.id).all()
    db_routes = db.query(StaticRoute).filter(StaticRoute.device_id == dev.id).all()

    all_l3_vlanifs = db.query(Vlanif).all() if not dev.supports_l3_routing else db_vlanifs
    all_l3_routes = db.query(StaticRoute).all() if not dev.supports_l3_routing else db_routes

    vlan_map = {v.vlan_id: v for v in db_vlans}
    vif_map = {v.vlan_id: v for v in all_l3_vlanifs}

    customers_populated = 0
    records: List[ImportedTableRecord] = []

    for iface in db_ifaces:
        desc = (iface.description or "").strip()
        pvid = iface.pvid or 1
        allowed_list = [
            int(x.strip())
            for x in (iface.allowed_vlans or "1").split(",")
            if x.strip().isdigit()
        ]
        if pvid not in allowed_list:
            allowed_list.append(pvid)

        # Ensure every VLAN referenced on the port exists in the VLAN table
        for vid in allowed_list:
            if vid not in vlan_map:
                new_v = Vlan(
                    device_id=dev.id,
                    vlan_id=vid,
                    name=f"VLAN {vid:04d}",
                    description=desc if (vid == pvid and desc) else f"VLAN-{vid}",
                    vlan_type="common",
                    status="ACTIVE",
                )
                db.add(new_v)
                db.flush()
                vlan_map[vid] = new_v
            elif vid == pvid and desc and not vlan_map[vid].description:
                vlan_map[vid].description = desc

        # Skip completely empty default ports in the imported summary table
        if pvid == 1 and iface.link_type == "access" and not desc:
            continue

        vif = vif_map.get(pvid)
        vlanif_str = f"{vif.ip_address}/{vif.cidr_prefix}" if vif else "Sem IP L3"

        routed_list: List[str] = []
        if vif:
            try:
                vif_net = ipaddress.IPv4Network(f"{vif.ip_address}/{vif.cidr_prefix}", strict=False)
                for rt in all_l3_routes:
                    if rt.ip_version == 4:
                        try:
                            if ipaddress.IPv4Address(rt.next_hop) in vif_net:
                                routed_list.append(f"{rt.destination_network}/{rt.cidr_prefix}")
                        except ValueError:
                            pass
            except ValueError:
                pass
        routed_str = ", ".join(routed_list) if routed_list else "Sem rota estática"

        sync_action = "SINCRONIZADO"
        is_infrastructure_port = any(
            kw in desc.upper() for kw in ("UPLINK", "DOWNLINK", "TRUNK", "BNG", "CORE", "GERENCIA")
        )

        # Auto-populate Customer table for customer access ports discovered on the switch
        if iface.link_type == "access" and (pvid > 1 or desc) and not is_infrastructure_port:
            cust_name = (desc or vlan_map[pvid].description or f"CLIENTE-VLAN-{pvid}").upper()
            cust_code = f"CLI-{pvid}"
            existing_cust = (
                db.query(Customer)
                .filter(
                    (Customer.code == cust_code)
                    | (Customer.name == cust_name)
                    | (
                        (Customer.device_id == dev.id)
                        & (Customer.interface_name == iface.name)
                    )
                )
                .first()
            )
            if not existing_cust:
                new_cust = Customer(
                    name=cust_name,
                    code=cust_code if not db.query(Customer).filter(Customer.code == cust_code).first() else f"CLI-{dev.id}-{iface.port_index}",
                    pop_id=dev.pop_id,
                    device_id=dev.id,
                    interface_name=iface.name,
                    vlan_id=pvid,
                    vlanif_ip=vlanif_str if vif else None,
                    routed_block=routed_str if routed_list else None,
                    status="ATIVO",
                    notes=f"Importado automaticamente do switch {dev.name} (Porta {iface.name}).",
                )
                db.add(new_cust)
                customers_populated += 1
                sync_action = "IMPORTADO (NOVO CLIENTE)"
            else:
                existing_cust.pop_id = dev.pop_id
                existing_cust.device_id = dev.id
                existing_cust.interface_name = iface.name
                existing_cust.vlan_id = pvid
                if vif:
                    existing_cust.vlanif_ip = vlanif_str
                if routed_list:
                    existing_cust.routed_block = routed_str
                existing_cust.status = "ATIVO"
                customers_populated += 1
                sync_action = "ATUALIZADO NA TABELA"

        records.append(
            ImportedTableRecord(
                vlan_id=pvid,
                vlan_name=vlan_map[pvid].name if pvid in vlan_map else f"VLAN {pvid:04d}",
                customer_or_description=desc or (vlan_map[pvid].description if pvid in vlan_map else f"VLAN {pvid}"),
                interface_name=iface.name,
                port_mode=iface.link_type.upper(),
                port_status=iface.physical_status,
                vlanif_ip=vlanif_str,
                routed_block=routed_str,
                sync_action=sync_action,
            )
        )

    dev.status = "ONLINE"
    dev.last_synced_at = datetime.now(timezone.utc)
    db.commit()

    total_vlans = db.query(Vlan).filter(Vlan.device_id == dev.id).count()

    log_audit_event(
        db=db,
        user=current_user,
        action="SWITCH_IMPORT_TABLES",
        resource_type="DEVICE",
        resource_id=str(dev.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=(
            f"Importação automática concluída de {dev.name}: "
            f"{total_vlans} VLANs, {len(db_ifaces)} portas, {len(db_vlanifs)} Vlanifs, "
            f"{len(db_routes)} rotas e {customers_populated} clientes sincronizados."
        ),
        is_simulated=driver.is_simulated,
    )

    return SwitchImportResponse(
        device_id=dev.id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else "POP",
        management_ip=dev.management_ip,
        imported_at=datetime.now(timezone.utc),
        vlans_synced=total_vlans,
        interfaces_synced=len(db_ifaces),
        vlanifs_synced=len(db_vlanifs),
        routes_synced=len(db_routes),
        customers_populated=customers_populated,
        records=records,
        message=(
            f"Dados do switch {dev.name} importados com sucesso! "
            f"Todas as tabelas do sistema (VLANs, Portas, Vlanifs, Rotas e Clientes) foram preenchidas."
        ),
    )


# =====================================================================
# 10. BACKUP DO SWITCH EM .TXT (CONFIGURAÇÕES GERAIS HUAWEI VRP)
#     E BACKUP COMPLETO DO SISTEMA (GERAR E BAIXAR)
# =====================================================================
@router.post("/devices/{device_id}/backup-txt", response_model=SwitchBackupTxtResponse)
def create_and_download_switch_backup_txt(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Equipamento Huawei não encontrado.")

    verify_pop_access(current_user, dev.pop_id)
    driver = HuaweiVRPDriver(dev)

    db_vlans = db.query(Vlan).filter(Vlan.device_id == dev.id).order_by(Vlan.vlan_id.asc()).all()
    db_ifaces = db.query(Interface).filter(Interface.device_id == dev.id).order_by(Interface.port_index.asc()).all()
    db_vlanifs = db.query(Vlanif).filter(Vlanif.device_id == dev.id).order_by(Vlanif.vlan_id.asc()).all()
    db_routes = db.query(StaticRoute).filter(StaticRoute.device_id == dev.id).all()

    now_utc = datetime.now(timezone.utc)
    vlan_ids_str = " ".join(str(v.vlan_id) for v in db_vlans if v.vlan_id != 1)

    lines = [
        "! ==========================================================================",
        f"! HUAWEI NETWORK MANAGER — BACKUP COMPLETO DE CONFIGURAÇÃO GERAL (.TXT)",
        f"! Comando Executado via SSH : screen-length 0 temporary / display cu (display current-configuration)",
        f"! Equipamento : {dev.name}",
        f"! POP         : {dev.pop.name if dev.pop else 'N/A'}",
        f"! Modelo      : {dev.model}",
        f"! IP Gerência : {dev.management_ip}:{dev.ssh_port}",
        f"! Versão VRP  : {dev.system_version or 'VRP V200R021C00SPC100'}",
        f"! Data/Hora   : {now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"! Admin       : {current_user.username} ({current_user.full_name})",
        "! ==========================================================================",
        f"<{dev.name}> screen-length 0 temporary",
        "Info: The configuration takes effect on the current user terminal interface only.",
        f"<{dev.name}> display cu",
        f"!Software Version {dev.system_version or 'V200R021C00SPC100'}",
        "#",
        f"sysname {dev.name}",
        "#",
        "clock timezone BRT minus 03:00:00",
        "#",
        "info-center enable",
        "#",
        "aaa",
        " authentication-scheme default",
        " authorization-scheme default",
        " accounting-scheme default",
        " domain default",
        " domain default_admin",
        "#",
        f"vlan batch 1 {vlan_ids_str}".strip(),
        "#",
    ]

    for v in db_vlans:
        lines.append(f"vlan {v.vlan_id}")
        if v.description:
            lines.append(f" description {v.description}")
        lines.append("#")

    for vif in db_vlanifs:
        lines.append(f"interface {vif.interface_name}")
        if vif.description:
            lines.append(f" description {vif.description}")
        if vif.vrf_name:
            lines.append(f" ip binding vpn-instance {vif.vrf_name}")
        lines.append(f" ip address {vif.ip_address} {vif.subnet_mask}")
        if vif.ipv6_address:
            lines.append(" ipv6 enable")
            lines.append(f" ipv6 address {vif.ipv6_address}")
        lines.append("#")

    for iface in db_ifaces:
        lines.append(f"interface {iface.name}")
        if (iface.description or "").strip():
            lines.append(f" description {iface.description.strip()}")
        lines.append(f" port link-type {iface.link_type}")
        if iface.link_type == "access":
            lines.append(f" port default vlan {iface.pvid or 1}")
        elif iface.link_type == "trunk":
            if (iface.pvid or 1) != 1:
                lines.append(f" port trunk pvid vlan {iface.pvid}")
            allow_spaces = " ".join(x.strip() for x in (iface.allowed_vlans or "1").split(",") if x.strip())
            lines.append(f" port trunk allow-pass vlan {allow_spaces}")
        else:
            allow_spaces = " ".join(x.strip() for x in (iface.allowed_vlans or "1").split(",") if x.strip())
            lines.append(f" port hybrid tagged vlan {allow_spaces}")
        if iface.admin_status == "DOWN":
            lines.append(" shutdown")
        lines.append("#")

    for rt in db_routes:
        if rt.ip_version == 6:
            cmd = f"ipv6 route-static {rt.destination_network} {rt.cidr_prefix} {rt.next_hop}"
        else:
            vrf_part = f"vpn-instance {rt.vrf_name} " if rt.vrf_name else ""
            cmd = f"ip route-static {vrf_part}{rt.destination_network} {rt.subnet_mask} {rt.next_hop}"
        if rt.preference and rt.preference != 60:
            cmd += f" preference {rt.preference}"
        if rt.description:
            cmd += f" description {rt.description}"
        lines.append(cmd)

    lines.extend(
        [
            "#",
            "stelnet server enable",
            "ssh user admin_noc authentication-type password",
            "ssh user admin_noc service-type stelnet",
            "#",
            "user-interface vty 0 4",
            " authentication-mode aaa",
            " protocol inbound ssh",
            "#",
            "return",
            "",
        ]
    )

    config_txt = "\n".join(lines)
    backup_rec = driver.create_configuration_backup(
        db=db,
        user_id=current_user.id,
        backup_type="SWITCH_TXT_FULL",
        comment=f"Backup completo TXT das configurações gerais do switch {dev.name}",
    )
    backup_rec.config_text = config_txt
    db.commit()
    db.refresh(backup_rec)

    filename = f"BACKUP-SWITCH-{dev.name}-{now_utc.strftime('%Y%m%d-%H%M%S')}.txt"

    log_audit_event(
        db=db,
        user=current_user,
        action="SWITCH_BACKUP_TXT",
        resource_type="BACKUP",
        resource_id=str(backup_rec.id),
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else None,
        details=f"Salvo e gerado arquivo TXT de configurações gerais do switch {dev.name} ({len(config_txt)} bytes).",
        is_simulated=driver.is_simulated,
    )

    return SwitchBackupTxtResponse(
        backup_id=backup_rec.id,
        device_id=dev.id,
        device_name=dev.name,
        pop_name=dev.pop.name if dev.pop else "POP",
        management_ip=dev.management_ip,
        model=dev.model,
        system_version=dev.system_version or "VRP V200R021",
        filename=filename,
        config_txt=config_txt,
        size_bytes=len(config_txt.encode("utf-8")),
        created_at=backup_rec.created_at,
    )


@router.post("/backups/system", response_model=SystemBackupResponse)
def create_and_download_system_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    import json

    now_utc = datetime.now(timezone.utc)
    pops = db.query(Pop).all()
    devices = db.query(Device).all()
    customers = db.query(Customer).all()
    interfaces = db.query(Interface).all()
    vlans = db.query(Vlan).all()
    vlanifs = db.query(Vlanif).all()
    routes = db.query(StaticRoute).all()
    backups = db.query(ConfigurationBackup).order_by(ConfigurationBackup.created_at.desc()).limit(30).all()

    counts = {
        "pops": len(pops),
        "devices": len(devices),
        "customers": len(customers),
        "interfaces": len(interfaces),
        "vlans": len(vlans),
        "vlanifs": len(vlanifs),
        "routes": len(routes),
        "switch_backups": len(backups),
    }

    dump_obj = {
        "system": "Huawei Network Manager ISP Edition",
        "version": "2.0.0",
        "generated_at": now_utc.isoformat(),
        "generated_by": current_user.username,
        "counts": counts,
        "pops": [
            {
                "id": p.id,
                "name": p.name,
                "city": p.city,
                "state": p.state,
                "address": p.address,
                "status": p.status,
            }
            for p in pops
        ],
        "devices": [
            {
                "id": d.id,
                "name": d.name,
                "pop_id": d.pop_id,
                "vendor": d.vendor,
                "model": d.model,
                "management_ip": d.management_ip,
                "ssh_port": d.ssh_port,
                "system_version": d.system_version,
                "supports_l3_routing": d.supports_l3_routing,
                "status": d.status,
            }
            for d in devices
        ],
        "customers": [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "document": c.document,
                "contact_name": c.contact_name,
                "contact_phone": c.contact_phone,
                "contact_email": c.contact_email,
                "pop_id": c.pop_id,
                "device_id": c.device_id,
                "interface_name": c.interface_name,
                "vlan_id": c.vlan_id,
                "vlanif_ip": c.vlanif_ip,
                "routed_block": c.routed_block,
                "status": c.status,
            }
            for c in customers
        ],
        "vlans": [
            {
                "device_id": v.device_id,
                "vlan_id": v.vlan_id,
                "name": v.name,
                "description": v.description,
                "status": v.status,
            }
            for v in vlans
        ],
        "vlanifs": [
            {
                "device_id": vf.device_id,
                "vlan_id": vf.vlan_id,
                "interface_name": vf.interface_name,
                "ip_address": vf.ip_address,
                "cidr_prefix": vf.cidr_prefix,
                "subnet_mask": vf.subnet_mask,
                "description": vf.description,
            }
            for vf in vlanifs
        ],
        "static_routes": [
            {
                "device_id": r.device_id,
                "destination_network": r.destination_network,
                "cidr_prefix": r.cidr_prefix,
                "subnet_mask": r.subnet_mask,
                "next_hop": r.next_hop,
                "description": r.description,
                "preference": r.preference,
            }
            for r in routes
        ],
        "interfaces_configured": [
            {
                "device_id": i.device_id,
                "port_index": i.port_index,
                "name": i.name,
                "description": i.description,
                "link_type": i.link_type,
                "pvid": i.pvid,
                "allowed_vlans": i.allowed_vlans,
                "physical_status": i.physical_status,
            }
            for i in interfaces
            if (i.description or "").strip() or (i.pvid or 1) != 1
        ],
    }

    json_str = json.dumps(dump_obj, indent=2, ensure_ascii=False)

    txt_lines = [
        "==========================================================================",
        "HUAWEI NETWORK MANAGER — BACKUP COMPLETO DO SISTEMA (BANCO DE DADOS & CADASTROS)",
        f"Gerado em : {now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"Operador  : {current_user.username} ({current_user.full_name})",
        "==========================================================================",
        f"- POPs Cadastrados         : {counts['pops']}",
        f"- Switches / Roteadores    : {counts['devices']}",
        f"- Clientes Cadastrados     : {counts['customers']}",
        f"- Portas Físicas Mapeadas  : {counts['interfaces']}",
        f"- VLANs Ativas             : {counts['vlans']}",
        f"- Gateways Layer 3 (Vlanif): {counts['vlanifs']}",
        f"- Rotas Estáticas          : {counts['routes']}",
        "",
        "--- CONTEÚDO INTEGRAL EM FORMATO JSON ESTRUTURADO ---",
        json_str,
    ]
    full_txt = "\n".join(txt_lines)
    backup_id = f"SYS-BKP-{now_utc.strftime('%Y%m%d-%H%M%S')}"
    filename = f"BACKUP-SISTEMA-HUAWEI-MANAGER-{now_utc.strftime('%Y%m%d-%H%M%S')}.json"

    log_audit_event(
        db=db,
        user=current_user,
        action="SYSTEM_BACKUP_EXPORT",
        resource_type="SYSTEM",
        resource_id=backup_id,
        details=(
            f"Backup completo do sistema gerado e baixado ({len(json_str)} bytes): "
            f"{counts['pops']} POPs, {counts['devices']} switches, {counts['customers']} clientes, "
            f"{counts['vlans']} VLANs e {counts['routes']} rotas."
        ),
        is_simulated=True,
    )

    return SystemBackupResponse(
        backup_id=backup_id,
        filename=filename,
        created_at=now_utc,
        created_by=current_user.username,
        size_bytes=len(json_str.encode("utf-8")),
        counts=counts,
        backup_json_text=json_str,
        backup_txt_summary=full_txt,
    )




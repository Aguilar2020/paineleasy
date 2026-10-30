import difflib
from typing import List, Optional, Tuple
from backend.models.entities import Device, Interface, Vlan, Vlanif, StaticRoute
from backend.schemas.api_schemas import (
    ProvisioningRequest,
    StaticRouteItemInput,
    DeviceCommandPlan,
    DiffLine,
)
from backend.drivers.huawei.validator import cidr_to_netmask


def format_static_route_command(route: StaticRouteItemInput) -> str:
    """Generates exact Huawei VRP CLI command for an IPv4 or IPv6 static route."""
    cmd_prefix = "ipv6 route-static" if route.ip_version == 6 else "ip route-static"
    parts = [cmd_prefix]

    if route.vrf_name and route.vrf_name.strip():
        parts.append(f"vpn-instance {route.vrf_name.strip()}")

    parts.append(route.destination_network.strip())
    parts.append(str(route.cidr_prefix))
    parts.append(route.next_hop.strip())

    if route.preference and route.preference != 60:
        parts.append(f"preference {route.preference}")

    if route.description and route.description.strip():
        parts.append(f"description {route.description.strip()}")

    return " ".join(parts)


def format_undo_static_route_command(
    destination_network: str,
    cidr_prefix: int,
    next_hop: str,
    ip_version: int = 4,
    vrf_name: Optional[str] = None,
) -> str:
    cmd_prefix = "undo ipv6 route-static" if ip_version == 6 else "undo ip route-static"
    parts = [cmd_prefix]
    if vrf_name and vrf_name.strip():
        parts.append(f"vpn-instance {vrf_name.strip()}")
    parts.append(destination_network.strip())
    parts.append(str(cidr_prefix))
    parts.append(next_hop.strip())
    return " ".join(parts)


def build_interface_current_snippet(
    iface: Optional[Interface],
    existing_vlan: Optional[Vlan],
    existing_vlanif: Optional[Vlanif],
    existing_routes: List[StaticRoute],
) -> str:
    blocks: List[str] = []

    if existing_vlan:
        v_lines = [f"vlan {existing_vlan.vlan_id}"]
        if existing_vlan.description:
            v_lines.append(f" description {existing_vlan.description}")
        v_lines.append("quit")
        blocks.append("\n".join(v_lines))

    if iface:
        if iface.discovered_config:
            blocks.append(iface.discovered_config.strip())
        else:
            i_lines = [f"interface {iface.name}"]
            if iface.description:
                i_lines.append(f" description {iface.description}")
            i_lines.append(f" port link-type {iface.link_type}")
            if iface.link_type == "access":
                i_lines.append(f" port default vlan {iface.pvid}")
            elif iface.link_type == "trunk":
                if iface.pvid != 1:
                    i_lines.append(f" port trunk pvid vlan {iface.pvid}")
                vlans_spaced = " ".join(
                    v.strip() for v in iface.allowed_vlans.split(",") if v.strip()
                )
                i_lines.append(f" port trunk allow-pass vlan {vlans_spaced}")
            elif iface.link_type == "hybrid":
                if iface.pvid != 1:
                    i_lines.append(f" port hybrid pvid vlan {iface.pvid}")
                vlans_spaced = " ".join(
                    v.strip() for v in iface.allowed_vlans.split(",") if v.strip()
                )
                i_lines.append(f" port hybrid tagged vlan {vlans_spaced}")
            i_lines.append("quit")
            blocks.append("\n".join(i_lines))

    if existing_vlanif:
        vif_lines = [f"interface Vlanif{existing_vlanif.vlan_id}"]
        if existing_vlanif.description:
            vif_lines.append(f" description {existing_vlanif.description}")
        if existing_vlanif.vrf_name:
            vif_lines.append(f" ip binding vpn-instance {existing_vlanif.vrf_name}")
        vif_lines.append(
            f" ip address {existing_vlanif.ip_address} {existing_vlanif.subnet_mask}"
        )
        if existing_vlanif.ipv6_address:
            vif_lines.append(" ipv6 enable")
            vif_lines.append(f" ipv6 address {existing_vlanif.ipv6_address}")
        vif_lines.append("quit")
        blocks.append("\n".join(vif_lines))

    if existing_routes:
        r_lines = [
            r.discovered_config
            or f"ip route-static {r.destination_network} {r.cidr_prefix} {r.next_hop}"
            + (f" description {r.description}" if r.description else "")
            for r in existing_routes[:5]
        ]
        blocks.append("\n".join(r_lines))

    return "\n\n".join(blocks)


def compute_diff_lines(before_text: str, after_text: str) -> List[DiffLine]:
    before_lines = before_text.splitlines() if before_text else []
    after_lines = after_text.splitlines() if after_text else []
    matcher = difflib.SequenceMatcher(None, before_lines, after_lines)
    diff_result: List[DiffLine] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for b_line, a_line in zip(before_lines[i1:i2], after_lines[j1:j2]):
                diff_result.append(
                    DiffLine(line_type="context", before_line=b_line, after_line=a_line)
                )
        elif tag == "replace":
            max_len = max(i2 - i1, j2 - j1)
            for k in range(max_len):
                b_val = before_lines[i1 + k] if (i1 + k) < i2 else None
                a_val = after_lines[j1 + k] if (j1 + k) < j2 else None
                if b_val is not None and a_val is not None:
                    diff_result.append(
                        DiffLine(line_type="modified", before_line=b_val, after_line=a_val)
                    )
                elif b_val is not None:
                    diff_result.append(
                        DiffLine(line_type="removed", before_line=b_val, after_line=None)
                    )
                else:
                    diff_result.append(
                        DiffLine(line_type="added", before_line=None, after_line=a_val)
                    )
        elif tag == "delete":
            for b_line in before_lines[i1:i2]:
                diff_result.append(
                    DiffLine(line_type="removed", before_line=b_line, after_line=None)
                )
        elif tag == "insert":
            for a_line in after_lines[j1:j2]:
                diff_result.append(
                    DiffLine(line_type="added", before_line=None, after_line=a_line)
                )

    return diff_result


def generate_provisioning_plan(
    req: ProvisioningRequest,
    access_device: Device,
    l3_device: Device,
    iface: Optional[Interface],
    existing_vlan: Optional[Vlan],
    existing_vlanif: Optional[Vlanif],
    existing_routes: List[StaticRoute],
) -> Tuple[str, str, List[DiffLine], List[DeviceCommandPlan], str]:
    """
    Generates Huawei VRP CLI commands, current vs proposed config blocks, and structured diff.
    Supports both single-box (L3 switch) and split L2 access + L3 core router topologies.
    """
    current_text = build_interface_current_snippet(
        iface=iface,
        existing_vlan=existing_vlan,
        existing_vlanif=existing_vlanif,
        existing_routes=[],
    )

    access_commands: List[str] = []
    l3_commands: List[str] = []
    proposed_blocks: List[str] = []

    port_desc = req.port_description or req.vlan_description
    mode = req.port_mode.lower().strip()

    # 1. VLAN creation block
    if req.auto_create_vlan:
        need_vlan_cmd = (
            existing_vlan is None
            or (existing_vlan.description or "") != req.vlan_description
        )
        vlan_block = [
            f"vlan {req.vlan_id}",
            f" description {req.vlan_description}",
            "quit",
        ]
        proposed_blocks.append("\n".join(vlan_block))
        if need_vlan_cmd:
            access_commands.extend(vlan_block)

    # 2. Interface block (Access, Trunk, Hybrid)
    iface_block = [f"interface {req.interface_name}"]
    if port_desc:
        iface_block.append(f" description {port_desc}")

    if mode == "access":
        iface_block.append(" port link-type access")
        iface_block.append(f" port default vlan {req.vlan_id}")
    elif mode == "trunk":
        iface_block.append(" port link-type trunk")
        iface_block.append(f" port trunk allow-pass vlan {req.vlan_id}")
    elif mode == "hybrid":
        iface_block.append(" port link-type hybrid")
        if req.hybrid_tagged:
            iface_block.append(f" port hybrid tagged vlan {req.vlan_id}")
        else:
            iface_block.append(f" port hybrid pvid vlan {req.vlan_id}")
            iface_block.append(f" port hybrid untagged vlan {req.vlan_id}")
    iface_block.append("quit")

    # Build proposed state block showing preserved allowed VLANs on Trunk/Hybrid
    proposed_iface_state = [f"interface {req.interface_name}"]
    if port_desc:
        proposed_iface_state.append(f" description {port_desc}")
    if mode == "access":
        proposed_iface_state.append(" port link-type access")
        proposed_iface_state.append(f" port default vlan {req.vlan_id}")
    elif mode == "trunk":
        proposed_iface_state.append(" port link-type trunk")
        if iface and iface.link_type == "trunk" and req.preserve_existing_vlans:
            existing_list = [
                v.strip() for v in iface.allowed_vlans.split(",") if v.strip()
            ]
            if str(req.vlan_id) not in existing_list:
                existing_list.append(str(req.vlan_id))
            proposed_iface_state.append(
                f" port trunk allow-pass vlan {' '.join(existing_list)}"
            )
        else:
            proposed_iface_state.append(f" port trunk allow-pass vlan {req.vlan_id}")
    elif mode == "hybrid":
        proposed_iface_state.append(" port link-type hybrid")
        if req.hybrid_tagged:
            proposed_iface_state.append(f" port hybrid tagged vlan {req.vlan_id}")
        else:
            proposed_iface_state.append(f" port hybrid pvid vlan {req.vlan_id}")
            proposed_iface_state.append(f" port hybrid untagged vlan {req.vlan_id}")
    proposed_iface_state.append("quit")

    proposed_blocks.append("\n".join(proposed_iface_state))
    access_commands.extend(iface_block)

    # 3. Vlanif block
    if req.create_vlanif and req.vlanif_ipv4:
        cidr = req.vlanif_cidr or 30
        netmask = req.vlanif_subnet_mask or cidr_to_netmask(cidr)
        vif_desc = req.vlanif_description or f"GATEWAY-{req.vlan_description}"

        # If Vlanif is created on a separate L3 device, ensure the VLAN also exists there
        if l3_device.id != access_device.id:
            l3_commands.extend(
                [
                    f"vlan {req.vlan_id}",
                    f" description {req.vlan_description}",
                    "quit",
                ]
            )

        vif_block = [
            f"interface Vlanif{req.vlan_id}",
            f" description {vif_desc}",
        ]
        if req.vlanif_vrf_name and req.vlanif_vrf_name.strip():
            vif_block.append(f" ip binding vpn-instance {req.vlanif_vrf_name.strip()}")
        vif_block.append(f" ip address {req.vlanif_ipv4.strip()} {netmask}")
        if req.vlanif_ipv6 and req.vlanif_ipv6.strip():
            vif_block.append(" ipv6 enable")
            vif_block.append(f" ipv6 address {req.vlanif_ipv6.strip()}")
        vif_block.append("quit")

        proposed_blocks.append("\n".join(vif_block))
        if l3_device.id == access_device.id:
            access_commands.extend(vif_block)
        else:
            l3_commands.extend(vif_block)

    # 4. Static Routes block
    if req.create_static_routes and req.static_routes:
        route_cmds: List[str] = []
        for r_item in req.static_routes:
            cmd = format_static_route_command(r_item)
            route_cmds.append(cmd)
        proposed_blocks.append("\n".join(route_cmds))
        if l3_device.id == access_device.id:
            access_commands.extend(route_cmds)
        else:
            l3_commands.extend(route_cmds)

    # Handle VRP8 transactional commit when supported
    if access_device.supports_two_phase_commit and access_commands:
        access_commands.append("commit")
    if (
        l3_device.id != access_device.id
        and l3_device.supports_two_phase_commit
        and l3_commands
    ):
        l3_commands.append("commit")

    proposed_text = "\n\n".join(proposed_blocks)
    diff_lines = compute_diff_lines(current_text, proposed_text)

    device_plans: List[DeviceCommandPlan] = []
    if access_commands:
        role_label = (
            "COMBINED"
            if (l3_device.id == access_device.id and (req.create_vlanif or req.create_static_routes))
            else "ACCESS_SWITCH"
        )
        device_plans.append(
            DeviceCommandPlan(
                device_id=access_device.id,
                device_name=access_device.name,
                management_ip=access_device.management_ip,
                model=access_device.model,
                system_version=access_device.system_version or "VRP V200R021C00SPC100",
                role_in_plan=role_label,
                commands=access_commands,
            )
        )

    if l3_device.id != access_device.id and l3_commands:
        device_plans.append(
            DeviceCommandPlan(
                device_id=l3_device.id,
                device_name=l3_device.name,
                management_ip=l3_device.management_ip,
                model=l3_device.model,
                system_version=l3_device.system_version or "VRP V800R022C00SPC500",
                role_in_plan="L3_ROUTER",
                commands=l3_commands,
            )
        )

    # Build combined CLI script with clear headers
    script_parts: List[str] = []
    for plan in device_plans:
        if len(device_plans) > 1:
            script_parts.append(
                f"# ==========================================================\n"
                f"# EQUIPAMENTO: {plan.device_name} ({plan.management_ip} - {plan.model})\n"
                f"# =========================================================="
            )
        script_parts.append("system-view")
        script_parts.extend(plan.commands)
        script_parts.append("return")
        if req.save_configuration:
            script_parts.append("save")
            script_parts.append("Y")

    combined_cli_script = "\n".join(script_parts)
    return current_text, proposed_text, diff_lines, device_plans, combined_cli_script


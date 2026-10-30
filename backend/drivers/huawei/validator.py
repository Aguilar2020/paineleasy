import ipaddress
from typing import List, Optional
from backend.models.entities import Device, Interface, Vlan, Vlanif, StaticRoute
from backend.schemas.api_schemas import (
    ProvisioningRequest,
    StaticRouteItemInput,
    ValidationIssue,
)


def cidr_to_netmask(cidr: int) -> str:
    """Converts CIDR prefix length (0-32) to dotted-decimal IPv4 subnet mask."""
    net = ipaddress.IPv4Network(f"0.0.0.0/{cidr}")
    return str(net.netmask)


def netmask_to_cidr(mask: str) -> int:
    """Converts dotted-decimal subnet mask to CIDR prefix length."""
    return ipaddress.IPv4Network(f"0.0.0.0/{mask.strip()}").prefixlen


def validate_static_route_item(
    route: StaticRouteItemInput,
    l3_device: Device,
    existing_routes: List[StaticRoute],
    existing_vlanifs: List[Vlanif],
    new_vlanif_ip: Optional[str] = None,
    new_vlanif_cidr: Optional[int] = None,
    route_index: int = 0,
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    field_prefix = f"static_routes[{route_index}]"

    if not l3_device.supports_l3_routing:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field="l3_routing_device_id",
                message=(
                    f"O equipamento '{l3_device.name}' ({l3_device.model}) opera exclusivamente em Camada 2 "
                    "e não suporta roteamento estático IPv4/IPv6. Selecione um equipamento Layer 3 de destino."
                ),
            )
        )

    if route.ip_version == 6:
        try:
            net6 = ipaddress.IPv6Network(
                f"{route.destination_network.strip()}/{route.cidr_prefix}",
                strict=False,
            )
            strict_net6 = ipaddress.IPv6Network(
                f"{route.destination_network.strip()}/{route.cidr_prefix}",
                strict=True,
            )
            _ = strict_net6
        except ValueError:
            try:
                net6 = ipaddress.IPv6Network(
                    f"{route.destination_network.strip()}/{route.cidr_prefix}",
                    strict=False,
                )
                issues.append(
                    ValidationIssue(
                        severity="ERROR",
                        field=f"{field_prefix}.destination_network",
                        message=(
                            f"Endereço de rede IPv6 inválido para o prefixo /{route.cidr_prefix}. "
                            f"Use o endereço de rede canônico: {net6.network_address}/{route.cidr_prefix}."
                        ),
                    )
                )
            except ValueError as exc:
                issues.append(
                    ValidationIssue(
                        severity="ERROR",
                        field=f"{field_prefix}.destination_network",
                        message=f"Formato IPv6 inválido: {exc}",
                    )
                )
        try:
            ipaddress.IPv6Address(route.next_hop.strip())
        except ValueError:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field=f"{field_prefix}.next_hop",
                    message=f"Next-hop IPv6 inválido: '{route.next_hop}'.",
                )
            )
        return issues

    # IPv4 validation
    if route.cidr_prefix < 0 or route.cidr_prefix > 32:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field=f"{field_prefix}.cidr_prefix",
                message=f"Prefixo CIDR IPv4 inválido (/{route.cidr_prefix}). Deve estar entre /0 e /32.",
            )
        )
        return issues

    dest_str = route.destination_network.strip()
    try:
        ipaddress.IPv4Address(dest_str)
    except ValueError:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field=f"{field_prefix}.destination_network",
                message=f"Formato de endereço IPv4 inválido: '{dest_str}'.",
            )
        )
        return issues

    # Check if destination_network matches cidr_prefix (no host bits set)
    non_strict_net = ipaddress.IPv4Network(f"{dest_str}/{route.cidr_prefix}", strict=False)
    try:
        strict_net = ipaddress.IPv4Network(f"{dest_str}/{route.cidr_prefix}", strict=True)
    except ValueError:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field=f"{field_prefix}.destination_network",
                message=(
                    f"O endereço {dest_str} possui bits de host ativos para o prefixo /{route.cidr_prefix}. "
                    f"O endereço de rede correto é {non_strict_net.network_address}/{route.cidr_prefix}."
                ),
            )
        )
        strict_net = non_strict_net

    # Validate subnet mask if explicitly provided
    if route.subnet_mask:
        expected_mask = cidr_to_netmask(route.cidr_prefix)
        if route.subnet_mask.strip() != expected_mask:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field=f"{field_prefix}.subnet_mask",
                    message=(
                        f"A máscara informada ({route.subnet_mask}) não corresponde ao prefixo /{route.cidr_prefix} "
                        f"(esperado: {expected_mask})."
                    ),
                )
            )

    # Validate next-hop format
    nh_str = route.next_hop.strip()
    try:
        nh_ip = ipaddress.IPv4Address(nh_str)
        if nh_ip.is_unspecified or nh_ip.is_multicast or nh_ip.is_loopback:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field=f"{field_prefix}.next_hop",
                    message=f"O next-hop {nh_str} é um endereço reservado inválido para encaminhamento.",
                )
            )
    except ValueError:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field=f"{field_prefix}.next_hop",
                message=f"Endereço IPv4 de next-hop inválido: '{nh_str}'.",
            )
        )
        return issues

    # Check if next-hop is the gateway's own IP
    if new_vlanif_ip and nh_str == new_vlanif_ip.strip():
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field=f"{field_prefix}.next_hop",
                message=(
                    f"Conflito de next-hop: {nh_str} é o próprio endereço IP da Vlanif local. "
                    "O next-hop deve ser o IP do roteador do cliente (ex.: final .2)."
                ),
            )
        )

    for v in existing_vlanifs:
        if v.ip_address == nh_str:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field=f"{field_prefix}.next_hop",
                    message=(
                        f"Conflito de next-hop: {nh_str} pertence à própria interface local {v.interface_name} "
                        f"do equipamento {l3_device.name}."
                    ),
                )
            )

    # Check next-hop reachability across new Vlanif or existing Vlanifs on the L3 device
    reachable = False
    if new_vlanif_ip and new_vlanif_cidr:
        try:
            new_net = ipaddress.IPv4Network(f"{new_vlanif_ip.strip()}/{new_vlanif_cidr}", strict=False)
            if nh_ip in new_net and nh_ip != new_net.network_address and (new_vlanif_cidr >= 31 or nh_ip != new_net.broadcast_address):
                reachable = True
        except ValueError:
            pass

    if not reachable:
        for v in existing_vlanifs:
            try:
                vnet = ipaddress.IPv4Network(f"{v.ip_address}/{v.cidr_prefix}", strict=False)
                if nh_ip in vnet:
                    reachable = True
                    break
            except ValueError:
                continue

    if not reachable:
        issues.append(
            ValidationIssue(
                severity="WARNING",
                field=f"{field_prefix}.next_hop",
                message=(
                    f"Aviso de alcançabilidade: O next-hop {nh_str} não pertence diretamente a nenhuma sub-rede "
                    f"Vlanif cadastrada ou sendo criada em {l3_device.name}. Certifique-se de que a interface "
                    "de trânsito correspondente esteja ativa."
                ),
            )
        )

    # Check VRF support
    if route.vrf_name and not l3_device.supports_vrf:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field=f"{field_prefix}.vrf_name",
                message=f"O equipamento {l3_device.name} não suporta instâncias VPN/VRF.",
            )
        )

    # Check conflicting static routes on the L3 device
    for existing in existing_routes:
        if existing.ip_version != 4:
            continue
        try:
            ex_net = ipaddress.IPv4Network(
                f"{existing.destination_network}/{existing.cidr_prefix}",
                strict=False,
            )
            if ex_net == strict_net and (existing.vrf_name or None) == (route.vrf_name or None):
                if existing.next_hop == nh_str:
                    issues.append(
                        ValidationIssue(
                            severity="WARNING",
                            field=f"{field_prefix}.destination_network",
                            message=(
                                f"A rota {strict_net} via {nh_str} já está cadastrada em {l3_device.name} "
                                f"(protocolo: {existing.protocol})."
                            ),
                        )
                    )
                else:
                    issues.append(
                        ValidationIssue(
                            severity="ERROR",
                            field=f"{field_prefix}.destination_network",
                            message=(
                                f"Conflito de rota: O bloco {strict_net} já está roteado em {l3_device.name} "
                                f"para outro next-hop ({existing.next_hop}, protocolo {existing.protocol})."
                            ),
                        )
                    )
            elif ex_net.overlaps(strict_net) and (existing.vrf_name or None) == (route.vrf_name or None):
                issues.append(
                    ValidationIssue(
                        severity="WARNING",
                        field=f"{field_prefix}.destination_network",
                        message=(
                            f"Sobreposição de prefixo: O bloco {strict_net} sobrepõe a rota existente "
                            f"{ex_net} -> {existing.next_hop} em {l3_device.name}."
                        ),
                    )
                )
        except ValueError:
            continue

    return issues


def validate_provisioning_request(
    req: ProvisioningRequest,
    access_device: Device,
    l3_device: Device,
    port_iface: Optional[Interface],
    existing_vlans: List[Vlan],
    existing_vlanifs: List[Vlanif],
    existing_routes: List[StaticRoute],
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    if not port_iface:
        issues.append(
            ValidationIssue(
                severity="ERROR",
                field="interface_name",
                message=f"A porta '{req.interface_name}' não existe no equipamento {access_device.name}.",
            )
        )
    elif port_iface.physical_status == "ERROR":
        issues.append(
            ValidationIssue(
                severity="WARNING",
                field="interface_name",
                message=(
                    f"A interface {port_iface.name} apresenta erros físicos (CRC/RX). "
                    "Verifique o cabeamento ou módulo óptico SFP+."
                ),
            )
        )

    # Check VLAN conflicts
    for v in existing_vlans:
        if v.vlan_id == req.vlan_id:
            issues.append(
                ValidationIssue(
                    severity="INFO",
                    field="vlan_id",
                    message=(
                        f"A VLAN {req.vlan_id} ({v.description or v.name or 'Sem descrição'}) já existe no switch "
                        f"{access_device.name}; sua descrição será atualizada e preservada."
                    ),
                )
            )
            break

    # Validate Step 5: Vlanif
    if req.create_vlanif:
        target_vlanif_device = l3_device if not access_device.supports_l3_routing else access_device
        if not target_vlanif_device.supports_l3_routing:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field="create_vlanif",
                    message=(
                        f"O equipamento {target_vlanif_device.name} é Camada 2 puro e não suporta "
                        "interfaces L3 Vlanif com endereçamento IP."
                    ),
                )
            )
        if not req.vlanif_ipv4:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field="vlanif_ipv4",
                    message="Informe o endereço IPv4 da interface Vlanif.",
                )
            )
        else:
            cidr = req.vlanif_cidr or 30
            try:
                ip_obj = ipaddress.IPv4Address(req.vlanif_ipv4.strip())
                iface_net = ipaddress.IPv4Network(f"{ip_obj}/{cidr}", strict=False)
                if cidr < 31 and (
                    ip_obj == iface_net.network_address
                    or ip_obj == iface_net.broadcast_address
                ):
                    issues.append(
                        ValidationIssue(
                            severity="ERROR",
                            field="vlanif_ipv4",
                            message=(
                                f"O endereço {ip_obj} é endereço de rede ou broadcast para a máscara /{cidr}. "
                                "Utilize um IP de host válido (ex.: .1)."
                            ),
                        )
                    )

                for ex_vif in existing_vlanifs:
                    ex_net = ipaddress.IPv4Network(
                        f"{ex_vif.ip_address}/{ex_vif.cidr_prefix}", strict=False
                    )
                    if ex_vif.vlan_id == req.vlan_id and ex_vif.ip_address == str(ip_obj):
                        issues.append(
                            ValidationIssue(
                                severity="WARNING",
                                field="vlanif_ipv4",
                                message=(
                                    f"A interface Vlanif{req.vlan_id} já possui o IP {ip_obj}/{cidr} configurado."
                                ),
                            )
                        )
                    elif ex_vif.vlan_id != req.vlan_id and ex_net.overlaps(iface_net):
                        issues.append(
                            ValidationIssue(
                                severity="ERROR",
                                field="vlanif_ipv4",
                                message=(
                                    f"Conflito de endereçamento IP: A sub-rede {iface_net} sobrepõe a interface "
                                    f"existente {ex_vif.interface_name} ({ex_vif.ip_address}/{ex_vif.cidr_prefix})."
                                ),
                            )
                        )
            except ValueError:
                issues.append(
                    ValidationIssue(
                        severity="ERROR",
                        field="vlanif_ipv4",
                        message=f"Endereço IPv4 inválido para a Vlanif: '{req.vlanif_ipv4}'.",
                    )
                )

    # Validate Step 6: Static Routes
    if req.create_static_routes:
        if not req.static_routes:
            issues.append(
                ValidationIssue(
                    severity="ERROR",
                    field="static_routes",
                    message="Adicione ao menos uma rota estática ou desmarque a opção de rota estática.",
                )
            )
        seen_prefixes = set()
        for idx, route_item in enumerate(req.static_routes):
            key = (route_item.destination_network.strip(), route_item.cidr_prefix, route_item.next_hop.strip())
            if key in seen_prefixes:
                issues.append(
                    ValidationIssue(
                        severity="ERROR",
                        field=f"static_routes[{idx}].destination_network",
                        message=f"Rota duplicada no formulário: {route_item.destination_network}/{route_item.cidr_prefix}.",
                    )
                )
            seen_prefixes.add(key)

            route_issues = validate_static_route_item(
                route=route_item,
                l3_device=l3_device,
                existing_routes=existing_routes,
                existing_vlanifs=existing_vlanifs,
                new_vlanif_ip=req.vlanif_ipv4 if req.create_vlanif else None,
                new_vlanif_cidr=req.vlanif_cidr if req.create_vlanif else None,
                route_index=idx,
            )
            issues.extend(route_issues)

    return issues


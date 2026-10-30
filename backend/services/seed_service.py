from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.models.entities import (
    Role,
    User,
    Pop,
    Customer,
    Device,
    DeviceCredential,
    Interface,
    Vlan,
    Vlanif,
    StaticRoute,
    ConfigurationBackup,
    ProvisioningJob,
    ProvisioningCommand,
    AuditLog,
)
from backend.security.auth import hash_password
from backend.security.crypto import encrypt_secret
from backend.drivers.huawei.vrp_driver import HuaweiVRPDriver


def ensure_roles_users_and_customers(db: Session) -> None:
    """Ensures the 3 RBAC areas (admin, supervisor, operador) and initial Customers exist."""
    role_defs = [
        (
            "admin",
            "Administrador (Acesso Full)",
            "Acesso total irrestrito: Clientes, POPs, Equipamentos, Portas, VLANs, IPs, Rotas, Provisionamento e Área Admin.",
            [
                "admin:full",
                "customers:write",
                "pops:write",
                "devices:write",
                "vlans:write",
                "vlanifs:write",
                "routes:write",
                "ports:bind",
                "provisioning:execute",
                "users:write",
                "settings:write",
            ],
        ),
        (
            "supervisor",
            "Supervisor (Cadastro de Clientes e Equipamentos)",
            "Acesso dedicado exclusivamente para cadastrar, editar e remover Clientes, Equipamentos Huawei e POPs.",
            [
                "customers:write",
                "pops:write",
                "devices:write",
            ],
        ),
        (
            "operador",
            "Operador (VLAN, IP, Rota e Atrelar Cliente na Porta)",
            "Pode colocar e remover VLAN, IP (Vlanif), Rota Estática e atrelar/desatrelar Cliente e VLAN na porta física.",
            [
                "vlans:write",
                "vlanifs:write",
                "routes:write",
                "ports:bind",
                "provisioning:execute",
            ],
        ),
    ]

    role_map = {}
    for rname, dname, desc, perms in role_defs:
        r = db.query(Role).filter(Role.name == rname).first()
        if not r:
            r = Role(name=rname, display_name=dname, description=desc, permissions=perms)
            db.add(r)
            db.flush()
        else:
            r.display_name = dname
            r.description = desc
            r.permissions = perms
        role_map[rname] = r

    user_defs = [
        ("admin", "Carlos Eduardo (Admin Full)", "admin@isp.net.br", "admin"),
        ("supervisor", "Mariana Silva (Supervisora Cadastro)", "supervisor@isp.net.br", "supervisor"),
        ("operador", "Rafael Mendes (Operador NOC)", "operador@isp.net.br", "operador"),
    ]
    for uname, fname, email, rname in user_defs:
        u = db.query(User).filter(User.username == uname).first()
        if not u:
            u = User(
                username=uname,
                full_name=fname,
                email=email,
                password_hash=hash_password("Huawei@2026"),
                role_id=role_map[rname].id,
                is_active=True,
                all_pops_access=True,
            )
            db.add(u)
        else:
            u.full_name = fname
            u.role_id = role_map[rname].id
            u.is_active = True
    db.flush()

    if db.query(Customer).count() == 0:
        pop_motiro = db.query(Pop).filter(Pop.name == "POP MOTIRO").first()
        pop_silvina = db.query(Pop).filter(Pop.name == "POP SILVINA").first()
        sw_montiro = db.query(Device).filter(Device.name == "SWITCH-MPLS-MONTIRO").first()
        sw_silvina = db.query(Device).filter(Device.name == "SW-ACESSO-SILVINA-01").first()

        customers_seed = [
            Customer(
                name="CLIENTE-LGCONNECT",
                code="CLI-2443",
                document="18.452.910/0001-43",
                contact_name="Leandro Gomes",
                contact_phone="(11) 99812-2443",
                contact_email="noc@lgconnect.net.br",
                pop_id=pop_motiro.id if pop_motiro else None,
                device_id=sw_montiro.id if sw_montiro else None,
                interface_name="XGigabitEthernet0/0/39",
                vlan_id=2443,
                vlanif_ip="10.24.43.1/30",
                routed_block="45.0.0.0/30, 45.0.0.8/29",
                status="ATIVO",
                notes="Link Dedicado 1Gbps Full Duplex com entrega de bloco público /30 e /29.",
            ),
            Customer(
                name="CLIENTE-DATACENTER-ABC",
                code="CLI-2440",
                document="12.331.400/0001-10",
                contact_name="Fernando Costa",
                contact_phone="(11) 98741-2440",
                contact_email="infra@datacenterabc.com.br",
                pop_id=pop_motiro.id if pop_motiro else None,
                device_id=sw_montiro.id if sw_montiro else None,
                interface_name="XGigabitEthernet0/0/3",
                vlan_id=2440,
                vlanif_ip="10.24.40.1/30",
                routed_block="177.84.120.0/29",
                status="ATIVO",
                notes="Trânsito IP Dedicado Datacenter ABC.",
            ),
            Customer(
                name="CLIENTE-HOSPITAL-SAO-LUCAS",
                code="CLI-2441",
                document="44.910.220/0001-88",
                contact_name="Dra. Helena Prado",
                contact_phone="(11) 4122-2441",
                contact_email="ti@hospitalsaolucas.org.br",
                pop_id=pop_motiro.id if pop_motiro else None,
                device_id=sw_montiro.id if sw_montiro else None,
                interface_name="XGigabitEthernet0/0/4",
                vlan_id=2441,
                vlanif_ip="10.24.41.1/30",
                routed_block="200.150.10.0/30",
                status="ATIVO",
                notes="Circuito prioritário hospitalar SLA 99.95%.",
            ),
            Customer(
                name="CLIENTE-NOVA-FIBRA-EMPRESARIAL",
                code="CLI-2455",
                document="31.887.102/0001-05",
                contact_name="Marcos Oliveira",
                contact_phone="(11) 97110-2455",
                contact_email="redes@novafibra.com.br",
                pop_id=pop_silvina.id if pop_silvina else None,
                device_id=sw_silvina.id if sw_silvina else None,
                interface_name="GigabitEthernet0/0/6",
                vlan_id=2455,
                vlanif_ip="10.24.55.1/30",
                routed_block="45.0.55.0/29",
                status="PENDENTE",
                notes="Cadastrado pelo Supervisor — aguardando Operador atrelar VLAN 2455 na porta e ativar IP/Rota.",
            ),
        ]
        db.add_all(customers_seed)

    # Normalize free ports so any port marked LIVRE / PORTA-LIVRE / DISPONIVEL has empty description ("")
    all_ifaces = db.query(Interface).all()
    for iface in all_ifaces:
        desc_upper = (iface.description or "").strip().upper()
        if (
            desc_upper.startswith("LIVRE")
            or desc_upper.startswith("PORTA-LIVRE")
            or desc_upper.startswith("DISPONIVEL")
        ):
            iface.description = ""
            iface.pvid = 1
            iface.allowed_vlans = "1"
            iface.link_type = "access"
            cfg = f"interface {iface.name}\n port link-type access\n port default vlan 1\nquit"
            iface.discovered_config = cfg
            iface.desired_config = cfg
            iface.last_known_config = cfg

    # Ensure BNG-NE8000-CORE-SP also has free ports (ports 11 and 12)
    rt_core = db.query(Device).filter(Device.name == "BNG-NE8000-CORE-SP").first()
    if rt_core:
        for p_idx in (11, 12):
            p_obj = (
                db.query(Interface)
                .filter(Interface.device_id == rt_core.id, Interface.port_index == p_idx)
                .first()
            )
            if p_obj and (p_obj.description or "").startswith("DOWNLINK-POP"):
                p_obj.description = ""
                p_obj.pvid = 1
                p_obj.allowed_vlans = "1"
                p_obj.link_type = "access"
                cfg = f"interface {p_obj.name}\n port link-type access\n port default vlan 1\nquit"
                p_obj.discovered_config = cfg
                p_obj.desired_config = cfg
                p_obj.last_known_config = cfg

    # Ensure POP MOTIRO has a second switch (SW-ACESSO-MONTIRO-02) to demonstrate multi-switch POP selection
    pop_motiro_obj = db.query(Pop).filter(Pop.name == "POP MOTIRO").first()
    sw_montiro_02 = db.query(Device).filter(Device.name == "SW-ACESSO-MONTIRO-02").first()
    if pop_motiro_obj and not sw_montiro_02:
        sw_montiro_02 = Device(
            name="SW-ACESSO-MONTIRO-02",
            pop_id=pop_motiro_obj.id,
            vendor="Huawei",
            model="CloudEngine S5735-L24T4X-A1",
            management_ip="10.255.1.12",
            ssh_port=22,
            system_version="VRP V200R021C00SPC100",
            description="2º Switch de Acesso Corporativo do POP MOTIRO (24 portas GE + 4 SFP+ 10G)",
            status="ONLINE",
            supports_l3_routing=True,
            supports_vrf=False,
            supports_two_phase_commit=False,
            supports_ipv6=True,
            is_simulated=True,
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(sw_montiro_02)
        db.flush()
        db.add(
            DeviceCredential(
                device_id=sw_montiro_02.id,
                ssh_username="admin_noc",
                encrypted_password=encrypt_secret("HuaweiVRP#2026"),
            )
        )
        db.add(Vlan(device_id=sw_montiro_02.id, vlan_id=1, name="VLAN 0001", description="Default VLAN"))
        for idx in range(1, 25):
            if_name = f"GigabitEthernet0/0/{idx}"
            short_n = f"GE0/0/{idx}"
            if idx in (1, 2):
                desc = f"UPLINK-SWITCH-MPLS-MONTIRO-PORTA-{idx}"
                pvid = 1
                allowed = "1,100"
                ltype = "trunk"
                p_stat = "UP"
                cfg = f"interface {if_name}\n description {desc}\n port link-type trunk\n port trunk allow-pass vlan 100\nquit"
            else:
                desc = ""
                pvid = 1
                allowed = "1"
                ltype = "access"
                p_stat = "DOWN"
                cfg = f"interface {if_name}\n port link-type access\n port default vlan 1\nquit"
            db.add(
                Interface(
                    device_id=sw_montiro_02.id,
                    name=if_name,
                    short_name=short_n,
                    port_index=idx,
                    description=desc,
                    admin_status="UP",
                    physical_status=p_stat,
                    speed="1G",
                    duplex="Full",
                    mtu=1500,
                    link_type=ltype,
                    pvid=pvid,
                    allowed_vlans=allowed,
                    rx_rate_mbps=0.0,
                    tx_rate_mbps=0.0,
                    rx_errors=0,
                    tx_errors=0,
                    discovered_config=cfg,
                    desired_config=cfg,
                    last_known_config=cfg,
                )
            )

    if sw_montiro_02:
        has_sync_backup = (
            db.query(ConfigurationBackup)
            .filter(ConfigurationBackup.device_id == sw_montiro_02.id)
            .count()
            > 0
        )
        if not has_sync_backup:
            sw_montiro_02.last_synced_at = None
        if (
            db.query(StaticRoute)
            .filter(StaticRoute.device_id == sw_montiro_02.id)
            .count()
            == 0
        ):
            db.add_all(
                [
                    StaticRoute(
                        device_id=sw_montiro_02.id,
                        ip_version=4,
                        destination_network="0.0.0.0",
                        cidr_prefix=0,
                        subnet_mask="0.0.0.0",
                        next_hop="10.255.1.1",
                        preference=60,
                        description="ROTA-DEFAULT-GATEWAY-MOTIRO",
                        protocol="Static",
                        is_active=True,
                        discovered_config="ip route-static 0.0.0.0 0.0.0.0 10.255.1.1 description ROTA-DEFAULT-GATEWAY-MOTIRO",
                        desired_config="ip route-static 0.0.0.0 0.0.0.0 10.255.1.1 description ROTA-DEFAULT-GATEWAY-MOTIRO",
                        last_known_config="ip route-static 0.0.0.0 0.0.0.0 10.255.1.1 description ROTA-DEFAULT-GATEWAY-MOTIRO",
                    ),
                    StaticRoute(
                        device_id=sw_montiro_02.id,
                        ip_version=4,
                        destination_network="45.0.20.0",
                        cidr_prefix=30,
                        subnet_mask="255.255.255.252",
                        next_hop="10.24.20.2",
                        preference=60,
                        description="BLOCO-CLIENTE-MONTIRO-02",
                        protocol="Static",
                        is_active=True,
                        discovered_config="ip route-static 45.0.20.0 255.255.255.252 10.24.20.2 description BLOCO-CLIENTE-MONTIRO-02",
                        desired_config="ip route-static 45.0.20.0 255.255.255.252 10.24.20.2 description BLOCO-CLIENTE-MONTIRO-02",
                        last_known_config="ip route-static 45.0.20.0 255.255.255.252 10.24.20.2 description BLOCO-CLIENTE-MONTIRO-02",
                    ),
                ]
            )

    db.commit()


def seed_initial_data(db: Session) -> None:
    """Seeds initial RBAC roles, users, POPs, customers, and simulated Huawei switches."""
    if db.query(Pop).count() > 0:
        ensure_roles_users_and_customers(db)
        return

    # 1. Roles
    role_admin = Role(
        name="admin",
        display_name="Administrador",
        description="Acesso irrestrito a POPs, equipamentos, provisionamento SSH e usuários.",
        permissions=[
            "pops:write",
            "devices:write",
            "provisioning:execute",
            "routes:write",
            "users:write",
            "settings:write",
        ],
    )
    role_engineer = Role(
        name="engineer",
        display_name="Engenheiro de Rede",
        description="Pode cadastrar equipamentos, executar provisionamento SSH, gerenciar VLANs, Vlanifs e rotas.",
        permissions=[
            "pops:write",
            "devices:write",
            "provisioning:execute",
            "routes:write",
        ],
    )
    role_readonly = Role(
        name="readonly",
        display_name="Operador Somente Leitura",
        description="Visualiza dashboard, portas, VLANs, rotas e simula prévias sem aplicar via SSH.",
        permissions=["pops:read", "devices:read", "provisioning:preview"],
    )
    db.add_all([role_admin, role_engineer, role_readonly])
    db.flush()

    # 2. Users
    admin_user = User(
        username="admin",
        full_name="Carlos Eduardo (NOC Admin)",
        email="admin@isp.net.br",
        password_hash=hash_password("Huawei@2026"),
        role_id=role_admin.id,
        is_active=True,
        all_pops_access=True,
        last_login_at=datetime.now(timezone.utc),
    )
    eng_user = User(
        username="engenheiro",
        full_name="Rafael Mendes (Engenharia L3)",
        email="rafael.mendes@isp.net.br",
        password_hash=hash_password("Huawei@2026"),
        role_id=role_engineer.id,
        is_active=True,
        all_pops_access=True,
    )
    ro_user = User(
        username="operador",
        full_name="Juliana Costa (NOC N1 - Leitura)",
        email="juliana.costa@isp.net.br",
        password_hash=hash_password("Huawei@2026"),
        role_id=role_readonly.id,
        is_active=True,
        all_pops_access=True,
    )
    db.add_all([admin_user, eng_user, ro_user])
    db.flush()

    # 3. POPs
    pop_motiro = Pop(
        name="POP MOTIRO",
        city="São Bernardo do Campo",
        state="SP",
        address="Av. Robert Kennedy, 1840 - Bairro Assunção",
        description="POP de Agregação MPLS e Atendimento Dedicado B2B - Região Motiró",
        status="ATIVO",
    )
    pop_silvina = Pop(
        name="POP SILVINA",
        city="São Bernardo do Campo",
        state="SP",
        address="Estrada dos Alvarengas, 4120 - Jardim Silvina",
        description="POP de Acesso Metro Ethernet e Concentração FTTH/Empresarial",
        status="ATIVO",
    )
    pop_core_sp = Pop(
        name="POP CORE-SP",
        city="São Paulo",
        state="SP",
        address="Rua Doutor Ovídio Pires de Campos, 225 - PIX SP4",
        description="Datacenter Core BGP/MPLS, Trânsito IP e PTT-SP",
        status="ATIVO",
    )
    pop_vila_sp = Pop(
        name="POP VILA SÃO PEDRO",
        city="Santo André",
        state="SP",
        address="Rua das Hortênsias, 890 - Vila São Pedro",
        description="POP de Distribuição Regional ABC",
        status="ATIVO",
    )
    db.add_all([pop_motiro, pop_silvina, pop_core_sp, pop_vila_sp])
    db.flush()

    # 4. Devices
    sw_montiro = Device(
        name="SWITCH-MPLS-MONTIRO",
        pop_id=pop_motiro.id,
        vendor="Huawei",
        model="CloudEngine S6730-H48X6C",
        management_ip="10.255.1.10",
        ssh_port=22,
        system_version="VRP V200R021C00SPC100",
        description="Switch MPLS/L3 48x 10GE SFP+ de agregação de clientes dedicados no POP MOTIRO",
        status="ONLINE",
        supports_l3_routing=True,
        supports_vrf=True,
        supports_two_phase_commit=False,
        supports_ipv6=True,
        is_simulated=True,
        last_synced_at=datetime.now(timezone.utc),
    )
    sw_silvina = Device(
        name="SW-ACESSO-SILVINA-01",
        pop_id=pop_silvina.id,
        vendor="Huawei",
        model="S5735-L48T4X-A1",
        management_ip="10.255.2.15",
        ssh_port=22,
        system_version="VRP V200R020C10SPC500",
        description="Switch de Acesso Layer 2 puro (48 portas GE + 4 uplinks 10GE para o Core)",
        status="ONLINE",
        supports_l3_routing=False,
        supports_vrf=False,
        supports_two_phase_commit=False,
        supports_ipv6=True,
        is_simulated=True,
        last_synced_at=datetime.now(timezone.utc),
    )
    rt_core = Device(
        name="BNG-NE8000-CORE-SP",
        pop_id=pop_core_sp.id,
        vendor="Huawei",
        model="NetEngine 8000 M8",
        management_ip="10.255.0.1",
        ssh_port=22,
        system_version="VRP V800R022C00SPC500",
        description="Roteador de Borda e Core MPLS L3 com suporte a commit transacional",
        status="ONLINE",
        supports_l3_routing=True,
        supports_vrf=True,
        supports_two_phase_commit=True,
        supports_ipv6=True,
        is_simulated=True,
        last_synced_at=datetime.now(timezone.utc),
    )
    sw_vila = Device(
        name="SW-DIST-VILA-SP",
        pop_id=pop_vila_sp.id,
        vendor="Huawei",
        model="S6730-S24X6Q",
        management_ip="10.255.4.10",
        ssh_port=22,
        system_version="VRP V200R021C00SPC100",
        description="Switch de Distribuição L3 - Vila São Pedro (Em manutenção programada)",
        status="OFFLINE",
        supports_l3_routing=True,
        supports_vrf=True,
        supports_two_phase_commit=False,
        supports_ipv6=True,
        is_simulated=True,
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add_all([sw_montiro, sw_silvina, rt_core, sw_vila])
    db.flush()

    # Credentials encrypted at rest
    for dev in [sw_montiro, sw_silvina, rt_core, sw_vila]:
        cred = DeviceCredential(
            device_id=dev.id,
            ssh_username="noc.automation",
            encrypted_password=encrypt_secret("HuaweiVRP#2026!"),
            auth_method="password",
        )
        db.add(cred)

    # 5. Populate 48 real interfaces on SWITCH-MPLS-MONTIRO
    customer_ports = {
        1: ("UPLINK-CORE-SP-PRIMARY", "UP", "UP", "trunk", 1, "1,100,200,500,2440,2441,2442,2443", "8420.50 Mbps", "6190.20 Mbps", 0, 0),
        2: ("UPLINK-CORE-SP-BACKUP", "UP", "UP", "trunk", 1, "1,100,200,500,2440,2441,2442,2443", "1120.10 Mbps", "980.40 Mbps", 0, 0),
        3: ("CLIENTE-DATACENTER-ABC", "UP", "UP", "access", 2440, "2440", "940.80 Mbps", "815.30 Mbps", 0, 0),
        4: ("CLIENTE-HOSPITAL-SAO-LUCAS", "UP", "UP", "access", 2441, "2441", "450.20 Mbps", "390.10 Mbps", 0, 0),
        5: ("CLIENTE-SUPERMERCADO-CENTRAL", "UP", "UP", "access", 2442, "2442", "210.00 Mbps", "185.60 Mbps", 0, 0),
        8: ("LINK-RADIO-TORRE-SUL", "UP", "ALERT", "trunk", 1, "100,310,320", "312.40 Mbps", "295.00 Mbps", 18, 2),
        12: ("PORTA-COM-CRC-SFP-DEFEITO", "UP", "ERROR", "access", 500, "500", "12.10 Mbps", "4.50 Mbps", 1428, 89),
        15: ("OLT-HUAWEI-MA5800-X7-UPLINK", "UP", "UP", "trunk", 1, "100,1101,1102,1103,1104", "3850.00 Mbps", "1240.00 Mbps", 0, 0),
        24: ("ANEL-METRO-POP-SILVINA", "UP", "UP", "trunk", 1, "1,100,200,2450,2451", "2640.00 Mbps", "2110.00 Mbps", 0, 0),
        38: ("CLIENTE-TECHCORP-FIBRA", "UP", "UP", "access", 2438, "2438", "512.40 Mbps", "498.90 Mbps", 0, 0),
        39: ("DISPONIVEL-ENTREGA-B2B-39", "UP", "UP", "access", 1, "1", "0.45 Mbps", "0.12 Mbps", 0, 0),
        40: ("CLIENTE-LGCONNECT-LINK2", "UP", "UP", "trunk", 1, "100,2440", "620.00 Mbps", "540.00 Mbps", 0, 0),
        48: ("GERENCIA-OOB-NOC", "UP", "UP", "access", 100, "100", "14.20 Mbps", "18.90 Mbps", 0, 0),
    }

    for idx in range(1, 49):
        if idx in customer_ports:
            desc, adm, phy, ltype, pvid, avlan, rx, tx, rx_err, tx_err = customer_ports[idx]
        else:
            is_up = idx in (6, 7, 9, 10, 11, 16, 17, 18, 20, 22, 25, 26, 30, 32, 35, 36, 41, 42, 44)
            desc = f"CLIENTE-EMPRESARIAL-P{idx:02d}" if is_up else f"LIVRE-PORTA-{idx:02d}"
            adm = "UP"
            phy = "UP" if is_up else "DOWN"
            ltype = "access"
            pvid = 2400 + idx if is_up else 1
            avlan = str(pvid)
            rx = f"{(idx * 17.5) % 850:.2f} Mbps" if is_up else "0.00 Mbps"
            tx = f"{(idx * 13.2) % 720:.2f} Mbps" if is_up else "0.00 Mbps"
            rx_err = 0
            tx_err = 0

        iface_name = f"XGigabitEthernet0/0/{idx}"
        short_name = f"XGE0/0/{idx}"
        cfg_lines = [f"interface {iface_name}"]
        if desc:
            cfg_lines.append(f" description {desc}")
        cfg_lines.append(f" port link-type {ltype}")
        if ltype == "access":
            cfg_lines.append(f" port default vlan {pvid}")
        else:
            cfg_lines.append(f" port trunk allow-pass vlan {' '.join(avlan.split(','))}")
        cfg_lines.append("quit")
        cfg_str = "\n".join(cfg_lines)

        db.add(
            Interface(
                device_id=sw_montiro.id,
                port_index=idx,
                name=iface_name,
                short_name=short_name,
                description=desc,
                admin_status=adm,
                physical_status=phy,
                speed="10G",
                duplex="Full",
                mtu=1500,
                link_type=ltype,
                pvid=pvid,
                allowed_vlans=avlan,
                rx_rate_mbps=rx,
                tx_rate_mbps=tx,
                rx_errors=rx_err,
                tx_errors=tx_err,
                discovered_config=cfg_str,
                desired_config=cfg_str,
                last_known_config=cfg_str,
            )
        )

    # Populate 24 interfaces on SW-ACESSO-SILVINA-01
    for idx in range(1, 25):
        is_uplink = idx >= 23
        iface_name = f"XGigabitEthernet0/0/{idx - 22}" if is_uplink else f"GigabitEthernet0/0/{idx}"
        short_name = f"XGE0/0/{idx - 22}" if is_uplink else f"GE0/0/{idx}"
        is_up = is_uplink or (idx % 2 == 1)
        ltype = "trunk" if is_uplink else "access"
        pvid = 1 if is_uplink else (2500 + idx if is_up else 1)
        avlan = "1,100,2501,2503,2505" if is_uplink else str(pvid)
        desc = "UPLINK-POP-MOTIRO" if is_uplink else (f"ACESSO-SILVINA-P{idx:02d}" if is_up else "PORTA-LIVRE")
        cfg_str = (
            f"interface {iface_name}\n"
            f" description {desc}\n"
            f" port link-type {ltype}\n"
            + (f" port default vlan {pvid}\n" if ltype == "access" else f" port trunk allow-pass vlan {' '.join(avlan.split(','))}\n")
            + "quit"
        )
        db.add(
            Interface(
                device_id=sw_silvina.id,
                port_index=idx,
                name=iface_name,
                short_name=short_name,
                description=desc,
                admin_status="UP",
                physical_status="UP" if is_up else "DOWN",
                speed="10G" if is_uplink else "1G",
                duplex="Full",
                mtu=1500,
                link_type=ltype,
                pvid=pvid,
                allowed_vlans=avlan,
                rx_rate_mbps="420.10 Mbps" if is_up else "0.00 Mbps",
                tx_rate_mbps="380.40 Mbps" if is_up else "0.00 Mbps",
                rx_errors=0,
                tx_errors=0,
                discovered_config=cfg_str,
                desired_config=cfg_str,
                last_known_config=cfg_str,
            )
        )

    # Populate 12 100G/10G interfaces on BNG-NE8000-CORE-SP
    for idx in range(1, 13):
        iface_name = f"100GE0/1/{idx}" if idx <= 4 else f"XGigabitEthernet0/2/{idx - 4}"
        short_name = f"100GE0/1/{idx}" if idx <= 4 else f"XGE0/2/{idx - 4}"
        desc = f"BACKBONE-MPLS-LINK-{idx:02d}" if idx <= 4 else f"DOWNLINK-POP-AGREGACAO-{idx - 4:02d}"
        cfg_str = f"interface {iface_name}\n description {desc}\n port link-type trunk\n port trunk allow-pass vlan 100 200 2440 2441 2442 2443\nquit"
        db.add(
            Interface(
                device_id=rt_core.id,
                port_index=idx,
                name=iface_name,
                short_name=short_name,
                description=desc,
                admin_status="UP",
                physical_status="UP" if idx <= 10 else "DOWN",
                speed="100G" if idx <= 4 else "10G",
                duplex="Full",
                mtu=9216,
                link_type="trunk",
                pvid=1,
                allowed_vlans="100,200,2440,2441,2442,2443",
                rx_rate_mbps="18450.00 Mbps" if idx <= 4 else "3210.00 Mbps",
                tx_rate_mbps="16920.00 Mbps" if idx <= 4 else "2890.00 Mbps",
                rx_errors=0,
                tx_errors=0,
                discovered_config=cfg_str,
                desired_config=cfg_str,
                last_known_config=cfg_str,
            )
        )

    # 6. Seed VLANs
    seed_vlans = [
        (sw_montiro.id, 1, "VLAN-DEFAULT", "VLAN Padrão Nativa", "XGE0/0/1,XGE0/0/2", "XGE0/0/39"),
        (sw_montiro.id, 100, "GERENCIA-NOC", "Gerência de Equipamentos ISP", "XGE0/0/1,XGE0/0/2", "XGE0/0/48"),
        (sw_montiro.id, 2440, "CLIENTE-DATACENTER-ABC", "Link Dedicado 1Gbps Datacenter ABC", "XGE0/0/1", "XGE0/0/3"),
        (sw_montiro.id, 2441, "CLIENTE-HOSPITAL-SAO-LUCAS", "Link Dedicado Hospital São Lucas", "XGE0/0/1", "XGE0/0/4"),
        (sw_montiro.id, 2442, "CLIENTE-SUPERMERCADO-CENTRAL", "Link Dedicado Supermercado Central", "XGE0/0/1", "XGE0/0/5"),
        (sw_montiro.id, 2443, "CLIENTE-LGCONNECT", "Transporte Dedicado CLIENTE-LGCONNECT", "XGE0/0/1", "XGE0/0/39"),
        (sw_silvina.id, 100, "GERENCIA-SILVINA", "Gerência POP Silvina", "XGE0/0/1", ""),
        (sw_silvina.id, 2501, "CLIENTE-FIBRA-SILVINA", "Acesso Metro L2 Cliente Silvina", "XGE0/0/1", "GE0/0/1"),
        (rt_core.id, 100, "CORE-MGMT", "Gerência Core SP", "100GE0/1/1", ""),
        (rt_core.id, 2443, "CLIENTE-LGCONNECT", "Agregação L3 CLIENTE-LGCONNECT", "XGE0/2/1", ""),
    ]
    for dev_id, vid, vname, vdesc, tg, ut in seed_vlans:
        vcfg = f"vlan {vid}\n description {vdesc}\nquit"
        db.add(
            Vlan(
                device_id=dev_id,
                vlan_id=vid,
                name=vname,
                description=vdesc,
                tagged_ports=tg,
                untagged_ports=ut,
                discovered_config=vcfg,
                desired_config=vcfg,
                last_known_config=vcfg,
            )
        )

    # 7. Seed Vlanifs
    seed_vlanifs = [
        (sw_montiro.id, 100, "Vlanif100", "MGMT-SWITCH-MONTIRO", "10.255.1.10", "255.255.255.0", 24, None),
        (sw_montiro.id, 2440, "Vlanif2440", "GATEWAY-DATACENTER-ABC", "10.24.40.1", "255.255.255.252", 30, "2804:14d:40::1/64"),
        (sw_montiro.id, 2441, "Vlanif2441", "GATEWAY-HOSPITAL-SAO-LUCAS", "10.24.41.1", "255.255.255.252", 30, None),
        (sw_montiro.id, 2442, "Vlanif2442", "GATEWAY-SUPERMERCADO-CENTRAL", "10.24.42.1", "255.255.255.252", 30, None),
        (sw_montiro.id, 2443, "Vlanif2443", "GATEWAY-CLIENTE-LGCONNECT", "10.24.43.1", "255.255.255.252", 30, "2804:14d:2443::1/64"),
        (rt_core.id, 100, "Vlanif100", "CORE-LOOPBACK-VLANIF", "10.255.0.1", "255.255.255.0", 24, None),
    ]
    for dev_id, vid, iname, desc, ip, mask, cidr, ipv6 in seed_vlanifs:
        vif_cfg = f"interface {iname}\n description {desc}\n ip address {ip} {mask}\nquit"
        db.add(
            Vlanif(
                device_id=dev_id,
                vlan_id=vid,
                interface_name=iname,
                description=desc,
                ip_address=ip,
                subnet_mask=mask,
                cidr_prefix=cidr,
                ipv6_address=ipv6,
                discovered_config=vif_cfg,
                desired_config=vif_cfg,
                last_known_config=vif_cfg,
            )
        )

    # 8. Seed Static & Dynamic Routes (matching prompt section 6 & 9 examples)
    seed_routes = [
        (sw_montiro.id, 4, "45.0.0.0", 30, "255.255.255.252", "10.24.43.2", 60, "BLOCO-PUBLICO-CLIENTE", "Static", True),
        (sw_montiro.id, 4, "45.0.0.8", 29, "255.255.255.248", "10.24.43.2", 60, "BLOCO-ADICIONAL-LGCONNECT", "Static", True),
        (sw_montiro.id, 4, "177.84.120.0", 29, "255.255.255.248", "10.24.40.2", 60, "BLOCO-DATACENTER-ABC", "Static", True),
        (sw_montiro.id, 4, "200.150.10.0", 30, "255.255.255.252", "10.24.41.2", 60, "BLOCO-HOSPITAL-SAO-LUCAS", "Static", True),
        (sw_montiro.id, 4, "10.24.43.0", 30, "255.255.255.252", "10.24.43.1", 0, "CONECTADA-VLANIF2443", "Direct", True),
        (sw_montiro.id, 4, "10.255.0.0", 16, "255.255.0.0", "10.255.1.1", 10, "BACKBONE-OSPF-INTERNO", "OSPF", True),
        (rt_core.id, 4, "0.0.0.0", 0, "0.0.0.0", "200.160.0.1", 255, "FULL-ROUTING-UPSTREAM-PTT", "BGP", True),
        (rt_core.id, 4, "45.0.0.16", 28, "255.255.255.240", "10.255.1.10", 60, "ROTA-AGREGADA-POP-MOTIRO", "Static", True),
    ]
    for dev_id, ipv, dest, cidr, mask, nh, pref, desc, proto, active in seed_routes:
        rcfg = f"ip route-static {dest} {cidr} {nh} description {desc}" if proto == "Static" else f"# {proto} route {dest}/{cidr}"
        db.add(
            StaticRoute(
                device_id=dev_id,
                ip_version=ipv,
                destination_network=dest,
                cidr_prefix=cidr,
                subnet_mask=mask,
                next_hop=nh,
                preference=pref,
                description=desc,
                protocol=proto,
                is_active=active,
                discovered_config=rcfg,
                desired_config=rcfg,
                last_known_config=rcfg,
            )
        )

    db.flush()

    # 9. Generate initial current-configuration and backups for devices
    for dev in [sw_montiro, sw_silvina, rt_core, sw_vila]:
        driver = HuaweiVRPDriver(dev)
        driver.create_configuration_backup(
            db=db,
            user_id=admin_user.id,
            backup_type="INITIAL_DISCOVERY",
            comment=f"Snapshot inicial sincronizado de {dev.name}",
        )

    # 10. Seed sample provisioning job & audit logs for Dashboard and History
    sample_job = ProvisioningJob(
        pop_id=pop_motiro.id,
        device_id=sw_montiro.id,
        l3_routing_device_id=sw_montiro.id,
        user_id=admin_user.id,
        interface_name="XGigabitEthernet0/0/3",
        vlan_id=2440,
        vlan_description="CLIENTE-DATACENTER-ABC",
        port_mode="access",
        create_vlanif=True,
        vlanif_ipv4="10.24.40.1",
        vlanif_cidr=30,
        create_static_routes=True,
        routes_payload=[
            {
                "destination_network": "177.84.120.0",
                "cidr_prefix": 29,
                "next_hop": "10.24.40.2",
                "description": "BLOCO-DATACENTER-ABC",
                "preference": 60,
            }
        ],
        status="COMPLETED",
        before_config_snippet="interface XGigabitEthernet0/0/3\n port link-type access\n port default vlan 1\nquit",
        proposed_config_snippet=(
            "vlan 2440\n description CLIENTE-DATACENTER-ABC\nquit\n\n"
            "interface XGigabitEthernet0/0/3\n description CLIENTE-DATACENTER-ABC\n port link-type access\n port default vlan 2440\nquit\n\n"
            "interface Vlanif2440\n description GATEWAY-DATACENTER-ABC\n ip address 10.24.40.1 255.255.255.252\nquit\n\n"
            "ip route-static 177.84.120.0 29 10.24.40.2 description BLOCO-DATACENTER-ABC"
        ),
        execution_summary="Provisionamento completo de VLAN 2440, Vlanif2440 e rota 177.84.120.0/29 aplicado com sucesso.",
        is_simulated=True,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(sample_job)
    db.flush()

    sample_cmds = [
        "vlan 2440",
        " description CLIENTE-DATACENTER-ABC",
        "quit",
        "interface XGigabitEthernet0/0/3",
        " description CLIENTE-DATACENTER-ABC",
        " port link-type access",
        " port default vlan 2440",
        "quit",
        "interface Vlanif2440",
        " description GATEWAY-DATACENTER-ABC",
        " ip address 10.24.40.1 255.255.255.252",
        "quit",
        "ip route-static 177.84.120.0 29 10.24.40.2 description BLOCO-DATACENTER-ABC",
        "save",
    ]
    for idx, cmd_str in enumerate(sample_cmds, start=1):
        db.add(
            ProvisioningCommand(
                job_id=sample_job.id,
                target_device_id=sw_montiro.id,
                sequence_order=idx,
                command_text=cmd_str,
                device_output=f"[SWITCH-MPLS-MONTIRO] {cmd_str} -> OK",
                status="SUCCESS",
            )
        )

    db.add_all(
        [
            AuditLog(
                user_id=admin_user.id,
                username=admin_user.username,
                action="PROVISION_COMPLETE",
                resource_type="PROVISIONING",
                resource_id=str(sample_job.id),
                device_name="SWITCH-MPLS-MONTIRO",
                pop_name="POP MOTIRO",
                status="SUCCESS",
                details="Entregue VLAN 2440 + Vlanif2440 (10.24.40.1/30) + Rota 177.84.120.0/29 na porta XGE0/0/3.",
                is_simulated=True,
            ),
            AuditLog(
                user_id=eng_user.id,
                username=eng_user.username,
                action="SYNC_DEVICE",
                resource_type="DEVICE",
                resource_id=str(sw_montiro.id),
                device_name="SWITCH-MPLS-MONTIRO",
                pop_name="POP MOTIRO",
                status="SUCCESS",
                details="Sincronizadas 48 interfaces, 6 VLANs, 5 Vlanifs e 6 rotas via SSH VRP.",
                is_simulated=True,
            ),
            AuditLog(
                user_id=eng_user.id,
                username=eng_user.username,
                action="STATIC_ROUTE_ADD",
                resource_type="STATIC_ROUTE",
                resource_id="1",
                device_name="SWITCH-MPLS-MONTIRO",
                pop_name="POP MOTIRO",
                status="SUCCESS",
                details="Adicionada rota estática 45.0.0.0/30 -> 10.24.43.2 (BLOCO-PUBLICO-CLIENTE).",
                is_simulated=True,
            ),
        ]
    )
    db.commit()
    ensure_roles_users_and_customers(db)


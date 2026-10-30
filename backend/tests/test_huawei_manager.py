import os
import pytest
from fastapi.testclient import TestClient

# Use an isolated test SQLite database
os.environ["DATABASE_URL"] = "sqlite:///./test_huawei_manager.db"

from backend.main import app  # noqa: E402
from backend.database import Base, engine, SessionLocal  # noqa: E402
from backend.services.seed_service import seed_initial_data  # noqa: E402
from backend.schemas.api_schemas import (  # noqa: E402
    ProvisioningRequest,
    StaticRouteItemInput,
)
from backend.drivers.huawei.command_generator import (  # noqa: E402
    format_static_route_command,
    generate_provisioning_plan,
)
from backend.drivers.huawei.validator import (  # noqa: E402
    validate_static_route_item,
)
from backend.models.entities import Device, Interface  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("./test_huawei_manager.db"):
        try:
            os.remove("./test_huawei_manager.db")
        except OSError:
            pass


def get_auth_headers(client: TestClient, username: str = "admin", password: str = "Huawei@2026") -> dict:
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# =====================================================================
# 1. UNIT TESTS — HUAWEI VRP COMMAND GENERATION
# =====================================================================
def test_static_route_command_generation_single_and_multiple_blocks():
    r1 = StaticRouteItemInput(
        destination_network="45.0.0.0",
        cidr_prefix=30,
        next_hop="10.24.43.2",
        description="BLOCO-PUBLICO-CLIENTE",
        preference=60,
    )
    assert (
        format_static_route_command(r1)
        == "ip route-static 45.0.0.0 30 10.24.43.2 description BLOCO-PUBLICO-CLIENTE"
    )

    # Multiple public blocks without description
    r2 = StaticRouteItemInput(destination_network="45.0.0.8", cidr_prefix=29, next_hop="10.24.43.2")
    r3 = StaticRouteItemInput(destination_network="45.0.0.16", cidr_prefix=28, next_hop="10.24.43.2")
    assert format_static_route_command(r2) == "ip route-static 45.0.0.8 29 10.24.43.2"
    assert format_static_route_command(r3) == "ip route-static 45.0.0.16 28 10.24.43.2"

    # Custom preference and VRF
    r_vrf = StaticRouteItemInput(
        destination_network="45.0.0.32",
        cidr_prefix=29,
        next_hop="10.24.43.2",
        preference=80,
        vrf_name="VRF_DEDICADO",
        description="CLIENTE-VRF",
    )
    assert (
        format_static_route_command(r_vrf)
        == "ip route-static vpn-instance VRF_DEDICADO 45.0.0.32 29 10.24.43.2 preference 80 description CLIENTE-VRF"
    )

    # IPv6 static route support
    r_v6 = StaticRouteItemInput(
        ip_version=6,
        destination_network="2804:14d:2443::",
        cidr_prefix=48,
        next_hop="2804:14d:2443::2",
        description="BLOCO-IPV6-CLIENTE",
    )
    assert (
        format_static_route_command(r_v6)
        == "ipv6 route-static 2804:14d:2443:: 48 2804:14d:2443::2 description BLOCO-IPV6-CLIENTE"
    )


def test_access_and_trunk_port_command_generation():
    db = SessionLocal()
    try:
        sw = db.query(Device).filter(Device.name == "SWITCH-MPLS-MONTIRO").first()
        iface = (
            db.query(Interface)
            .filter(
                Interface.device_id == sw.id,
                Interface.name == "XGigabitEthernet0/0/39",
            )
            .first()
        )

        # Access Mode + Vlanif + Static Route (Exact Prompt Section 6 Example)
        req_access = ProvisioningRequest(
            pop_id=sw.pop_id,
            device_id=sw.id,
            interface_name="XGigabitEthernet0/0/39",
            vlan_id=2499,
            vlan_description="CLIENTE-LGCONNECT",
            port_mode="access",
            create_vlanif=True,
            vlanif_description="GATEWAY-CLIENTE-LGCONNECT",
            vlanif_ipv4="10.24.99.1",
            vlanif_cidr=30,
            create_static_routes=True,
            static_routes=[
                StaticRouteItemInput(
                    destination_network="45.0.10.0",
                    cidr_prefix=30,
                    next_hop="10.24.99.2",
                    description="BLOCO-PUBLICO-CLIENTE",
                    preference=60,
                )
            ],
        )

        _cur, proposed, _diff, plans, _script = generate_provisioning_plan(
            req=req_access,
            access_device=sw,
            l3_device=sw,
            iface=iface,
            existing_vlan=None,
            existing_vlanif=None,
            existing_routes=[],
        )
        assert "vlan 2499\n description CLIENTE-LGCONNECT\nquit" in proposed
        assert (
            "interface XGigabitEthernet0/0/39\n"
            " description CLIENTE-LGCONNECT\n"
            " port link-type access\n"
            " port default vlan 2499\n"
            "quit"
        ) in proposed
        assert (
            "interface Vlanif2499\n"
            " description GATEWAY-CLIENTE-LGCONNECT\n"
            " ip address 10.24.99.1 255.255.255.252\n"
            "quit"
        ) in proposed
        assert "ip route-static 45.0.10.0 30 10.24.99.2 description BLOCO-PUBLICO-CLIENTE" in proposed
        assert len(plans) == 1

        # Trunk Mode preserving existing allowed VLANs
        trunk_iface = (
            db.query(Interface)
            .filter(
                Interface.device_id == sw.id,
                Interface.name == "XGigabitEthernet0/0/40",
            )
            .first()
        )
        req_trunk = ProvisioningRequest(
            pop_id=sw.pop_id,
            device_id=sw.id,
            interface_name="XGigabitEthernet0/0/40",
            vlan_id=2443,
            vlan_description="CLIENTE-LGCONNECT",
            port_mode="trunk",
            preserve_existing_vlans=True,
        )
        _cur_t, proposed_t, _diff_t, plans_t, _script_t = generate_provisioning_plan(
            req=req_trunk,
            access_device=sw,
            l3_device=sw,
            iface=trunk_iface,
            existing_vlan=None,
            existing_vlanif=None,
            existing_routes=[],
        )
        # Incremental CLI command sent to switch:
        assert " port link-type trunk" in plans_t[0].commands
        assert " port trunk allow-pass vlan 2443" in plans_t[0].commands
        # Proposed state preserves existing VLANs (100, 2440) + 2443:
        assert "port trunk allow-pass vlan 100 2440 2443" in proposed_t
    finally:
        db.close()


# =====================================================================
# 2. UNIT TESTS — NETWORK & L3 CAPABILITY VALIDATION
# =====================================================================
def test_route_validation_blocks_host_bits_and_l2_switch():
    db = SessionLocal()
    try:
        l2_sw = db.query(Device).filter(Device.name == "SW-ACESSO-SILVINA-01").first()
        l3_sw = db.query(Device).filter(Device.name == "SWITCH-MPLS-MONTIRO").first()

        # 1. Host bits set on /30 network (45.0.0.1/30 instead of 45.0.0.0/30)
        bad_net_route = StaticRouteItemInput(
            destination_network="45.0.0.1",
            cidr_prefix=30,
            next_hop="10.24.43.2",
        )
        issues = validate_static_route_item(
            route=bad_net_route,
            l3_device=l3_sw,
            existing_routes=[],
            existing_vlanifs=[],
        )
        assert any(i.severity == "ERROR" and "45.0.0.0/30" in i.message for i in issues)

        # 2. Attempting static route on Layer 2-only switch
        valid_route = StaticRouteItemInput(
            destination_network="45.0.20.0",
            cidr_prefix=30,
            next_hop="10.24.43.2",
        )
        l2_issues = validate_static_route_item(
            route=valid_route,
            l3_device=l2_sw,
            existing_routes=[],
            existing_vlanifs=[],
        )
        assert any(i.severity == "ERROR" and "Camada 2" in i.message for i in l2_issues)
    finally:
        db.close()


# =====================================================================
# 3. INTEGRATION TESTS — API, 3-ROLE RBAC (ADMIN, SUPERVISOR, OPERADOR),
#    CUSTOMERS, PORT VLAN BINDING, AND PROVISIONING
# =====================================================================
def test_api_integration_end_to_end():
    with TestClient(app) as client:
        admin_headers = get_auth_headers(client, "admin", "Huawei@2026")
        sup_headers = get_auth_headers(client, "supervisor", "Huawei@2026")
        op_headers = get_auth_headers(client, "operador", "Huawei@2026")

        # 1. Verify devices never leak SSH passwords
        dev_resp = client.get("/api/v1/devices", headers=admin_headers)
        assert dev_resp.status_code == 200
        devices = dev_resp.json()
        assert len(devices) >= 4
        for d in devices:
            assert "ssh_password" not in d
            assert "encrypted_password" not in d

        montiro = next(d for d in devices if d["name"] == "SWITCH-MPLS-MONTIRO")

        # 2. Supervisor CAN register a Customer, Operador CANNOT register a Customer
        new_cust_payload = {
            "name": "CLIENTE-FIBRA-SUPERVISOR",
            "code": "CLI-2510",
            "document": "11.222.333/0001-44",
            "contact_name": "Roberto NOC",
            "pop_id": montiro["pop_id"],
            "device_id": montiro["id"],
            "interface_name": "XGigabitEthernet0/0/41",
            "vlan_id": 2510,
            "vlanif_ip": "10.25.10.1/30",
            "routed_block": "45.0.50.0/30",
        }
        op_create_cust = client.post("/api/v1/customers", json=new_cust_payload, headers=op_headers)
        assert op_create_cust.status_code == 403

        sup_create_cust = client.post("/api/v1/customers", json=new_cust_payload, headers=sup_headers)
        assert sup_create_cust.status_code == 201, sup_create_cust.text
        created_customer = sup_create_cust.json()
        assert created_customer["name"] == "CLIENTE-FIBRA-SUPERVISOR"

        # 3. Supervisor CANNOT execute port provisioning or bind VLAN on port
        provision_payload = {
            "pop_id": montiro["pop_id"],
            "device_id": montiro["id"],
            "interface_name": "XGigabitEthernet0/0/39",
            "vlan_id": 2488,
            "vlan_description": "CLIENTE-TESTE-E2E",
            "port_mode": "access",
            "create_vlanif": True,
            "vlanif_ipv4": "10.24.88.1",
            "vlanif_cidr": 30,
            "create_static_routes": True,
            "static_routes": [
                {
                    "destination_network": "45.0.88.0",
                    "cidr_prefix": 30,
                    "next_hop": "10.24.88.2",
                    "description": "BLOCO-PUBLICO-E2E",
                    "preference": 60,
                }
            ],
            "save_configuration": True,
            "explicit_confirmation": True,
        }

        sup_exec = client.post(
            "/api/v1/provisioning/execute",
            json=provision_payload,
            headers=sup_headers,
        )
        assert sup_exec.status_code == 403

        # 4. Operador CAN bind/unbind Customer & VLAN on a switch port and execute provisioning
        ifaces_resp = client.get(f"/api/v1/devices/{montiro['id']}/interfaces", headers=op_headers)
        assert ifaces_resp.status_code == 200
        port_41 = next(i for i in ifaces_resp.json() if i["name"] == "XGigabitEthernet0/0/41")

        bind_resp = client.post(
            f"/api/v1/interfaces/{port_41['id']}/bind-vlan",
            json={
                "vlan_id": 2510,
                "port_mode": "access",
                "customer_id": created_customer["id"],
                "description": "CLIENTE-FIBRA-SUPERVISOR",
                "auto_create_vlan": True,
            },
            headers=op_headers,
        )
        assert bind_resp.status_code == 200, bind_resp.text
        assert bind_resp.json()["pvid"] == 2510

        unbind_resp = client.post(
            f"/api/v1/interfaces/{port_41['id']}/unbind-vlan",
            headers=op_headers,
        )
        assert unbind_resp.status_code == 200, unbind_resp.text
        assert unbind_resp.json()["pvid"] == 1

        # 5. Preview & Execute provisioning as Operador (and Admin)
        prev_resp = client.post(
            "/api/v1/provisioning/preview",
            json=provision_payload,
            headers=op_headers,
        )
        assert prev_resp.status_code == 200
        prev_data = prev_resp.json()
        assert prev_data["is_valid"] is True
        assert "ip route-static 45.0.88.0 30 10.24.88.2 description BLOCO-PUBLICO-E2E" in prev_data["combined_cli_script"]

        exec_resp = client.post(
            "/api/v1/provisioning/execute",
            json=provision_payload,
            headers=op_headers,
        )
        assert exec_resp.status_code == 200, exec_resp.text
        exec_data = exec_resp.json()
        assert exec_data["status"] == "COMPLETED"
        assert exec_data["backup_id"] is not None
        assert exec_data["post_validation_passed"] is True
        assert len(exec_data["workflow_steps"]) == 6

        # 6. Analyze Switch VLANs, Ports and IPs via SSH endpoint
        analyze_resp = client.post(
            f"/api/v1/devices/{montiro['id']}/analyze-vlans",
            headers=op_headers,
        )
        assert analyze_resp.status_code == 200, analyze_resp.text
        analyze_data = analyze_resp.json()
        assert analyze_data["device_name"] == "SWITCH-MPLS-MONTIRO"
        assert analyze_data["total_vlans"] >= 5
        vlan_2488 = next((v for v in analyze_data["vlans"] if v["vlan_id"] == 2488), None)
        assert vlan_2488 is not None
        assert vlan_2488["vlan_description"] == "CLIENTE-TESTE-E2E"
        assert any(p["interface_name"] == "XGigabitEthernet0/0/39" for p in vlan_2488["ports"])
        assert any(ip["ip_address"] == "10.24.88.1" for ip in vlan_2488["ips"])

        # 7. Import from Switch (auto-populates all system tables)
        import_resp = client.post(
            f"/api/v1/devices/{montiro['id']}/import-from-switch",
            headers=op_headers,
        )
        assert import_resp.status_code == 200, import_resp.text
        import_data = import_resp.json()
        assert import_data["interfaces_synced"] == 48
        assert import_data["customers_populated"] >= 3
        assert len(import_data["records"]) >= 3

        # 8. Switch Full .TXT Backup & System Full Backup (Restricted strictly to Admin)
        op_bkp_forbidden = client.post(
            f"/api/v1/devices/{montiro['id']}/backup-txt",
            headers=op_headers,
        )
        assert op_bkp_forbidden.status_code == 403

        sw_bkp_resp = client.post(
            f"/api/v1/devices/{montiro['id']}/backup-txt",
            headers=admin_headers,
        )
        assert sw_bkp_resp.status_code == 200, sw_bkp_resp.text
        sw_bkp = sw_bkp_resp.json()
        assert sw_bkp["filename"].endswith(".txt")
        assert "display cu" in sw_bkp["config_txt"]
        assert "sysname SWITCH-MPLS-MONTIRO" in sw_bkp["config_txt"]
        assert "interface XGigabitEthernet0/0/39" in sw_bkp["config_txt"]

        sys_bkp_resp = client.post(
            "/api/v1/backups/system",
            headers=admin_headers,
        )
        assert sys_bkp_resp.status_code == 200, sys_bkp_resp.text
        sys_bkp = sys_bkp_resp.json()
        assert sys_bkp["counts"]["pops"] >= 4
        assert sys_bkp["counts"]["devices"] >= 4
        assert len(sys_bkp["backup_json_text"]) > 100



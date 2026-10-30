from datetime import datetime
from typing import List, Optional
import ipaddress
import re
from pydantic import BaseModel, Field, field_validator


# --- Auth & Users ---
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class RoleSchema(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str] = None
    permissions: List[str] = []

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    is_active: bool
    all_pops_access: bool
    role: RoleSchema
    allowed_pop_ids: List[int] = []
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    full_name: str = Field(..., min_length=3, max_length=120)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=6, max_length=128)
    role_name: str = Field(default="engineer")
    all_pops_access: bool = True
    allowed_pop_ids: List[int] = []


# --- POPs ---
class PopBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=50)
    address: Optional[str] = None
    description: Optional[str] = None
    status: str = Field(default="ATIVO")


class PopCreate(PopBase):
    pass


class PopUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class PopOut(PopBase):
    id: int
    device_count: int = 0
    online_devices: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Customers (Clientes ISP) ---
class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    code: str = Field(..., min_length=2, max_length=50)
    document: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    pop_id: Optional[int] = None
    device_id: Optional[int] = None
    interface_name: Optional[str] = None
    vlan_id: Optional[int] = Field(default=None, ge=1, le=4094)
    vlanif_ip: Optional[str] = None
    routed_block: Optional[str] = None
    status: str = Field(default="ATIVO")
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    document: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    pop_id: Optional[int] = None
    device_id: Optional[int] = None
    interface_name: Optional[str] = None
    vlan_id: Optional[int] = None
    vlanif_ip: Optional[str] = None
    routed_block: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    name: str
    code: str
    document: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    pop_id: Optional[int] = None
    pop_name: Optional[str] = None
    device_id: Optional[int] = None
    device_name: Optional[str] = None
    interface_name: Optional[str] = None
    vlan_id: Optional[int] = None
    vlanif_ip: Optional[str] = None
    routed_block: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortBindVlanRequest(BaseModel):
    vlan_id: int = Field(..., ge=1, le=4094)
    port_mode: str = Field(default="access")  # access, trunk, hybrid
    customer_id: Optional[int] = None
    description: Optional[str] = None
    preserve_existing_vlans: bool = True


# --- Devices ---
class DeviceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    pop_id: int
    vendor: str = Field(default="Huawei")
    model: str = Field(..., min_length=2, max_length=100)
    management_ip: str
    ssh_port: int = Field(default=22, ge=1, le=65535)
    ssh_username: str = Field(..., min_length=1, max_length=100)
    ssh_password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    system_version: Optional[str] = "VRP V200R021C00SPC100"
    description: Optional[str] = None
    supports_l3_routing: bool = True
    supports_vrf: bool = True
    supports_two_phase_commit: bool = False
    is_simulated: bool = True

    @field_validator("management_ip")
    @classmethod
    def validate_ip(cls, v: str) -> str:
        try:
            ipaddress.ip_address(v.strip())
            return v.strip()
        except ValueError as exc:
            raise ValueError("Endereço IP de gerenciamento inválido.") from exc


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    pop_id: Optional[int] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    management_ip: Optional[str] = None
    ssh_port: Optional[int] = Field(default=None, ge=1, le=65535)
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    system_version: Optional[str] = None
    description: Optional[str] = None
    supports_l3_routing: Optional[bool] = None
    supports_vrf: Optional[bool] = None
    supports_two_phase_commit: Optional[bool] = None
    is_simulated: Optional[bool] = None
    status: Optional[str] = None


class DeviceOut(BaseModel):
    """Notice: Never exposes ssh_password or ssh_private_key!"""
    id: int
    name: str
    pop_id: int
    pop_name: Optional[str] = None
    vendor: str
    model: str
    management_ip: str
    ssh_port: int
    ssh_username: Optional[str] = None
    has_credentials: bool = True
    auth_method: str = "password"
    system_version: Optional[str] = None
    description: Optional[str] = None
    status: str
    supports_l3_routing: bool
    supports_vrf: bool
    supports_two_phase_commit: bool
    supports_ipv6: bool
    is_simulated: bool
    interface_count: int = 0
    up_interfaces: int = 0
    vlan_count: int = 0
    vlanif_count: int = 0
    route_count: int = 0
    last_synced_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Interfaces ---
class InterfaceOut(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str] = None
    port_index: int
    name: str
    short_name: str
    description: Optional[str] = None
    admin_status: str
    physical_status: str
    speed: str
    duplex: str
    mtu: int
    link_type: str
    pvid: int
    allowed_vlans: str
    untagged_vlans: Optional[str] = None
    rx_rate_mbps: str
    tx_rate_mbps: str
    rx_errors: int
    tx_errors: int
    discovered_config: Optional[str] = None
    desired_config: Optional[str] = None
    last_known_config: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- VLANs ---
class VlanCreate(BaseModel):
    device_id: int
    vlan_id: int = Field(..., ge=1, le=4094)
    name: Optional[str] = None
    description: str = Field(..., min_length=1, max_length=120)


class VlanOut(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str] = None
    pop_name: Optional[str] = None
    vlan_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    vlan_type: str
    status: str
    tagged_ports: str
    untagged_ports: str
    discovered_config: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Vlanifs ---
class VlanifCreate(BaseModel):
    device_id: int
    vlan_id: int = Field(..., ge=1, le=4094)
    description: Optional[str] = None
    ip_address: str
    cidr_prefix: int = Field(default=30, ge=1, le=32)
    ipv6_address: Optional[str] = None
    vrf_name: Optional[str] = None

    @field_validator("ip_address")
    @classmethod
    def validate_ipv4(cls, v: str) -> str:
        ip = ipaddress.IPv4Address(v.strip())
        return str(ip)


class VlanifOut(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str] = None
    pop_name: Optional[str] = None
    vlan_id: int
    interface_name: str
    description: Optional[str] = None
    ip_address: str
    subnet_mask: str
    cidr_prefix: int
    ipv6_address: Optional[str] = None
    admin_status: str
    protocol_status: str
    vrf_name: Optional[str] = None
    discovered_config: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Static Routes ---
class StaticRouteItemInput(BaseModel):
    ip_version: int = Field(default=4)
    destination_network: str
    cidr_prefix: int = Field(..., ge=0, le=128)
    subnet_mask: Optional[str] = None
    next_hop: str
    description: Optional[str] = None
    preference: int = Field(default=60, ge=1, le=255)
    vrf_name: Optional[str] = None

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = re.sub(r"[^A-Za-z0-9_\-\.]", "-", v.strip())
        return cleaned[:80]


class StaticRouteCreate(StaticRouteItemInput):
    device_id: int


class StaticRouteUpdate(BaseModel):
    destination_network: Optional[str] = None
    cidr_prefix: Optional[int] = Field(default=None, ge=0, le=128)
    next_hop: Optional[str] = None
    description: Optional[str] = None
    preference: Optional[int] = Field(default=None, ge=1, le=255)
    vrf_name: Optional[str] = None
    is_active: Optional[bool] = None


class StaticRouteOut(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str] = None
    pop_name: Optional[str] = None
    ip_version: int
    destination_network: str
    cidr_prefix: int
    subnet_mask: str
    next_hop: str
    preference: int
    description: Optional[str] = None
    vrf_name: Optional[str] = None
    protocol: str
    is_active: bool
    discovered_config: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Provisioning Wizard ---
class ProvisioningRequest(BaseModel):
    pop_id: int
    device_id: int
    interface_name: str = Field(..., min_length=2, max_length=100)

    # Step 4: VLAN & Port config
    vlan_id: int = Field(..., ge=1, le=4094)
    vlan_description: str = Field(..., min_length=1, max_length=80)
    port_description: Optional[str] = None
    port_mode: str = Field(default="access")  # access, trunk, hybrid
    hybrid_tagged: bool = True
    auto_create_vlan: bool = True
    preserve_existing_vlans: bool = True

    # Step 5: Vlanif
    create_vlanif: bool = False
    vlanif_device_id: Optional[int] = None  # defaults to device_id or l3_routing_device_id
    vlanif_description: Optional[str] = None
    vlanif_ipv4: Optional[str] = None
    vlanif_cidr: Optional[int] = Field(default=30, ge=1, le=32)
    vlanif_subnet_mask: Optional[str] = None
    vlanif_ipv6: Optional[str] = None
    vlanif_vrf_name: Optional[str] = None

    # Step 6: Static Routes
    create_static_routes: bool = False
    l3_routing_device_id: Optional[int] = None  # Allows choosing L3 device if access switch is L2
    static_routes: List[StaticRouteItemInput] = []

    # Execution flags
    save_configuration: bool = True
    explicit_confirmation: bool = False

    @field_validator("vlan_description", "port_description", "vlanif_description")
    @classmethod
    def sanitize_cli_description(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        # Prevent CLI command injection via newlines or semicolons
        cleaned = re.sub(r"[\r\n;|&`$<>]", "", v.strip())
        cleaned = re.sub(r"\s+", "-", cleaned)
        return cleaned[:80]


class DiffLine(BaseModel):
    line_type: str  # context, added, removed, modified
    before_line: Optional[str] = None
    after_line: Optional[str] = None


class ValidationIssue(BaseModel):
    severity: str  # ERROR, WARNING, INFO
    field: str
    message: str


class DeviceCommandPlan(BaseModel):
    device_id: int
    device_name: str
    management_ip: str
    model: str
    system_version: str
    role_in_plan: str  # ACCESS_SWITCH, L3_ROUTER, COMBINED
    commands: List[str]


class ProvisioningPreviewResponse(BaseModel):
    is_valid: bool
    issues: List[ValidationIssue]
    current_config_text: str
    proposed_config_text: str
    diff_lines: List[DiffLine]
    device_plans: List[DeviceCommandPlan]
    combined_cli_script: str
    is_simulated: bool


class CommandExecutionResult(BaseModel):
    sequence_order: int
    device_name: str
    command_text: str
    device_output: str
    status: str


class ProvisioningExecutionResponse(BaseModel):
    job_id: int
    status: str
    backup_id: Optional[int] = None
    is_simulated: bool
    summary: str
    workflow_steps: List[dict]
    command_results: List[CommandExecutionResult]
    post_validation_passed: bool
    created_at: datetime


# --- Switch VLAN Analysis (SSH Inspection) ---
class AnalyzedVlanPortItem(BaseModel):
    interface_id: int
    port_index: int
    interface_name: str
    short_name: str
    link_type: str  # access, trunk, hybrid
    tag_mode: str   # Untagged (PVID) | Tagged (Trunk)
    physical_status: str
    speed: str
    port_description: str


class AnalyzedVlanIpItem(BaseModel):
    vlanif_id: int
    interface_name: str
    ip_address: str
    cidr_prefix: int
    subnet_mask: str
    ipv6_address: Optional[str] = None
    description: str
    status: str
    vrf_name: Optional[str] = None
    routed_blocks: List[str] = []


class AnalyzedVlanItem(BaseModel):
    vlan_id: int
    vlan_name: str
    vlan_description: str
    vlan_status: str
    ports: List[AnalyzedVlanPortItem] = []
    ips: List[AnalyzedVlanIpItem] = []


class SwitchVlanAnalysisResponse(BaseModel):
    device_id: int
    device_name: str
    pop_name: str
    model: str
    management_ip: str
    system_version: str
    is_simulated: bool
    ssh_latency_ms: float
    analyzed_at: datetime
    total_vlans: int
    total_ports_with_vlan: int
    total_l3_ips: int
    vlans: List[AnalyzedVlanItem]
    cli_transcript: str


class ImportedTableRecord(BaseModel):
    vlan_id: int
    vlan_name: str
    customer_or_description: str
    interface_name: str
    port_mode: str
    port_status: str
    vlanif_ip: str
    routed_block: str
    sync_action: str  # IMPORTADO, ATUALIZADO, SINCRONIZADO


class SwitchImportResponse(BaseModel):
    device_id: int
    device_name: str
    pop_name: str
    management_ip: str
    imported_at: datetime
    vlans_synced: int
    interfaces_synced: int
    vlanifs_synced: int
    routes_synced: int
    customers_populated: int
    records: List[ImportedTableRecord]
    message: str


class SwitchBackupTxtResponse(BaseModel):
    backup_id: int
    device_id: int
    device_name: str
    pop_name: str
    management_ip: str
    model: str
    system_version: str
    filename: str
    config_txt: str
    size_bytes: int
    created_at: datetime


class SystemBackupResponse(BaseModel):
    backup_id: str
    filename: str
    created_at: datetime
    created_by: str
    size_bytes: int
    counts: dict
    backup_json_text: str
    backup_txt_summary: str




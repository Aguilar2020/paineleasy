from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Table,
    Index,
    JSON,
)
from sqlalchemy.orm import relationship
from backend.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# Junction table for restricting user access to specific POPs
user_pops = Table(
    "user_pops",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("pop_id", Integer, ForeignKey("pops.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # admin, engineer, readonly
    display_name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    permissions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    all_pops_access = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    role = relationship("Role", back_populates="users")
    allowed_pops = relationship("Pop", secondary=user_pops, back_populates="allowed_users")
    provisioning_jobs = relationship("ProvisioningJob", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Pop(Base):
    __tablename__ = "pops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    city = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False)
    address = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="ATIVO", nullable=False, index=True)  # ATIVO, MANUTENCAO, INATIVO
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    devices = relationship("Device", back_populates="pop", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="pop")
    allowed_users = relationship("User", secondary=user_pops, back_populates="allowed_pops")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # ex: CLI-2443
    document = Column(String(40), nullable=True)  # CNPJ / CPF
    contact_name = Column(String(100), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(120), nullable=True)
    pop_id = Column(Integer, ForeignKey("pops.id", ondelete="SET NULL"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    interface_name = Column(String(100), nullable=True)
    vlan_id = Column(Integer, nullable=True)
    vlanif_ip = Column(String(64), nullable=True)
    routed_block = Column(String(100), nullable=True)
    status = Column(String(30), default="ATIVO", nullable=False, index=True)  # ATIVO, PENDENTE, SUSPENSO
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    pop = relationship("Pop", back_populates="customers")
    device = relationship("Device")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False, index=True)
    pop_id = Column(Integer, ForeignKey("pops.id", ondelete="RESTRICT"), nullable=False, index=True)
    vendor = Column(String(50), default="Huawei", nullable=False, index=True)
    model = Column(String(100), nullable=False)  # e.g., S6730-H48X6C, S5735-L48T4X-A1, NE8000-M8
    management_ip = Column(String(64), unique=True, nullable=False, index=True)
    ssh_port = Column(Integer, default=22, nullable=False)
    system_version = Column(String(100), nullable=True)  # e.g., VRP V200R021C00SPC100
    description = Column(Text, nullable=True)

    # Capabilities & Operational state
    status = Column(String(30), default="ONLINE", nullable=False, index=True)  # ONLINE, OFFLINE, ALERTA, MANUTENCAO
    supports_l3_routing = Column(Boolean, default=True, nullable=False)
    supports_vrf = Column(Boolean, default=True, nullable=False)
    supports_two_phase_commit = Column(Boolean, default=False, nullable=False)
    supports_ipv6 = Column(Boolean, default=True, nullable=False)
    is_simulated = Column(Boolean, default=False, nullable=False)

    # Separation between discovered, desired, and last known configurations
    discovered_config = Column(Text, nullable=True)
    desired_config = Column(Text, nullable=True)
    last_known_config = Column(Text, nullable=True)

    # Active operation lock to prevent simultaneous modifications on the same device
    locked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    pop = relationship("Pop", back_populates="devices")
    credential = relationship(
        "DeviceCredential",
        back_populates="device",
        uselist=False,
        cascade="all, delete-orphan",
    )
    interfaces = relationship("Interface", back_populates="device", cascade="all, delete-orphan")
    vlans = relationship("Vlan", back_populates="device", cascade="all, delete-orphan")
    vlanifs = relationship("Vlanif", back_populates="device", cascade="all, delete-orphan")
    static_routes = relationship("StaticRoute", back_populates="device", cascade="all, delete-orphan")
    backups = relationship("ConfigurationBackup", back_populates="device", cascade="all, delete-orphan")
    provisioning_jobs = relationship(
        "ProvisioningJob",
        foreign_keys="ProvisioningJob.device_id",
        back_populates="device",
        cascade="all, delete-orphan",
    )


class DeviceCredential(Base):
    __tablename__ = "device_credentials"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), unique=True, nullable=False)
    ssh_username = Column(String(100), nullable=False)
    encrypted_password = Column(Text, nullable=True)
    encrypted_private_key = Column(Text, nullable=True)
    auth_method = Column(String(30), default="password", nullable=False)  # password, private_key
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    device = relationship("Device", back_populates="credential")


class Interface(Base):
    __tablename__ = "interfaces"
    __table_args__ = (
        Index("ix_interfaces_device_name", "device_id", "name", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    port_index = Column(Integer, nullable=False, default=1)
    name = Column(String(100), nullable=False)  # e.g., XGigabitEthernet0/0/39
    short_name = Column(String(40), nullable=False)  # e.g., XGE0/0/39
    description = Column(String(255), nullable=True)
    admin_status = Column(String(20), default="UP", nullable=False)  # UP, DOWN
    physical_status = Column(String(20), default="UP", nullable=False)  # UP, DOWN, ERROR, ALERT
    speed = Column(String(30), default="10G", nullable=False)
    duplex = Column(String(20), default="Full", nullable=False)
    mtu = Column(Integer, default=1500, nullable=False)
    link_type = Column(String(20), default="access", nullable=False)  # access, trunk, hybrid, routed
    pvid = Column(Integer, default=1, nullable=False)
    allowed_vlans = Column(String(500), default="1", nullable=False)  # e.g., "1,100,2443"
    untagged_vlans = Column(String(500), nullable=True)
    rx_rate_mbps = Column(String(40), default="0.00 Mbps", nullable=False)
    tx_rate_mbps = Column(String(40), default="0.00 Mbps", nullable=False)
    rx_errors = Column(Integer, default=0, nullable=False)
    tx_errors = Column(Integer, default=0, nullable=False)

    # Config tracking per interface
    discovered_config = Column(Text, nullable=True)
    desired_config = Column(Text, nullable=True)
    last_known_config = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    device = relationship("Device", back_populates="interfaces")


class Vlan(Base):
    __tablename__ = "vlans"
    __table_args__ = (
        Index("ix_vlans_device_vlan_id", "device_id", "vlan_id", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    vlan_id = Column(Integer, nullable=False, index=True)
    name = Column(String(120), nullable=True)
    description = Column(String(255), nullable=True)
    vlan_type = Column(String(30), default="common", nullable=False)
    status = Column(String(20), default="UP", nullable=False)
    tagged_ports = Column(String(500), default="", nullable=False)
    untagged_ports = Column(String(500), default="", nullable=False)
    discovered_config = Column(Text, nullable=True)
    desired_config = Column(Text, nullable=True)
    last_known_config = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    device = relationship("Device", back_populates="vlans")


class Vlanif(Base):
    __tablename__ = "vlanifs"
    __table_args__ = (
        Index("ix_vlanifs_device_vlan_id", "device_id", "vlan_id", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    vlan_id = Column(Integer, nullable=False, index=True)
    interface_name = Column(String(60), nullable=False)  # e.g., Vlanif2443
    description = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=False)  # e.g., 10.24.43.1
    subnet_mask = Column(String(64), nullable=False)  # e.g., 255.255.255.252
    cidr_prefix = Column(Integer, nullable=False, default=30)
    ipv6_address = Column(String(128), nullable=True)
    admin_status = Column(String(20), default="UP", nullable=False)
    protocol_status = Column(String(20), default="UP", nullable=False)
    vrf_name = Column(String(100), nullable=True)
    discovered_config = Column(Text, nullable=True)
    desired_config = Column(Text, nullable=True)
    last_known_config = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    device = relationship("Device", back_populates="vlanifs")


class StaticRoute(Base):
    __tablename__ = "static_routes"
    __table_args__ = (
        Index("ix_routes_device_dest_nh", "device_id", "destination_network", "cidr_prefix", "next_hop"),
    )

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_version = Column(Integer, default=4, nullable=False)  # 4 or 6
    destination_network = Column(String(64), nullable=False, index=True)  # e.g., 45.0.0.0
    cidr_prefix = Column(Integer, nullable=False)  # e.g., 30
    subnet_mask = Column(String(64), nullable=False)  # e.g., 255.255.255.252
    next_hop = Column(String(64), nullable=False, index=True)  # e.g., 10.24.43.2
    preference = Column(Integer, default=60, nullable=False)
    description = Column(String(255), nullable=True)
    vrf_name = Column(String(100), nullable=True)
    protocol = Column(String(30), default="Static", nullable=False, index=True)  # Static, Direct, OSPF, BGP
    is_active = Column(Boolean, default=True, nullable=False)
    discovered_config = Column(Text, nullable=True)
    desired_config = Column(Text, nullable=True)
    last_known_config = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    device = relationship("Device", back_populates="static_routes")


class ConfigurationBackup(Base):
    __tablename__ = "configuration_backups"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    backup_type = Column(String(50), default="PRE_PROVISIONING", nullable=False)  # PRE_PROVISIONING, MANUAL, SCHEDULED
    config_content = Column(Text, nullable=False)
    checksum = Column(String(64), nullable=False)
    comment = Column(String(255), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    device = relationship("Device", back_populates="backups")


class ProvisioningJob(Base):
    __tablename__ = "provisioning_jobs"

    id = Column(Integer, primary_key=True, index=True)
    pop_id = Column(Integer, ForeignKey("pops.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    l3_routing_device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    interface_name = Column(String(100), nullable=False)
    vlan_id = Column(Integer, nullable=False)
    vlan_description = Column(String(255), nullable=True)
    port_mode = Column(String(20), nullable=False)  # access, trunk, hybrid
    create_vlanif = Column(Boolean, default=False, nullable=False)
    vlanif_ipv4 = Column(String(64), nullable=True)
    vlanif_cidr = Column(Integer, nullable=True)
    create_static_routes = Column(Boolean, default=False, nullable=False)
    routes_payload = Column(JSON, nullable=True)

    status = Column(String(30), default="COMPLETED", nullable=False, index=True)  # PENDING, VALIDATED, RUNNING, COMPLETED, FAILED, ROLLED_BACK
    before_config_snippet = Column(Text, nullable=True)
    proposed_config_snippet = Column(Text, nullable=True)
    backup_id = Column(Integer, ForeignKey("configuration_backups.id"), nullable=True)
    execution_summary = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    device = relationship("Device", foreign_keys=[device_id], back_populates="provisioning_jobs")
    user = relationship("User", back_populates="provisioning_jobs")
    commands = relationship(
        "ProvisioningCommand",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="ProvisioningCommand.sequence_order",
    )


class ProvisioningCommand(Base):
    __tablename__ = "provisioning_commands"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("provisioning_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    target_device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    sequence_order = Column(Integer, nullable=False)
    command_text = Column(String(500), nullable=False)
    device_output = Column(Text, nullable=True)
    status = Column(String(30), default="SUCCESS", nullable=False)  # PENDING, SUCCESS, ERROR, SKIPPED
    executed_at = Column(DateTime(timezone=True), default=utcnow)

    job = relationship("ProvisioningJob", back_populates="commands")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(60), nullable=False, index=True)
    resource_id = Column(String(60), nullable=True)
    device_name = Column(String(120), nullable=True)
    pop_name = Column(String(120), nullable=True)
    status = Column(String(30), default="SUCCESS", nullable=False)  # SUCCESS, WARNING, FAILED
    details = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")

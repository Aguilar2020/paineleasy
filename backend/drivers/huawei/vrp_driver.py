import hashlib
import time
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session

from backend.config import settings
from backend.models.entities import (
    Device,
    Interface,
    Vlan,
    Vlanif,
    StaticRoute,
    ConfigurationBackup,
)
from backend.security.crypto import decrypt_secret
from backend.drivers.huawei.validator import cidr_to_netmask

try:
    from netmiko import ConnectHandler
    from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException
except ImportError:  # pragma: no cover
    ConnectHandler = None
    NetmikoTimeoutException = TimeoutError
    NetmikoAuthenticationException = PermissionError


HUAWEI_DISCOVERY_COMMANDS = [
    "display version",
    "display device",
    "display interface brief",
    "display vlan",
    "display ip interface brief",
    "display ip routing-table",
    "display current-configuration",
]

HUAWEI_ERROR_MARKERS = [
    "Error: Unrecognized command",
    "Error: Wrong parameter",
    "Error: Incomplete command",
    "Error: Ambiguous command",
    "Error: Please renew",
]


class HuaweiSSHDriverError(Exception):
    """Raised when SSH connection or VRP CLI execution fails."""


class HuaweiVRPDriver:
    """
    Driver for Huawei VRP switches and routers (S5735, S6730, CloudEngine, NE8000).
    Supports real SSH via Netmiko in production and explicit stateful simulation when
    device.is_simulated is True (never faking connections in production mode).
    """

    def __init__(self, device: Device):
        self.device = device
        self.is_simulated = bool(device.is_simulated and settings.DEMO_MODE)

    def _get_netmiko_params(self) -> dict:
        if not self.device.credential:
            raise HuaweiSSHDriverError(
                f"Credenciais SSH não configuradas para o equipamento {self.device.name}."
            )
        password = decrypt_secret(self.device.credential.encrypted_password)
        pkey = decrypt_secret(self.device.credential.encrypted_private_key)
        device_type = (
            "huawei_vrpv8"
            if self.device.system_version and "V800" in self.device.system_version
            else "huawei"
        )
        params = {
            "device_type": device_type,
            "host": self.device.management_ip,
            "port": self.device.ssh_port or 22,
            "username": self.device.credential.ssh_username,
            "timeout": settings.SSH_DEFAULT_TIMEOUT,
            "conn_timeout": settings.SSH_DEFAULT_TIMEOUT,
        }
        if password:
            params["password"] = password
        if pkey:
            params["use_keys"] = True
            params["key_file"] = pkey
        return params

    def test_connectivity(self) -> Dict[str, object]:
        """Tests SSH connectivity and queries basic system version."""
        start_ts = time.perf_counter()
        if self.device.status == "OFFLINE" and self.is_simulated:
            raise HuaweiSSHDriverError(
                f"Timeout SSH ao conectar em {self.device.management_ip}:{self.device.ssh_port} "
                f"(Equipamento {self.device.name} está OFFLINE)."
            )

        if not self.is_simulated:
            if ConnectHandler is None:
                raise HuaweiSSHDriverError("Biblioteca Netmiko não disponível no ambiente.")
            params = self._get_netmiko_params()
            try:
                with ConnectHandler(**params) as conn:
                    version_out = conn.send_command("display version", expect_string=r"[<>]")
            except NetmikoTimeoutException as exc:
                raise HuaweiSSHDriverError(
                    f"Timeout SSH ao conectar em {self.device.management_ip}:{self.device.ssh_port}."
                ) from exc
            except NetmikoAuthenticationException as exc:
                raise HuaweiSSHDriverError(
                    f"Falha de autenticação SSH no equipamento {self.device.name}. Verifique usuário e senha."
                ) from exc
            except Exception as exc:
                raise HuaweiSSHDriverError(
                    f"Erro de comunicação SSH com {self.device.management_ip}: {exc}"
                ) from exc

            elapsed_ms = round((time.perf_counter() - start_ts) * 1000, 1)
            return {
                "reachable": True,
                "is_simulated": False,
                "latency_ms": elapsed_ms,
                "system_version": self.device.system_version or "Huawei VRP",
                "raw_version_output": version_out,
            }

        # Explicit simulation mode
        elapsed_ms = round((time.perf_counter() - start_ts) * 1000 + 12.4, 1)
        return {
            "reachable": True,
            "is_simulated": True,
            "latency_ms": elapsed_ms,
            "system_version": self.device.system_version or "VRP (R) software, Version 5.170 (V200R021C00SPC100)",
            "raw_version_output": self.generate_display_output("display version"),
        }

    def generate_display_output(self, command: str, db: Session | None = None) -> str:
        """Executes a read-only diagnostic command on Huawei VRP."""
        cmd = command.strip()
        if not self.is_simulated:
            params = self._get_netmiko_params()
            try:
                with ConnectHandler(**params) as conn:
                    output = conn.send_command(cmd, expect_string=r"[<>]")
                    for err in HUAWEI_ERROR_MARKERS:
                        if err in output:
                            raise HuaweiSSHDriverError(
                                f"Comando incompatível com {self.device.model} ({self.device.system_version}): {cmd}"
                            )
                    return output
            except HuaweiSSHDriverError:
                raise
            except Exception as exc:
                raise HuaweiSSHDriverError(f"Erro ao executar '{cmd}' via SSH: {exc}") from exc

        # Simulated VRP command outputs derived from real database state of the device
        if cmd == "display version":
            return (
                f"Huawei Versatile Routing Platform Software\n"
                f"VRP (R) software, Version 5.170 ({self.device.system_version or 'V200R021C00SPC100'})\n"
                f"Copyright (C) 2000-2025 HUAWEI TECH CO., LTD\n"
                f"HUAWEI {self.device.model} Routing Switch uptime is 142 days, 6 hours, 18 minutes\n"
            )
        if cmd == "display device":
            return (
                f"{self.device.model}'s Device status:\n"
                f"Slot Sub  Type                   Online    Power    Register     Status   Role\n"
                f"- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
                f"0    -    {self.device.model:<22} Present   PowerOn  Registered   Normal   Master\n"
            )
        if cmd == "display interface brief":
            lines = [
                "PHY: Physical",
                "*down: administratively down",
                "Interface                   PHY   Protocol  InUti OutUti   inErrors  outErrors",
            ]
            for iface in sorted(self.device.interfaces, key=lambda x: x.port_index):
                phy = "up" if iface.physical_status == "UP" else ("*down" if iface.admin_status == "DOWN" else "down")
                proto = "up" if iface.physical_status == "UP" else "down"
                lines.append(
                    f"{iface.name:<27} {phy:<5} {proto:<9} 12%   18%      {iface.rx_errors:<9} {iface.tx_errors}"
                )
            return "\n".join(lines)
        if cmd == "display vlan":
            lines = [
                "The total number of vlans is : " + str(len(self.device.vlans)),
                "--------------------------------------------------------------------------------",
                "U: Up;         D: Down;         TG: Tagged;         UT: Untagged;",
                "VID  Type    Ports                                                          ",
                "--------------------------------------------------------------------------------",
            ]
            for v in sorted(self.device.vlans, key=lambda x: x.vlan_id):
                ports_info = f"UT:{v.untagged_ports} TG:{v.tagged_ports}".strip()
                lines.append(f"{v.vlan_id:<4} {v.vlan_type:<7} {ports_info}")
            return "\n".join(lines)
        if cmd == "display ip interface brief":
            if not self.device.supports_l3_routing:
                raise HuaweiSSHDriverError(
                    f"Error: Unrecognized command found at '^' position. ({self.device.model} L2-only)"
                )
            lines = [
                "Interface                         IP Address/Mask      Physical   Protocol  ",
            ]
            for vif in sorted(self.device.vlanifs, key=lambda x: x.vlan_id):
                ip_mask = f"{vif.ip_address}/{vif.cidr_prefix}"
                lines.append(
                    f"{vif.interface_name:<33} {ip_mask:<20} {vif.admin_status.lower():<10} {vif.protocol_status.lower()}"
                )
            return "\n".join(lines)
        if cmd == "display ip routing-table":
            if not self.device.supports_l3_routing:
                raise HuaweiSSHDriverError(
                    f"Error: Unrecognized command found at '^' position. ({self.device.model} L2-only)"
                )
            lines = [
                "Route Flags: R - relay, D - download to fib",
                "------------------------------------------------------------------------------",
                "Destination/Mask    Proto   Pre  Cost      Flags NextHop         Interface",
            ]
            for r in self.device.static_routes:
                dest_mask = f"{r.destination_network}/{r.cidr_prefix}"
                lines.append(
                    f"{dest_mask:<19} {r.protocol:<7} {r.preference:<4} 0         D     {r.next_hop:<15} Vlanif"
                )
            return "\n".join(lines)
        if cmd == "display current-configuration":
            return self.build_full_current_configuration()

        raise HuaweiSSHDriverError(
            f"Error: Unrecognized command found: '{cmd}' on {self.device.model}"
        )

    def build_full_current_configuration(self) -> str:
        """Builds the complete VRP configuration file representing the current state of the device."""
        lines = [
            f"!Software Version {self.device.system_version or 'V200R021C00SPC100'}",
            f"sysname {self.device.name}",
            "#",
        ]
        vlan_ids = sorted(v.vlan_id for v in self.device.vlans)
        if vlan_ids:
            lines.append("vlan batch " + " ".join(str(vid) for vid in vlan_ids))
            lines.append("#")
        for v in sorted(self.device.vlans, key=lambda x: x.vlan_id):
            lines.append(f"vlan {v.vlan_id}")
            if v.description:
                lines.append(f" description {v.description}")
            lines.append("#")

        for vif in sorted(self.device.vlanifs, key=lambda x: x.vlan_id):
            lines.append(f"interface {vif.interface_name}")
            if vif.description:
                lines.append(f" description {vif.description}")
            if vif.vrf_name:
                lines.append(f" ip binding vpn-instance {vif.vrf_name}")
            lines.append(f" ip address {vif.ip_address} {vif.subnet_mask}")
            lines.append("#")

        for iface in sorted(self.device.interfaces, key=lambda x: x.port_index):
            lines.append(f"interface {iface.name}")
            if iface.description:
                lines.append(f" description {iface.description}")
            lines.append(f" port link-type {iface.link_type}")
            if iface.link_type == "access":
                lines.append(f" port default vlan {iface.pvid}")
            elif iface.link_type == "trunk":
                vlans_sp = " ".join(
                    x.strip() for x in iface.allowed_vlans.split(",") if x.strip()
                )
                lines.append(f" port trunk allow-pass vlan {vlans_sp}")
            elif iface.link_type == "hybrid":
                vlans_sp = " ".join(
                    x.strip() for x in iface.allowed_vlans.split(",") if x.strip()
                )
                lines.append(f" port hybrid tagged vlan {vlans_sp}")
            if iface.admin_status == "DOWN":
                lines.append(" shutdown")
            lines.append("#")

        for r in self.device.static_routes:
            if r.protocol.lower() == "static":
                cmd = f"ip route-static {r.destination_network} {r.cidr_prefix} {r.next_hop}"
                if r.preference and r.preference != 60:
                    cmd += f" preference {r.preference}"
                if r.description:
                    cmd += f" description {r.description}"
                lines.append(cmd)
        lines.append("#")
        lines.append("return")
        return "\n".join(lines)

    def create_configuration_backup(
        self,
        db: Session,
        user_id: int | None,
        backup_type: str = "PRE_PROVISIONING",
        comment: str | None = None,
    ) -> ConfigurationBackup:
        config_text = self.generate_display_output("display current-configuration", db=db)
        checksum = hashlib.sha256(config_text.encode("utf-8")).hexdigest()[:16]
        backup = ConfigurationBackup(
            device_id=self.device.id,
            backup_type=backup_type,
            config_content=config_text,
            checksum=checksum,
            comment=comment or f"Backup automático antes de alteração ({self.device.name})",
            created_by_user_id=user_id,
        )
        db.add(backup)
        self.device.discovered_config = config_text
        self.device.last_known_config = config_text
        db.commit()
        db.refresh(backup)
        return backup

    def execute_commands_sequentially(
        self,
        commands: List[str],
        save_config: bool = True,
    ) -> List[Tuple[str, str, str]]:
        """
        Executes a list of VRP configuration commands sequentially inside system-view.
        Returns list of tuples: (command_text, device_output, status).
        """
        results: List[Tuple[str, str, str]] = []

        if not self.is_simulated:
            params = self._get_netmiko_params()
            try:
                with ConnectHandler(**params) as conn:
                    conn.config_mode()
                    for cmd in commands:
                        output = conn.send_command_timing(cmd)
                        has_err = any(marker in output for marker in HUAWEI_ERROR_MARKERS)
                        if has_err:
                            results.append((cmd, output, "ERROR"))
                            if self.device.supports_two_phase_commit:
                                conn.send_command_timing("abort")
                            raise HuaweiSSHDriverError(
                                f"Erro de execução VRP no comando '{cmd}': {output}"
                            )
                        results.append((cmd, output or f"[{self.device.name}] OK", "SUCCESS"))
                    conn.exit_config_mode()
                    if save_config and settings.AUTO_SAVE_CONFIG_ON_SUCCESS:
                        save_out = conn.send_command_timing("save")
                        if "Y/N" in save_out or "[Y/N]" in save_out:
                            save_out += "\n" + conn.send_command_timing("Y")
                        results.append(("save", save_out, "SUCCESS"))
            except HuaweiSSHDriverError:
                raise
            except Exception as exc:
                raise HuaweiSSHDriverError(
                    f"Falha durante sessão SSH de configuração em {self.device.name}: {exc}"
                ) from exc
            return results

        # Simulated sequential VRP execution
        prompt_ctx = f"[{self.device.name}]"
        for cmd in commands:
            stripped = cmd.strip()
            if stripped.startswith("vlan "):
                vid = stripped.split()[1]
                prompt_ctx = f"[{self.device.name}-vlan{vid}]"
                out = f"{prompt_ctx}"
            elif stripped.startswith("interface "):
                iname = stripped.split()[1]
                prompt_ctx = f"[{self.device.name}-{iname}]"
                out = f"{prompt_ctx}"
            elif stripped == "quit":
                prompt_ctx = f"[{self.device.name}]"
                out = f"{prompt_ctx}"
            elif stripped == "commit":
                out = f"Info:kl Commit succeeded on {self.device.name}."
            else:
                out = f"{prompt_ctx} {stripped} -> Info: Configuration applied."
            results.append((cmd, out, "SUCCESS"))

        if save_config and settings.AUTO_SAVE_CONFIG_ON_SUCCESS:
            results.append(
                (
                    "save",
                    "The current configuration will be written to the device.\nAre you sure to continue?[Y/N]:Y\nInfo: Save the configuration successfully.",
                    "SUCCESS",
                )
            )

        return results


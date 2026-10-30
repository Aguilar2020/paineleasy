export type NavSection =
  | "dashboard"
  | "clientes"
  | "pops"
  | "equipamentos"
  | "interfaces"
  | "vlans"
  | "vlanifs"
  | "rotas"
  | "provisionamento"
  | "analise"
  | "backups"
  | "historico"
  | "configuracoes";

export interface Customer {
  id: number;
  name: string;
  code: string;
  document?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  pop_id?: number;
  pop_name?: string;
  device_id?: number;
  device_name?: string;
  interface_name?: string;
  vlan_id?: number;
  vlanif_ip?: string;
  routed_block?: string;
  status: "ATIVO" | "PENDENTE" | "SUSPENSO" | string;
  notes?: string;
  created_at: string;
}

export interface Role {
  id: number;
  name: "admin" | "engineer" | "readonly" | string;
  display_name: string;
  description?: string;
  permissions: string[];
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_active: boolean;
  all_pops_access: boolean;
  role: Role;
  allowed_pop_ids: number[];
  last_login_at?: string;
}

export interface Pop {
  id: number;
  name: string;
  city: string;
  state: string;
  address?: string;
  description?: string;
  status: "ATIVO" | "MANUTENCAO" | "INATIVO" | string;
  device_count: number;
  online_devices: number;
  created_at: string;
}

export interface Device {
  id: number;
  name: string;
  pop_id: number;
  pop_name?: string;
  vendor: string;
  model: string;
  management_ip: string;
  ssh_port: number;
  ssh_username?: string;
  has_credentials: boolean;
  auth_method: string;
  system_version?: string;
  description?: string;
  status: "ONLINE" | "OFFLINE" | "ALERTA" | "MANUTENCAO" | string;
  supports_l3_routing: boolean;
  supports_vrf: boolean;
  supports_two_phase_commit: boolean;
  supports_ipv6: boolean;
  is_simulated: boolean;
  interface_count: number;
  up_interfaces: number;
  vlan_count: number;
  vlanif_count: number;
  route_count: number;
  last_synced_at?: string;
  created_at: string;
}

export interface NetworkInterface {
  id: number;
  device_id: number;
  device_name?: string;
  port_index: number;
  name: string;
  short_name: string;
  description?: string;
  admin_status: "UP" | "DOWN" | string;
  physical_status: "UP" | "DOWN" | "ERROR" | "ALERT" | string;
  speed: string;
  duplex: string;
  mtu: number;
  link_type: "access" | "trunk" | "hybrid" | string;
  pvid: number;
  allowed_vlans: string;
  untagged_vlans?: string;
  rx_rate_mbps: string;
  tx_rate_mbps: string;
  rx_errors: number;
  tx_errors: number;
  discovered_config?: string;
  desired_config?: string;
  last_known_config?: string;
  updated_at?: string;
}

export interface Vlan {
  id: number;
  device_id: number;
  device_name?: string;
  pop_name?: string;
  vlan_id: number;
  name?: string;
  description?: string;
  vlan_type: string;
  status: string;
  tagged_ports: string;
  untagged_ports: string;
  discovered_config?: string;
  updated_at?: string;
}

export interface Vlanif {
  id: number;
  device_id: number;
  device_name?: string;
  pop_name?: string;
  vlan_id: number;
  interface_name: string;
  description?: string;
  ip_address: string;
  subnet_mask: string;
  cidr_prefix: number;
  ipv6_address?: string;
  admin_status: string;
  protocol_status: string;
  vrf_name?: string;
  discovered_config?: string;
  updated_at?: string;
}

export interface StaticRoute {
  id: number;
  device_id: number;
  device_name?: string;
  pop_name?: string;
  ip_version: number;
  destination_network: string;
  cidr_prefix: number;
  subnet_mask: string;
  next_hop: string;
  preference: number;
  description?: string;
  vrf_name?: string;
  protocol: "Static" | "Direct" | "OSPF" | "BGP" | string;
  is_active: boolean;
  discovered_config?: string;
  created_at?: string;
}

export interface StaticRouteFormItem {
  ip_version: number;
  destination_network: string;
  cidr_prefix: number;
  subnet_mask?: string;
  next_hop: string;
  description?: string;
  preference: number;
  vrf_name?: string;
}

export interface ProvisioningPayload {
  pop_id: number;
  device_id: number;
  interface_name: string;
  vlan_id: number;
  vlan_description: string;
  port_description?: string;
  port_mode: "access" | "trunk" | "hybrid";
  hybrid_tagged: boolean;
  auto_create_vlan: boolean;
  preserve_existing_vlans: boolean;
  create_vlanif: boolean;
  vlanif_description?: string;
  vlanif_ipv4?: string;
  vlanif_cidr?: number;
  vlanif_subnet_mask?: string;
  vlanif_ipv6?: string;
  vlanif_vrf_name?: string;
  create_static_routes: boolean;
  l3_routing_device_id?: number;
  static_routes: StaticRouteFormItem[];
  save_configuration: boolean;
  explicit_confirmation: boolean;
}

export interface ValidationIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  field: string;
  message: string;
}

export interface DiffLine {
  line_type: "context" | "added" | "removed" | "modified";
  before_line?: string | null;
  after_line?: string | null;
}

export interface DeviceCommandPlan {
  device_id: number;
  device_name: string;
  management_ip: string;
  model: string;
  system_version: string;
  role_in_plan: string;
  commands: string[];
}

export interface ProvisioningPreviewResponse {
  is_valid: boolean;
  issues: ValidationIssue[];
  current_config_text: string;
  proposed_config_text: string;
  diff_lines: DiffLine[];
  device_plans: DeviceCommandPlan[];
  combined_cli_script: string;
  is_simulated: boolean;
}

export interface ProvisioningExecutionResponse {
  job_id: number;
  status: string;
  backup_id?: number;
  is_simulated: boolean;
  summary: string;
  workflow_steps: Array<{
    step: number;
    title: string;
    detail: string;
    status: string;
  }>;
  command_results: Array<{
    sequence_order: number;
    device_name: string;
    command_text: string;
    device_output: string;
    status: string;
  }>;
  post_validation_passed: boolean;
  created_at: string;
}

export interface AnalyzedVlanPortItem {
  interface_id: number;
  port_index: number;
  interface_name: string;
  short_name: string;
  link_type: string;
  tag_mode: string;
  physical_status: string;
  speed: string;
  port_description: string;
}

export interface AnalyzedVlanIpItem {
  vlanif_id: number;
  interface_name: string;
  ip_address: string;
  cidr_prefix: number;
  subnet_mask: string;
  ipv6_address?: string | null;
  description: string;
  status: string;
  vrf_name?: string | null;
  routed_blocks: string[];
}

export interface AnalyzedVlanItem {
  vlan_id: number;
  vlan_name: string;
  vlan_description: string;
  vlan_status: string;
  ports: AnalyzedVlanPortItem[];
  ips: AnalyzedVlanIpItem[];
}

export interface SwitchVlanAnalysisResponse {
  device_id: number;
  device_name: string;
  pop_name: string;
  model: string;
  management_ip: string;
  system_version: string;
  is_simulated: boolean;
  ssh_latency_ms: number;
  analyzed_at: string;
  total_vlans: number;
  total_ports_with_vlan: number;
  total_l3_ips: number;
  vlans: AnalyzedVlanItem[];
  cli_transcript: string;
}

export interface ImportedTableRecord {
  vlan_id: number;
  vlan_name: string;
  customer_or_description: string;
  interface_name: string;
  port_mode: string;
  port_status: string;
  vlanif_ip: string;
  routed_block: string;
  sync_action: string;
}

export interface SwitchImportResponse {
  device_id: number;
  device_name: string;
  pop_name: string;
  management_ip: string;
  imported_at: string;
  vlans_synced: number;
  interfaces_synced: number;
  vlanifs_synced: number;
  routes_synced: number;
  customers_populated: number;
  records: ImportedTableRecord[];
  message: string;
}

export interface SwitchBackupTxtResponse {
  backup_id: number;
  device_id: number;
  device_name: string;
  pop_name: string;
  management_ip: string;
  model: string;
  system_version: string;
  filename: string;
  config_txt: string;
  size_bytes: number;
  created_at: string;
}

export interface SystemBackupResponse {
  backup_id: string;
  filename: string;
  created_at: string;
  created_by: string;
  size_bytes: number;
  counts: Record<string, number>;
  backup_json_text: string;
  backup_txt_summary: string;
}




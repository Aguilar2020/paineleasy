import {
  User,
  Pop,
  Customer,
  Device,
  NetworkInterface,
  Vlan,
  Vlanif,
  StaticRoute,
  ProvisioningPayload,
  ProvisioningPreviewResponse,
  ProvisioningExecutionResponse,
  SwitchVlanAnalysisResponse,
  SwitchImportResponse,
  SwitchBackupTxtResponse,
  SystemBackupResponse,
} from "@/types/network";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TOKEN_STORAGE_KEY = "hnm_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Erro HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (typeof errJson.detail === "string") {
        errorDetail = errJson.detail;
      } else if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail.map((e: { msg?: string }) => e.msg).join("; ");
      }
    } catch {
      // fallback to status text
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const apiService = {
  // Auth
  login: (username: string, password: string) =>
    apiRequest<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => apiRequest<User>("/auth/me"),
  getUsers: () => apiRequest<User[]>("/users"),
  createUser: (data: Record<string, unknown>) =>
    apiRequest<User>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Dashboard
  getDashboardSummary: () => apiRequest<Record<string, any>>("/dashboard/summary"),

  // POPs
  getPops: () => apiRequest<Pop[]>("/pops"),
  createPop: (data: Partial<Pop>) =>
    apiRequest<Pop>("/pops", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePop: (id: number, data: Partial<Pop>) =>
    apiRequest<Pop>(`/pops/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePop: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/pops/${id}`, {
      method: "DELETE",
    }),

  // Customers (Clientes)
  getCustomers: () => apiRequest<Customer[]>("/customers"),
  createCustomer: (data: Partial<Customer>) =>
    apiRequest<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: number, data: Partial<Customer>) =>
    apiRequest<Customer>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/customers/${id}`, {
      method: "DELETE",
    }),

  // Devices & SSH Operations
  getDevices: (popId?: number) =>
    apiRequest<Device[]>(popId ? `/devices?pop_id=${popId}` : "/devices"),
  createDevice: (data: Record<string, unknown>) =>
    apiRequest<Device>("/devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDevice: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/devices/${id}`, {
      method: "DELETE",
    }),
  testDeviceConnection: (id: number) =>
    apiRequest<Record<string, any>>(`/devices/${id}/test-connection`, {
      method: "POST",
    }),
  connectDeviceCLI: (id: number) =>
    apiRequest<Record<string, any>>(`/devices/${id}/connect`, {
      method: "POST",
    }),
  syncDevice: (id: number) =>
    apiRequest<Record<string, any>>(`/devices/${id}/sync`, {
      method: "POST",
    }),
  getDeviceConfig: (id: number) =>
    apiRequest<Record<string, any>>(`/devices/${id}/configuration`),
  getDeviceInterfaces: (id: number) =>
    apiRequest<NetworkInterface[]>(`/devices/${id}/interfaces`),

  // Interfaces, VLANs, Vlanifs
  getAllInterfaces: (deviceId?: number) =>
    apiRequest<NetworkInterface[]>(
      deviceId ? `/interfaces?device_id=${deviceId}` : "/interfaces"
    ),
  bindVlanToPort: (
    interfaceId: number,
    data: {
      vlan_id: number;
      port_mode: string;
      customer_id?: number;
      description?: string;
      preserve_existing_vlans?: boolean;
    }
  ) =>
    apiRequest<NetworkInterface>(`/interfaces/${interfaceId}/bind-vlan`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unbindVlanFromPort: (interfaceId: number) =>
    apiRequest<NetworkInterface>(`/interfaces/${interfaceId}/unbind-vlan`, {
      method: "POST",
    }),
  analyzeDeviceVlans: (deviceId: number) =>
    apiRequest<SwitchVlanAnalysisResponse>(`/devices/${deviceId}/analyze-vlans`, {
      method: "POST",
    }),
  importFromSwitch: (deviceId: number) =>
    apiRequest<SwitchImportResponse>(`/devices/${deviceId}/import-from-switch`, {
      method: "POST",
    }),
  createSwitchBackupTxt: (deviceId: number) =>
    apiRequest<SwitchBackupTxtResponse>(`/devices/${deviceId}/backup-txt`, {
      method: "POST",
    }),
  createSystemBackup: () =>
    apiRequest<SystemBackupResponse>(`/backups/system`, {
      method: "POST",
    }),
  getVlans: (deviceId?: number) =>
    apiRequest<Vlan[]>(deviceId ? `/vlans?device_id=${deviceId}` : "/vlans"),
  createVlan: (data: { device_id: number; vlan_id: number; description: string }) =>
    apiRequest<Vlan>("/vlans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteVlan: (vlanDbId: number) =>
    apiRequest<{ deleted: boolean; undo_command: string }>(`/vlans/${vlanDbId}`, {
      method: "DELETE",
    }),
  getVlanifs: (deviceId?: number) =>
    apiRequest<Vlanif[]>(
      deviceId ? `/vlanifs?device_id=${deviceId}` : "/vlanifs"
    ),
  createVlanif: (data: Record<string, unknown>) =>
    apiRequest<Vlanif>("/vlanifs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteVlanif: (vlanifDbId: number) =>
    apiRequest<{ deleted: boolean; undo_command: string }>(
      `/vlanifs/${vlanifDbId}`,
      {
        method: "DELETE",
      }
    ),

  // Static Routes
  getRoutes: (filters?: {
    device_id?: number;
    destination?: string;
    next_hop?: string;
    protocol?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.device_id) params.set("device_id", String(filters.device_id));
    if (filters?.destination) params.set("destination", filters.destination);
    if (filters?.next_hop) params.set("next_hop", filters.next_hop);
    if (filters?.protocol) params.set("protocol", filters.protocol);
    const qs = params.toString();
    return apiRequest<StaticRoute[]>(`/routes${qs ? `?${qs}` : ""}`);
  },
  createRoute: (data: Record<string, unknown>) =>
    apiRequest<StaticRoute>("/routes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRoute: (id: number, data: Record<string, unknown>) =>
    apiRequest<StaticRoute>(`/routes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRoute: (id: number) =>
    apiRequest<{ deleted: boolean; undo_command: string }>(`/routes/${id}`, {
      method: "DELETE",
    }),

  // Provisioning Wizard
  previewProvisioning: (payload: ProvisioningPayload) =>
    apiRequest<ProvisioningPreviewResponse>("/provisioning/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  executeProvisioning: (payload: ProvisioningPayload) =>
    apiRequest<ProvisioningExecutionResponse>("/provisioning/execute", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // History, Audit & Settings
  getProvisioningJobs: (deviceId?: number) =>
    apiRequest<any[]>(
      deviceId ? `/history/jobs?device_id=${deviceId}` : "/history/jobs"
    ),
  getAuditLogs: () => apiRequest<any[]>("/history/audit-logs"),
  getBackups: (deviceId?: number) =>
    apiRequest<any[]>(
      deviceId ? `/history/backups?device_id=${deviceId}` : "/history/backups"
    ),
  getSettings: () => apiRequest<Record<string, any>>("/settings"),
  updateSettings: (data: Record<string, any>) =>
    apiRequest<Record<string, any>>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};


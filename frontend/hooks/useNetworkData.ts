import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "@/services/api";

export function useDashboardSummary(enabled = true) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiService.getDashboardSummary(),
    enabled,
  });
}

export function usePops(enabled = true) {
  return useQuery({
    queryKey: ["pops"],
    queryFn: () => apiService.getPops(),
    enabled,
  });
}

export function useCustomers(enabled = true) {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => apiService.getCustomers(),
    enabled,
  });
}

export function useDevices(popId?: number, enabled = true) {
  return useQuery({
    queryKey: ["devices", popId ?? "all"],
    queryFn: () => apiService.getDevices(popId),
    enabled,
  });
}

export function useDeviceInterfaces(deviceId?: number, enabled = true) {
  return useQuery({
    queryKey: ["interfaces", deviceId],
    queryFn: () =>
      deviceId
        ? apiService.getDeviceInterfaces(deviceId)
        : apiService.getAllInterfaces(),
    enabled,
  });
}

export function useVlans(deviceId?: number, enabled = true) {
  return useQuery({
    queryKey: ["vlans", deviceId ?? "all"],
    queryFn: () => apiService.getVlans(deviceId),
    enabled,
  });
}

export function useVlanifs(deviceId?: number, enabled = true) {
  return useQuery({
    queryKey: ["vlanifs", deviceId ?? "all"],
    queryFn: () => apiService.getVlanifs(deviceId),
    enabled,
  });
}

export function useRoutes(
  filters?: {
    device_id?: number;
    destination?: string;
    next_hop?: string;
    protocol?: string;
  },
  enabled = true
) {
  return useQuery({
    queryKey: ["routes", filters],
    queryFn: () => apiService.getRoutes(filters),
    enabled,
  });
}

export function useHistoryData(enabled = true) {
  const jobs = useQuery({
    queryKey: ["history-jobs"],
    queryFn: () => apiService.getProvisioningJobs(),
    enabled,
  });
  const logs = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => apiService.getAuditLogs(),
    enabled,
  });
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () => apiService.getBackups(),
    enabled,
  });
  return { jobs, logs, backups };
}

export function useInvalidateNetworkQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["pops"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["devices"] });
    queryClient.invalidateQueries({ queryKey: ["interfaces"] });
    queryClient.invalidateQueries({ queryKey: ["vlans"] });
    queryClient.invalidateQueries({ queryKey: ["vlanifs"] });
    queryClient.invalidateQueries({ queryKey: ["routes"] });
    queryClient.invalidateQueries({ queryKey: ["history-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    queryClient.invalidateQueries({ queryKey: ["backups"] });
  };
}


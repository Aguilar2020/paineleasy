"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Pop,
  Device,
  Customer,
  NetworkInterface,
  ProvisioningPayload,
  ProvisioningPreviewResponse,
  ProvisioningExecutionResponse,
  StaticRouteFormItem,
} from "@/types/network";
import { apiService } from "@/services/api";
import { PortVisualMap, isInterfaceOccupied } from "@/components/PortVisualMap";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Layers,
  Lock,
  Network,
  Play,
  Plus,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";

const CIDR_TO_MASK: Record<number, string> = {
  32: "255.255.255.255",
  31: "255.255.255.254",
  30: "255.255.255.252",
  29: "255.255.255.248",
  28: "255.255.255.240",
  27: "255.255.255.224",
  26: "255.255.255.192",
  25: "255.255.255.128",
  24: "255.255.255.0",
  23: "255.255.254.0",
  22: "255.255.252.0",
  21: "255.255.248.0",
  20: "255.255.240.0",
  16: "255.255.0.0",
  8: "255.0.0.0",
  0: "0.0.0.0",
};

function getMaskForCidr(cidr: number): string {
  if (CIDR_TO_MASK[cidr]) return CIDR_TO_MASK[cidr];
  const mask =cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join(".");
}

interface ProvisioningWizardProps {
  pops: Pop[];
  allDevices: Device[];
  customers?: Customer[];
  initialPopId?: number;
  initialDeviceId?: number;
  initialInterfaceName?: string;
  initialCustomerId?: number;
  userRole: string;
  onSuccessInvalidate: () => void;
}

export function ProvisioningWizard({
  pops,
  allDevices,
  customers = [],
  initialPopId,
  initialDeviceId,
  initialInterfaceName,
  initialCustomerId,
  userRole,
  onSuccessInvalidate,
}: ProvisioningWizardProps) {
  const canExecuteSsh =
    userRole === "admin" || userRole === "operador" || userRole === "engineer";
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomerId ? String(initialCustomerId) : ""
  );
  // Sequential Step Progression (starts at Step 1 and unlocks 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7)
  const [unlockedStep, setUnlockedStep] = useState<number>(
    initialInterfaceName || initialCustomerId ? 7 : 1
  );
  const [popSelected, setPopSelected] = useState<boolean>(
    Boolean(initialPopId || initialDeviceId || initialInterfaceName || initialCustomerId)
  );
  // Step 1: POP (default to POP MOTIRO if present)
  const defaultPop =
    pops.find((p) => p.name.toUpperCase().includes("MOTIRO")) || pops[0];
  const [popId, setPopId] = useState<number>(
    initialPopId || defaultPop?.id || 1
  );

  // Step 2: Switch (default to SWITCH-MPLS-MONTIRO if present)
  const popDevices = useMemo(
    () => allDevices.filter((d) => d.pop_id === popId),
    [allDevices, popId]
  );
  const defaultSwitch =
    popDevices.find((d) => d.name.includes("MONTIRO")) ||
    popDevices[0] ||
    allDevices[0];
  const [deviceId, setDeviceId] = useState<number>(
    initialDeviceId || defaultSwitch?.id || 1
  );

  const selectedDevice = useMemo(
    () => allDevices.find((d) => d.id === deviceId) || allDevices[0],
    [allDevices, deviceId]
  );

  const handleChoosePop = (chosenPopId: number) => {
    setPopId(chosenPopId);
    setPopSelected(true);
    const switchesInChosenPop = allDevices.filter(
      (d) => d.pop_id === chosenPopId
    );
    if (switchesInChosenPop.length > 0) {
      setDeviceId(switchesInChosenPop[0].id);
    }
    if (switchesInChosenPop.length === 1) {
      // Se o POP tiver apenas 1 switch, já carrega o switch na Etapa 2 e libera a Etapa 3
      setUnlockedStep((s) => Math.max(s, 3));
    } else {
      // Se o POP tiver mais de 1 switch, libera a Etapa 2 para o operador escolher qual switch
      setUnlockedStep((s) => Math.max(s, 2));
    }
  };

  // Interfaces of selected switch
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);

  // Step 3: Port
  const [interfaceName, setInterfaceName] = useState<string>(
    initialInterfaceName || "XGigabitEthernet0/0/39"
  );
  const [showVisualMap, setShowVisualMap] = useState<boolean>(false);

  // Step 4: VLAN & Port Mode
  const [vlanId, setVlanId] = useState<number>(2443);
  const [vlanDescription, setVlanDescription] = useState<string>("CLIENTE-LGCONNECT");
  const [portMode, setPortMode] = useState<"access" | "trunk" | "hybrid">("access");
  const [hybridTagged, setHybridTagged] = useState<boolean>(true);
  const [autoCreateVlan, setAutoCreateVlan] = useState<boolean>(true);
  const [preserveExistingVlans, setPreserveExistingVlans] = useState<boolean>(true);

  // Step 5: Vlanif
  const [createVlanif, setCreateVlanif] = useState<boolean>(true);
  const [vlanifDescription, setVlanifDescription] = useState<string>(
    "GATEWAY-CLIENTE-LGCONNECT"
  );
  const [vlanifIpv4, setVlanifIpv4] = useState<string>("10.24.43.1");
  const [vlanifCidr, setVlanifCidr] = useState<number>(30);
  const [enableIpv6Vlanif, setEnableIpv6Vlanif] = useState<boolean>(false);
  const [vlanifIpv6, setVlanifIpv6] = useState<string>("");
  const [vlanifVrf, setVlanifVrf] = useState<string>("");

  // Step 6: Static Routes & L3 Target Equipment
  const [createStaticRoutes, setCreateStaticRoutes] = useState<boolean>(true);
  const [l3RoutingDeviceId, setL3RoutingDeviceId] = useState<number>(
    selectedDevice?.id || 1
  );
  const [staticRoutes, setStaticRoutes] = useState<StaticRouteFormItem[]>([
    {
      ip_version: 4,
      destination_network: "45.0.0.0",
      cidr_prefix: 30,
      subnet_mask: "255.255.255.252",
      next_hop: "10.24.43.2",
      description: "BLOCO-PUBLICO-CLIENTE",
      preference: 60,
      vrf_name: "",
    },
  ]);

  // Execution & Preview State
  const [saveConfiguration, setSaveConfiguration] = useState<boolean>(true);
  const [explicitConfirmation, setExplicitConfirmation] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<ProvisioningPreviewResponse | null>(null);
  const [executionResult, setExecutionResult] =
    useState<ProvisioningExecutionResponse | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  // Sync initial props when navigating from "Configurar esta porta" or "Atrelar Cliente"
  useEffect(() => {
    if (initialPopId) {
      setPopId(initialPopId);
      setPopSelected(true);
    }
    if (initialDeviceId) {
      setDeviceId(initialDeviceId);
      setPopSelected(true);
    }
    if (initialInterfaceName) setInterfaceName(initialInterfaceName);
    if (initialCustomerId) {
      handleSelectCustomer(String(initialCustomerId));
    }
  }, [initialPopId, initialDeviceId, initialInterfaceName, initialCustomerId]);

  const handleSelectCustomer = (cidStr: string) => {
    setSelectedCustomerId(cidStr);
    const cust = customers.find((c) => String(c.id) === cidStr);
    if (!cust) return;
    if (cust.pop_id) {
      setPopId(cust.pop_id);
      setPopSelected(true);
    }
    if (cust.device_id) setDeviceId(cust.device_id);
    if (cust.interface_name) setInterfaceName(cust.interface_name);
    if (cust.vlan_id) setVlanId(cust.vlan_id);
    setVlanDescription(cust.name);
    setVlanifDescription(`GATEWAY-${cust.name}`);
    if (cust.vlanif_ip) {
      const [ipPart, cidrPart] = cust.vlanif_ip.split("/");
      if (ipPart) setVlanifIpv4(ipPart);
      if (cidrPart) setVlanifCidr(Number(cidrPart) || 30);
      setCreateVlanif(true);
    }
    if (cust.routed_block) {
      const firstBlock = cust.routed_block.split(",")[0].trim();
      const [netPart, prefPart] = firstBlock.split("/");
      const nh =
        cust.vlanif_ip && cust.vlanif_ip.split("/")[0].endsWith(".1")
          ? cust.vlanif_ip.split("/")[0].slice(0, -2) + ".2"
          : "10.24.43.2";
      if (netPart) {
        const cidrNum = Number(prefPart) || 30;
        setCreateStaticRoutes(true);
        setStaticRoutes([
          {
            ip_version: 4,
            destination_network: netPart,
            cidr_prefix: cidrNum,
            subnet_mask: getMaskForCidr(cidrNum),
            next_hop: nh,
            description: `BLOCO-${cust.name}`,
            preference: 60,
            vrf_name: "",
          },
        ]);
      }
    }
  };

  // Keep deviceId in sync when POP changes
  useEffect(() => {
    const firstInPop = allDevices.find((d) => d.pop_id === popId);
    if (firstInPop && !allDevices.some((d) => d.id === deviceId && d.pop_id === popId)) {
      setDeviceId(firstInPop.id);
    }
  }, [popId, allDevices, deviceId]);

  // Keep L3 target device synced when selected switch changes
  useEffect(() => {
    if (!selectedDevice) return;
    if (selectedDevice.supports_l3_routing) {
      setL3RoutingDeviceId(selectedDevice.id);
    } else {
      // Automatically suggest an L3 router if the user chooses an L2-only switch
      const l3Fallback = allDevices.find((d) => d.supports_l3_routing);
      if (l3Fallback) {
        setL3RoutingDeviceId(l3Fallback.id);
      } else {
        setL3RoutingDeviceId(selectedDevice.id);
      }
    }
  }, [selectedDevice, allDevices]);

  // Load interfaces for selected switch and select only a FREE port
  useEffect(() => {
    if (!deviceId) return;
    setLoadingInterfaces(true);
    apiService
      .getDeviceInterfaces(deviceId)
      .then((list) => {
        setInterfaces(list);
        const freeList = list.filter((i) => !isInterfaceOccupied(i));
        if (
          freeList.length > 0 &&
          !freeList.some((i) => i.name === interfaceName)
        ) {
          const preferred =
            freeList.find((i) => i.name === "XGigabitEthernet0/0/39") ||
            freeList[0];
          setInterfaceName(preferred.name);
        }
      })
      .catch(() => setInterfaces([]))
      .finally(() => setLoadingInterfaces(false));
  }, [deviceId]);

  const freeInterfaces = useMemo(
    () => interfaces.filter((i) => !isInterfaceOccupied(i)),
    [interfaces]
  );

  const currentPortObj = useMemo(
    () => interfaces.find((i) => i.name === interfaceName) || null,
    [interfaces, interfaceName]
  );

  const buildPayload = (): ProvisioningPayload => ({
    pop_id: popId,
    device_id: deviceId,
    interface_name: interfaceName,
    vlan_id: Number(vlanId),
    vlan_description: vlanDescription.trim() || `VLAN-${vlanId}`,
    port_description: vlanDescription.trim() || `VLAN-${vlanId}`,
    port_mode: portMode,
    hybrid_tagged: hybridTagged,
    auto_create_vlan: autoCreateVlan,
    preserve_existing_vlans: preserveExistingVlans,
    create_vlanif: createVlanif,
    vlanif_description:
      vlanifDescription.trim() || `GATEWAY-${vlanDescription.trim()}`,
    vlanif_ipv4: createVlanif ? vlanifIpv4.trim() : undefined,
    vlanif_cidr: createVlanif ? Number(vlanifCidr) : undefined,
    vlanif_subnet_mask: createVlanif ? getMaskForCidr(Number(vlanifCidr)) : undefined,
    vlanif_ipv6:
      createVlanif && enableIpv6Vlanif && vlanifIpv6.trim()
        ? vlanifIpv6.trim()
        : undefined,
    vlanif_vrf_name:
      createVlanif && vlanifVrf.trim() ? vlanifVrf.trim() : undefined,
    create_static_routes: createStaticRoutes,
    l3_routing_device_id: l3RoutingDeviceId,
    static_routes: createStaticRoutes ? staticRoutes : [],
    save_configuration: saveConfiguration,
    explicit_confirmation: explicitConfirmation,
  });

  const handlePreviewAndValidate = async () => {
    setErrorBanner(null);
    setIsValidating(true);
    try {
      const res = await apiService.previewProvisioning(buildPayload());
      setPreviewData(res);
    } catch (err: any) {
      setErrorBanner(err.message || "Falha ao validar prévia de comandos.");
    } finally {
      setIsValidating(false);
    }
  };

  // Automatically refresh preview when key inputs change
  useEffect(() => {
    if (!deviceId || !interfaceName || !vlanId) return;
    const timer = setTimeout(() => {
      handlePreviewAndValidate();
    }, 280);
    return () => clearTimeout(timer);
  }, [
    popId,
    deviceId,
    interfaceName,
    vlanId,
    vlanDescription,
    portMode,
    hybridTagged,
    autoCreateVlan,
    preserveExistingVlans,
    createVlanif,
    vlanifDescription,
    vlanifIpv4,
    vlanifCidr,
    enableIpv6Vlanif,
    vlanifIpv6,
    vlanifVrf,
    createStaticRoutes,
    l3RoutingDeviceId,
    staticRoutes,
    saveConfiguration,
  ]);

  const handleExecuteSSH = async () => {
    setErrorBanner(null);
    setExecutionResult(null);
    if (!explicitConfirmation) {
      setErrorBanner(
        "Marque a caixa de confirmação explícita antes de aplicar as alterações via SSH no equipamento."
      );
      return;
    }
    setIsApplying(true);
    try {
      const res = await apiService.executeProvisioning(buildPayload());
      setExecutionResult(res);
      onSuccessInvalidate();
      // Refresh interfaces after apply
      const updatedIfaces = await apiService.getDeviceInterfaces(deviceId);
      setInterfaces(updatedIfaces);
    } catch (err: any) {
      setErrorBanner(err.message || "Erro ao aplicar configuração via SSH.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleAddRouteRow = () => {
    const defaultNextHop =
      staticRoutes[0]?.next_hop ||
      (vlanifIpv4.endsWith(".1")
        ? vlanifIpv4.slice(0, -2) + ".2"
        : "10.24.43.2");
    setStaticRoutes((prev) => [
      ...prev,
      {
        ip_version: 4,
        destination_network: "45.0.0.8",
        cidr_prefix: 29,
        subnet_mask: "255.255.255.248",
        next_hop: defaultNextHop,
        description: `BLOCO-PUBLICO-${prev.length + 1}`,
        preference: 60,
        vrf_name: "",
      },
    ]);
  };

  const handleUpdateRouteRow = (
    idx: number,
    field: keyof StaticRouteFormItem,
    value: any
  ) => {
    setStaticRoutes((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        if (field === "cidr_prefix" && updated.ip_version === 4) {
          updated.subnet_mask = getMaskForCidr(Number(value));
        }
        return updated;
      })
    );
  };

  const handleRemoveRouteRow = (idx: number) => {
    setStaticRoutes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLoadPromptExamplePreset = () => {
    setPopSelected(true);
    setUnlockedStep(7);
    const motiro = pops.find((p) => p.name.includes("MOTIRO")) || pops[0];
    if (motiro) setPopId(motiro.id);
    const swMontiro =
      allDevices.find((d) => d.name === "SWITCH-MPLS-MONTIRO") || allDevices[0];
    if (swMontiro) {
      setDeviceId(swMontiro.id);
      setL3RoutingDeviceId(swMontiro.id);
    }
    setInterfaceName("XGigabitEthernet0/0/39");
    setVlanId(2443);
    setVlanDescription("CLIENTE-LGCONNECT");
    setPortMode("access");
    setCreateVlanif(true);
    setVlanifDescription("GATEWAY-CLIENTE-LGCONNECT");
    setVlanifIpv4("10.24.43.1");
    setVlanifCidr(30);
    setCreateStaticRoutes(true);
    setStaticRoutes([
      {
        ip_version: 4,
        destination_network: "45.0.0.0",
        cidr_prefix: 30,
        subnet_mask: "255.255.255.252",
        next_hop: "10.24.43.2",
        description: "BLOCO-PUBLICO-CLIENTE",
        preference: 60,
        vrf_name: "",
      },
      {
        ip_version: 4,
        destination_network: "45.0.0.8",
        cidr_prefix: 29,
        subnet_mask: "255.255.255.248",
        next_hop: "10.24.43.2",
        description: "BLOCO-ADICIONAL-29",
        preference: 60,
        vrf_name: "",
      },
      {
        ip_version: 4,
        destination_network: "45.0.0.16",
        cidr_prefix: 28,
        subnet_mask: "255.255.255.240",
        next_hop: "10.24.43.2",
        description: "BLOCO-ADICIONAL-28",
        preference: 60,
        vrf_name: "",
      },
    ]);
  };

  const handleCopyCli = () => {
    if (!previewData?.combined_cli_script) return;
    navigator.clipboard.writeText(previewData.combined_cli_script);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  // Syntax highlight helper for Huawei VRP lines
  const highlightVrpLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
      return <span className="text-slate-500 italic">{line}</span>;
    }
    if (
      trimmed.startsWith("vlan ") ||
      trimmed.startsWith("interface ") ||
      trimmed === "system-view"
    ) {
      return <span className="text-sky-400 font-semibold">{line}</span>;
    }
    if (
      trimmed.startsWith("ip route-static") ||
      trimmed.startsWith("ipv6 route-static")
    ) {
      return <span className="text-amber-300 font-semibold">{line}</span>;
    }
    if (trimmed.startsWith("ip address") || trimmed.startsWith("ipv6 address")) {
      return <span className="text-emerald-300 font-semibold">{line}</span>;
    }
    if (trimmed.startsWith("port ")) {
      return <span className="text-indigo-300">{line}</span>;
    }
    if (trimmed === "quit" || trimmed === "return" || trimmed === "save" || trimmed === "commit") {
      return <span className="text-purple-400">{line}</span>;
    }
    return <span className="text-slate-200">{line}</span>;
  };

  const selectedPopObj = useMemo(
    () => pops.find((p) => p.id === popId) || pops[0],
    [pops, popId]
  );

  const stepSquares = [
    {
      step: 1,
      title: "Escolher POP",
      value: selectedPopObj?.name || `POP #${popId}`,
      sub: `${selectedPopObj?.city || ""}/${selectedPopObj?.state || ""}`,
      anchor: "step-1-pop",
      bgClass:
        "bg-sky-50 hover:bg-sky-100/80 border-sky-300 dark:bg-sky-950/40 dark:border-sky-800",
      badgeClass: "bg-sky-600 text-white",
      textClass: "text-sky-900 dark:text-sky-200",
    },
    {
      step: 2,
      title: "Escolher Switch",
      value: selectedDevice?.name || "Selecionar",
      sub: `${selectedDevice?.model || ""} • ${selectedDevice?.management_ip || ""}`,
      anchor: "step-2-switch",
      bgClass:
        "bg-indigo-50 hover:bg-indigo-100/80 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800",
      badgeClass: "bg-indigo-600 text-white",
      textClass: "text-indigo-900 dark:text-indigo-200",
    },
    {
      step: 3,
      title: "Porta & Cliente",
      value: interfaceName,
      sub: `Modo ${portMode.toUpperCase()} • ${currentPortObj?.physical_status || "UP"}`,
      anchor: "step-3-porta",
      bgClass:
        "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800",
      badgeClass: "bg-emerald-600 text-white",
      textClass: "text-emerald-900 dark:text-emerald-200",
    },
    {
      step: 4,
      title: "Colocar VLAN",
      value: `VLAN ${vlanId}`,
      sub: vlanDescription || "Sem descrição",
      anchor: "step-4-vlan",
      bgClass:
        "bg-amber-50 hover:bg-amber-100/80 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
      badgeClass: "bg-amber-500 text-white",
      textClass: "text-amber-900 dark:text-amber-200",
    },
    {
      step: 5,
      title: "IP Gateway Vlanif",
      value: createVlanif ? `${vlanifIpv4}/${vlanifCidr}` : "Apenas L2",
      sub: createVlanif ? `Vlanif${vlanId}` : "Desativado",
      anchor: "step-5-vlanif",
      bgClass:
        "bg-purple-50 hover:bg-purple-100/80 border-purple-300 dark:bg-purple-950/40 dark:border-purple-800",
      badgeClass: "bg-purple-600 text-white",
      textClass: "text-purple-900 dark:text-purple-200",
    },
    {
      step: 6,
      title: "Rota Estática",
      value: createStaticRoutes
        ? `${staticRoutes.length} bloco(s) IP`
        : "Sem rota",
      sub:
        createStaticRoutes && staticRoutes[0]
          ? `${staticRoutes[0].destination_network}/${staticRoutes[0].cidr_prefix}`
          : "Opcional",
      anchor: "step-6-rota",
      bgClass:
        "bg-rose-50 hover:bg-rose-100/80 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800",
      badgeClass: "bg-rose-600 text-white",
      textClass: "text-rose-900 dark:text-rose-200",
    },
    {
      step: 7,
      title: "Prévia & Aplicar",
      value: previewData?.is_valid ? "Pronto p/ SSH" : "Revisar",
      sub: "Enviar ao Huawei",
      anchor: "step-7-ssh",
      bgClass:
        "bg-teal-50 hover:bg-teal-100/80 border-teal-300 dark:bg-teal-950/40 dark:border-teal-800",
      badgeClass: "bg-teal-600 text-white",
      textClass: "text-teal-900 dark:text-teal-200",
    },
  ];

  const scrollToStep = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. DESENHO DO SWITCH NO TOPO (Carregado ao escolher o POP na Etapa 1)
      ===================================================================== */}
      <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
              {popSelected
                ? "Desenho do Switch no Topo — Clique em qualquer porta LIVRE numerada para selecioná-la"
                : "Painel Superior do Switch Huawei — Escolha um POP na Etapa 1 abaixo para exibir o Switch aqui"}
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {popSelected ? (
                <>
                  {selectedDevice?.name} ({selectedPopObj?.name}) — Porta Livre Ativa:{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    {interfaceName}
                  </span>
                </>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  Nenhum POP selecionado ainda — Role e escolha o POP na Etapa 1
                </span>
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadPromptExamplePreset}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
            >
              Preencher Exemplo Automático (CLIENTE-LGCONNECT)
            </button>
            {popSelected && (
              <button
                type="button"
                onClick={() => setShowVisualMap((v) => !v)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                {showVisualMap
                  ? "Ocultar Ficha Técnica da Porta"
                  : "Ver Ficha Técnica da Porta"}
              </button>
            )}
          </div>
        </div>

        {!popSelected ? (
          <div className="rounded-xl border-2 border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-6 text-center space-y-2">
            <Server className="w-8 h-8 text-sky-600 dark:text-sky-400 mx-auto" />
            <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              Escolha o POP por rolagem na Etapa 1 logo abaixo
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Assim que você escolher o POP na <strong>Etapa 1</strong>, o desenho físico do Switch Huawei aparecerá automaticamente aqui na parte superior e também na <strong>Etapa 2</strong>.
            </p>
          </div>
        ) : (
          selectedDevice &&
          interfaces.length > 0 && (
            <div className="space-y-3">
              {popDevices.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    O {selectedPopObj?.name} possui {popDevices.length} Switches — Alternar visualização no topo:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {popDevices.map((sw) => (
                      <button
                        key={sw.id}
                        type="button"
                        onClick={() => {
                          setDeviceId(sw.id);
                          setUnlockedStep((s) => Math.max(s, 3));
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                          sw.id === deviceId
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {sw.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <PortVisualMap
                device={selectedDevice}
                interfaces={interfaces}
                selectedInterfaceName={interfaceName}
                onSelectInterface={(iface) => {
                  if (isInterfaceOccupied(iface)) return;
                  setInterfaceName(iface.name);
                  setUnlockedStep((s) => Math.max(s, 3));
                }}
                compact={false}
                onlyChassis={!showVisualMap}
                restrictToFreePorts={true}
              />
            </div>
          )
        )}
      </div>

      {/* =====================================================================
          2. TRILHA DE QUADRADOS COLORIDOS POR ETAPA (SEQUÊNCIA 1 A 7)
      ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stepSquares.map((sq) => {
          const isLocked = sq.step > unlockedStep;
          return (
            <button
              key={sq.step}
              type="button"
              onClick={() => {
                if (!isLocked) scrollToStep(sq.anchor);
              }}
              className={`group text-left rounded-2xl border-2 p-3.5 shadow-sm transition-all flex flex-col justify-between min-h-[112px] ${
                isLocked
                  ? "bg-slate-100/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                  : `${sq.bgClass} hover:shadow-md hover:-translate-y-0.5`
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`w-7 h-7 rounded-xl text-xs font-extrabold flex items-center justify-center shadow-sm ${
                    isLocked ? "bg-slate-400 text-white" : sq.badgeClass
                  }`}
                >
                  {isLocked ? <Lock className="w-3.5 h-3.5" /> : sq.step}
                </span>
                <span
                  className={`text-[10px] font-extrabold uppercase ${
                    isLocked ? "text-slate-400" : sq.textClass
                  }`}
                >
                  {isLocked ? "Aguardando" : `Etapa ${sq.step}`}
                </span>
              </div>
              <div className="mt-2.5">
                <div
                  className={`text-xs font-bold ${
                    isLocked ? "text-slate-500" : sq.textClass
                  }`}
                >
                  {sq.title}
                </div>
                <div className="text-xs font-extrabold font-mono text-slate-900 dark:text-white truncate mt-0.5">
                  {isLocked ? "Conclua a anterior" : sq.value}
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {sq.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          3. QUADRADOS LÚDICOS EM SEQUÊNCIA (1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* QUADRADO 1 (AZUL CÉU CLARO) — ESCOLHER O POP POR ROLAGEM */}
        <div
          id="step-1-pop"
          className="rounded-2xl border-2 border-sky-300 dark:border-sky-800 bg-sky-50/85 dark:bg-sky-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-sky-200 dark:border-sky-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-sky-600 text-white text-base font-extrabold flex items-center justify-center shadow">
                  1
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 block">
                    Primeira Etapa (Início)
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Escolher o POP (Rolagem)
                  </h3>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-950 dark:text-sky-200 mb-1">
                1º Passo — Role e selecione o POP:
              </label>
              <select
                value={popSelected ? popId : ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val) handleChoosePop(val);
                }}
                className="w-full rounded-xl border-2 border-sky-400 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-slate-100 shadow-sm"
              >
                <option value="">-- Role para escolher o POP --</option>
                {pops.map((p) => {
                  const swCount = allDevices.filter((d) => d.pop_id === p.id).length;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.city}/{p.state} ({swCount}{" "}
                      {swCount === 1 ? "Switch" : "Switches"})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-sky-800 dark:text-sky-300 mb-1.5">
                Ou role a lista de POPs abaixo e clique:
              </span>
              <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
                {pops.map((p) => {
                  const active = popSelected && p.id === popId;
                  const swCount = allDevices.filter((d) => d.pop_id === p.id).length;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoosePop(p.id)}
                      className={`w-full text-left p-2.5 rounded-xl border-2 transition ${
                        active
                          ? "border-sky-600 bg-white dark:bg-slate-900 shadow-sm ring-2 ring-sky-400/40"
                          : "border-sky-200/90 dark:border-sky-800/60 bg-white/70 dark:bg-slate-900/60 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                          {p.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                          {swCount} {swCount === 1 ? "Switch" : "Switches"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                        <span>
                          {p.city}/{p.state}
                        </span>
                        {active && (
                          <span className="text-[10px] font-bold text-sky-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Selecionado
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-sky-200/70 dark:border-sky-800/60 flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-sky-900 dark:text-sky-200">
              {popSelected ? selectedPopObj?.name : "Aguardando escolha do POP"}
            </span>
            <button
              type="button"
              onClick={() => handleChoosePop(popId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition"
            >
              Confirmar Etapa 1 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* QUADRADO 2 (ÍNDIGO/LAVANDA CLARO) — ESCOLHER O SWITCH */}
        <div
          id="step-2-switch"
          className={`relative rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-indigo-50/85 dark:bg-indigo-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4 transition ${
            unlockedStep < 2 ? "opacity-60" : ""
          }`}
        >
          {unlockedStep < 2 && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 text-center">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-indigo-200 max-w-xs space-y-2">
                <Lock className="w-6 h-6 text-indigo-600 mx-auto" />
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Etapa 2 Aguardando a Etapa 1
                </div>
                <p className="text-[11px] text-slate-500">
                  Escolha primeiro o POP na Etapa 1 ao lado para carregar o Switch no topo e nesta etapa.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white text-base font-extrabold flex items-center justify-center shadow">
                  2
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                    Segunda Etapa ({popDevices.length}{" "}
                    {popDevices.length === 1 ? "Switch no POP" : "Switches no POP"})
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    {popDevices.length > 1
                      ? "Escolher Qual Switch do POP"
                      : "Switch do POP Selecionado"}
                  </h3>
                </div>
              </div>
            </div>

            {popDevices.length > 1 ? (
              <>
                <div className="p-2.5 rounded-xl bg-indigo-100/90 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Este POP possui {popDevices.length} switches. Escolha abaixo qual Switch deseja configurar:
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                    Selecionar Switch por rolagem:
                  </label>
                  <select
                    value={deviceId}
                    onChange={(e) => {
                      setDeviceId(Number(e.target.value));
                      setUnlockedStep((s) => Math.max(s, 3));
                    }}
                    className="w-full rounded-xl border-2 border-indigo-400 dark:border-indigo-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100 shadow-sm"
                  >
                    {popDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.model} ({d.management_ip})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Switch único deste POP carregado automaticamente no topo e nesta etapa!
                </span>
              </div>
            )}

            <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
              {(popDevices.length > 0 ? popDevices : allDevices).map((d) => {
                const active = d.id === deviceId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDeviceId(d.id);
                      setUnlockedStep((s) => Math.max(s, 3));
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition ${
                      active
                        ? "border-indigo-600 bg-white dark:bg-slate-900 shadow-sm ring-2 ring-indigo-400/40"
                        : "border-indigo-200/90 dark:border-indigo-800/60 bg-white/70 dark:bg-slate-900/60 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-slate-100">
                        {d.name}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          d.supports_l3_routing
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {d.supports_l3_routing ? "L2 / L3" : "L2 Puro"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {d.model} • {d.management_ip}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-200 truncate">
              {selectedDevice?.name}
            </span>
            <button
              type="button"
              onClick={() => setUnlockedStep((s) => Math.max(s, 3))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              Confirmar Etapa 2 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* QUADRADO 3 (VERDE MENTA/ESMERALDA CLARO) — ESCOLHER PORTA LIVRE E NOME DO CLIENTE */}
        <div
          id="step-3-porta"
          className={`relative rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/85 dark:bg-emerald-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4 transition ${
            unlockedStep < 3 ? "opacity-60" : ""
          }`}
        >
          {unlockedStep < 3 && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 text-center">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-emerald-200 max-w-xs space-y-2">
                <Lock className="w-6 h-6 text-emerald-600 mx-auto" />
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Etapa 3 Aguardando a Etapa 2
                </div>
                <p className="text-[11px] text-slate-500">
                  Escolha e confirme primeiro o Switch na Etapa 2 para escolher a Porta Livre e o Cliente.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white text-base font-extrabold flex items-center justify-center shadow">
                  3
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                    Terceira Etapa (Apenas Portas Livres)
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Porta Livre & Nome do Cliente
                  </h3>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-950 dark:text-emerald-200 mb-1">
                1. Escolher Porta Livre ({freeInterfaces.length} livres de {interfaces.length} portas — portas com descrição estão ocultas/bloqueadas)
              </label>
              <select
                value={interfaceName}
                onChange={(e) => setInterfaceName(e.target.value)}
                disabled={loadingInterfaces}
                className="w-full rounded-xl border-2 border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
              >
                {freeInterfaces.map((iface) => (
                  <option key={iface.id} value={iface.name}>
                    Porta #{iface.port_index} — {iface.name} [PORTA LIVRE • SEM DESCRIÇÃO]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-950 dark:text-emerald-200 mb-1">
                2. Digitar o Nome do Cliente (Gravado na descrição da porta e VLAN)
              </label>
              <input
                type="text"
                value={vlanDescription}
                onChange={(e) => {
                  setVlanDescription(e.target.value);
                  setVlanifDescription(`GATEWAY-${e.target.value}`);
                }}
                placeholder="Digite o nome do cliente (ex.: CLIENTE-LGCONNECT)"
                className="w-full rounded-xl border-2 border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                Ou selecionar Cliente Cadastrado (Opcional — preenche o nome acima):
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white/80 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
              >
                <option value="">
                  -- Opcional: buscar da lista do Supervisor --
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} (VLAN {c.vlan_id || "S/N"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-200 truncate">
              {interfaceName} • {vlanDescription || "Sem nome"}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!vlanDescription.trim()) {
                  alert("Por favor, digite o nome do cliente na Etapa 3 antes de avançar.");
                  return;
                }
                setUnlockedStep((s) => Math.max(s, 4));
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              Confirmar Etapa 3 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SEGUNDA LINHA DE QUADRADOS COLORIDOS: ETAPAS 4, 5 e 6 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* QUADRADO 4 (AMARELO/ÂMBAR CLARO) — CONFIGURAR VLAN */}
        <div
          id="step-4-vlan"
          className={`relative rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/85 dark:bg-amber-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4 transition ${
            unlockedStep < 4 ? "opacity-60" : ""
          }`}
        >
          {unlockedStep < 4 && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 text-center">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-amber-200 max-w-xs space-y-2">
                <Lock className="w-6 h-6 text-amber-500 mx-auto" />
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Etapa 4 Aguardando a Etapa 3
                </div>
                <p className="text-[11px] text-slate-500">
                  Escolha a Porta Livre e digite o Nome do Cliente na Etapa 3 para liberar a VLAN.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-500 text-white text-base font-extrabold flex items-center justify-center shadow">
                  4
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                    Quarta Etapa
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Colocar VLAN na Porta
                  </h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                  Número da VLAN
                </label>
                <input
                  type="number"
                  min={1}
                  max={4094}
                  value={vlanId}
                  onChange={(e) => setVlanId(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono font-extrabold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                  Descrição (Cliente)
                </label>
                <input
                  type="text"
                  value={vlanDescription}
                  onChange={(e) => setVlanDescription(e.target.value)}
                  placeholder="CLIENTE-LGCONNECT"
                  className="w-full rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                Modo da Porta (Access = Untagged | Trunk = Tagged)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["access", "trunk", "hybrid"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPortMode(m)}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold uppercase border-2 transition ${
                      portMode === m
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-amber-300 dark:border-amber-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer text-amber-950 dark:text-amber-200 font-medium">
                <input
                  type="checkbox"
                  checked={autoCreateVlan}
                  onChange={(e) => setAutoCreateVlan(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600"
                />
                Criar VLAN {vlanId} automaticamente no switch
              </label>
              {portMode !== "access" && (
                <label className="inline-flex items-center gap-2 cursor-pointer text-amber-950 dark:text-amber-200 font-medium">
                  <input
                    type="checkbox"
                    checked={preserveExistingVlans}
                    onChange={(e) => setPreserveExistingVlans(e.target.checked)}
                    className="rounded border-amber-400 text-amber-600"
                  />
                  Preservar VLANs já existentes ({currentPortObj?.allowed_vlans || "1"})
                </label>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between gap-2">
            <strong className="font-mono text-xs text-amber-900 dark:text-amber-200">
              VLAN {vlanId} ({portMode.toUpperCase()})
            </strong>
            <button
              type="button"
              onClick={() => setUnlockedStep((s) => Math.max(s, 5))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              Confirmar Etapa 4 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* QUADRADO 5 (ROXO/VIOLETA CLARO) — CRIAR VLANIF (IP GATEWAY) */}
        <div
          id="step-5-vlanif"
          className={`relative rounded-2xl border-2 border-purple-300 dark:border-purple-800 bg-purple-50/85 dark:bg-purple-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4 transition ${
            unlockedStep < 5 ? "opacity-60" : ""
          }`}
        >
          {unlockedStep < 5 && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 text-center">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-purple-200 max-w-xs space-y-2">
                <Lock className="w-6 h-6 text-purple-600 mx-auto" />
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Etapa 5 Aguardando a Etapa 4
                </div>
                <p className="text-[11px] text-slate-500">
                  Confirme primeiro a VLAN na Etapa 4 para configurar o IP da Vlanif.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-purple-600 text-white text-base font-extrabold flex items-center justify-center shadow">
                  5
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                    Quinta Etapa
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Colocar IP (Vlanif{vlanId})
                  </h3>
                </div>
              </div>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-extrabold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700">
                <input
                  type="checkbox"
                  checked={createVlanif}
                  onChange={(e) => setCreateVlanif(e.target.checked)}
                  className="w-4 h-4 rounded border-purple-300 text-purple-600"
                />
                Ativar IP
              </label>
            </div>

            {createVlanif ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-purple-950 dark:text-purple-200 mb-1">
                      IP Gateway (Vlanif{vlanId})
                    </label>
                    <input
                      type="text"
                      value={vlanifIpv4}
                      onChange={(e) => setVlanifIpv4(e.target.value)}
                      placeholder="10.24.43.1"
                      className="w-full rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-950 dark:text-purple-200 mb-1">
                      Máscara CIDR
                    </label>
                    <select
                      value={vlanifCidr}
                      onChange={(e) => setVlanifCidr(Number(e.target.value))}
                      className="w-full rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                    >
                      {[31, 30, 29, 28, 27, 26, 25, 24].map((c) => (
                        <option key={c} value={c}>
                          /{c} ({getMaskForCidr(c)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-950 dark:text-purple-200 mb-1">
                    Descrição da Interface Vlanif
                  </label>
                  <input
                    type="text"
                    value={vlanifDescription}
                    onChange={(e) => setVlanifDescription(e.target.value)}
                    placeholder={`GATEWAY-${vlanDescription}`}
                    className="w-full rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-purple-950 dark:text-purple-200 font-medium">
                  <input
                    type="checkbox"
                    checked={enableIpv6Vlanif}
                    onChange={(e) => setEnableIpv6Vlanif(e.target.checked)}
                    className="rounded border-purple-400 text-purple-600"
                  />
                  Habilitar IPv6 na Vlanif{vlanId}
                </label>

                {enableIpv6Vlanif && (
                  <input
                    type="text"
                    value={vlanifIpv6}
                    onChange={(e) => setVlanifIpv6(e.target.value)}
                    placeholder="2804:14d:2443::1/64"
                    className="w-full rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                  />
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200">
                Desativado: A porta funcionará apenas em Camada 2 (sem endereço
                IP no switch).
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-purple-200/70 dark:border-purple-800/60 flex items-center justify-between gap-2">
            <strong className="font-mono text-xs text-purple-900 dark:text-purple-200">
              {createVlanif ? `${vlanifIpv4}/${vlanifCidr}` : "Sem IP (L2)"}
            </strong>
            <button
              type="button"
              onClick={() => setUnlockedStep((s) => Math.max(s, 6))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              Confirmar Etapa 5 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* QUADRADO 6 (ROSA/CORAL CLARO) — CONFIGURAR ROTA ESTÁTICA */}
        <div
          id="step-6-rota"
          className={`relative rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/85 dark:bg-rose-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4 transition ${
            unlockedStep < 6 ? "opacity-60" : ""
          }`}
        >
          {unlockedStep < 6 && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 text-center">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-rose-200 max-w-xs space-y-2">
                <Lock className="w-6 h-6 text-rose-600 mx-auto" />
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Etapa 6 Aguardando a Etapa 5
                </div>
                <p className="text-[11px] text-slate-500">
                  Confirme primeiro a Etapa 5 (IP Vlanif) para liberar a Rota Estática.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-rose-600 text-white text-base font-extrabold flex items-center justify-center shadow">
                  6
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 block">
                    Sexta Etapa
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Colocar Rota Estática
                  </h3>
                </div>
              </div>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-extrabold text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700">
                <input
                  type="checkbox"
                  checked={createStaticRoutes}
                  onChange={(e) => setCreateStaticRoutes(e.target.checked)}
                  className="w-4 h-4 rounded border-rose-300 text-rose-600"
                />
                Ativar Rota
              </label>
            </div>

          {createStaticRoutes ? (
            <div className="space-y-4">
              {/* Target L3 Router selector (Crucial when access switch is L2!) */}
              <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    Equipamento Layer 3 Responsável pelo Roteamento
                  </span>
                  {!selectedDevice?.supports_l3_routing && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                      Switch de acesso selecionado é Camada 2 puro!
                    </span>
                  )}
                </div>
                <select
                  value={l3RoutingDeviceId}
                  onChange={(e) => setL3RoutingDeviceId(Number(e.target.value))}
                  className="w-full rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {allDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.model} • {d.management_ip}) —{" "}
                      {d.supports_l3_routing
                        ? "Suporta Roteamento Layer 3"
                        : "BLOQUEADO: Apenas Layer 2"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic list of Public Blocks */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {staticRoutes.map((rt, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Bloco Roteado #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={rt.ip_version}
                          onChange={(e) =>
                            handleUpdateRouteRow(
                              idx,
                              "ip_version",
                              Number(e.target.value)
                            )
                          }
                          className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-semibold"
                        >
                          <option value={4}>IPv4 (ip route-static)</option>
                          <option value={6}>IPv6 (ipv6 route-static)</option>
                        </select>
                        {staticRoutes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRouteRow(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remover esta rota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Rede de Destino
                        </label>
                        <input
                          type="text"
                          value={rt.destination_network}
                          onChange={(e) =>
                            handleUpdateRouteRow(
                              idx,
                              "destination_network",
                              e.target.value
                            )
                          }
                          placeholder="45.0.0.0"
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Prefixo CIDR / Máscara
                        </label>
                        <select
                          value={rt.cidr_prefix}
                          onChange={(e) =>
                            handleUpdateRouteRow(
                              idx,
                              "cidr_prefix",
                              Number(e.target.value)
                            )
                          }
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                        >
                          {rt.ip_version === 4
                            ? [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22].map(
                                (c) => (
                                  <option key={c} value={c}>
                                    /{c} ({getMaskForCidr(c)})
                                  </option>
                                )
                              )
                            : [128, 64, 56, 48, 32].map((c) => (
                                <option key={c} value={c}>
                                  /{c}
                                </option>
                              ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Next-hop (IP Cliente)
                        </label>
                        <input
                          type="text"
                          value={rt.next_hop}
                          onChange={(e) =>
                            handleUpdateRouteRow(idx, "next_hop", e.target.value)
                          }
                          placeholder="10.24.43.2"
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Descrição da Rota
                        </label>
                        <input
                          type="text"
                          value={rt.description || ""}
                          onChange={(e) =>
                            handleUpdateRouteRow(
                              idx,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="BLOCO-PUBLICO-CLIENTE"
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Preferência Admin
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={255}
                          value={rt.preference}
                          onChange={(e) =>
                            handleUpdateRouteRow(
                              idx,
                              "preference",
                              Number(e.target.value)
                            )
                          }
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          VPN-Instance (VRF Opcional)
                        </label>
                        <input
                          type="text"
                          value={rt.vrf_name || ""}
                          onChange={(e) =>
                            handleUpdateRouteRow(idx, "vrf_name", e.target.value)
                          }
                          placeholder="Tabela Global"
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddRouteRow}
                className="w-full py-2 rounded-xl border border-dashed border-rose-400 dark:border-rose-700 bg-white/80 dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                + Adicionar outro bloco IP para o cliente
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
              Desativado: Nenhuma rota estática adicional será criada.
            </div>
          )}
          </div>

          <div className="pt-2 border-t border-rose-200/70 dark:border-rose-800/60 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
            <div>
              <span>Blocos Roteados: </span>
              <strong className="font-mono">
                {createStaticRoutes
                  ? `${staticRoutes.length} rota(s)`
                  : "Sem rota estática"}
              </strong>
            </div>
            {unlockedStep === 6 && (
              <button
                type="button"
                onClick={() => {
                  setUnlockedStep(7);
                  setTimeout(() => scrollToStep("step-7-ssh"), 120);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition"
              >
                Confirmar Etapa 6 → Liberar Prévia SSH
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Validation Issues & Conflict Alerts */}
      {previewData && previewData.issues.length > 0 && (
        <div className="space-y-2">
          {previewData.issues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border flex items-start gap-3 text-xs ${
                issue.severity === "ERROR"
                  ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200"
                  : issue.severity === "WARNING"
                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                  : "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
              }`}
            >
              {issue.severity === "ERROR" ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              )}
              <div>
                <strong className="font-semibold uppercase mr-1.5">
                  [{issue.severity}]
                </strong>
                <span>{issue.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {errorBanner && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* QUADRADO 7 (CIANO/TEAL CLARO): PRÉVIA LADO A LADO & TERMINAL HUAWEI VRP */}
      {previewData && (
        <div
          id="step-7-ssh"
          className={`relative rounded-2xl border-2 border-teal-300 dark:border-teal-800 bg-teal-50/75 dark:bg-teal-950/30 p-5 shadow-sm space-y-5 transition-all ${
            unlockedStep < 7 ? "opacity-55 pointer-events-none select-none" : ""
          }`}
        >
          {unlockedStep < 7 && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/10 dark:bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center p-4">
              <span className="px-3.5 py-2 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-teal-300 dark:border-teal-700 text-xs font-extrabold text-teal-900 dark:text-teal-200 shadow-md">
                🔒 Bloqueado: Conclua a Etapa 6 (Rota Estática) para liberar a Prévia e Aplicação SSH
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-teal-200 dark:border-teal-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-teal-600 text-white text-base font-extrabold flex items-center justify-center shadow">
                7
              </span>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 dark:text-teal-300 block">
                  Sétima Etapa — Conferência Final
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Prévia dos Comandos VRP e Aplicação via SSH
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCli}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
              >
                {copiedCli ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar Script CLI
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePreviewAndValidate}
                disabled={isValidating}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-xs font-semibold text-blue-700 dark:text-blue-300 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`}
                />
                Validar Conflitos
              </button>
            </div>
          </div>

          {/* Side-by-Side Current vs Proposed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Configuração Atual (Descoberta no Equipamento)</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {interfaceName}
                </span>
              </div>
              <pre className="p-3.5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed min-h-[190px]">
                {previewData.current_config_text || "# Sem configuração anterior"}
              </pre>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Configuração Proposta (Desejada)</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                  Diff Destacado
                </span>
              </div>
              <div className="p-3.5 font-mono text-xs overflow-x-auto leading-relaxed min-h-[190px] space-y-0.5">
                {previewData.diff_lines.map((dline, idx) => {
                  if (dline.line_type === "added") {
                    return (
                      <div
                        key={idx}
                        className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-sm border-l-2 border-emerald-400"
                      >
                        + {dline.after_line}
                      </div>
                    );
                  }
                  if (dline.line_type === "removed") {
                    return (
                      <div
                        key={idx}
                        className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-sm border-l-2 border-red-400 line-through opacity-80"
                      >
                        - {dline.before_line}
                      </div>
                    );
                  }
                  if (dline.line_type === "modified") {
                    return (
                      <div
                        key={idx}
                        className="bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-sm border-l-2 border-amber-400"
                      >
                        ~ {dline.after_line}{" "}
                        <span className="text-slate-500 text-[10px]">
                          (era: {dline.before_line?.trim()})
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="text-slate-300 px-2">
                      {"  "}
                      {dline.after_line}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Visual Dark Huawei VRP CLI Terminal */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800 text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 font-semibold text-slate-200">
                  Terminal Huawei VRP — Sequência Exata de Comandos SSH
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {previewData.device_plans.map((p) => p.device_name).join(" + ")}
              </span>
            </div>

            <div className="space-y-0.5 overflow-x-auto">
              {previewData.combined_cli_script.split("\n").map((line, i) => (
                <div key={i} className="leading-relaxed">
                  {highlightVrpLine(line)}
                </div>
              ))}
            </div>
          </div>

          {/* Explicit Confirmation & SSH Apply Action Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={explicitConfirmation}
                  onChange={(e) => setExplicitConfirmation(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Confirmo que revisei os comandos VRP e autorizo a aplicação via
                SSH com backup prévio automático
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={saveConfiguration}
                  onChange={(e) => setSaveConfiguration(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                Executar comando <code className="font-mono">save</code> após
                validação bem-sucedida da sessão
              </label>
            </div>

            <button
              type="button"
              onClick={handleExecuteSSH}
              disabled={!previewData.is_valid || isApplying || !canExecuteSsh}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-bold shadow-md transition"
            >
              <Play className="w-4 h-4 fill-current" />
              {isApplying
                ? "Aplicando via SSH..."
                : !canExecuteSsh
                ? "Bloqueado (Apenas Operador ou Admin podem aplicar na porta)"
                : "Aplicar Configuração via SSH"}
            </button>
          </div>
        </div>
      )}

      {/* SECTION 8: 14-Step SSH Execution Result Report */}
      {executionResult && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 className="font-bold text-emerald-950 dark:text-emerald-100">
                  Operação SSH #{executionResult.job_id} Concluída com Sucesso!
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  {executionResult.summary} (Backup #{executionResult.backup_id})
                </p>
              </div>
            </div>
            {executionResult.is_simulated && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                Executado no Simulador VRP
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {executionResult.workflow_steps.map((st) => (
              <div
                key={st.step}
                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 text-xs"
              >
                <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Passo {st.step}: {st.title}
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  {st.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200 max-h-56 overflow-y-auto space-y-1">
            {executionResult.command_results.map((c) => (
              <div key={c.sequence_order} className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">
                  [{c.sequence_order.toString().padStart(2, "0")}]
                </span>
                <span className="text-sky-300">{c.command_text}</span>
                <span className="text-slate-500">→</span>
                <span className="text-slate-400">{c.device_output}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


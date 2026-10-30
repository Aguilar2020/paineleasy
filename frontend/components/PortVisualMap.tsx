"use client";

import React from "react";
import { NetworkInterface, Device } from "@/types/network";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  Sliders,
  Terminal,
  XCircle,
} from "lucide-react";

export function isInterfaceOccupied(iface: NetworkInterface): boolean {
  const desc = (iface.description || "").trim().toUpperCase();
  if (
    desc !== "" &&
    !desc.startsWith("LIVRE") &&
    !desc.startsWith("PORTA-LIVRE") &&
    !desc.startsWith("DISPONIVEL")
  ) {
    return true;
  }
  if (iface.pvid !== 1 || (iface.allowed_vlans && iface.allowed_vlans !== "1")) {
    return true;
  }
  return false;
}

interface PortVisualMapProps {
  device: Device;
  interfaces: NetworkInterface[];
  selectedInterfaceName?: string;
  onSelectInterface: (iface: NetworkInterface) => void;
  onConfigurePort?: (iface: NetworkInterface) => void;
  compact?: boolean;
  onlyChassis?: boolean;
  restrictToFreePorts?: boolean;
}

export function PortVisualMap({
  device,
  interfaces,
  selectedInterfaceName,
  onSelectInterface,
  onConfigurePort,
  compact = false,
  onlyChassis = false,
  restrictToFreePorts = false,
}: PortVisualMapProps) {
  const sorted = [...interfaces].sort((a, b) => a.port_index - b.port_index);
  const selectedPort =
    sorted.find((i) => i.name === selectedInterfaceName) || sorted[0] || null;

  // Separate odd (top row) and even (bottom row) ports like a real Huawei S6730/S5735 chassis
  const topRow = sorted.filter((p) => p.port_index % 2 === 1);
  const bottomRow = sorted.filter((p) => p.port_index % 2 === 0);

  const getPortVisualClasses = (iface: NetworkInterface, isSelected: boolean) => {
    const occupied = isInterfaceOccupied(iface);
    if (isSelected) {
      return "bg-blue-600 text-white border-blue-400 ring-2 ring-blue-500/60 shadow-md scale-105";
    }
    if (restrictToFreePorts && occupied) {
      return "bg-slate-800/80 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed";
    }
    if (restrictToFreePorts && !occupied) {
      return "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-300 shadow-sm";
    }
    if (iface.physical_status === "ERROR" || iface.rx_errors > 100) {
      return "bg-red-500/90 hover:bg-red-600 text-white border-red-400";
    }
    if (iface.physical_status === "ALERT" || iface.rx_errors > 0) {
      return "bg-amber-500/90 hover:bg-amber-600 text-slate-950 border-amber-300";
    }
    if (iface.physical_status === "UP") {
      return "bg-emerald-500/90 hover:bg-emerald-600 text-white border-emerald-400";
    }
    return "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border-slate-400 dark:border-slate-600";
  };

  const renderConnector = (iface: NetworkInterface) => {
    const isSelected = iface.name === selectedPort?.name;
    const occupied = isInterfaceOccupied(iface);
    const disabledInProvisioning = restrictToFreePorts && occupied;
    return (
      <button
        key={iface.id}
        type="button"
        disabled={disabledInProvisioning}
        onClick={() => {
          if (disabledInProvisioning) return;
          onSelectInterface(iface);
        }}
        title={
          disabledInProvisioning
            ? `PORTA EM USO (BLOQUEADA): ${iface.name} — ${iface.description || `VLAN ${iface.allowed_vlans}`}`
            : `PORTA LIVRE: ${iface.name} | Clique para selecionar`
        }
        className={`group relative flex flex-col items-center justify-center rounded-md border transition-all duration-150 ${
          compact ? "w-9 h-8 text-[10px]" : "w-10 h-9 text-xs"
        } font-mono font-semibold ${getPortVisualClasses(iface, isSelected)}`}
      >
        {/* Ethernet RJ45/SFP+ top latch visual */}
        <span className="w-3.5 h-1 rounded-t-sm bg-black/25 -mt-0.5 mb-0.5" />
        <span>{iface.port_index}</span>
        {/* Link mode mini badge */}
        <span className="text-[8px] leading-none opacity-85 uppercase">
          {restrictToFreePorts
            ? occupied
              ? "USO"
              : "LIVRE"
            : iface.link_type === "trunk"
            ? "T"
            : iface.link_type === "hybrid"
            ? "H"
            : "A"}
        </span>
      </button>
    );
  };

  const upCount = sorted.filter((i) => i.physical_status === "UP").length;
  const downCount = sorted.filter((i) => i.physical_status === "DOWN").length;
  const alertCount = sorted.filter((i) => i.physical_status === "ALERT").length;
  const errorCount = sorted.filter((i) => i.physical_status === "ERROR").length;

  return (
    <div className="space-y-4">
      {/* Huawei Physical Switch Faceplate Chassis */}
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-100 p-4 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-bold tracking-wider">
              HUAWEI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-white">
                  {device.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {device.model}
                </span>
                {device.is_simulated && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Simulação VRP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                IP: {device.management_ip} • {device.system_version} •{" "}
                {sorted.length} interfaces físicas descobertas
              </p>
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {restrictToFreePorts ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Portas Livres ({sorted.filter((i) => !isInterfaceOccupied(i)).length})
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-500" />
                  Em Uso / Com Descrição ({sorted.filter((i) => isInterfaceOccupied(i)).length} bloqueadas)
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400/50" />
                  Selecionada
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  UP ({upCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  DOWN ({downCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Alerta ({alertCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Erro ({errorCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400/50" />
                  Selecionada
                </span>
              </>
            )}
          </div>
        </div>

        {/* Switch Ports Matrix */}
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col gap-2 min-w-max bg-slate-950/90 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5">
              {topRow.map((iface) => renderConnector(iface))}
            </div>
            {bottomRow.length > 0 && (
              <div className="flex items-center gap-1.5">
                {bottomRow.map((iface) => renderConnector(iface))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact 1-line bar when onlyChassis is true */}
      {onlyChassis && selectedPort && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold">
              Porta #{selectedPort.port_index} Selecionada
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {selectedPort.name}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              • Status: <strong>{selectedPort.physical_status}</strong> ({selectedPort.speed})
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              • Modo Atual: <strong className="uppercase text-blue-700 dark:text-blue-300">{selectedPort.link_type}</strong> (VLAN {selectedPort.allowed_vlans})
            </span>
          </div>
          <span className="font-mono text-slate-700 dark:text-slate-300">
            Descrição atual: <strong>{selectedPort.description || "Livre / Sem cliente"}</strong>
          </span>
        </div>
      )}

      {/* Selected Interface Details Panel */}
      {!onlyChassis && selectedPort && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono text-sm font-bold border border-blue-200 dark:border-blue-800">
                  Porta #{selectedPort.port_index}
                </span>
                <h3 className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                  {selectedPort.name}
                </h3>
                {selectedPort.physical_status === "UP" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> LINK UP
                  </span>
                )}
                {selectedPort.physical_status === "DOWN" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <XCircle className="w-3.5 h-3.5" /> LINK DOWN
                  </span>
                )}
                {selectedPort.physical_status === "ALERT" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" /> ALERTA DE SINAL/CRC
                  </span>
                )}
                {selectedPort.physical_status === "ERROR" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300">
                    <ShieldAlert className="w-3.5 h-3.5" /> ERRO CRÍTICO
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Descrição:{" "}
                <strong className="font-mono text-slate-900 dark:text-slate-200">
                  {selectedPort.description || "Sem descrição configurada"}
                </strong>
              </p>
            </div>

            {onConfigurePort && (
              <button
                type="button"
                onClick={() => onConfigurePort(selectedPort)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition"
              >
                <Sliders className="w-4 h-4" />
                Configurar esta porta
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Physical & L2 Parameters */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">
                  Status Admin / Físico
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedPort.admin_status} / {selectedPort.physical_status}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">
                  Velocidade / Duplex
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedPort.speed} / {selectedPort.duplex}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">
                  Modo da Porta / PVID
                </span>
                <span className="font-semibold uppercase text-blue-600 dark:text-blue-400 mt-0.5 block">
                  {selectedPort.link_type} (PVID {selectedPort.pvid})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">
                  MTU
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedPort.mtu} bytes
                </span>
              </div>
              <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block">
                  VLANs Permitidas na Interface
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block break-all">
                  {selectedPort.allowed_vlans}
                </span>
              </div>
            </div>

            {/* Column 2: Traffic & Error Telemetry */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">
                      Tráfego RX (Entrada)
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                      {selectedPort.rx_rate_mbps}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Erros RX
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      selectedPort.rx_errors > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedPort.rx_errors} pkts
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">
                      Tráfego TX (Saída)
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                      {selectedPort.tx_rate_mbps}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Erros TX
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      selectedPort.tx_errors > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedPort.tx_errors} pkts
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: Current VRP Interface Config */}
            <div className="rounded-lg bg-slate-950 text-slate-100 p-3 border border-slate-800 font-mono text-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 mb-1.5 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Configuração Atual (VRP)
                </span>
                <span>display this</span>
              </div>
              <pre className="whitespace-pre-wrap text-emerald-300 leading-relaxed overflow-x-auto">
                {selectedPort.discovered_config ||
                  `interface ${selectedPort.name}\n port link-type ${selectedPort.link_type}\n port default vlan ${selectedPort.pvid}\nquit`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


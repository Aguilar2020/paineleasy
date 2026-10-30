"use client";

import React, { useState } from "react";
import {
  Pop,
  Customer,
  Device,
  NetworkInterface,
  Vlan,
  Vlanif,
  StaticRoute,
  User,
  SwitchVlanAnalysisResponse,
  SwitchImportResponse,
  SwitchBackupTxtResponse,
  SystemBackupResponse,
} from "@/types/network";
import { apiService } from "@/services/api";
import { PortVisualMap } from "@/components/PortVisualMap";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Edit3,
  Eye,
  FileCode2,
  Filter,
  HardDrive,
  History,
  Layers,
  Lock,
  Network,
  Plus,
  RefreshCw,
  Route,
  Search,
  Server,
  Settings,
  Shield,
  Sliders,
  Terminal,
  Trash2,
  UploadCloud,
  Wifi,
  X,
} from "lucide-react";

// ============================================================================
// 1. DASHBOARD VIEW (Section 10) — Redesigned Premium NOC Dashboard
// ============================================================================
export function DashboardView({
  summary,
  devices = [],
  customers = [],
  onNavigate,
  onStartProvisioning,
}: {
  summary: Record<string, any> | undefined;
  devices?: Device[];
  customers?: Customer[];
  onNavigate: (tab: any) => void;
  onStartProvisioning: () => void;
}) {
  const m = summary?.metrics || {
    total_pops: 4,
    online_devices: 3,
    offline_devices: 1,
    total_interfaces: 84,
    up_interfaces: 42,
    total_vlans: 10,
    total_vlanifs: 6,
    static_routes: 5,
    completed_jobs: 1,
    failed_jobs: 0,
  };

  const totalDevs = (m.online_devices || 0) + (m.offline_devices || 0);
  const availabilityPct =
    totalDevs > 0 ? Math.round((m.online_devices / totalDevs) * 100) : 100;
  const portUtilizationPct =
    m.total_interfaces > 0
      ? Math.round((m.up_interfaces / m.total_interfaces) * 100)
      : 50;

  const kpiCards = [
    {
      label: "POPs Cadastrados",
      value: m.total_pops,
      badge: "100% Ativos",
      sub: "Pontos de Presença Regionais",
      accent: "border-t-blue-600",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400",
      icon: Building2,
      target: "pops",
    },
    {
      label: "Equipamentos Online",
      value: m.online_devices,
      badge: `${availabilityPct}% Disponibilidade`,
      sub: `${m.offline_devices} equipamento(s) em alerta/offline`,
      accent: "border-t-emerald-500",
      color:
        "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400",
      icon: Server,
      target: "equipamentos",
    },
    {
      label: "Clientes Atendidos",
      value: customers.length || 4,
      badge: "B2B / Dedicado",
      sub: "Clientes corporativos e blocos IP",
      accent: "border-t-purple-600",
      color:
        "text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400",
      icon: Shield,
      target: "clientes",
    },
    {
      label: "Portas Físicas Huawei",
      value: m.total_interfaces,
      badge: `${portUtilizationPct}% LINK UP`,
      sub: `${m.up_interfaces} UP • ${m.error_interfaces || 0} com alerta CRC`,
      accent: "border-t-indigo-600",
      color:
        "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400",
      icon: Cpu,
      target: "interfaces",
    },
    {
      label: "VLANs Ativas (802.1Q)",
      value: m.total_vlans,
      badge: "Layer 2",
      sub: "Sincronizadas via Huawei VRP",
      accent: "border-t-sky-500",
      color: "text-sky-600 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-400",
      icon: Layers,
      target: "vlans",
    },
    {
      label: "Gateways IP (Vlanifs)",
      value: m.total_vlanifs,
      badge: "Layer 3 SVI",
      sub: "Interfaces L3 configuradas",
      accent: "border-t-violet-500",
      color:
        "text-violet-600 bg-violet-50 dark:bg-violet-950/60 dark:text-violet-400",
      icon: Network,
      target: "vlanifs",
    },
    {
      label: "Rotas Estáticas IPv4/v6",
      value: m.static_routes,
      badge: "FIB Ativa",
      sub: `${m.total_routes || m.static_routes} rotas totais na tabela`,
      accent: "border-t-amber-500",
      color:
        "text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
      icon: Route,
      target: "rotas",
    },
    {
      label: "Operações SSH Auditadas",
      value: `${m.completed_jobs} / ${m.failed_jobs}`,
      badge: "Sucesso / Falha",
      sub: "Com backup automático da config",
      accent: "border-t-teal-500",
      color:
        "text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400",
      icon: Activity,
      target: "historico",
    },
  ];

  return (
    <div className="space-y-6">
      {/* NOC Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 shadow-lg border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              NOC ISP • Automação Huawei VRP8 / VRP5 em Tempo Real
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Central de Operações e Provisionamento Huawei
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Gerencie POPs, switches de acesso e borda MPLS, visualize o mapa
              físico de portas em tempo real e provisione clientes corporativos
              (VLAN, Gateway Vlanif e Blocos Roteados) sem digitar comandos CLI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onStartProvisioning}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition"
            >
              <Sliders className="w-4 h-4" />
              Iniciar Provisionamento por Etapas
            </button>
            <button
              type="button"
              onClick={() => onNavigate("interfaces")}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/15 transition"
            >
              <Cpu className="w-4 h-4 text-emerald-400" />
              Abrir Mapa de Portas
            </button>
          </div>
        </div>

        {/* Quick Status Strip inside Hero */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl px-3.5 py-2.5 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400">Saúde dos Switches</span>
            <span className="font-bold text-emerald-400">
              {availabilityPct}% Online
            </span>
          </div>
          <div className="bg-white/5 rounded-xl px-3.5 py-2.5 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400">Ocupação de Portas</span>
            <span className="font-bold text-sky-300">
              {m.up_interfaces}/{m.total_interfaces} ({portUtilizationPct}%)
            </span>
          </div>
          <div className="bg-white/5 rounded-xl px-3.5 py-2.5 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400">Motor de Conexão</span>
            <span className="font-bold text-amber-300">
              {summary?.demo_mode ? "Simulador VRP + SSH" : "Netmiko SSH Puro"}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl px-3.5 py-2.5 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400">Segurança de Credenciais</span>
            <span className="font-bold text-blue-300">AES-Fernet Ativo</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid with Top Accent Border */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onNavigate(c.target)}
              className={`group text-left rounded-xl border border-slate-200 dark:border-slate-800 border-t-4 ${c.accent} bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-3`}
            >
              <div className="flex items-start justify-between w-full">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {c.label}
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                    {c.value}
                  </div>
                </div>
                <div
                  className={`p-2.5 rounded-xl ${c.color} group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 w-full">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {c.sub}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  {c.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Rack Overview of Registered Huawei Switches */}
      {devices.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                Painel Rápido de Switches e Roteadores Huawei
              </h3>
              <p className="text-xs text-slate-500">
                Clique em qualquer equipamento para inspecionar suas portas ou
                iniciar provisionamento
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("equipamentos")}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Gerenciar todos os equipamentos →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {devices.map((dev) => (
              <div
                key={dev.id}
                onClick={() => onNavigate("interfaces")}
                className="cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white p-3.5 hover:border-blue-500 transition space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold tracking-wider">
                    HUAWEI {dev.model}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      dev.status === "ONLINE"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        dev.status === "ONLINE"
                          ? "bg-emerald-400"
                          : "bg-red-400"
                      }`}
                    />
                    {dev.status}
                  </span>
                </div>

                <div>
                  <div className="font-mono font-bold text-xs text-white truncate">
                    {dev.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {dev.management_ip} • {dev.pop_name}
                  </div>
                </div>

                {/* Mini visual port strip representation */}
                <div className="grid grid-cols-12 gap-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 rounded-xs ${
                        dev.status !== "ONLINE"
                          ? "bg-slate-700"
                          : i % 3 === 0
                          ? "bg-emerald-500"
                          : i === 7
                          ? "bg-blue-500"
                          : "bg-emerald-500/60"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>
                    {dev.supports_l3_routing
                      ? "Roteamento L2/L3 MPLS"
                      : "Switch Acesso L2"}
                  </span>
                  <span className="text-blue-400 font-semibold">
                    Ver Portas →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribution Chart & Latest Provisioning Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* POP Capacity Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Capacidade por POP
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("pops")}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Ver POPs
            </button>
          </div>
          <div className="space-y-3.5">
            {(summary?.pop_distribution || []).map((p: any, i: number) => {
              const pct = Math.min(100, Math.max(15, p.interfaces * 2));
              return (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {p.pop_name}
                    </span>
                    <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                      {p.devices} sw • {p.interfaces} portas • {p.vlans} VLANs
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activities Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Últimas Operações e Auditoria na Rede
              </h3>
              <p className="text-xs text-slate-500">
                Histórico em tempo real de comandos aplicados por Operadores,
                Supervisores e Admins
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("historico")}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Ver histórico completo →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-3">Operador</th>
                  <th className="py-2.5 px-3">Ação Executada</th>
                  <th className="py-2.5 px-3">Equipamento / POP</th>
                  <th className="py-2.5 px-3">Resumo Técnico</th>
                  <th className="py-2.5 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(summary?.recent_activities || []).map((act: any) => (
                  <tr
                    key={act.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-2.5 pr-3 font-bold text-slate-800 dark:text-slate-200">
                      {act.username}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        {act.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {act.device_name || act.pop_name || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {act.details}
                    </td>
                    <td className="py-2.5 pl-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          act.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. POPS MANAGEMENT VIEW (Section 3)
// ============================================================================
export function PopsManagementView({
  pops,
  devices,
  userRole,
  onRefresh,
  onSelectDeviceForInterfaces,
}: {
  pops: Pop[];
  devices: Device[];
  userRole: string;
  onRefresh: () => void;
  onSelectDeviceForInterfaces: (device: Device) => void;
}) {
  const [selectedPopId, setSelectedPopId] = useState<number>(
    pops[0]?.id || 1
  );
  const [showModal, setShowModal] = useState(false);
  const [editingPop, setEditingPop] = useState<Pop | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const selectedPop = pops.find((p) => p.id === selectedPopId) || pops[0];
  const associatedDevices = devices.filter(
    (d) => d.pop_id === selectedPop?.id
  );

  const openCreateModal = () => {
    setEditingPop(null);
    setName("");
    setCity("");
    setState("SP");
    setAddress("");
    setDescription("");
    setStatus("ATIVO");
    setErrMsg(null);
    setShowModal(true);
  };

  const openEditModal = (pop: Pop) => {
    setEditingPop(pop);
    setName(pop.name);
    setCity(pop.city);
    setState(pop.state);
    setAddress(pop.address || "");
    setDescription(pop.description || "");
    setStatus(pop.status);
    setErrMsg(null);
    setShowModal(true);
  };

  const handleSavePop = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    try {
      if (editingPop) {
        await apiService.updatePop(editingPop.id, {
          name,
          city,
          state,
          address,
          description,
          status,
        });
      } else {
        await apiService.createPop({
          name,
          city,
          state,
          address,
          description,
          status,
        });
      }
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setErrMsg(err.message);
    }
  };

  const handleDeletePop = async (pop: Pop) => {
    if (!window.confirm(`Confirma a exclusão do ${pop.name}?`)) return;
    try {
      await apiService.deletePop(pop.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Gerenciamento de POPs (Pontos de Presença)
          </h2>
          <p className="text-xs text-slate-500">
            Selecione um POP abaixo para listar automaticamente os switches e
            roteadores Huawei cadastrados nele.
          </p>
        </div>
        {userRole !== "readonly" && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo POP
          </button>
        )}
      </div>

      {/* POPs Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {pops.map((p) => {
          const isSelected = p.id === selectedPop?.id;
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPopId(p.id)}
              className={`cursor-pointer rounded-xl border p-4 transition shadow-sm ${
                isSelected
                  ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {p.city} - {p.state}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {p.name}
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    p.status === "ATIVO"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                {p.description || p.address || "Sem endereço cadastrado"}
              </p>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {p.device_count} equipamento(s) ({p.online_devices} online)
                </span>
                {userRole !== "readonly" && (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="p-1 text-slate-500 hover:text-blue-600"
                      title="Editar POP"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {userRole === "admin" && (
                      <button
                        type="button"
                        onClick={() => handleDeletePop(p)}
                        className="p-1 text-slate-500 hover:text-red-600"
                        title="Remover POP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Associated Devices for Selected POP */}
      {selectedPop && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Equipamentos Associados ao {selectedPop.name}
              </h3>
              <p className="text-xs text-slate-500">
                Endereço: {selectedPop.address || "Não informado"} •{" "}
                {selectedPop.city}/{selectedPop.state}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {associatedDevices.length} switch(es)/roteador(es)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3">Equipamento</th>
                  <th className="py-2 px-3">Modelo / Versão VRP</th>
                  <th className="py-2 px-3">IP Gerência</th>
                  <th className="py-2 px-3">Capacidade</th>
                  <th className="py-2 px-3">Portas / VLANs</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {associatedDevices.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 pr-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {d.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {d.model} •{" "}
                      <span className="font-mono text-[11px]">
                        {d.system_version}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200">
                      {d.management_ip}:{d.ssh_port}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          d.supports_l3_routing
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {d.supports_l3_routing ? "Layer 2 / Layer 3" : "Layer 2"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {d.up_interfaces}/{d.interface_count} portas UP •{" "}
                      {d.vlan_count} VLANs
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === "ONLINE"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectDeviceForInterfaces(d)}
                        className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                      >
                        Mapa de Portas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit POP Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePop}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {editingPop ? `Editar ${editingPop.name}` : "Cadastrar Novo POP"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {errMsg && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {errMsg}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nome do POP</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="POP CENTRO-SP"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Cidade</label>
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="São Paulo"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">UF</label>
                  <input
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="SP"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Endereço</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Paulista, 1000"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Salvar POP
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2B. CUSTOMERS MANAGEMENT VIEW (Área Supervisor & Admin: Cadastro de Clientes)
// ============================================================================
export function CustomersManagementView({
  customers,
  pops,
  devices,
  userRole,
  onRefresh,
  onBindCustomerInPort,
}: {
  customers: Customer[];
  pops: Pop[];
  devices: Device[];
  userRole: string;
  onRefresh: () => void;
  onBindCustomerInPort: (customer: Customer) => void;
}) {
  const canEditCustomers = userRole === "admin" || userRole === "supervisor";
  const canOperatePort = userRole === "admin" || userRole === "operador";

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [document, setDocument] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [popId, setPopId] = useState<number>(pops[0]?.id || 1);
  const [deviceId, setDeviceId] = useState<number>(devices[0]?.id || 1);
  const [interfaceName, setInterfaceName] = useState("XGigabitEthernet0/0/39");
  const [vlanId, setVlanId] = useState<number>(2450);
  const [vlanifIp, setVlanifIp] = useState("10.24.50.1/30");
  const [routedBlock, setRoutedBlock] = useState("45.0.50.0/30");
  const [status, setStatus] = useState("PENDENTE");
  const [notes, setNotes] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingCustomer(null);
    setName("");
    setCode(`CLI-${Math.floor(2450 + Math.random() * 500)}`);
    setDocument("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setPopId(pops[0]?.id || 1);
    setDeviceId(devices[0]?.id || 1);
    setInterfaceName("XGigabitEthernet0/0/39");
    setVlanId(2455);
    setVlanifIp("10.24.55.1/30");
    setRoutedBlock("45.0.55.0/30");
    setStatus("PENDENTE");
    setNotes("");
    setErrMsg(null);
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setCode(c.code);
    setDocument(c.document || "");
    setContactName(c.contact_name || "");
    setContactPhone(c.contact_phone || "");
    setContactEmail(c.contact_email || "");
    setPopId(c.pop_id || pops[0]?.id || 1);
    setDeviceId(c.device_id || devices[0]?.id || 1);
    setInterfaceName(c.interface_name || "XGigabitEthernet0/0/39");
    setVlanId(c.vlan_id || 2450);
    setVlanifIp(c.vlanif_ip || "");
    setRoutedBlock(c.routed_block || "");
    setStatus(c.status);
    setNotes(c.notes || "");
    setErrMsg(null);
    setShowModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    try {
      const payload = {
        name,
        code,
        document,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        pop_id: popId,
        device_id: deviceId,
        interface_name: interfaceName,
        vlan_id: Number(vlanId),
        vlanif_ip: vlanifIp,
        routed_block: routedBlock,
        status,
        notes,
      };
      if (editingCustomer) {
        await apiService.updateCustomer(editingCustomer.id, payload);
      } else {
        await apiService.createCustomer(payload);
      }
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setErrMsg(err.message);
    }
  };

  const handleDeleteCustomer = async (c: Customer) => {
    if (!window.confirm(`Confirma remover o cliente ${c.name} (${c.code})?`))
      return;
    try {
      await apiService.deleteCustomer(c.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Cadastro e Carteira de Clientes Dedicados / B2B
          </h2>
          <p className="text-xs text-slate-500">
            O <strong>Supervisor</strong> (e <strong>Admin</strong>) cadastra os
            clientes e circuitos; o <strong>Operador</strong> atrela a VLAN do
            cliente na porta, configura IP e rota.
          </p>
        </div>

        {canEditCustomers && (
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Cadastrar Novo Cliente
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th className="py-3 px-4">Código / Cliente</th>
              <th className="py-3 px-4">CNPJ / Contato</th>
              <th className="py-3 px-4">POP / Switch</th>
              <th className="py-3 px-4">Porta / VLAN</th>
              <th className="py-3 px-4">IP Gateway / Bloco Roteado</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="py-3 px-4">
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {c.code}
                  </div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {c.name}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-mono">{c.document || "-"}</div>
                  <div className="text-slate-500">
                    {c.contact_name} • {c.contact_phone}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold">{c.pop_name || "-"}</div>
                  <div className="font-mono text-slate-500">
                    {c.device_name || "-"}
                  </div>
                </td>
                <td className="py-3 px-4 font-mono">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    VLAN {c.vlan_id || "-"}
                  </div>
                  <div className="text-slate-500">{c.interface_name || "-"}</div>
                </td>
                <td className="py-3 px-4 font-mono">
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {c.vlanif_ip || "-"}
                  </div>
                  <div className="text-slate-500">{c.routed_block || "-"}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.status === "ATIVO"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-1.5">
                  {canOperatePort && (
                    <button
                      type="button"
                      onClick={() => onBindCustomerInPort(c)}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px]"
                    >
                      Atrelar na Porta / Provisionar
                    </button>
                  )}
                  {canEditCustomers && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(c)}
                        className="px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 text-[11px]"
                      >
                        Remover
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingCustomer
                  ? `Editar Cliente ${editingCustomer.name}`
                  : "Cadastrar Novo Cliente ISP"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {errMsg && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {errMsg}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Nome / Identificador do Cliente
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CLIENTE-LGCONNECT"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Código / Contrato
                </label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CLI-2443"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">CNPJ / CPF</label>
                <input
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Responsável / Telefone
                </label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nome do Contato"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  POP de Atendimento
                </label>
                <select
                  value={popId}
                  onChange={(e) => setPopId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  {pops.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Equipamento Huawei
                </label>
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Porta Designada
                </label>
                <input
                  value={interfaceName}
                  onChange={(e) => setInterfaceName(e.target.value)}
                  placeholder="XGigabitEthernet0/0/39"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  VLAN Designada
                </label>
                <input
                  type="number"
                  value={vlanId}
                  onChange={(e) => setVlanId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Gateway IPv4 Previsto (Vlanif)
                </label>
                <input
                  value={vlanifIp}
                  onChange={(e) => setVlanifIp(e.target.value)}
                  placeholder="10.24.55.1/30"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Bloco Público Roteado
                </label>
                <input
                  value={routedBlock}
                  onChange={(e) => setRoutedBlock(e.target.value)}
                  placeholder="45.0.55.0/30"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. HUAWEI DEVICES MANAGEMENT & SSH ACTIONS VIEW (Section 4)
// ============================================================================
export function DevicesManagementView({
  devices,
  pops,
  userRole,
  onRefresh,
  onViewInterfaces,
}: {
  devices: Device[];
  pops: Pop[];
  userRole: string;
  onRefresh: () => void;
  onViewInterfaces: (device: Device) => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [terminalModalData, setTerminalModalData] = useState<{
    title: string;
    subtitle: string;
    content: string;
  } | null>(null);
  const [busyDeviceId, setBusyDeviceId] = useState<number | null>(null);

  // New device form state
  const [name, setName] = useState("");
  const [popId, setPopId] = useState<number>(pops[0]?.id || 1);
  const [model, setModel] = useState("CloudEngine S6730-H48X6C");
  const [managementIp, setManagementIp] = useState("");
  const [sshPort, setSshPort] = useState(22);
  const [sshUsername, setSshUsername] = useState("noc.automation");
  const [sshPassword, setSshPassword] = useState("");
  const [systemVersion, setSystemVersion] = useState("VRP V200R021C00SPC100");
  const [description, setDescription] = useState("");
  const [supportsL3, setSupportsL3] = useState(true);
  const [isSimulated, setIsSimulated] = useState(true);
  const [formErr, setFormErr] = useState<string | null>(null);

  const handleTestConnection = async (dev: Device) => {
    setBusyDeviceId(dev.id);
    try {
      const res = await apiService.testDeviceConnection(dev.id);
      setTerminalModalData({
        title: `Teste de Conectividade SSH — ${dev.name}`,
        subtitle: `Host: ${dev.management_ip}:${dev.ssh_port} • Latência: ${res.latency_ms} ms`,
        content: res.raw_version_output || "Conectividade SSH OK.",
      });
    } catch (err: any) {
      alert(`Falha no teste SSH: ${err.message}`);
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleConnectDiscovery = async (dev: Device) => {
    setBusyDeviceId(dev.id);
    try {
      const res = await apiService.connectDeviceCLI(dev.id);
      const formatted = (res.discovery_results || [])
        .map(
          (r: any) =>
            `====================================================================\n` +
            `<${dev.name}> ${r.command} [${r.status}]\n` +
            `====================================================================\n` +
            `${r.output}\n`
        )
        .join("\n");
      setTerminalModalData({
        title: `Sessão SSH & Descoberta VRP — ${dev.name}`,
        subtitle: `${dev.model} (${dev.system_version}) • Capacidade L3: ${
          dev.supports_l3_routing ? "Sim" : "Não (L2 Puro)"
        }`,
        content: formatted,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleSyncDevice = async (dev: Device) => {
    setBusyDeviceId(dev.id);
    try {
      const res = await apiService.syncDevice(dev.id);
      onRefresh();
      alert(
        `Equipamento ${dev.name} sincronizado com sucesso! Backup #${res.backup_id} armazenado.`
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleConsultConfig = async (dev: Device) => {
    setBusyDeviceId(dev.id);
    try {
      const res = await apiService.getDeviceConfig(dev.id);
      setTerminalModalData({
        title: `Configuração Atual (display current-configuration) — ${dev.name}`,
        subtitle: `Backups salvos: ${(res.backups || []).length}`,
        content: res.discovered_config,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    try {
      await apiService.createDevice({
        name,
        pop_id: popId,
        vendor: "Huawei",
        model,
        management_ip: managementIp,
        ssh_port: sshPort,
        ssh_username: sshUsername,
        ssh_password: sshPassword,
        system_version: systemVersion,
        description,
        supports_l3_routing: supportsL3,
        supports_vrf: supportsL3,
        is_simulated: isSimulated,
      });
      setShowCreateModal(false);
      onRefresh();
    } catch (err: any) {
      setFormErr(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Cadastro e Operação de Equipamentos Huawei
          </h2>
          <p className="text-xs text-slate-500">
            Credenciais SSH armazenadas com criptografia Fernet em repouso (as
            senhas nunca são reenviadas ao navegador nem gravadas em logs).
          </p>
        </div>
        {userRole !== "readonly" && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Cadastrar Equipamento Huawei
          </button>
        )}
      </div>

      {/* Equipment Cards with the 5 Mandatory Action Buttons */}
      <div className="grid grid-cols-1 gap-4">
        {devices.map((dev) => (
          <div
            key={dev.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      dev.status === "ONLINE" ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                    {dev.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    {dev.pop_name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono">
                    {dev.vendor} {dev.model}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      dev.supports_l3_routing
                        ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : "bg-amber-100/80 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                    }`}
                  >
                    {dev.supports_l3_routing
                      ? "Suporta Roteamento Layer 3"
                      : "Switch Acesso Layer 2"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  IP Gerência:{" "}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {dev.management_ip}:{dev.ssh_port}
                  </strong>{" "}
                  • Usuário SSH:{" "}
                  <strong className="font-mono">{dev.ssh_username}</strong>{" "}
                  (Senha protegida: <code className="font-mono">••••••••</code>)
                  • Versão: <code className="font-mono">{dev.system_version}</code>
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  <strong>{dev.up_interfaces}</strong>/{dev.interface_count}{" "}
                  Portas UP
                </span>
                <span>•</span>
                <span>
                  <strong>{dev.vlan_count}</strong> VLANs
                </span>
                <span>•</span>
                <span>
                  <strong>{dev.vlanif_count}</strong> Vlanifs
                </span>
                <span>•</span>
                <span>
                  <strong>{dev.route_count}</strong> Rotas
                </span>
              </div>
            </div>

            {/* 5 Mandatory SSH Action Buttons from Section 4 */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={busyDeviceId === dev.id}
                onClick={() => handleTestConnection(dev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                Testar conexão
              </button>

              <button
                type="button"
                disabled={busyDeviceId === dev.id}
                onClick={() => handleConnectDiscovery(dev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-500" />
                Conectar
              </button>

              <button
                type="button"
                disabled={busyDeviceId === dev.id || userRole === "readonly"}
                onClick={() => handleSyncDevice(dev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-indigo-500 ${
                    busyDeviceId === dev.id ? "animate-spin" : ""
                  }`}
                />
                Sincronizar informações
              </button>

              <button
                type="button"
                disabled={busyDeviceId === dev.id}
                onClick={() => handleConsultConfig(dev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
              >
                <FileCode2 className="w-3.5 h-3.5 text-amber-500" />
                Consultar configuração
              </button>

              <button
                type="button"
                onClick={() => onViewInterfaces(dev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition ml-auto"
              >
                <Eye className="w-3.5 h-3.5" />
                Visualizar interfaces
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Terminal Output Modal */}
      {terminalModalData && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl bg-slate-950 border border-slate-800 text-slate-100 p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">
                  {terminalModalData.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {terminalModalData.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTerminalModalData(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="font-mono text-xs text-emerald-300 max-h-[65vh] overflow-y-auto whitespace-pre-wrap p-3 bg-black/40 rounded-lg">
              {terminalModalData.content}
            </pre>
          </div>
        </div>
      )}

      {/* Create Device Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDevice}
            className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Cadastrar Switch / Roteador Huawei
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {formErr && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {formErr}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Nome do Equipamento
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="SWITCH-MPLS-NORTE"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">POP</label>
                <select
                  value={popId}
                  onChange={(e) => setPopId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  {pops.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Modelo Huawei</label>
                <input
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Versão Sistema VRP
                </label>
                <input
                  value={systemVersion}
                  onChange={(e) => setSystemVersion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  IP de Gerenciamento
                </label>
                <input
                  required
                  value={managementIp}
                  onChange={(e) => setManagementIp(e.target.value)}
                  placeholder="10.255.1.50"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Porta SSH</label>
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Usuário SSH</label>
                <input
                  required
                  value={sshUsername}
                  onChange={(e) => setSshUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Senha SSH (Criptografada em Repouso)
                </label>
                <input
                  required
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsL3}
                  onChange={(e) => setSupportsL3(e.target.checked)}
                />
                Suporta roteamento Layer 3 (Vlanif / ip route-static)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSimulated}
                  onChange={(e) => setIsSimulated(e.target.checked)}
                />
                Habilitar no Simulador VRP (Testes sem equipamento físico)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Salvar Equipamento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. INTERFACES & VISUAL PORT MAP VIEW (Section 5 + Atrelar/Remover VLAN na Porta)
// ============================================================================
export function InterfacesVisualView({
  devices,
  customers = [],
  userRole = "admin",
  selectedDeviceId,
  onSelectDeviceId,
  interfaces,
  onRefresh,
  onConfigurePort,
}: {
  devices: Device[];
  customers?: Customer[];
  userRole?: string;
  selectedDeviceId: number;
  onSelectDeviceId: (id: number) => void;
  interfaces: NetworkInterface[];
  onRefresh?: () => void;
  onConfigurePort: (device: Device, iface: NetworkInterface) => void;
}) {
  const [selectedPortName, setSelectedPortName] = useState<string>(
    interfaces[0]?.name || "XGigabitEthernet0/0/39"
  );
  const currentDevice =
    devices.find((d) => d.id === selectedDeviceId) || devices[0];
  const selectedIfaceObj =
    interfaces.find((i) => i.name === selectedPortName) || interfaces[0];

  const [bindCustomerId, setBindCustomerId] = useState<string>("");
  const [bindVlanId, setBindVlanId] = useState<number>(2443);
  const [bindMode, setBindMode] = useState<"access" | "trunk" | "hybrid">("access");
  const [bindDesc, setBindDesc] = useState<string>("CLIENTE-LGCONNECT");
  const [bindLoading, setBindLoading] = useState(false);

  const canOperatePort = userRole === "admin" || userRole === "operador";

  const handleSelectCustomerForPort = (cid: string) => {
    setBindCustomerId(cid);
    const found = customers.find((c) => c.id === Number(cid));
    if (found) {
      if (found.vlan_id) setBindVlanId(found.vlan_id);
      setBindDesc(found.name);
    }
  };

  const handleBindVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIfaceObj) return;
    setBindLoading(true);
    try {
      await apiService.bindVlanToPort(selectedIfaceObj.id, {
        vlan_id: Number(bindVlanId),
        port_mode: bindMode,
        customer_id: bindCustomerId ? Number(bindCustomerId) : undefined,
        description: bindDesc,
        preserve_existing_vlans: true,
      });
      onRefresh?.();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBindLoading(false);
    }
  };

  const handleUnbindVlan = async () => {
    if (!selectedIfaceObj) return;
    if (
      !window.confirm(
        `Confirma remover/desatrelar a VLAN da porta ${selectedIfaceObj.name} e retornar para VLAN 1 (Livre)?`
      )
    )
      return;
    setBindLoading(true);
    try {
      await apiService.unbindVlanFromPort(selectedIfaceObj.id);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBindLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Mapa Visual de Portas & Atrelamento de Cliente / VLAN na Porta
          </h2>
          <p className="text-xs text-slate-500">
            Clique em qualquer conector Ethernet para inspecionar a porta,
            atrelar Cliente e VLAN diretamente ou remover a VLAN da porta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Equipamento:
          </span>
          <select
            value={currentDevice?.id || ""}
            onChange={(e) => onSelectDeviceId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.model} • {d.interface_count} portas)
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentDevice && (
        <PortVisualMap
          device={currentDevice}
          interfaces={interfaces}
          selectedInterfaceName={selectedPortName}
          onSelectInterface={(iface) => {
            setSelectedPortName(iface.name);
            setBindVlanId(iface.pvid || 2443);
            setBindDesc(iface.description || "");
          }}
          onConfigurePort={(iface) => onConfigurePort(currentDevice, iface)}
        />
      )}

      {/* Quick Operator Action Box: Atrelar Cliente e VLAN na Porta / Remover VLAN da Porta */}
      {canOperatePort && selectedIfaceObj && (
        <form
          onSubmit={handleBindVlan}
          className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-blue-950/25 p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Ação Rápida do Operador — Atrelar / Remover Cliente e VLAN na
                Porta{" "}
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {selectedIfaceObj.name}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Selecione um cliente cadastrado pelo Supervisor ou informe a
                VLAN manualmente para aplicar na porta via SSH.
              </p>
            </div>
            {selectedIfaceObj.allowed_vlans !== "1" && (
              <button
                type="button"
                disabled={bindLoading}
                onClick={handleUnbindVlan}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm"
              >
                Remover / Desatrelar VLAN da Porta ({selectedIfaceObj.allowed_vlans})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">
                Selecionar Cliente Cadastrado
              </label>
              <select
                value={bindCustomerId}
                onChange={(e) => handleSelectCustomerForPort(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
              >
                <option value="">-- Escolher Cliente (Opcional) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} (VLAN {c.vlan_id || "S/N"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">VLAN ID</label>
              <input
                type="number"
                min={1}
                max={4094}
                required
                value={bindVlanId}
                onChange={(e) => setBindVlanId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Modo na Porta ({selectedIfaceObj.short_name})
              </label>
              <select
                value={bindMode}
                onChange={(e) => setBindMode(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-semibold uppercase"
              >
                <option value="access">Access (Untagged)</option>
                <option value="trunk">Trunk (Allow-pass Tagged)</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                Descrição / Identificação na Porta
              </label>
              <input
                type="text"
                required
                value={bindDesc}
                onChange={(e) => setBindDesc(e.target.value)}
                placeholder="CLIENTE-LGCONNECT"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={bindLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
            >
              {bindLoading
                ? "Aplicando na porta via SSH..."
                : `Atrelar VLAN ${bindVlanId} na Porta ${selectedIfaceObj.short_name}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ============================================================================
// 5. VLANS & VLANIFS VIEWS (Colocar e Remover VLAN / Colocar e Remover IP)
// ============================================================================
export function VlansAndVlanifsView({
  mode,
  vlans,
  vlanifs,
  devices,
  userRole,
  onRefresh,
  onStartProvisioning,
}: {
  mode: "vlans" | "vlanifs";
  vlans: Vlan[];
  vlanifs: Vlanif[];
  devices: Device[];
  userRole: string;
  onRefresh: () => void;
  onStartProvisioning: () => void;
}) {
  const [deviceFilter, setDeviceFilter] = useState<string>("");
  const [showAddVlanModal, setShowAddVlanModal] = useState(false);
  const [showAddVlanifModal, setShowAddVlanifModal] = useState(false);

  // Add VLAN state
  const [targetDeviceId, setTargetDeviceId] = useState<number>(
    devices[0]?.id || 1
  );
  const [newVlanId, setNewVlanId] = useState<number>(2455);
  const [newVlanDesc, setNewVlanDesc] = useState<string>("CLIENTE-NOVO");

  // Add Vlanif IP state
  const l3Devices = devices.filter((d) => d.supports_l3_routing);
  const [vifDeviceId, setVifDeviceId] = useState<number>(
    l3Devices[0]?.id || devices[0]?.id || 1
  );
  const [vifVlanId, setVifVlanId] = useState<number>(2455);
  const [vifIp, setVifIp] = useState<string>("10.24.55.1");
  const [vifCidr, setVifCidr] = useState<number>(30);
  const [vifDesc, setVifDesc] = useState<string>("GATEWAY-CLIENTE-NOVO");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const canModifyVlanOrIp = userRole === "admin" || userRole === "operador";

  const filteredVlans = deviceFilter
    ? vlans.filter((v) => v.device_id === Number(deviceFilter))
    : vlans;

  const filteredVlanifs = deviceFilter
    ? vlanifs.filter((v) => v.device_id === Number(deviceFilter))
    : vlanifs;

  const handleAddVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    try {
      await apiService.createVlan({
        device_id: targetDeviceId,
        vlan_id: Number(newVlanId),
        description: newVlanDesc,
      });
      setShowAddVlanModal(false);
      onRefresh();
    } catch (err: any) {
      setErrMsg(err.message);
    }
  };

  const handleRemoveVlan = async (v: Vlan) => {
    if (
      !window.confirm(
        `Confirma remover a VLAN ${v.vlan_id} (${v.description}) do equipamento ${v.device_name}?`
      )
    )
      return;
    try {
      await apiService.deleteVlan(v.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddVlanif = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    try {
      await apiService.createVlanif({
        device_id: vifDeviceId,
        vlan_id: Number(vifVlanId),
        ip_address: vifIp,
        cidr_prefix: Number(vifCidr),
        description: vifDesc,
      });
      setShowAddVlanifModal(false);
      onRefresh();
    } catch (err: any) {
      setErrMsg(err.message);
    }
  };

  const handleRemoveVlanif = async (vif: Vlanif) => {
    if (
      !window.confirm(
        `Confirma remover o IP ${vif.ip_address}/${vif.cidr_prefix} (${vif.interface_name}) do equipamento ${vif.device_name}?`
      )
    )
      return;
    try {
      await apiService.deleteVlanif(vif.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {mode === "vlans"
              ? "Gerenciamento de VLANs (Colocar e Remover VLAN)"
              : "Gerenciamento de IPs / Vlanifs (Colocar e Remover IP Gateway)"}
          </h2>
          <p className="text-xs text-slate-500">
            Sincronizado via SSH com os equipamentos Huawei VRP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
          >
            <option value="">Todos os Equipamentos</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {canModifyVlanOrIp && mode === "vlans" && (
            <button
              type="button"
              onClick={() => {
                setErrMsg(null);
                setShowAddVlanModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Colocar (Criar) VLAN
            </button>
          )}

          {canModifyVlanOrIp && mode === "vlanifs" && (
            <button
              type="button"
              onClick={() => {
                setErrMsg(null);
                setShowAddVlanifModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Colocar (Criar) IP Vlanif
            </button>
          )}
        </div>
      </div>

      {mode === "vlans" ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4">VLAN ID</th>
                <th className="py-3 px-4">Descrição / Cliente</th>
                <th className="py-3 px-4">Equipamento</th>
                <th className="py-3 px-4">POP</th>
                <th className="py-3 px-4">Portas Tagged</th>
                <th className="py-3 px-4">Portas Untagged</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVlans.map((v) => (
                <tr key={v.id}>
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    VLAN {v.vlan_id}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {v.description || v.name}
                  </td>
                  <td className="py-3 px-4 font-mono">{v.device_name}</td>
                  <td className="py-3 px-4">{v.pop_name}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {v.tagged_ports || "-"}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {v.untagged_ports || "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canModifyVlanOrIp && v.vlan_id !== 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveVlan(v)}
                        className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 text-xs font-semibold"
                      >
                        Remover VLAN
                      </button>
                    ) : (
                      <span className="text-slate-400">Nativa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4">Interface</th>
                <th className="py-3 px-4">Endereço IPv4 / Máscara</th>
                <th className="py-3 px-4">IPv6</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Equipamento L3</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVlanifs.map((vif) => (
                <tr key={vif.id}>
                  <td className="py-3 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
                    {vif.interface_name}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {vif.ip_address}/{vif.cidr_prefix}{" "}
                    <span className="text-slate-400 font-normal">
                      ({vif.subnet_mask})
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {vif.ipv6_address || "-"}
                  </td>
                  <td className="py-3 px-4 font-mono">{vif.description}</td>
                  <td className="py-3 px-4 font-mono">{vif.device_name}</td>
                  <td className="py-3 px-4 text-right">
                    {canModifyVlanOrIp && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVlanif(vif)}
                        className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 text-xs font-semibold"
                      >
                        Remover IP / Vlanif
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add VLAN Modal */}
      {showAddVlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddVlan}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Colocar (Criar) Nova VLAN</h3>
              <button type="button" onClick={() => setShowAddVlanModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {errMsg && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {errMsg}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Equipamento Huawei
                </label>
                <select
                  value={targetDeviceId}
                  onChange={(e) => setTargetDeviceId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Número da VLAN (1 – 4094)
                </label>
                <input
                  type="number"
                  min={2}
                  max={4094}
                  required
                  value={newVlanId}
                  onChange={(e) => setNewVlanId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Descrição / Cliente
                </label>
                <input
                  type="text"
                  required
                  value={newVlanDesc}
                  onChange={(e) => setNewVlanDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddVlanModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Aplicar VLAN via SSH
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Vlanif IP Modal */}
      {showAddVlanifModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddVlanif}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                Colocar (Criar) Interface IP Vlanif
              </h3>
              <button
                type="button"
                onClick={() => setShowAddVlanifModal(false)}
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {errMsg && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {errMsg}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Equipamento Layer 3
                </label>
                <select
                  value={vifDeviceId}
                  onChange={(e) => setVifDeviceId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.supports_l3_routing ? "L3" : "L2 Puro"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">VLAN ID</label>
                <input
                  type="number"
                  min={1}
                  max={4094}
                  required
                  value={vifVlanId}
                  onChange={(e) => setVifVlanId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">
                    Endereço IPv4
                  </label>
                  <input
                    required
                    value={vifIp}
                    onChange={(e) => setVifIp(e.target.value)}
                    placeholder="10.24.55.1"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Prefixo</label>
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={vifCidr}
                    onChange={(e) => setVifCidr(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Descrição</label>
                <input
                  required
                  value={vifDesc}
                  onChange={(e) => setVifDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddVlanifModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Aplicar IP Vlanif via SSH
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. STATIC & DYNAMIC ROUTES MANAGEMENT VIEW (Section 9)
// ============================================================================
export function RoutesManagementView({
  routes,
  devices,
  userRole,
  onRefresh,
}: {
  routes: StaticRoute[];
  devices: Device[];
  userRole: string;
  onRefresh: () => void;
}) {
  const [destFilter, setDestFilter] = useState("");
  const [nhFilter, setNhFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [protoFilter, setProtoFilter] = useState("");
  const [selectedRouteDetail, setSelectedRouteDetail] =
    useState<StaticRoute | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Route Form
  const l3Devices = devices.filter((d) => d.supports_l3_routing);
  const [newDeviceId, setNewDeviceId] = useState<number>(
    l3Devices[0]?.id || devices[0]?.id || 1
  );
  const [newDest, setNewDest] = useState("45.0.0.16");
  const [newCidr, setNewCidr] = useState(28);
  const [newNh, setNewNh] = useState("10.24.43.2");
  const [newPref, setNewPref] = useState(60);
  const [newDesc, setNewDesc] = useState("BLOCO-PUBLICO-CLIENTE");
  const [routeErr, setRouteErr] = useState<string | null>(null);

  const filtered = routes.filter((r) => {
    if (
      destFilter &&
      !`${r.destination_network}/${r.cidr_prefix}`.includes(destFilter.trim())
    )
      return false;
    if (nhFilter && !r.next_hop.includes(nhFilter.trim())) return false;
    if (deviceFilter && r.device_id !== Number(deviceFilter)) return false;
    if (protoFilter && r.protocol !== protoFilter) return false;
    return true;
  });

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteErr(null);
    try {
      await apiService.createRoute({
        device_id: newDeviceId,
        ip_version: 4,
        destination_network: newDest,
        cidr_prefix: newCidr,
        next_hop: newNh,
        preference: newPref,
        description: newDesc,
      });
      setShowAddModal(false);
      onRefresh();
    } catch (err: any) {
      setRouteErr(err.message);
    }
  };

  const handleDeleteRoute = async (r: StaticRoute) => {
    if (
      !window.confirm(
        `Confirma remover a rota estática ${r.destination_network}/${r.cidr_prefix} -> ${r.next_hop} do equipamento ${r.device_name}?`
      )
    )
      return;
    try {
      await apiService.deleteRoute(r.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Gerenciamento de Rotas (Estáticas, Diretas, OSPF e BGP)
          </h2>
          <p className="text-xs text-slate-500">
            Consulte, filtre e gerencie rotas IPv4/IPv6 nos equipamentos Layer 3
            da rede.
          </p>
        </div>

        {userRole !== "readonly" && (
          <button
            type="button"
            onClick={() => {
              setRouteErr(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Adicionar Rota Estática
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Filtrar por Destino
          </label>
          <input
            type="text"
            value={destFilter}
            onChange={(e) => setDestFilter(e.target.value)}
            placeholder="Ex.: 45.0.0."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Filtrar por Next-hop
          </label>
          <input
            type="text"
            value={nhFilter}
            onChange={(e) => setNhFilter(e.target.value)}
            placeholder="Ex.: 10.24.43.2"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Filtrar por Equipamento
          </label>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
          >
            <option value="">Todos os Equipamentos</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Protocolo da Rota
          </label>
          <select
            value={protoFilter}
            onChange={(e) => setProtoFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
          >
            <option value="">Todos (Static, Direct, OSPF, BGP)</option>
            <option value="Static">Static (Estática)</option>
            <option value="Direct">Direct (Direta/Conectada)</option>
            <option value="OSPF">OSPF</option>
            <option value="BGP">BGP</option>
          </select>
        </div>
      </div>

      {/* Section 9 Table: Destino | Next-hop | Preferência | Equipamento | Ações */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th className="py-3 px-4">Destino</th>
              <th className="py-3 px-4">Next-hop</th>
              <th className="py-3 px-4">Preferência</th>
              <th className="py-3 px-4">Protocolo / Status</th>
              <th className="py-3 px-4">Descrição</th>
              <th className="py-3 px-4">Equipamento</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                  {r.destination_network}/{r.cidr_prefix}
                </td>
                <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  {r.next_hop}
                </td>
                <td className="py-3 px-4 font-mono">{r.preference}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.protocol === "Static"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : r.protocol === "BGP"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                          : r.protocol === "OSPF"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {r.protocol}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {r.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-slate-500">
                  {r.description || "-"}
                </td>
                <td className="py-3 px-4 font-mono font-semibold">
                  {r.device_name}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRouteDetail(r)}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                  >
                    Detalhes
                  </button>
                  {r.protocol === "Static" && userRole !== "readonly" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRoute(r)}
                      className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 text-xs font-semibold"
                    >
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Route Detail Modal */}
      {selectedRouteDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                Detalhes da Rota {selectedRouteDetail.destination_network}/
                {selectedRouteDetail.cidr_prefix}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRouteDetail(null)}
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p>
                <strong>Equipamento Layer 3:</strong>{" "}
                {selectedRouteDetail.device_name} ({selectedRouteDetail.pop_name})
              </p>
              <p>
                <strong>Máscara de Sub-rede:</strong>{" "}
                {selectedRouteDetail.subnet_mask}
              </p>
              <p>
                <strong>Next-hop:</strong> {selectedRouteDetail.next_hop}
              </p>
              <p>
                <strong>Protocolo / Preferência:</strong>{" "}
                {selectedRouteDetail.protocol} (Pref{" "}
                {selectedRouteDetail.preference})
              </p>
              <div className="rounded-lg bg-slate-950 text-emerald-300 p-3 font-mono mt-2">
                {selectedRouteDetail.discovered_config}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Static Route Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRoute}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                Adicionar Rota Estática Huawei VRP
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {routeErr && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {routeErr}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Equipamento Layer 3 de Destino
                </label>
                <select
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.supports_l3_routing ? "L3" : "L2 Puro - Bloqueado"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">
                    Rede de Destino
                  </label>
                  <input
                    required
                    value={newDest}
                    onChange={(e) => setNewDest(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Prefixo</label>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    value={newCidr}
                    onChange={(e) => setNewCidr(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Next-hop</label>
                  <input
                    required
                    value={newNh}
                    onChange={(e) => setNewNh(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Preferência</label>
                  <input
                    type="number"
                    value={newPref}
                    onChange={(e) => setNewPref(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Descrição</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Aplicar Rota via SSH
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 7. HISTORY, AUDIT LOGS & BACKUPS VIEW
// ============================================================================
export function HistoryAndBackupsView({
  jobs,
  auditLogs,
  backups,
}: {
  jobs: any[];
  auditLogs: any[];
  backups: any[];
}) {
  const [subTab, setSubTab] = useState<"jobs" | "audit" | "backups">("jobs");
  const [selectedBackup, setSelectedBackup] = useState<any | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Histórico de Alterações, Auditoria & Backups VRP
          </h2>
          <p className="text-xs text-slate-500">
            Rastreabilidade completa de comandos executados por SSH, usuários e
            snapshots de configuração antes de cada mudança.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: "jobs", label: `Jobs de Provisionamento (${jobs.length})` },
            { id: "audit", label: `Logs de Auditoria (${auditLogs.length})` },
            { id: "backups", label: `Backups de Configuração (${backups.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "jobs" && (
        <div className="space-y-3">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                    Job #{j.id}
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {j.device_name} • {j.interface_name}
                  </span>
                  <span className="text-xs text-slate-500">
                    VLAN {j.vlan_id} ({j.vlan_description}) • Operador:{" "}
                    <strong>{j.username}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {j.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {j.execution_summary}
              </p>
              <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-emerald-300 overflow-x-auto">
                <pre>{j.proposed_config_snippet}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "audit" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Ação</th>
                <th className="py-3 px-4">Equipamento / POP</th>
                <th className="py-3 px-4">Detalhes</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-4 font-mono">#{l.id}</td>
                  <td className="py-2.5 px-4 font-semibold">{l.username}</td>
                  <td className="py-2.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                    {l.action}
                  </td>
                  <td className="py-2.5 px-4">
                    {l.device_name || l.pop_name || "-"}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                    {l.details}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === "backups" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {backups.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                  Backup #{b.id} — {b.device_name}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                  SHA256: {b.checksum}
                </span>
              </div>
              <p className="text-xs text-slate-500">{b.comment}</p>
              <button
                type="button"
                onClick={() => setSelectedBackup(b)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Visualizar current-configuration completo →
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedBackup && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl bg-slate-950 border border-slate-800 text-slate-100 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm">
                Backup #{selectedBackup.id} — {selectedBackup.device_name} (
                {selectedBackup.checksum})
              </h3>
              <button type="button" onClick={() => setSelectedBackup(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <pre className="font-mono text-xs text-emerald-300 max-h-[65vh] overflow-y-auto whitespace-pre-wrap">
              {selectedBackup.config_content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 8. ÁREA ADMIN FULL & CONFIGURAÇÕES RBAC (Sections 11 & 14)
// ============================================================================
export function SettingsAndSecurityView({
  currentUser,
}: {
  currentUser: User;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [settingsData, setSettingsData] = useState<Record<string, any> | null>(
    null
  );
  const [showUserModal, setShowUserModal] = useState(false);
  const [uUsername, setUUsername] = useState("");
  const [uFullName, setUFullName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPass, setUPass] = useState("Huawei@2026");
  const [uRole, setURole] = useState("operador");
  const [uErr, setUErr] = useState<string | null>(null);

  const loadUsersAndSettings = () => {
    apiService.getUsers().then(setUsers).catch(() => {});
    apiService.getSettings().then(setSettingsData).catch(() => {});
  };

  React.useEffect(() => {
    loadUsersAndSettings();
  }, []);

  const handleToggleDemoMode = async () => {
    if (!settingsData) return;
    try {
      const updated = await apiService.updateSettings({
        demo_mode: !settingsData.demo_mode,
      });
      setSettingsData(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUErr(null);
    try {
      await apiService.createUser({
        username: uUsername,
        full_name: uFullName,
        email: uEmail,
        password: uPass,
        role_name: uRole,
        all_pops_access: true,
      });
      setShowUserModal(false);
      setUUsername("");
      setUFullName("");
      setUEmail("");
      loadUsersAndSettings();
    } catch (err: any) {
      setUErr(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Área Admin Full — Gestão de Acessos (Admin, Supervisor e Operador)
          </h2>
          <p className="text-xs text-slate-500">
            Controle de usuários, matriz de permissões por área e políticas de
            execução SSH.
          </p>
        </div>

        {currentUser.role.name === "admin" && (
          <button
            type="button"
            onClick={() => setShowUserModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Usuário (Admin / Supervisor / Operador)
          </button>
        )}
      </div>

      {/* 3 RBAC Areas Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-1.5">
          <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] uppercase">
            1. Área Admin (Acesso Full)
          </span>
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Controle Irrestrito do Sistema
          </h4>
          <p className="text-slate-600 dark:text-slate-400">
            Acesso total a Clientes, POPs, Equipamentos, Portas, VLANs, IPs
            Vlanif, Rotas Estáticas, Provisionamento SSH, Histórico/Backups e
            Gestão de Usuários/Políticas.
          </p>
        </div>

        <div className="rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 p-4 space-y-1.5">
          <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold text-[10px] uppercase">
            2. Área Supervisor (Cadastros)
          </span>
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Cadastrar Clientes e Equipamentos
          </h4>
          <p className="text-slate-600 dark:text-slate-400">
            Acesso exclusivo para cadastrar, editar e gerenciar{" "}
            <strong>Clientes</strong>, <strong>Equipamentos Huawei</strong> e{" "}
            <strong>POPs</strong>. Bloqueado para alterar VLANs/IPs/Rotas nas
            portas.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-1.5">
          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] uppercase">
            3. Área Operador (Provisionamento)
          </span>
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            VLAN, IP, Rota e Atrelar Cliente na Porta
          </h4>
          <p className="text-slate-600 dark:text-slate-400">
            Acesso focado em colocar e remover <strong>VLAN</strong>,{" "}
            <strong>IP (Vlanif)</strong>, <strong>Rota Estática</strong> e{" "}
            <strong>atrelar Cliente/VLAN na porta física</strong>. Bloqueado
            para cadastrar/remover switches ou usuários.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System & SSH Policies */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            Políticas de Operação SSH e Modo de Execução
          </h3>
          {settingsData && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <div>
                  <strong className="block text-slate-900 dark:text-slate-100">
                    Modo de Demonstração (Simulador VRP)
                  </strong>
                  <span className="text-slate-500">
                    Quando desativado (Produção), todas as conexões exigem SSH
                    real via Netmiko.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={currentUser.role.name !== "admin"}
                  onClick={handleToggleDemoMode}
                  className={`px-3 py-1.5 rounded-lg font-bold ${
                    settingsData.demo_mode
                      ? "bg-amber-500 text-slate-950"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {settingsData.demo_mode
                    ? "DEMO / SIMULAÇÃO ATIVO"
                    : "PRODUÇÃO (SSH REAL)"}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <span>Timeout Padrão SSH (Netmiko)</span>
                <strong className="font-mono">
                  {settingsData.ssh_default_timeout} segundos
                </strong>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <span>Criptografia de Credenciais em Repouso</span>
                <strong className="text-emerald-600 font-mono">
                  Fernet AES-128-CBC + HMAC-SHA256
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Users & RBAC Roles */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Usuários Cadastrados no Sistema
          </h3>

          <div className="space-y-2.5 text-xs">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {u.full_name}{" "}
                    <span className="font-mono text-slate-500">
                      (@{u.username})
                    </span>
                  </div>
                  <div className="text-slate-500">{u.email}</div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                    u.role.name === "admin"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : u.role.name === "supervisor"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}
                >
                  {u.role.display_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewUser}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Cadastrar Novo Usuário</h3>
              <button type="button" onClick={() => setShowUserModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {uErr && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs">
                {uErr}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Área / Perfil de Acesso
                </label>
                <select
                  value={uRole}
                  onChange={(e) => setURole(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-semibold"
                >
                  <option value="admin">
                    Admin (Acesso Full ao Sistema)
                  </option>
                  <option value="supervisor">
                    Supervisor (Apenas Cadastrar Clientes e Equipamentos)
                  </option>
                  <option value="operador">
                    Operador (Colocar/Remover VLAN, IP, Rota e Atrelar na Porta)
                  </option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Login</label>
                <input
                  required
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  placeholder="joao.operador"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nome Completo</label>
                <input
                  required
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  placeholder="João Silva"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">E-mail</label>
                <input
                  required
                  type="email"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="joao@isp.net.br"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Senha</label>
                <input
                  required
                  type="password"
                  value={uPass}
                  onChange={(e) => setUPass(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Criar Usuário
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 11. ANÁLISE DE VLANs, PORTAS E IPs NO SWITCH (VARREDURA SSH)
// =====================================================================
export function SwitchVlanAnalysisView({
  pops,
  devices,
  initialDeviceId,
  onRefresh,
}: {
  pops: Pop[];
  devices: Device[];
  initialDeviceId?: number;
  onRefresh?: () => void;
}) {
  const [selectedPopId, setSelectedPopId] = useState<string>("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(
    initialDeviceId || devices[0]?.id || 1
  );
  const [analysis, setAnalysis] = useState<SwitchVlanAnalysisResponse | null>(
    null
  );
  const [importResult, setImportResult] = useState<SwitchImportResponse | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCliTerminal, setShowCliTerminal] = useState<boolean>(false);

  const filteredDevices =
    selectedPopId === "all"
      ? devices
      : devices.filter((d) => String(d.pop_id) === selectedPopId);

  const currentDevice =
    devices.find((d) => d.id === selectedDeviceId) || devices[0];

  const handleAnalyzeSwitchVlans = async (targetDevId?: number) => {
    const devIdToAnalyze = targetDevId || selectedDeviceId;
    if (!devIdToAnalyze) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await apiService.analyzeDeviceVlans(devIdToAnalyze);
      setAnalysis(res);
    } catch (err: any) {
      setErrorMsg(
        err.message || "Falha ao acessar o switch e analisar VLANs via SSH."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImportSwitchData = async (targetDevId?: number) => {
    const devIdToImport = targetDevId || selectedDeviceId;
    if (!devIdToImport) return;
    setIsImporting(true);
    setErrorMsg(null);
    try {
      const imp = await apiService.importFromSwitch(devIdToImport);
      setImportResult(imp);
      const res = await apiService.analyzeDeviceVlans(devIdToImport);
      setAnalysis(res);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(
        err.message || "Falha ao importar dados do switch para as tabelas."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const filteredVlans = (analysis?.vlans || []).filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchVlan =
      String(v.vlan_id).includes(q) ||
      v.vlan_name.toLowerCase().includes(q) ||
      v.vlan_description.toLowerCase().includes(q);
    const matchPort = v.ports.some(
      (p) =>
        p.interface_name.toLowerCase().includes(q) ||
        p.short_name.toLowerCase().includes(q) ||
        p.port_description.toLowerCase().includes(q)
    );
    const matchIp = v.ips.some(
      (ip) =>
        ip.ip_address.toLowerCase().includes(q) ||
        ip.interface_name.toLowerCase().includes(q) ||
        ip.description.toLowerCase().includes(q) ||
        ip.routed_blocks.some((rb) => rb.toLowerCase().includes(q))
    );
    return matchVlan || matchPort || matchIp;
  });

  return (
    <div className="space-y-6">
      {/* PAINEL DE SELEÇÃO DO SWITCH E BOTÃO "ANALISAR VLANs" */}
      <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                Diagnóstico & Auditoria Live via SSH (Huawei VRP)
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Análise de VLANs, Portas Físicas e Endereços IP no Switch
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Escolha o Switch Huawei abaixo e clique em{" "}
                <strong>Analisar VLANs</strong> para o sistema acessar o
                equipamento e listar todas as VLANs, seus nomes, em quais portas
                estão configuradas e seus IPs Layer 3.
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLES: ESCOLHER POP, ESCOLHER SWITCH E BOTÃO ANALISAR VLANs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60">
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              1. Filtrar por POP (Opcional)
            </label>
            <select
              value={selectedPopId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPopId(val);
                const list =
                  val === "all"
                    ? devices
                    : devices.filter((d) => String(d.pop_id) === val);
                if (list.length > 0) {
                  setSelectedDeviceId(list[0].id);
                }
              }}
              className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="all">Todos os POPs ({pops.length})</option>
              {pops.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} — {p.city}/{p.state}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-1.5">
              2. Escolher o Switch Huawei (Rolagem)
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-indigo-400 dark:border-indigo-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100 shadow-sm"
            >
              {filteredDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.pop_name || "POP"}) — {d.model} • IP{" "}
                  {d.management_ip}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleAnalyzeSwitchVlans(selectedDeviceId)}
              disabled={isAnalyzing || isImporting || !currentDevice}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-md hover:shadow-lg transition cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analisar VLANs
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleImportSwitchData(selectedDeviceId)}
              disabled={isImporting || isAnalyzing || !currentDevice}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-md hover:shadow-lg transition cursor-pointer"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Importar do Switch
                </>
              )}
            </button>
          </div>
        </div>

        {/* ATALHO RÁPIDO EM CARTÕES DOS SWITCHES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {filteredDevices.map((sw) => {
            const active = sw.id === selectedDeviceId;
            return (
              <button
                key={sw.id}
                type="button"
                onClick={() => {
                  setSelectedDeviceId(sw.id);
                  handleAnalyzeSwitchVlans(sw.id);
                }}
                className={`text-left p-3 rounded-xl border-2 transition flex flex-col justify-between ${
                  active
                    ? "border-indigo-600 bg-white dark:bg-slate-800 shadow-sm ring-2 ring-indigo-400/30"
                    : "border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-indigo-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-white truncate">
                    {sw.name}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      sw.status === "ONLINE" ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>{sw.pop_name}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {sw.management_ip}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {importResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong className="font-extrabold block text-sm">
                {importResult.message}
              </strong>
              <span>
                Sincronizados automaticamente: {importResult.vlans_synced} VLANs,{" "}
                {importResult.interfaces_synced} Portas,{" "}
                {importResult.vlanifs_synced} Gateways IP (Vlanif),{" "}
                {importResult.routes_synced} Rotas Estáticas e{" "}
                {importResult.customers_populated} Clientes preenchidos na tabela!
              </span>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-200 text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ESTADO INICIAL ANTES DE CLICAR EM ANALISAR VLANs */}
      {!analysis && !isAnalyzing && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <Server className="w-10 h-10 text-indigo-500 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Pronto para Analisar o Switch {currentDevice?.name}
          </h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Clique no botão <strong>&ldquo;Analisar VLANs no Switch&rdquo;</strong> acima (ou diretamente em um dos cartões de switch) para estabelecer a conexão SSH e exibir todas as VLANs, nomes/descrições, portas onde estão aplicadas e IPs Vlanif.
          </p>
        </div>
      )}

      {/* RESULTADO DA ANÁLISE DE VLANs, PORTAS E IPs */}
      {analysis && (
        <div className="space-y-5">
          {/* CARDS DE RESUMO DA VARREDURA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
              <div className="text-[11px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300">
                Switch Acessado via SSH
              </div>
              <div className="text-sm font-mono font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                {analysis.device_name}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                IP {analysis.management_ip} • {analysis.ssh_latency_ms} ms
              </div>
            </div>

            <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
              <div className="text-[11px] font-extrabold uppercase text-indigo-700 dark:text-indigo-300">
                Total de VLANs no Switch
              </div>
              <div className="text-2xl font-extrabold text-indigo-900 dark:text-indigo-100 mt-1">
                {analysis.total_vlans} VLANs
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Descobertas via display vlan
              </div>
            </div>

            <div className="rounded-2xl border-2 border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 p-4">
              <div className="text-[11px] font-extrabold uppercase text-sky-700 dark:text-sky-300">
                Portas Físicas com VLAN
              </div>
              <div className="text-2xl font-extrabold text-sky-900 dark:text-sky-100 mt-1">
                {analysis.total_ports_with_vlan} Portas
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Mapeadas (Access Untagged + Trunk Tagged)
              </div>
            </div>

            <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/30 p-4">
              <div className="text-[11px] font-extrabold uppercase text-purple-700 dark:text-purple-300">
                Interfaces Layer 3 (IPs Vlanif)
              </div>
              <div className="text-2xl font-extrabold text-purple-900 dark:text-purple-100 mt-1">
                {analysis.total_l3_ips} Gateways IP
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Descobertos via display ip interface brief
              </div>
            </div>
          </div>

          {/* BARRA DE BUSCA E BOTÃO PARA VER SAÍDA CLI HUAWEI */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por número da VLAN (ex: 2443), nome do cliente, porta (ex: XGE0/0/39) ou IP..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCliTerminal((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-emerald-400 text-xs font-mono font-bold hover:bg-slate-800 transition"
            >
              <Terminal className="w-4 h-4" />
              {showCliTerminal
                ? "Ocultar Saída Bruta SSH (VRP)"
                : "Ver Saída Bruta SSH (display vlan / ip)"}
            </button>
          </div>

          {showCliTerminal && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-md">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>
                  Sessão SSH Huawei VRP — {analysis.device_name} (
                  {analysis.management_ip})
                </span>
                <span className="text-emerald-400">
                  {analysis.system_version}
                </span>
              </div>
              <pre className="text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-72">
                {analysis.cli_transcript}
              </pre>
            </div>
          )}

          {/* TABELA DETALHADA: TODAS AS VLANs + NOMES + ONDE ESTÃO NAS PORTAS + IPs */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Mapeamento Completo de VLANs de {analysis.device_name} (
                  {filteredVlans.length} exibidas)
                </h3>
                <p className="text-xs text-slate-500">
                  Visão consolidada mostrando VLAN ID, Nome/Descrição, Portas onde está atrelada e Endereços IP (Vlanif + Blocos Roteados).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-4 w-56">1. VLAN & Nome / Cliente</th>
                    <th className="py-3.5 px-4">
                      2. Onde Está nas Portas (Físicas / Modo / Descrição)
                    </th>
                    <th className="py-3.5 px-4 w-96">
                      3. Endereços IP (Vlanif) & Rotas
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {filteredVlans.map((vlanItem) => (
                    <tr
                      key={vlanItem.vlan_id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 align-top transition"
                    >
                      {/* COLUNA 1: VLAN E NOME */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2.5">
                          <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-mono font-extrabold text-xs shadow-sm shrink-0">
                            VLAN {vlanItem.vlan_id}
                          </span>
                          <div>
                            <div className="font-mono font-extrabold text-slate-900 dark:text-white text-xs break-all">
                              {vlanItem.vlan_description}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {vlanItem.vlan_name} •{" "}
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {vlanItem.vlan_status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* COLUNA 2: ONDE ESTÁ NAS PORTAS */}
                      <td className="py-4 px-4">
                        {vlanItem.ports.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px]">
                            Nenhuma porta física atrelada no momento
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {vlanItem.ports.map((p) => {
                              const isUntagged = p.tag_mode.includes("Untagged");
                              return (
                                <div
                                  key={`${vlanItem.vlan_id}-${p.interface_id}`}
                                  className={`p-2.5 rounded-xl border text-xs min-w-[230px] flex-1 max-w-md ${
                                    isUntagged
                                      ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                                      : "bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                                      Porta #{p.port_index} — {p.interface_name}
                                    </span>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                        p.physical_status === "UP"
                                          ? "bg-emerald-600 text-white"
                                          : "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                                      }`}
                                    >
                                      {p.physical_status} • {p.speed}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                                    <span
                                      className={`font-bold ${
                                        isUntagged
                                          ? "text-emerald-800 dark:text-emerald-300"
                                          : "text-sky-800 dark:text-sky-300"
                                      }`}
                                    >
                                      {p.tag_mode}
                                    </span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                                      Desc: <strong>{p.port_description}</strong>
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* COLUNA 3: IPs (VLANIF) E ROTAS */}
                      <td className="py-4 px-4">
                        {vlanItem.ips.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px]">
                            Sem IP Layer 3 (Apenas Camada 2)
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {vlanItem.ips.map((ip) => (
                              <div
                                key={ip.vlanif_id}
                                className="p-2.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50/75 dark:bg-purple-950/30 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-extrabold text-purple-950 dark:text-purple-200">
                                    {ip.interface_name}
                                  </span>
                                  <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded bg-purple-600 text-white">
                                    {ip.ip_address}/{ip.cidr_prefix}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                                  Máscara: {ip.subnet_mask}{" "}
                                  {ip.description ? `• ${ip.description}` : ""}
                                </div>
                                {ip.routed_blocks.length > 0 && (
                                  <div className="pt-1 border-t border-purple-200 dark:border-purple-800/60 space-y-0.5">
                                    <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-300 block">
                                      Blocos Públicos Roteados para esta VLAN:
                                    </span>
                                    {ip.routed_blocks.map((rb, idx) => (
                                      <div
                                        key={idx}
                                        className="font-mono text-[11px] font-bold text-rose-900 dark:text-rose-200"
                                      >
                                        ↳ {rb}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 12. IMPORTAÇÃO AUTOMÁTICA DO SWITCH & CENTRAL DE BACKUPS (SISTEMA + SWITCH .TXT)
// =====================================================================
export function BackupsAndImportView({
  pops,
  devices,
  savedSwitchBackups,
  onRefresh,
}: {
  pops: Pop[];
  devices: Device[];
  savedSwitchBackups: any[];
  onRefresh: () => void;
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(
    devices[0]?.id || 1
  );
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importData, setImportData] = useState<SwitchImportResponse | null>(
    null
  );

  const [isCreatingSysBackup, setIsCreatingSysBackup] =
    useState<boolean>(false);
  const [sysBackupResult, setSysBackupResult] =
    useState<SystemBackupResponse | null>(null);

  const [isCreatingSwBackup, setIsCreatingSwBackup] = useState<boolean>(false);
  const [swBackupResult, setSwBackupResult] =
    useState<SwitchBackupTxtResponse | null>(null);

  const [errMsg, setErrMsg] = useState<string | null>(null);

  const triggerBrowserDownload = (
    filename: string,
    content: string,
    mimeType: string = "text/plain;charset=utf-8"
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFromSwitch = async () => {
    if (!selectedDeviceId) return;
    setIsImporting(true);
    setErrMsg(null);
    try {
      const res = await apiService.importFromSwitch(selectedDeviceId);
      setImportData(res);
      onRefresh();
    } catch (err: any) {
      setErrMsg(err.message || "Falha ao importar dados do switch.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateSystemBackup = async (format: "json" | "txt") => {
    setIsCreatingSysBackup(true);
    setErrMsg(null);
    try {
      const res = await apiService.createSystemBackup();
      setSysBackupResult(res);
      if (format === "json") {
        triggerBrowserDownload(
          res.filename,
          res.backup_json_text,
          "application/json;charset=utf-8"
        );
      } else {
        triggerBrowserDownload(
          res.filename.replace(".json", ".txt"),
          res.backup_txt_summary,
          "text/plain;charset=utf-8"
        );
      }
      onRefresh();
    } catch (err: any) {
      setErrMsg(err.message || "Falha ao gerar backup do sistema.");
    } finally {
      setIsCreatingSysBackup(false);
    }
  };

  const handleGenerateSwitchTxtBackup = async () => {
    if (!selectedDeviceId) return;
    setIsCreatingSwBackup(true);
    setErrMsg(null);
    try {
      const res = await apiService.createSwitchBackupTxt(selectedDeviceId);
      setSwBackupResult(res);
      triggerBrowserDownload(
        res.filename,
        res.config_txt,
        "text/plain;charset=utf-8"
      );
      onRefresh();
    } catch (err: any) {
      setErrMsg(
        err.message ||
          "Falha ao salvar o arquivo .txt das configurações gerais do switch."
      );
    } finally {
      setIsCreatingSwBackup(false);
    }
  };

  const currentSwitch =
    devices.find((d) => d.id === selectedDeviceId) || devices[0];

  return (
    <div className="space-y-6">
      {errMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-200 text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* SELETOR GLOBAL DO SWITCH PARA IMPORTAÇÃO E BACKUP TXT */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              Equipamento Huawei Selecionado
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Escolha o Switch para Importar Tabelas ou Salvar Backup Geral (.TXT)
            </h2>
          </div>

          <div className="min-w-[300px] flex-1 max-w-md">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-blue-400 dark:border-blue-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100 shadow-sm"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.pop_name || "POP"}) — {d.model} • IP{" "}
                  {d.management_ip}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3 GRANDES OPÇÕES COLORIDAS: 1. IMPORTAR DO SWITCH | 2. BACKUP DO SISTEMA | 3. BACKUP TXT DO SWITCH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* OPÇÃO 1: IMPORTAR DO SWITCH E PREENCHER AUTOMATICAMENTE TODA A TABELA */}
        <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/85 dark:bg-emerald-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-emerald-200 dark:border-emerald-800/80 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                  Sincronização Automática SSH
                </span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  1. Importar do Switch
                </h3>
              </div>
            </div>

            <p className="text-xs text-emerald-950/85 dark:text-emerald-200/85 leading-relaxed">
              Acessa o switch <strong>{currentSwitch?.name}</strong>, busca
              todas as configurações atuais e{" "}
              <strong>preenche automaticamente todas as tabelas do sistema</strong>{" "}
              (Clientes, Portas, VLANs, Gateways Vlanif e Rotas Estáticas).
            </p>
          </div>

          <button
            type="button"
            onClick={handleImportFromSwitch}
            disabled={isImporting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-md transition cursor-pointer"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Buscando Dados do Switch...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Importar Dados de {currentSwitch?.name}
              </>
            )}
          </button>
        </div>

        {/* OPÇÃO 2: BACKUP DO SISTEMA (FAZER E BAIXAR) */}
        <div className="rounded-2xl border-2 border-sky-300 dark:border-sky-800 bg-sky-50/85 dark:bg-sky-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-sky-200 dark:border-sky-800/80 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 block">
                  Banco de Dados & Cadastros
                </span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  2. Backup do Sistema
                </h3>
              </div>
            </div>

            <p className="text-xs text-sky-950/85 dark:text-sky-200/85 leading-relaxed">
              Gera e baixa imediatamente um backup completo do sistema contendo
              todos os <strong>POPs, Equipamentos, Clientes, Portas, VLANs, IPs Vlanif e Rotas</strong>{" "}
              cadastrados no painel.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleGenerateSystemBackup("json")}
              disabled={isCreatingSysBackup}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Fazer & Baixar (.JSON)
            </button>
            <button
              type="button"
              onClick={() => handleGenerateSystemBackup("txt")}
              disabled={isCreatingSysBackup}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-sky-500 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-extrabold shadow-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Fazer & Baixar (.TXT)
            </button>
          </div>
        </div>

        {/* OPÇÃO 3: BACKUP DO SWITCH EM .TXT (CONFIGURAÇÕES GERAIS) */}
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/85 dark:bg-amber-950/30 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-amber-200 dark:border-amber-800/80 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  display current-configuration
                </span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  3. Backup do Switch (.TXT)
                </h3>
              </div>
            </div>

            <p className="text-xs text-amber-950/85 dark:text-amber-200/85 leading-relaxed">
              Acessa o switch <strong>{currentSwitch?.name}</strong>, salva no
              histórico e baixa o arquivo <strong>.TXT completo</strong> com
              todas as configurações gerais do equipamento Huawei VRP.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateSwitchTxtBackup}
            disabled={isCreatingSwBackup}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-md transition cursor-pointer"
          >
            {isCreatingSwBackup ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Extraindo TXT do Switch...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Salvar e Baixar .TXT do Switch
              </>
            )}
          </button>
        </div>
      </div>

      {/* TABELA PREENCHIDA AUTOMATICAMENTE APÓS CLICAR EM "IMPORTAR DO SWITCH" */}
      {importData && (
        <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-5 bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {importData.message}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Switch: <strong>{importData.device_name}</strong> (
                  {importData.management_ip}) •{" "}
                  <strong>{importData.vlans_synced} VLANs</strong> •{" "}
                  <strong>{importData.interfaces_synced} Portas</strong> •{" "}
                  <strong>{importData.vlanifs_synced} Vlanifs</strong> •{" "}
                  <strong>{importData.routes_synced} Rotas</strong> •{" "}
                  <strong>
                    {importData.customers_populated} Clientes Preenchidos
                  </strong>
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/70 text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">VLAN</th>
                  <th className="py-3 px-4">Cliente / Descrição Importada</th>
                  <th className="py-3 px-4">Porta no Switch</th>
                  <th className="py-3 px-4">Modo / Status</th>
                  <th className="py-3 px-4">IP Vlanif</th>
                  <th className="py-3 px-4">Bloco Roteado</th>
                  <th className="py-3 px-4">Ação na Tabela</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {importData.records.map((rec, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-4 font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                      VLAN {rec.vlan_id}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {rec.customer_or_description}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {rec.interface_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
                        {rec.port_mode} • {rec.port_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-purple-700 dark:text-purple-300 font-bold">
                      {rec.vlanif_ip}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-700 dark:text-rose-300">
                      {rec.routed_block}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                        {rec.sync_action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRÉVIA DO ARQUIVO .TXT DO SWITCH RECÉM-SALVO */}
      {swBackupResult && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-slate-950 p-5 shadow-md space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-amber-400 block">
                Backup Geral do Switch Salvo em .TXT
              </span>
              <h4 className="text-sm font-mono font-extrabold text-white">
                {swBackupResult.filename} ({swBackupResult.size_bytes} bytes)
              </h4>
            </div>
            <button
              type="button"
              onClick={() =>
                triggerBrowserDownload(
                  swBackupResult.filename,
                  swBackupResult.config_txt
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar .TXT Novamente
            </button>
          </div>
          <pre className="text-xs font-mono text-emerald-300 overflow-x-auto max-h-80 leading-relaxed">
            {swBackupResult.config_txt}
          </pre>
        </div>
      )}

      {/* RESUMO DO BACKUP DO SISTEMA RECÉM-GERADO */}
      {sysBackupResult && (
        <div className="rounded-2xl border-2 border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
            <div className="text-xs">
              <strong className="font-extrabold text-slate-900 dark:text-white block">
                Backup do Sistema Gerado: {sysBackupResult.filename} (
                {sysBackupResult.size_bytes} bytes)
              </strong>
              <span className="text-slate-600 dark:text-slate-300">
                POPs: {sysBackupResult.counts.pops} • Switches:{" "}
                {sysBackupResult.counts.devices} • Clientes:{" "}
                {sysBackupResult.counts.customers} • VLANs:{" "}
                {sysBackupResult.counts.vlans} • Rotas:{" "}
                {sysBackupResult.counts.routes}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                triggerBrowserDownload(
                  sysBackupResult.filename,
                  sysBackupResult.backup_json_text,
                  "application/json;charset=utf-8"
                )
              }
              className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold"
            >
              Baixar .JSON
            </button>
            <button
              type="button"
              onClick={() =>
                triggerBrowserDownload(
                  sysBackupResult.filename.replace(".json", ".txt"),
                  sysBackupResult.backup_txt_summary
                )
              }
              className="px-3 py-1.5 rounded-lg border border-sky-600 text-sky-700 dark:text-sky-300 text-xs font-bold"
            >
              Baixar .TXT
            </button>
          </div>
        </div>
      )}

      {/* HISTÓRICO DE BACKUPS .TXT DOS SWITCHES SALVOS NO SISTEMA */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Arquivos .TXT de Configurações Gerais dos Switches Salvos (
              {savedSwitchBackups.length})
            </h3>
            <p className="text-xs text-slate-500">
              Clique em &ldquo;Baixar .TXT&rdquo; em qualquer ponto de restauração abaixo para obter o arquivo de configuração geral do switch.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/70 text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Comentário / Operação</th>
                <th className="py-3 px-4">Data/Hora</th>
                <th className="py-3 px-4 text-right">Download .TXT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {savedSwitchBackups.map((b: any) => (
                <tr
                  key={b.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3 px-4 font-mono font-bold">#{b.id}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold">
                      {b.backup_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {b.comment || "Configuração geral do switch"}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {b.created_at
                      ? new Date(b.created_at).toLocaleString("pt-BR")
                      : "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        triggerBrowserDownload(
                          `BACKUP-SWITCH-ID-${b.id}.txt`,
                          b.config_text || "# Sem conteúdo"
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar .TXT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}




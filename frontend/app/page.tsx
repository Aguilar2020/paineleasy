"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  NavSection,
  User,
  Device,
  Customer,
  NetworkInterface,
} from "@/types/network";
import { apiService, getStoredToken, setStoredToken } from "@/services/api";
import {
  useDashboardSummary,
  usePops,
  useDevices,
  useCustomers,
  useDeviceInterfaces,
  useVlans,
  useVlanifs,
  useRoutes,
  useHistoryData,
  useInvalidateNetworkQueries,
} from "@/hooks/useNetworkData";
import { ProvisioningWizard } from "@/components/ProvisioningWizard";
import {
  DashboardView,
  PopsManagementView,
  DevicesManagementView,
  CustomersManagementView,
  InterfacesVisualView,
  VlansAndVlanifsView,
  RoutesManagementView,
  HistoryAndBackupsView,
  SettingsAndSecurityView,
  SwitchVlanAnalysisView,
  BackupsAndImportView,
} from "@/components/ModulesViews";
import {
  Bell,
  Building2,
  Cpu,
  HardDrive,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Moon,
  Network,
  Route,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sliders,
  Sun,
  UserCheck,
  Users,
} from "lucide-react";

const MENU_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  allowedRoles: string[];
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["admin", "supervisor", "operador"],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    allowedRoles: ["admin", "supervisor", "operador"],
  },
  {
    id: "equipamentos",
    label: "Equipamentos",
    icon: Server,
    allowedRoles: ["admin", "supervisor"],
  },
  {
    id: "pops",
    label: "POPs",
    icon: Building2,
    allowedRoles: ["admin", "supervisor"],
  },
  {
    id: "interfaces",
    label: "Interfaces (Portas)",
    icon: Cpu,
    allowedRoles: ["admin", "operador"],
  },
  {
    id: "vlans",
    label: "VLANs",
    icon: Layers,
    allowedRoles: ["admin", "operador"],
  },
  {
    id: "vlanifs",
    label: "Vlanifs (IPs)",
    icon: Network,
    allowedRoles: ["admin", "operador"],
  },
  {
    id: "rotas",
    label: "Rotas estáticas",
    icon: Route,
    allowedRoles: ["admin", "operador"],
  },
  {
    id: "provisionamento",
    label: "Provisionamento",
    icon: Sliders,
    highlight: true,
    allowedRoles: ["admin", "operador"],
  },
  {
    id: "analise",
    label: "Análise & Importar Switch",
    icon: Search,
    highlight: true,
    allowedRoles: ["admin", "supervisor", "operador"],
  },
  {
    id: "historico",
    label: "Histórico de alterações",
    icon: History,
    allowedRoles: ["admin", "operador"],
  },
  {
    id: "configuracoes",
    label: "Configurações (Admin & Backups)",
    icon: Settings,
    highlight: true,
    allowedRoles: ["admin"],
  },
];

export default function HuaweiNetworkManagerApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeNav, setActiveNav] = useState<NavSection>("dashboard");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form state
  const [loginUser, setLoginUser] = useState("admin");
  const [loginPass, setLoginPass] = useState("Huawei@2026");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  // Context state for jumping from Port Map / Clientes directly into Provisioning Wizard
  const [selectedMapDeviceId, setSelectedMapDeviceId] = useState<number>(1);
  const [wizardPreset, setWizardPreset] = useState<{
    popId?: number;
    deviceId?: number;
    interfaceName?: string;
    customerId?: number;
  }>({});

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Auto-authenticate with default NOC admin if no session token exists yet for immediate convenience
  useEffect(() => {
    const initAuth = async () => {
      try {
        const existingToken = getStoredToken();
        if (existingToken) {
          const me = await apiService.getMe();
          setCurrentUser(me);
          setAuthLoading(false);
          return;
        }
        const res = await apiService.login("admin", "Huawei@2026");
        setStoredToken(res.access_token);
        setCurrentUser(res.user);
      } catch {
        setStoredToken(null);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  const isAuthenticated = Boolean(currentUser);
  const userRole = currentUser?.role?.name || "operador";
  const invalidateAll = useInvalidateNetworkQueries();

  const dashboardQuery = useDashboardSummary(isAuthenticated);
  const popsQuery = usePops(isAuthenticated);
  const devicesQuery = useDevices(undefined, isAuthenticated);
  const customersQuery = useCustomers(isAuthenticated);
  const mapInterfacesQuery = useDeviceInterfaces(
    selectedMapDeviceId,
    isAuthenticated
  );
  const vlansQuery = useVlans(undefined, isAuthenticated);
  const vlanifsQuery = useVlanifs(undefined, isAuthenticated);
  const routesQuery = useRoutes(undefined, isAuthenticated);
  const historyData = useHistoryData(isAuthenticated);

  // Filter menu items based on active role area
  const visibleMenuItems = useMemo(() => {
    return MENU_ITEMS.filter((item) => item.allowedRoles.includes(userRole));
  }, [userRole]);

  // Ensure activeNav is always permitted for the current role
  useEffect(() => {
    if (!currentUser) return;
    const isAllowed = visibleMenuItems.some((m) => m.id === activeNav);
    if (!isAllowed) {
      if (userRole === "supervisor") {
        setActiveNav("clientes");
      } else if (userRole === "operador") {
        setActiveNav("interfaces");
      } else {
        setActiveNav("dashboard");
      }
    }
  }, [userRole, visibleMenuItems, activeNav, currentUser]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    try {
      const res = await apiService.login(loginUser, loginPass);
      setStoredToken(res.access_token);
      setCurrentUser(res.user);
      invalidateAll();
    } catch (err: any) {
      setLoginErr(err.message || "Falha na autenticação.");
    }
  };

  const handleQuickSwitchProfile = async (
    username: string,
    defaultTab?: NavSection
  ) => {
    try {
      const res = await apiService.login(username, "Huawei@2026");
      setStoredToken(res.access_token);
      setCurrentUser(res.user);
      if (defaultTab) {
        setActiveNav(defaultTab);
      }
      invalidateAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setCurrentUser(null);
  };

  const handleConfigurePortFromMap = (
    dev: Device,
    iface: NetworkInterface
  ) => {
    setWizardPreset({
      popId: dev.pop_id,
      deviceId: dev.id,
      interfaceName: iface.name,
    });
    setActiveNav("provisionamento");
  };

  const handleBindCustomerOnPort = (cust: Customer) => {
    setWizardPreset({
      popId: cust.pop_id || undefined,
      deviceId: cust.device_id || undefined,
      interfaceName: cust.interface_name || undefined,
      customerId: cust.id,
    });
    setActiveNav("provisionamento");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">
            Inicializando Huawei Network Manager...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
        <form
          onSubmit={handleLoginSubmit}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 shadow-xl space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow">
              H
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Huawei Network Manager
              </h1>
              <p className="text-xs text-slate-500">
                Gerenciamento e Provisionamento VRP para Provedores (ISP)
              </p>
            </div>
          </div>

          {loginErr && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
              {loginErr}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Usuário</label>
              <input
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Senha</label>
              <input
                required
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
            <strong className="block text-slate-800 dark:text-slate-200">
              3 Áreas de Acesso Pré-configuradas (Senha: Huawei@2026):
            </strong>
            <div>
              • <strong>admin</strong> — Área Admin (Acesso Full total)
            </div>
            <div>
              • <strong>supervisor</strong> — Área Supervisor (Cadastrar
              Clientes e Equipamentos/POPs)
            </div>
            <div>
              • <strong>operador</strong> — Área Operador (Colocar/Remover VLAN,
              IP, Rota e Atrelar Cliente/VLAN na Porta)
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow transition"
          >
            Acessar Painel de Rede
          </button>
        </form>
      </div>
    );
  }

  const pops = popsQuery.data || [];
  const devices = devicesQuery.data || [];
  const customers = customersQuery.data || [];
  const interfaces = mapInterfacesQuery.data || [];
  const vlans = vlansQuery.data || [];
  const vlanifs = vlanifsQuery.data || [];
  const routes = routesQuery.data || [];

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
        <div>
          {/* Brand Logo */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shadow-sm">
              H
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight text-slate-900 dark:text-white">
                Huawei Network
              </h1>
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                ISP Provisioning Panel
              </span>
            </div>
          </div>

          {/* Active Area Badge inside Sidebar */}
          <div className="px-4 pt-3 pb-1">
            <div
              className={`px-3 py-2 rounded-lg text-[11px] font-bold border ${
                userRole === "admin"
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                  : userRole === "supervisor"
                  ? "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                  : "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <div className="uppercase tracking-wider text-[10px] opacity-80">
                Área Ativa
              </div>
              <div className="text-xs mt-0.5">
                {userRole === "admin"
                  ? "Área Admin (Acesso Full)"
                  : userRole === "supervisor"
                  ? "Área Supervisor (Cadastros)"
                  : "Área Operador (Provisionamento)"}
              </div>
            </div>
          </div>

          {/* Navigation Menu Filtered by Role Area */}
          <nav className="p-3 space-y-1">
            {visibleMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : item.highlight
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>
                      {index + 1}. {item.label}
                    </span>
                  </span>
                  {item.highlight && !isActive && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] uppercase font-bold">
                      VRP
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Quick Area Switcher (Admin / Supervisor / Operador) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Alternar Área de Acesso
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickSwitchProfile("admin", "dashboard")}
              className={`py-1.5 px-2.5 rounded-lg text-left text-[11px] font-semibold border transition flex items-center justify-between ${
                userRole === "admin"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>1. Área Admin</span>
              <span className="text-[10px] opacity-85">Acesso Full</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickSwitchProfile("supervisor", "clientes")}
              className={`py-1.5 px-2.5 rounded-lg text-left text-[11px] font-semibold border transition flex items-center justify-between ${
                userRole === "supervisor"
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>2. Área Supervisor</span>
              <span className="text-[10px] opacity-85">Clientes & Equip.</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickSwitchProfile("operador", "interfaces")
              }
              className={`py-1.5 px-2.5 rounded-lg text-left text-[11px] font-semibold border transition flex items-center justify-between ${
                userRole === "operador"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>3. Área Operador</span>
              <span className="text-[10px] opacity-85">
                VLAN / IP / Rota / Porta
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER BAR: Area Switcher Pills, System Status, Notifications, Theme & User */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 hidden xl:inline">
              Áreas do Sistema:
            </span>
            <button
              type="button"
              onClick={() => handleQuickSwitchProfile("admin", "dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                userRole === "admin"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              Área Admin (Full)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSwitchProfile("supervisor", "clientes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                userRole === "supervisor"
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              Área Supervisor (Clientes & Equipamentos)
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickSwitchProfile("operador", "interfaces")
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                userRole === "operador"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              Área Operador (VLAN, IP, Rota & Porta)
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Alternar tema claro/escuro"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Notifications indicator */}
            {userRole !== "supervisor" && (
              <button
                type="button"
                onClick={() => setActiveNav("historico")}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Últimas operações auditadas"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600" />
              </button>
            )}

            {/* Active Operator Info */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 justify-end">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  {currentUser.full_name}
                </div>
                <span className="text-[11px] text-slate-500">
                  Perfil: <strong>{currentUser.role.display_name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Encerrar sessão"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ROLE SCOPE EXPLANATION BAR */}
        <div
          className={`px-6 py-2 text-xs font-medium border-b flex flex-wrap items-center justify-between gap-2 ${
            userRole === "admin"
              ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200"
              : userRole === "supervisor"
              ? "bg-purple-50/80 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-200"
              : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200"
          }`}
        >
          <div>
            {userRole === "admin" && (
              <>
                <strong>ÁREA ADMIN (ACESSO FULL):</strong> Permissão total para
                gerenciar Usuários, POPs, Equipamentos, Clientes, Portas, VLANs,
                IPs Vlanif, Rotas Estáticas e Provisionamento SSH.
              </>
            )}
            {userRole === "supervisor" && (
              <>
                <strong>ÁREA SUPERVISOR:</strong> Acesso exclusivo para{" "}
                <strong>Cadastrar/Editar Clientes</strong> e{" "}
                <strong>Cadastrar/Gerenciar Equipamentos e POPs</strong>.
                Operações de porta/VLAN/IP/Rota pertencem ao Operador.
              </>
            )}
            {userRole === "operador" && (
              <>
                <strong>ÁREA OPERADOR:</strong> Acesso operacional para{" "}
                <strong>Colocar e Remover VLAN</strong>,{" "}
                <strong>Colocar e Remover IP (Vlanif)</strong>,{" "}
                <strong>Colocar e Remover Rota Estática</strong> e{" "}
                <strong>Selecionar Cliente para Atrelar VLAN na Porta</strong>.
              </>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] opacity-80">
            <ShieldCheck className="w-3.5 h-3.5" /> Controle de Acesso RBAC Ativo
          </span>
        </div>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {activeNav === "dashboard" && (
            <DashboardView
              summary={dashboardQuery.data}
              devices={devices}
              customers={customers}
              onNavigate={(tab) => setActiveNav(tab)}
              onStartProvisioning={() =>
                setActiveNav(
                  userRole === "supervisor" ? "clientes" : "provisionamento"
                )
              }
            />
          )}

          {activeNav === "clientes" && (
            <CustomersManagementView
              customers={customers}
              pops={pops}
              devices={devices}
              userRole={userRole}
              onRefresh={invalidateAll}
              onBindCustomerInPort={handleBindCustomerOnPort}
            />
          )}

          {activeNav === "pops" && (
            <PopsManagementView
              pops={pops}
              devices={devices}
              userRole={userRole}
              onRefresh={invalidateAll}
              onSelectDeviceForInterfaces={(dev) => {
                setSelectedMapDeviceId(dev.id);
                if (userRole === "supervisor") {
                  setActiveNav("equipamentos");
                } else {
                  setActiveNav("interfaces");
                }
              }}
            />
          )}

          {activeNav === "equipamentos" && (
            <DevicesManagementView
              devices={devices}
              pops={pops}
              userRole={userRole}
              onRefresh={invalidateAll}
              onViewInterfaces={(dev) => {
                setSelectedMapDeviceId(dev.id);
                if (userRole === "supervisor") {
                  alert(
                    "No perfil Supervisor o acesso é dedicado ao cadastro de Clientes e Equipamentos. Alterne para Área Operador ou Admin para operar portas e VLANs."
                  );
                } else {
                  setActiveNav("interfaces");
                }
              }}
            />
          )}

          {activeNav === "interfaces" && (
            <InterfacesVisualView
              devices={devices}
              customers={customers}
              selectedDeviceId={selectedMapDeviceId}
              onSelectDeviceId={(id) => setSelectedMapDeviceId(id)}
              interfaces={interfaces}
              userRole={userRole}
              onRefresh={invalidateAll}
              onConfigurePort={handleConfigurePortFromMap}
            />
          )}

          {activeNav === "vlans" && (
            <VlansAndVlanifsView
              mode="vlans"
              vlans={vlans}
              vlanifs={vlanifs}
              devices={devices}
              userRole={userRole}
              onRefresh={invalidateAll}
              onStartProvisioning={() => setActiveNav("provisionamento")}
            />
          )}

          {activeNav === "vlanifs" && (
            <VlansAndVlanifsView
              mode="vlanifs"
              vlans={vlans}
              vlanifs={vlanifs}
              devices={devices}
              userRole={userRole}
              onRefresh={invalidateAll}
              onStartProvisioning={() => setActiveNav("provisionamento")}
            />
          )}

          {activeNav === "rotas" && (
            <RoutesManagementView
              routes={routes}
              devices={devices}
              userRole={userRole}
              onRefresh={invalidateAll}
            />
          )}

          {activeNav === "provisionamento" &&
            pops.length > 0 &&
            devices.length > 0 && (
              <ProvisioningWizard
                pops={pops}
                allDevices={devices}
                customers={customers}
                initialPopId={wizardPreset.popId}
                initialDeviceId={wizardPreset.deviceId}
                initialInterfaceName={wizardPreset.interfaceName}
                initialCustomerId={wizardPreset.customerId}
                userRole={userRole}
                onSuccessInvalidate={invalidateAll}
              />
            )}

          {activeNav === "analise" && (
            <SwitchVlanAnalysisView
              pops={pops}
              devices={devices}
              initialDeviceId={selectedMapDeviceId}
              onRefresh={invalidateAll}
            />
          )}

          {activeNav === "historico" && (
            <HistoryAndBackupsView
              jobs={historyData.jobs.data || []}
              auditLogs={historyData.logs.data || []}
            />
          )}

          {activeNav === "configuracoes" && userRole === "admin" && (
            <SettingsAndSecurityView
              currentUser={currentUser}
              devices={devices}
              savedSwitchBackups={historyData.backups.data || []}
              onRefresh={invalidateAll}
            />
          )}
        </main>
      </div>
    </div>
  );
}

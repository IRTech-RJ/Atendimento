import {
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  LogOut,
  Users,
  X,
  Layers3,
  MessageCircle,
  MessageSquare,
  Contact,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import type { AdminSection, CompanySection, WorkspaceMode } from "../types/workspace";

type Section = AdminSection | CompanySection;

interface WorkspaceSidebarProps {
  mode: WorkspaceMode;
  role?: "platform_admin" | "company_admin" | "supervisor" | "agent";
  section: Section;
  onNavigate: (section: Section) => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  companyName?: string;
  isDemo?: boolean;
}

const adminItems = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "departments", label: "Setores", icon: Layers3 },
] as const;

const companyItems = [
  { id: "overview", label: "Painel inicial", icon: LayoutDashboard },
  { id: "conversations", label: "Conversas", icon: MessageSquare },
  { id: "contacts", label: "Contatos", icon: Contact },
  { id: "users", label: "Equipe", icon: Users },
  { id: "departments", label: "Setores", icon: Layers3 },
  { id: "whatsapp", label: "Canais", icon: MessageCircle },
] as const;

export function WorkspaceSidebar({
  mode,
  role,
  section,
  onNavigate,
  onLogout,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  companyName,
  isDemo = true,
}: WorkspaceSidebarProps) {
  const items = mode === "admin"
    ? adminItems
    : companyItems.filter((item) => {
        if (item.id === "users" || item.id === "departments") return role === "company_admin";
        if (item.id === "contacts") return role === "company_admin" || role === "supervisor";
        if (item.id === "whatsapp") return isDemo || role === "company_admin";
        return true;
      });

  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" onClick={onClose} aria-label="Fechar menu" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#101b2c] px-4 py-5 text-white transition-[width,transform] md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[80px] md:px-3" : "md:w-[264px]"}`}
      >
        <div className={`flex items-center justify-between px-2 ${collapsed ? "md:flex-col md:justify-start md:gap-3" : ""}`}>
          <div className={collapsed ? "md:hidden" : ""}>
            <BrandMark />
          </div>
          {collapsed && (
            <div
              className="hidden size-10 shrink-0 place-items-center rounded-xl bg-teal-400 text-sm font-black text-slate-950 md:grid"
              title="IR Tech · Atendimento"
            >
              IR
            </div>
          )}
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 md:hidden" onClick={onClose} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
          <button
            className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/10 md:block"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir painel lateral" : "Recolher painel lateral"}
            title={collapsed ? "Expandir painel lateral" : "Recolher painel lateral"}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        <div className={`mt-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 ${collapsed ? "md:hidden" : ""}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {mode === "admin" ? "Ambiente" : "Empresa"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-100">
              {mode === "admin" ? "Administração IR Tech" : companyName}
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-500" />
          </div>
        </div>

        <nav className="mt-8 flex-1 space-y-1" aria-label="Navegação principal">
          <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${collapsed ? "md:hidden" : ""}`}>
            Workspace
          </p>
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                onNavigate(id);
                onClose();
              }}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-left text-sm font-medium transition ${
                collapsed ? "md:justify-center md:px-2" : "px-3"
              } ${
                section === id
                  ? "bg-teal-400 text-slate-950 shadow-sm shadow-black/10"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              <span className={collapsed ? "md:hidden" : ""}>{label}</span>
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs font-medium text-slate-200">Soluções inteligentes</p>
            <p className="mt-1 text-[11px] text-slate-500">em tecnologia · IR Tech</p>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? (isDemo ? "Sair da demonstração" : "Sair") : undefined}
          aria-label={collapsed ? (isDemo ? "Sair da demonstração" : "Sair") : undefined}
          className={`mt-3 flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white ${
            collapsed ? "md:justify-center md:px-2" : "px-3"
          }`}
        >
          <LogOut className="size-[18px]" strokeWidth={1.8} />
          <span className={collapsed ? "md:hidden" : ""}>{isDemo ? "Sair da demonstração" : "Sair"}</span>
        </button>
      </aside>
    </>
  );
}

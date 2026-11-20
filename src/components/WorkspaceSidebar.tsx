import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Users,
  X,
  Layers3,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import type { AdminSection, CompanySection, WorkspaceMode } from "../types/workspace";

type Section = AdminSection | CompanySection;

interface WorkspaceSidebarProps {
  mode: WorkspaceMode;
  section: Section;
  onNavigate: (section: Section) => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
  companyName?: string;
}

const adminItems = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "departments", label: "Setores", icon: Layers3 },
] as const;

const companyItems = [
  { id: "overview", label: "Painel inicial", icon: LayoutDashboard },
  { id: "users", label: "Equipe", icon: Users },
  { id: "departments", label: "Setores", icon: Layers3 },
] as const;

export function WorkspaceSidebar({
  mode,
  section,
  onNavigate,
  onLogout,
  open,
  onClose,
  companyName,
}: WorkspaceSidebarProps) {
  const items = mode === "admin" ? adminItems : companyItems;

  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" onClick={onClose} aria-label="Fechar menu" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#101b2c] px-4 py-5 text-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <BrandMark />
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 md:hidden" onClick={onClose} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
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
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                onNavigate(id);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                section === id
                  ? "bg-teal-400 text-slate-950 shadow-sm shadow-black/10"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs font-medium text-slate-200">Soluções inteligentes</p>
          <p className="mt-1 text-[11px] text-slate-500">em tecnologia · IR Tech</p>
        </div>
        <button
          onClick={onLogout}
          className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut className="size-[18px]" strokeWidth={1.8} />
          Sair da demonstração
        </button>
      </aside>
    </>
  );
}

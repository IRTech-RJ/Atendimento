import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DemoNotice } from "../components/DemoNotice";
import { StatusBadge } from "../components/StatusBadge";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import type { AdminSection, CompanySection, WorkspaceMode } from "../types/workspace";

type Section = AdminSection | CompanySection;

interface WorkspaceLayoutProps {
  mode: WorkspaceMode;
  role?: "platform_admin" | "company_admin" | "supervisor" | "agent";
  section: Section;
  onNavigate: (section: Section) => void;
  onLogout: () => void;
  companyName?: string;
  showDemoNotice?: boolean;
  children: ReactNode;
}

export function WorkspaceLayout({
  mode,
  role,
  section,
  onNavigate,
  onLogout,
  companyName,
  showDemoNotice = true,
  children,
}: WorkspaceLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7fa] md:flex">
      <WorkspaceSidebar
        mode={mode}
        role={role}
        section={section}
        onNavigate={onNavigate}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        companyName={companyName}
        isDemo={showDemoNotice}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
            <button
              className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:block"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? "Expandir painel lateral" : "Recolher painel lateral"}
              title={sidebarCollapsed ? "Expandir painel lateral" : "Recolher painel lateral"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
            <span className="text-sm font-medium text-slate-500">
              {mode === "admin" ? "Painel IR Tech" : companyName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge />
            <span className="hidden text-xs text-slate-400 sm:inline">Soluções inteligentes em tecnologia</span>
            <span className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {mode === "admin" ? "IR" : "MA"}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-5 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {showDemoNotice && <DemoNotice />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

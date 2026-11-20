import { Activity, ArrowRight, Building2, Layers3, Users } from "lucide-react";
import { PageHeading } from "../components/PageHeading";
import { StatusPill } from "../components/StatusPill";
import type { AdminSection, Company, Department, WorkspaceUser } from "../types/workspace";

interface AdminDashboardPageProps {
  companies: Company[];
  users: WorkspaceUser[];
  departments: Department[];
  onNavigate: (section: AdminSection) => void;
}

export function AdminDashboardPage({ companies, users, departments, onNavigate }: AdminDashboardPageProps) {
  const activeCompanies = companies.filter((company) => company.status === "Ativa").length;
  const cards = [
    { label: "Empresas clientes", value: companies.length, detail: `${activeCompanies} ambientes ativos`, icon: Building2, tint: "bg-teal-50 text-teal-800" },
    { label: "Usuários cadastrados", value: users.length, detail: "Distribuídos entre as empresas", icon: Users, tint: "bg-indigo-50 text-indigo-700" },
    { label: "Setores configurados", value: departments.length, detail: "Organizados por empresa", icon: Layers3, tint: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div>
      <PageHeading
        eyebrow="Soluções inteligentes em tecnologia"
        title="Painel IR Tech"
        description="Acompanhe a estrutura das empresas clientes e dos ambientes de atendimento."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon, tint }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`grid size-10 place-items-center rounded-xl ${tint}`}><Icon className="size-5" /></span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600"><Activity className="size-4" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Empresas clientes</h2>
              <p className="mt-0.5 text-xs text-slate-500">Visão resumida dos ambientes demonstrativos</p>
            </div>
          </div>
          <button onClick={() => onNavigate("companies")} className="inline-flex items-center gap-2 text-sm font-medium text-teal-800 hover:text-teal-950">
            Gerenciar empresas <ArrowRight className="size-4" />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {companies.slice(0, 4).map((company) => (
            <div key={company.id} className="flex items-center gap-3 px-5 py-4">
              <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-800">
                {company.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{company.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{company.segment} · {company.city}</p>
              </div>
              <StatusPill status={company.status} />
            </div>
          ))}
          {companies.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Cadastre a primeira empresa para começar.</p>}
        </div>
      </section>
    </div>
  );
}

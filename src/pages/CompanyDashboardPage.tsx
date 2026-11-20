import { ArrowRight, Headset, Layers3, Users, WifiOff } from "lucide-react";
import { PageHeading } from "../components/PageHeading";
import type { Company, Department, WorkspaceUser } from "../types/workspace";

interface CompanyDashboardPageProps {
  company: Company;
  users: WorkspaceUser[];
  departments: Department[];
  onNavigate: (section: "users" | "departments") => void;
}

export function CompanyDashboardPage({ company, users, departments, onNavigate }: CompanyDashboardPageProps) {
  const teamSize = users.filter((user) => user.companyId === company.id && user.status === "Ativo").length;
  const departmentCount = departments.filter((department) => department.companyId === company.id && department.status === "Ativo").length;

  return (
    <div>
      <PageHeading
        eyebrow="Espaço da empresa"
        title={`Olá, ${company.name}`}
        description="Este é o ponto de partida para organizar sua equipe e seu atendimento."
      />
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-800"><Users className="size-5" /></span>
          <div><p className="text-sm text-slate-500">Equipe ativa</p><p className="mt-1 text-2xl font-semibold text-slate-900">{teamSize}</p></div>
          <button onClick={() => onNavigate("users")} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-800" aria-label="Gerenciar equipe"><ArrowRight className="size-4" /></button>
        </article>
        <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Layers3 className="size-5" /></span>
          <div><p className="text-sm text-slate-500">Setores ativos</p><p className="mt-1 text-2xl font-semibold text-slate-900">{departmentCount}</p></div>
          <button onClick={() => onNavigate("departments")} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-800" aria-label="Gerenciar setores"><ArrowRight className="size-4" /></button>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Headset className="size-5" /></span>
          <div>
            <h2 className="font-semibold text-slate-900">Caixa de entrada</h2>
            <p className="mt-1 text-sm text-slate-500">Conversas e mensagens aparecerão neste espaço.</p>
          </div>
        </div>
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-amber-50 text-amber-700"><WifiOff className="size-5" /></span>
          <h3 className="mt-4 text-sm font-semibold text-slate-800">Nenhum canal conectado</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            A integração oficial com a WhatsApp Business Platform ainda não foi configurada.
            Nenhuma mensagem está sendo recebida ou enviada.
          </p>
        </div>
      </section>
    </div>
  );
}

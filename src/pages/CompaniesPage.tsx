import { Building2, CircleOff, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { FormField, SelectField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageHeading } from "../components/PageHeading";
import { StatusPill } from "../components/StatusPill";
import type { Company, CompanyStatus } from "../types/workspace";

interface CompaniesPageProps {
  companies: Company[];
  onSave: (company: Company) => void;
  onToggleStatus: (id: string) => void;
}

export function CompaniesPage({ companies, onSave, onToggleStatus }: CompaniesPageProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Company | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const filteredCompanies = useMemo(
    () => companies.filter((company) => `${company.name} ${company.segment} ${company.city}`.toLowerCase().includes(query.toLowerCase())),
    [companies, query],
  );

  function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSave({
      id: editing?.id ?? crypto.randomUUID(),
      name: String(formData.get("name")).trim(),
      document: String(formData.get("document")).trim(),
      segment: String(formData.get("segment")).trim(),
      city: String(formData.get("city")).trim(),
      status: (String(formData.get("status") ?? editing?.status ?? "Ativa")) as CompanyStatus,
    });
    closeModal();
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <PageHeading
        eyebrow="Administração"
        title="Empresas"
        description="Gerencie as empresas clientes e o acesso aos seus ambientes."
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus className="size-4" />
            Cadastrar empresa
          </button>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Building2 className="size-4 text-slate-400" />
            {companies.length} empresas cadastradas
          </div>
          <label className="relative block sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </label>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredCompanies.map((company) => (
            <article key={company.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-sm font-bold text-teal-800">
                {company.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900">{company.name}</h2>
                  <StatusPill status={company.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {company.segment} <span className="px-1 text-slate-300">·</span> {company.city}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  onClick={() => {
                    setEditing(company);
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Pencil className="size-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => onToggleStatus(company.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <CircleOff className="size-3.5" />
                  {company.status === "Ativa" ? "Bloquear" : "Desbloquear"}
                </button>
              </div>
            </article>
          ))}
          {filteredCompanies.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma empresa encontrada.</p>
          )}
        </div>
      </section>

      {modalOpen && (
        <Modal
          title={editing ? "Editar empresa" : "Cadastrar empresa"}
          description="Preencha os dados básicos da empresa."
          onClose={closeModal}
          onSubmit={submitCompany}
          submitLabel={editing ? "Salvar alterações" : "Cadastrar"}
        >
          <FormField label="Nome da empresa" name="name" defaultValue={editing?.name} required maxLength={120} />
          <FormField label="CNPJ (opcional)" name="document" defaultValue={editing?.document} maxLength={18} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Segmento" name="segment" defaultValue={editing?.segment} required maxLength={80} />
            <FormField label="Cidade / UF" name="city" defaultValue={editing?.city} required maxLength={100} />
          </div>
          {editing && (
            <SelectField label="Situação" name="status" defaultValue={editing.status}>
              <option value="Ativa">Ativa</option>
              <option value="Bloqueada">Bloqueada</option>
            </SelectField>
          )}
        </Modal>
      )}
    </div>
  );
}

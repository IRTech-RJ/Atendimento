import { Layers3, Pencil, Plus, Power } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormField, SelectField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageHeading } from "../components/PageHeading";
import { StatusPill } from "../components/StatusPill";
import type { Company, Department } from "../types/workspace";

interface DepartmentsPageProps {
  departments: Department[];
  companies: Company[];
  companyId?: string;
  onSave: (department: Department) => void;
  onToggleStatus: (id: string) => void;
}

export function DepartmentsPage({ departments, companies, companyId, onSave, onToggleStatus }: DepartmentsPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [selectedCompany, setSelectedCompany] = useState(companyId ?? companies[0]?.id ?? "");
  const scopedCompanyId = companyId ?? selectedCompany;
  const scopedDepartments = departments.filter((department) => department.companyId === scopedCompanyId);
  const companyName = companies.find((company) => company.id === scopedCompanyId)?.name ?? "Empresa";

  function submitDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSave({
      id: editing?.id ?? crypto.randomUUID(),
      companyId: editing?.companyId ?? companyId ?? String(formData.get("companyId") ?? selectedCompany),
      name: String(formData.get("name")).trim(),
      description: String(formData.get("description")).trim(),
      status: editing?.status ?? "Ativo",
    });
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <PageHeading
        eyebrow={companyId ? "Espaço da empresa" : "Administração"}
        title="Setores"
        description={companyId ? `Organize os setores de ${companyName}.` : "Cada empresa mantém seus próprios setores de atendimento."}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus className="size-4" />
            Cadastrar setor
          </button>
        }
      />
      {!companyId && (
        <div className="mb-5 max-w-sm">
          <SelectField label="Empresa" value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)}>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </SelectField>
        </div>
      )}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {scopedDepartments.map((department) => (
          <article key={department.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800">
                <Layers3 className="size-5" />
              </span>
              <StatusPill status={department.status} />
            </div>
            <h2 className="mt-4 font-semibold text-slate-900">{department.name}</h2>
            <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{department.description || "Sem descrição"}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setEditing(department);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <Pencil className="size-3.5" />
                Editar
              </button>
              <button
                onClick={() => onToggleStatus(department.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <Power className="size-3.5" />
                {department.status === "Ativo" ? "Desativar" : "Ativar"}
              </button>
            </div>
          </article>
        ))}
        {scopedDepartments.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">
            Nenhum setor cadastrado para esta empresa.
          </p>
        )}
      </section>

      {modalOpen && (
        <Modal
          title={editing ? "Editar setor" : "Cadastrar setor"}
          description="Adicione um setor à empresa selecionada. Os dados permanecem na demonstração."
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSubmit={submitDepartment}
          submitLabel={editing ? "Salvar demonstração" : "Adicionar à demonstração"}
        >
          {!companyId && (
            <SelectField label="Empresa" name="companyId" defaultValue={scopedCompanyId} required>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </SelectField>
          )}
          <FormField label="Nome do setor" name="name" defaultValue={editing?.name} placeholder="Ex.: Delivery" required maxLength={80} />
          <FormField label="Descrição (opcional)" name="description" defaultValue={editing?.description} placeholder="Responsabilidades do setor" maxLength={180} />
        </Modal>
      )}
    </div>
  );
}

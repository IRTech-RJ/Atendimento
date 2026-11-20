import { Mail, Pencil, Plus, UserRoundCog } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { FormField, SelectField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageHeading } from "../components/PageHeading";
import { StatusPill } from "../components/StatusPill";
import type { Company, Department, UserRole, WorkspaceUser } from "../types/workspace";

interface UsersPageProps {
  users: WorkspaceUser[];
  companies: Company[];
  departments: Department[];
  companyId?: string;
  onSave: (user: WorkspaceUser) => void;
  onToggleStatus: (id: string) => void;
}

export function UsersPage({ users, companies, departments, companyId, onSave, onToggleStatus }: UsersPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceUser | null>(null);
  const [selectedCompany, setSelectedCompany] = useState(companyId ?? companies[0]?.id ?? "");
  const scopedCompanyId = companyId ?? selectedCompany;
  const scopedUsers = useMemo(() => users.filter((user) => user.companyId === scopedCompanyId), [users, scopedCompanyId]);
  const scopedDepartments = departments.filter((department) => department.companyId === scopedCompanyId && department.status === "Ativo");
  const companyName = companies.find((company) => company.id === scopedCompanyId)?.name ?? "Empresa";

  function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const formCompanyId = editing?.companyId ?? companyId ?? selectedCompany;
    onSave({
      id: editing?.id ?? crypto.randomUUID(),
      companyId: formCompanyId,
      name: String(formData.get("name")).trim(),
      email: String(formData.get("email")).trim().toLowerCase(),
      role: String(formData.get("role")) as UserRole,
      departmentId: String(formData.get("departmentId")),
      status: editing?.status ?? "Ativo",
    });
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <PageHeading
        eyebrow={companyId ? "Espaço da empresa" : "Administração"}
        title="Usuários"
        description={companyId ? `Visualize a equipe de ${companyName}.` : "Organize as pessoas e os papéis de acesso de cada empresa."}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus className="size-4" />
            Cadastrar usuário
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-800">
          <UserRoundCog className="size-4 text-slate-400" />
          Equipe · {scopedUsers.length}
        </div>
        <div className="divide-y divide-slate-100">
          {scopedUsers.map((user) => {
            const department = departments.find((item) => item.id === user.departmentId);
            return (
              <article key={user.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-slate-900">{user.name}</h2>
                    <StatusPill status={user.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail className="size-3.5" />{user.email}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm sm:justify-end">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{user.role}</span>
                  {department && <span className="hidden text-slate-500 md:inline">{department.name}</span>}
                  <button
                    onClick={() => {
                      setEditing(user);
                      setModalOpen(true);
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    aria-label={`Editar ${user.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleStatus(user.id)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {user.status === "Ativo" ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </article>
            );
          })}
          {scopedUsers.length === 0 && <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhum usuário cadastrado.</p>}
        </div>
      </section>

      {modalOpen && (
        <Modal
          title={editing ? "Editar usuário" : "Cadastrar usuário"}
          description="Demonstração local: não cria credenciais nem acesso ao sistema."
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSubmit={submitUser}
          submitLabel={editing ? "Salvar demonstração" : "Adicionar à demonstração"}
        >
          <FormField label="Nome" name="name" defaultValue={editing?.name} required maxLength={120} />
          <FormField label="E-mail" name="email" type="email" defaultValue={editing?.email} required maxLength={160} />
          <SelectField label="Papel" name="role" defaultValue={editing?.role ?? "Atendente"}>
            <option>Administrador</option>
            <option>Supervisor</option>
            <option>Atendente</option>
          </SelectField>
          <SelectField label="Setor" name="departmentId" defaultValue={editing?.departmentId} required>
            {scopedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </SelectField>
        </Modal>
      )}
    </div>
  );
}

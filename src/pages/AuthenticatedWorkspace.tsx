import { Building2, Layers3, LoaderCircle, MessageCircle, Plus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { WorkspaceLayout } from "../layouts/WorkspaceLayout";
import { apiRequest, type AuthenticatedUser } from "../services/auth";
import type { AdminSection, CompanySection } from "../types/workspace";

interface CompanyRecord {
  id: string;
  name: string;
  slug: string;
  segment: string;
  city: string;
  status: "active" | "blocked";
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface DepartmentRecord {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface WhatsAppAccountRecord {
  tenant_id: string;
  phone_number_id: string;
  verify_token: string;
  default_department_id: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface AuthenticatedWorkspaceProps {
  user: AuthenticatedUser;
  onLogout: () => void;
}

export function AuthenticatedWorkspace({ user, onLogout }: AuthenticatedWorkspaceProps) {
  const isPlatformAdmin = user.role === "platform_admin";
  const mode = isPlatformAdmin ? "admin" : "company";
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [companySection, setCompanySection] = useState<CompanySection>("overview");
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [whatsappAccount, setWhatsappAccount] = useState<WhatsAppAccountRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const section = isPlatformAdmin ? adminSection : companySection;
  const tenantId = isPlatformAdmin ? selectedCompanyId : user.tenantId ?? "";
  const companyName = isPlatformAdmin
    ? companies.find((company) => company.id === tenantId)?.name
    : user.company?.name;
  const tenantPath = tenantId ? `/api/tenants/${tenantId}` : "";

  function navigate(nextSection: AdminSection | CompanySection) {
    if (isPlatformAdmin) setAdminSection(nextSection as AdminSection);
    else setCompanySection(nextSection as CompanySection);
    setError("");
    setNotice("");
  }

  useEffect(() => {
    if (!isPlatformAdmin) return;
    let active = true;
    apiRequest<{ companies: CompanyRecord[] }>("/api/admin/companies")
      .then(({ companies: records }) => {
        if (!active) return;
        setCompanies(records);
        setSelectedCompanyId((current) => current || records[0]?.id || "");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as empresas.");
      });
    return () => {
      active = false;
    };
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (section !== "users" && section !== "departments" && section !== "whatsapp") return;
    if (!tenantPath) return;
    let active = true;
    setLoading(true);
    setError("");
    const request = section === "users"
      ? Promise.all([
          apiRequest<{ users: UserRecord[] }>(`${tenantPath}/users`),
          apiRequest<{ departments: DepartmentRecord[] }>(`${tenantPath}/departments`),
        ]).then(([userResult, departmentResult]) => {
          if (active) {
            setUsers(userResult.users);
            setDepartments(departmentResult.departments);
          }
        })
      : section === "whatsapp"
        ? Promise.all([
            apiRequest<{ departments: DepartmentRecord[] }>(`${tenantPath}/departments`),
            apiRequest<{ account: WhatsAppAccountRecord | null }>(`${tenantPath}/whatsapp`),
          ]).then(([departmentResult, accountResult]) => {
            if (active) {
              setDepartments(departmentResult.departments);
              setWhatsappAccount(accountResult.account);
            }
          })
        : apiRequest<{ departments: DepartmentRecord[] }>(`${tenantPath}/departments`).then((result) => {
            if (active) setDepartments(result.departments);
          });
    request
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, section, tenantPath]);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    setNotice("");
    try {
      await apiRequest("/api/admin/companies", {
        method: "POST",
        body: {
          name: values.get("name"),
          slug: values.get("slug") || undefined,
          segment: values.get("segment"),
          city: values.get("city"),
        },
      });
      form.reset();
      setNotice("Empresa cadastrada no banco de dados.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar a empresa.");
    }
  }

  async function setCompanyStatus(company: CompanyRecord) {
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/admin/companies/${company.id}`, {
        method: "PATCH",
        body: { status: company.status === "active" ? "blocked" : "active" },
      });
      setNotice("Situação da empresa atualizada.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a empresa.");
    }
  }

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    setNotice("");
    try {
      await apiRequest(`${tenantPath}/departments`, {
        method: "POST",
        body: { name: values.get("name"), description: values.get("description") },
      });
      form.reset();
      setNotice("Setor cadastrado no banco de dados.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o setor.");
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const departmentIds = values.getAll("departmentIds").map(String);
    const role = String(values.get("role"));
    setError("");
    setNotice("");
    try {
      await apiRequest(`${tenantPath}/users`, {
        method: "POST",
        body: {
          name: values.get("name"),
          email: values.get("email"),
          password: values.get("password"),
          role,
          departments: departmentIds.map((departmentId) => ({
            departmentId,
            canViewConversations: true,
            canReply: role === "agent",
          })),
        },
      });
      form.reset();
      setNotice("Usuário criado. A senha foi armazenada somente como hash.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o usuário.");
    }
  }

  async function saveWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantPath) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    setNotice("");
    try {
      await apiRequest(`${tenantPath}/whatsapp`, {
        method: "PUT",
        body: {
          phoneNumberId: values.get("phoneNumberId"),
          accessToken: values.get("accessToken"),
          verifyToken: values.get("verifyToken"),
          defaultDepartmentId: values.get("defaultDepartmentId"),
          enabled: true,
        },
      });
      form.reset();
      setNotice("Configuração WhatsApp salva. Configure o webhook na Meta.");
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a integração.");
    }
  }

  async function removeWhatsApp() {
    if (!tenantPath) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`${tenantPath}/whatsapp`, { method: "DELETE" });
      setWhatsappAccount(null);
      setNotice("Integração WhatsApp removida.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover a integração.");
    }
  }

  const selectedSection = isPlatformAdmin ? adminSection : companySection;
  const heading = selectedSection === "overview"
    ? isPlatformAdmin ? "Painel IR Tech" : `Olá, ${companyName ?? "empresa"}`
    : selectedSection === "companies" ? "Empresas"
      : selectedSection === "users" ? "Usuários"
        : selectedSection === "whatsapp" ? "WhatsApp Cloud API"
          : "Setores";

  return (
    <WorkspaceLayout
      mode={mode}
      role={user.role}
      section={section}
      onNavigate={navigate}
      onLogout={onLogout}
      companyName={companyName}
      showDemoNotice={false}
    >
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
          {isPlatformAdmin ? "Administração IR Tech" : "Ambiente da empresa"}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{heading}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sessão autenticada como {user.name} · perfil {user.role}
            </p>
          </div>
          {(selectedSection === "users" || selectedSection === "departments") && isPlatformAdmin && (
            <label className="block text-sm font-medium text-slate-700 sm:w-72">
              Empresa
              <select
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
          )}
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {loading && <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Carregando dados do D1…</p>}

        {selectedSection === "overview" && (
          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-800">
                {isPlatformAdmin ? <Building2 className="size-5" /> : <Users className="size-5" />}
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Banco de dados conectado</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Esta sessão é verificada no backend. As consultas e permissões são aplicadas no Worker
                  e os registros pertencem ao tenant associado à sua conta.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {isPlatformAdmin && <QuickAction icon={<Building2 className="size-4" />} label="Empresas" onClick={() => navigate("companies")} />}
              <QuickAction icon={<Users className="size-4" />} label="Usuários" onClick={() => navigate("users")} />
              <QuickAction icon={<Layers3 className="size-4" />} label="Setores" onClick={() => navigate("departments")} />
                {!isPlatformAdmin && user.role === "company_admin" && <QuickAction icon={<MessageCircle className="size-4" />} label="WhatsApp" onClick={() => navigate("whatsapp")} />}
            </div>
          </section>
        )}

        {selectedSection === "companies" && isPlatformAdmin && (
          <section className="mt-7 space-y-5">
            <form onSubmit={createCompany} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
              <h2 className="sm:col-span-2 font-semibold text-slate-900">Cadastrar empresa</h2>
              <input name="name" required maxLength={120} placeholder="Nome da empresa" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="slug" maxLength={80} placeholder="Identificador (opcional)" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="segment" required maxLength={80} placeholder="Segmento" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="city" required maxLength={100} placeholder="Cidade / UF" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start">
                <Plus className="size-4" />Salvar empresa
              </button>
            </form>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {companies.map((company) => (
                <article key={company.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-slate-900">{company.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{company.slug} · {company.segment} · {company.city}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{company.status === "active" ? "Ativa" : "Bloqueada"}</span>
                  <button onClick={() => void setCompanyStatus(company)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">
                    {company.status === "active" ? "Bloquear" : "Reativar"}
                  </button>
                </article>
              ))}
              {companies.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma empresa cadastrada.</p>}
            </div>
          </section>
        )}

        {selectedSection === "users" && (
          <section className="mt-7 space-y-5">
            {isPlatformAdmin && !tenantId && <p className="text-sm text-slate-500">Selecione uma empresa para gerenciar usuários.</p>}
            {tenantId && (
              <>
                <form onSubmit={createUser} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
                  <h2 className="sm:col-span-2 font-semibold text-slate-900">Cadastrar usuário</h2>
                  <input name="name" required maxLength={120} placeholder="Nome" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <input name="email" type="email" required maxLength={254} placeholder="E-mail" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <input name="password" type="password" required minLength={12} maxLength={128} placeholder="Senha (mínimo 12 caracteres)" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <select name="role" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    <option value="agent">Atendente</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="company_admin">Administrador da empresa</option>
                  </select>
                  <label className="text-sm text-slate-600 sm:col-span-2">Setores
                    <select name="departmentIds" multiple className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                    <span className="mt-1 block text-xs text-slate-400">Use Ctrl para selecionar mais de um setor.</span>
                  </label>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start">
                    <Plus className="size-4" />Criar usuário
                  </button>
                </form>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {users.map((record) => (
                    <article key={record.id} className="flex items-center gap-3 px-5 py-4">
                      <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {record.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{record.name}</p><p className="text-xs text-slate-500">{record.email}</p></div>
                      <span className="text-xs text-slate-500">{record.role} · {record.status}</span>
                    </article>
                  ))}
                  {users.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum usuário cadastrado.</p>}
                </div>
              </>
            )}
          </section>
        )}

        {selectedSection === "departments" && (
          <section className="mt-7 space-y-5">
            {isPlatformAdmin && !tenantId && <p className="text-sm text-slate-500">Selecione uma empresa para gerenciar setores.</p>}
            {tenantId && (
              <>
                <form onSubmit={createDepartment} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row">
                  <input name="name" required maxLength={80} placeholder="Nome do setor" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <input name="description" maxLength={500} placeholder="Descrição" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />Adicionar</button>
                </form>
                <div className="grid gap-3 sm:grid-cols-2">
                  {departments.map((department) => (
                    <article key={department.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="font-medium text-slate-900">{department.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{department.description || "Sem descrição"}</p>
                    </article>
                  ))}
                  {departments.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum setor cadastrado.</p>}
                </div>
              </>
            )}
          </section>
        )}

        {selectedSection === "whatsapp" && !isPlatformAdmin && user.role === "company_admin" && (
          <section className="mt-7 space-y-5">
            {tenantId && (
              <>
                <form onSubmit={saveWhatsApp} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <h2 className="font-semibold text-slate-900">Conectar WhatsApp Cloud API</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Use credenciais fornecidas pela Meta. O access token é criptografado no servidor.
                    </p>
                  </div>
                  <input name="phoneNumberId" required maxLength={100} defaultValue={whatsappAccount?.phone_number_id ?? ""} placeholder="Phone Number ID" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <input name="accessToken" type="password" required maxLength={1000} placeholder="Access token permanente ou temporário" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <input name="verifyToken" required maxLength={200} defaultValue={whatsappAccount?.verify_token ?? ""} placeholder="Verify token do webhook" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                  <select name="defaultDepartmentId" required defaultValue={whatsappAccount?.default_department_id ?? ""} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    <option value="" disabled>Setor padrão para novas conversas</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start">
                    <MessageCircle className="size-4" />Salvar integração
                  </button>
                </form>

                {whatsappAccount && (
                  <article className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-950">Configuração cadastrada</p>
                      <p className="mt-1 text-sm text-emerald-800">
                        Phone Number ID: {whatsappAccount.phone_number_id}
                      </p>
                      <p className="mt-2 text-xs text-emerald-700">
                        Webhook: HTTPS público + `/api/webhooks/whatsapp`
                      </p>
                    </div>
                    <button onClick={() => void removeWhatsApp()} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800">
                      Remover
                    </button>
                  </article>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </WorkspaceLayout>
  );
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
      {icon}{label}
    </button>
  );
}

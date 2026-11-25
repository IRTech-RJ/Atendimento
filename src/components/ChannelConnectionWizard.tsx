import { ArrowLeft, ArrowRight, Check, CircleCheck, ExternalLink, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "../services/auth";

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface WhatsAppChannelAccount {
  display_name: string;
  phone_number_id: string;
  default_department_id: string;
  enabled: number;
}

interface ChannelConnectionWizardProps {
  tenantPath: string;
  departments: DepartmentOption[];
  whatsappAccount: WhatsAppChannelAccount | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const steps = ["Nome", "Conectar", "Webhooks"];

const inputClassName =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

export function ChannelConnectionWizard({
  tenantPath,
  departments,
  whatsappAccount,
  onClose,
  onSaved,
}: ChannelConnectionWizardProps) {
  const existingAccount = whatsappAccount;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    displayName: existingAccount?.display_name ?? "WhatsApp da empresa",
    phoneNumberId: whatsappAccount?.phone_number_id ?? "",
    accessToken: "",
    verifyToken: "",
    defaultDepartmentId: existingAccount?.default_department_id ?? departments[0]?.id ?? "",
  }));
  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function continueToNextStep() {
    setError("");
    if (step === 0 && !form.displayName.trim()) {
      setError("Informe um nome para esta conexão.");
      return;
    }
    if (step === 1) {
      const missingWhatsAppCredential =
        !form.phoneNumberId.trim() ||
        (!existingAccount && (!form.verifyToken.trim() || !form.accessToken.trim()));
      if (missingWhatsAppCredential) {
        setError(existingAccount
          ? "Informe o Phone Number ID."
          : "Preencha o Phone Number ID, o access token e o verify token.");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function copyWebhookUrl() {
    setError("");
    try {
      await navigator.clipboard.writeText(webhookUrl);
    } catch {
      setError("Não foi possível copiar o endereço. Selecione e copie o texto manualmente.");
    }
  }

  async function saveConnection() {
    setError("");
    if (!form.displayName.trim()) {
      setError("Informe um nome para esta conexão.");
      setStep(0);
      return;
    }
    if (!form.defaultDepartmentId) {
      setError("Cadastre ou selecione um setor antes de continuar.");
      return;
    }

    setSaving(true);
    try {
      if (existingAccount) {
        await apiRequest(`${tenantPath}/whatsapp`, {
          method: "PATCH",
          body: {
            displayName: form.displayName.trim(),
            defaultDepartmentId: form.defaultDepartmentId,
            phoneNumberId: form.phoneNumberId.trim(),
            verifyToken: form.verifyToken.trim() || undefined,
            accessToken: form.accessToken,
          },
        });
      } else {
        await apiRequest(`${tenantPath}/whatsapp`, {
          method: "PUT",
          body: {
            displayName: form.displayName.trim(),
            phoneNumberId: form.phoneNumberId.trim(),
            accessToken: form.accessToken,
            verifyToken: form.verifyToken.trim(),
            defaultDepartmentId: form.defaultDepartmentId,
            enabled: true,
          },
        });
      }
      onSaved("Conexão salva. Configure ou confirme o webhook no painel da Meta.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a conexão.");
    } finally {
      setSaving(false);
    }
  }

  const title = "Meta Cloud API (WhatsApp)";
  const Icon = MessageCircle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-wizard-title"
        className="grid h-full max-h-[760px] w-full max-w-5xl grid-rows-[auto_1fr_auto] overflow-hidden bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="channel-wizard-title" className="truncate font-semibold text-slate-950">
                Conectar {title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">3 etapas para ativar o canal</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Fechar configuração"
            disabled={saving}
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 md:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden border-r border-slate-200 bg-slate-50 px-6 py-7 md:block">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Configuração
            </p>
            <ol className="space-y-5">
              {steps.map((label, index) => {
                const complete = index < step || (index === 0 && Boolean(existingAccount));
                const active = index === step;
                return (
                  <li key={label} className="flex items-start gap-3">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium ${
                      complete
                        ? "border-slate-900 bg-slate-900 text-white"
                        : active
                          ? "border-slate-900 bg-white text-slate-900"
                          : "border-slate-300 bg-transparent text-slate-400"
                    }`}>
                      {complete ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className="pt-0.5">
                      <span className={`block text-sm font-medium ${active || complete ? "text-slate-900" : "text-slate-400"}`}>
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {complete ? "concluído" : active ? "em andamento" : "pendente"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>

          <main className="min-h-0 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center gap-2 md:hidden" aria-label={`Etapa ${step + 1} de 3`}>
              {steps.map((label, index) => (
                <span key={label} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-teal-600" : "bg-slate-200"}`} />
              ))}
              <span className="ml-1 shrink-0 text-xs text-slate-500">{step + 1}/3</span>
            </div>

            {step === 0 && (
              <div className="max-w-xl">
                <h3 className="text-lg font-semibold text-slate-950">Dê um nome à conexão</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use um nome fácil de reconhecer pela equipe. Você poderá alterá-lo depois.
                </p>
                <label className="mt-7 block text-sm font-medium text-slate-700">
                  Nome do canal
                  <input
                    autoFocus
                    value={form.displayName}
                    onChange={(event) => updateForm("displayName", event.target.value)}
                    maxLength={80}
                    placeholder="WhatsApp da empresa"
                    className={inputClassName}
                  />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-slate-950">Vincule o canal</h3>
                {existingAccount ? (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <div className="text-sm text-emerald-950">
                      <p className="font-medium">Canal já autenticado</p>
                      <p className="mt-1 text-emerald-800">
                        Phone Number ID: {whatsappAccount?.phone_number_id ?? ""}
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        As credenciais ficam protegidas no servidor e não são exibidas novamente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Informe os dados da sua aplicação WhatsApp na Meta. O token será criptografado no servidor.
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700">
                        Phone Number ID
                        <input
                          value={form.phoneNumberId}
                          onChange={(event) => updateForm("phoneNumberId", event.target.value)}
                          maxLength={100}
                          autoComplete="off"
                          className={inputClassName}
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Verify token do webhook
                        <input
                          value={form.verifyToken}
                          onChange={(event) => updateForm("verifyToken", event.target.value)}
                          maxLength={200}
                          autoComplete="off"
                          className={inputClassName}
                        />
                        {existingAccount && (
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            Opcional. Deixe em branco para manter o token atual.
                          </span>
                        )}
                      </label>
                      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                        Access token da Meta
                        <input
                          type="password"
                          value={form.accessToken}
                          onChange={(event) => updateForm("accessToken", event.target.value)}
                          maxLength={1000}
                          autoComplete="new-password"
                          className={inputClassName}
                        />
                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          {existingAccount ? "Opcional. Informe apenas para substituir o token atual." : "Use um token válido para a WhatsApp Cloud API."}
                        </span>
                      </label>
                    </div>
                    <a
                      className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-teal-800 hover:text-teal-950"
                      href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Requisitos de integração da Meta <ExternalLink className="size-4" />
                    </a>
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-slate-950">Configure o recebimento</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  As novas conversas deste canal serão direcionadas para o setor escolhido.
                </p>
                <label className="mt-6 block text-sm font-medium text-slate-700">
                  Setor padrão
                  <select
                    value={form.defaultDepartmentId}
                    onChange={(event) => updateForm("defaultDepartmentId", event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Selecione um setor</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </label>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Endereço do webhook</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <code className="min-w-0 flex-1 break-all rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                      {webhookUrl}
                    </code>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      onClick={() => void copyWebhookUrl()}
                    >
                      Copiar URL
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Na Meta, configure este callback e o verify token informado na etapa anterior; assine o evento messages.
                  </p>
                </div>

                {!departments.length && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    Cadastre pelo menos um setor antes de ativar um canal.
                  </p>
                )}
              </div>
            )}

            {error && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          </main>
        </div>

        <footer className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-800">{form.displayName || title}</span>
              <span className="block truncate">{existingAccount ? "Conexão existente · pode ser editada" : "As credenciais só serão salvas ao ativar"}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="mr-auto px-2 py-2 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline sm:mr-2" onClick={onClose} disabled={saving}>
              Fechar por enquanto
            </button>
            {step > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setError("");
                  setStep((current) => Math.max(current - 1, 0));
                }}
                disabled={saving}
              >
                <ArrowLeft className="size-4" />Voltar
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                onClick={continueToNextStep}
              >
                Continuar <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void saveConnection()}
                disabled={saving || !departments.length}
              >
                {saving ? "Salvando..." : existingAccount ? "Salvar alterações" : "Ativar canal"}
                {!saving && <ArrowRight className="size-4" />}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

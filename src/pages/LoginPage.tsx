import { ArrowRight, Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { BrandMark } from "../components/BrandMark";
import { DemoNotice } from "../components/DemoNotice";
import { apiRequest } from "../services/auth";
import type { WorkspaceMode } from "../types/workspace";

interface LoginPageProps {
  onLogin: (credentials: { workspace: string; email: string; password: string }) => Promise<void>;
  onBootstrap: (details: { key: string; name: string; email: string; password: string }) => Promise<void>;
  onEnterDemo: (mode: WorkspaceMode) => void;
  startupError: string;
}

export function LoginPage({ onLogin, onBootstrap, onEnterDemo, startupError }: LoginPageProps) {
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [bootstrapNeedsKey, setBootstrapNeedsKey] = useState(false);
  const [screen, setScreen] = useState<"login" | "bootstrap">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<{ bootstrapRequired: boolean; bootstrapEnabled: boolean }>("/api/setup/status")
      .then(({ bootstrapRequired, bootstrapEnabled }) => {
        if (active) {
          setBootstrapAvailable(bootstrapRequired && bootstrapEnabled);
          setBootstrapNeedsKey(bootstrapRequired && !bootstrapEnabled);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar a configuração.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onLogin({
        workspace: String(form.get("workspace")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onBootstrap({
        key: String(form.get("key")),
        name: String(form.get("name")),
        email: String(form.get("email")),
        password,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o administrador inicial.");
    } finally {
      setBusy(false);
    }
  }

  const formClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10";

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#101b2c] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-36 -top-32 size-[520px] rounded-full border border-white/[0.06]" />
        <div className="absolute -right-8 -top-4 size-[360px] rounded-full border border-white/[0.08]" />
        <div className="absolute -bottom-40 -left-36 size-[500px] rounded-full bg-teal-400/[0.07] blur-3xl" />
        <BrandMark />
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">Atendimento que aproxima</p>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">
            Conversas melhores.
            <br />
            <span className="text-teal-300">Relacionamentos</span>
            <br />
            mais fortes.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
            Uma plataforma de atendimento pensada para conectar empresas e pessoas, com clareza,
            cuidado e tecnologia.
          </p>
          <div className="mt-12 flex items-center gap-3 text-sm text-slate-400">
            <ShieldCheck className="size-5 text-teal-300" />
            Uma solução IR Tech, feita para crescer com você
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">Soluções inteligentes em tecnologia.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 lg:hidden">
            <div className="mb-8 inline-flex rounded-xl bg-[#101b2c] p-2.5">
              <BrandMark />
            </div>
            <p className="text-sm text-slate-500">Soluções inteligentes em tecnologia.</p>
          </div>
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              {screen === "login" ? "Acesso à plataforma" : "Configuração inicial"}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              {screen === "login" ? "Bem-vindo(a)" : "Criar administrador"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {screen === "login"
                ? "Entre no seu espaço de atendimento para continuar."
                : "Este cadastro só pode ser realizado uma vez e exige a chave local de configuração."}
            </p>
          </div>

          {startupError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{startupError}</p>}
          {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}

          {screen === "login" ? (
            <form className="space-y-4" onSubmit={submitLogin}>
              <label className="block text-sm font-medium text-slate-700">
                Espaço de trabalho
                <input name="workspace" defaultValue="ir-tech" required maxLength={80} className={formClass} />
                <span className="mt-1 block text-xs font-normal text-slate-400">Use <code>ir-tech</code> para administração ou o identificador da empresa.</span>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                E-mail
                <input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="voce@empresa.com.br" className={formClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Senha
                <span className="relative mt-1.5 block">
                  <input name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Sua senha" className={formClass} />
                  <LockKeyhole className="absolute right-3.5 top-3 size-4 text-slate-400" />
                </span>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Verificando..." : "Entrar"}
              </button>
              {bootstrapNeedsKey && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  Para criar o primeiro administrador, configure <code>BOOTSTRAP_ADMIN_KEY</code> em <code>.dev.vars</code> e reinicie o servidor local.
                </p>
              )}
              {bootstrapAvailable && (
                <button type="button" onClick={() => { setError(""); setScreen("bootstrap"); }} className="w-full py-2 text-sm font-medium text-teal-800 hover:text-teal-950">
                  Configurar o primeiro administrador
                </button>
              )}
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitBootstrap}>
              <label className="block text-sm font-medium text-slate-700">Chave de configuração
                <input name="key" type="password" autoComplete="off" required maxLength={512} className={formClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Nome
                <input name="name" required maxLength={120} className={formClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">E-mail
                <input name="email" type="email" autoComplete="username" required maxLength={254} className={formClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Senha (mínimo 12 caracteres)
                <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={formClass} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Confirme a senha
                <input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={formClass} />
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Configurando..." : "Criar administrador"}
              </button>
              <button type="button" onClick={() => { setError(""); setScreen("login"); }} className="w-full py-2 text-sm text-slate-500">
                Voltar para o login
              </button>
            </form>
          )}

          {import.meta.env.DEV && (
            <>
              <div className="my-7 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>VISUALIZAR DEMONSTRAÇÃO</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => onEnterDemo("admin")}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-500 hover:bg-teal-50/50"
                >
                  <span><span className="block text-sm font-semibold text-slate-800">Painel demonstrativo</span><span className="mt-1 block text-xs text-slate-500">Visão administrativa</span></span>
                  <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
                </button>
                <button
                  onClick={() => onEnterDemo("company")}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-500 hover:bg-teal-50/50"
                >
                  <span><span className="block text-sm font-semibold text-slate-800">Empresa demonstrativa</span><span className="mt-1 block text-xs text-slate-500">Painel fictício</span></span>
                  <Building2 className="size-4 text-slate-400 transition group-hover:text-teal-700" />
                </button>
              </div>
              <div className="mt-5"><DemoNotice /></div>
            </>
          )}
          <p className="mt-8 text-center text-xs text-slate-400">IR Tech Atendimento · {new Date().getFullYear()}</p>
        </div>
      </section>
    </main>
  );
}

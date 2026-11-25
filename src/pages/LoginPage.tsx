import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
  const [passwordVisible, setPasswordVisible] = useState(false);

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

  const formClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";

  return (
    <main className="min-h-screen bg-[#f3f6f7] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(500px,0.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#101b2c] px-10 py-9 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-44 size-[620px] rounded-full border border-teal-200/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-16 size-[360px] rounded-full border border-teal-200/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 size-[520px] rounded-full bg-teal-400/[0.09] blur-3xl" />
        <header className="relative z-10 flex items-center justify-between">
          <BrandMark />
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium tracking-wide text-slate-300">
            PLATAFORMA DE ATENDIMENTO
          </span>
        </header>

        <div className="relative z-10 grid items-center gap-10 xl:grid-cols-[1fr_0.8fr]">
          <div className="max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/[0.08] px-3 py-1.5 text-xs font-medium text-teal-200">
              <Sparkles className="size-3.5" /> Atendimento humano, organizado por tecnologia
            </p>
            <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[3.4rem]">
              Toda conversa pode virar
              <span className="mt-1 block text-teal-300">uma boa experiência.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300/75">
              Uma central clara para sua equipe acolher, acompanhar e resolver cada atendimento.
              Sem perder o contexto, nem a proximidade.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-200">
                <MessageCircle className="size-4 text-teal-300" /> WhatsApp
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-200">
                <Send className="size-4 text-sky-300" /> Telegram
              </span>
            </div>
          </div>

          <div className="relative hidden xl:block" aria-hidden="true">
            <div className="rounded-2xl border border-white/10 bg-[#17243a]/90 p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-teal-300/15 text-sm font-semibold text-teal-200">AC</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Atendimento organizado</p>
                    <p className="mt-0.5 text-xs text-slate-400">Visão da equipe</p>
                  </div>
                </div>
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-3 py-5">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3 text-xs leading-5 text-slate-200">
                  Olá! Preciso de ajuda com meu atendimento.
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-teal-300 px-4 py-3 text-xs leading-5 text-slate-950">
                  Oi! Já vou verificar isso para você.
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-400">
                <Check className="size-4 text-teal-300" /> Conversa acompanhada do início à resolução
              </div>
            </div>
            <div className="absolute -bottom-5 -left-7 rounded-xl border border-white/10 bg-[#1a2a41] px-4 py-3 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <ShieldCheck className="size-4 text-teal-300" /> Acesso seguro por empresa
              </div>
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <span>IR Tech · Soluções inteligentes em tecnologia</span>
          <span>Atendimento feito para pessoas.</span>
        </footer>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-[500px]">
          <div className="mb-7 lg:hidden">
            <div className="inline-flex rounded-2xl bg-[#101b2c] px-4 py-3 shadow-lg shadow-slate-900/10">
              <BrandMark />
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.28)] sm:p-9">
            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                {screen === "login" ? "Seu espaço de atendimento" : "Configuração segura"}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                {screen === "login" ? "Que bom ter você de volta." : "Prepare seu ambiente."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {screen === "login"
                  ? "Acesse sua conta para acompanhar as conversas da equipe."
                  : "Crie o administrador inicial. Esta etapa só pode ser concluída uma vez."}
              </p>
            </div>

            {startupError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{startupError}</p>}
            {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{error}</p>}

            {screen === "login" ? (
              <form className="space-y-4" onSubmit={submitLogin}>
                <label className="block text-sm font-medium text-slate-700">
                  Espaço de trabalho
                  <span className="relative mt-1.5 block">
                    <Building2 className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
                    <input name="workspace" defaultValue="ir-tech" required maxLength={80} className={`${formClass} pl-10`} />
                  </span>
                  <span className="mt-1.5 block text-xs font-normal text-slate-400">
                    Administração: <code className="rounded bg-slate-100 px-1 py-0.5">ir-tech</code>. Empresas usam seu identificador.
                  </span>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  E-mail corporativo
                  <input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="voce@empresa.com.br" className={formClass} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Senha
                  <span className="relative mt-1.5 block">
                    <LockKeyhole className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
                    <input
                      name="password"
                      type={passwordVisible ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      maxLength={128}
                      placeholder="Digite sua senha"
                      className={`${formClass} pl-10 pr-12`}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1.5 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => setPasswordVisible((visible) => !visible)}
                      aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Verificando acesso..." : "Entrar no atendimento"}
                  {!busy && <ArrowRight className="size-4" />}
                </button>
                {bootstrapNeedsKey && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900">
                    Para criar o administrador inicial, habilite <code>BOOTSTRAP_ADMIN_KEY</code> no ambiente de execução.
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
                <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                  {busy ? "Configurando..." : "Criar administrador"} {!busy && <ArrowRight className="size-4" />}
                </button>
                <button type="button" onClick={() => { setError(""); setScreen("login"); }} className="w-full py-2 text-sm text-slate-500 hover:text-slate-800">
                  Voltar para o login
                </button>
              </form>
            )}

            {import.meta.env.DEV && (
              <>
                <div className="my-7 flex items-center gap-3 text-[10px] font-semibold tracking-[0.14em] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  DEMONSTRAÇÃO LOCAL
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onEnterDemo("admin")}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-teal-500 hover:bg-teal-50/50"
                  >
                    <span><span className="block text-sm font-semibold text-slate-800">Painel admin</span><span className="mt-1 block text-xs text-slate-500">Dados demonstrativos</span></span>
                    <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterDemo("company")}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-teal-500 hover:bg-teal-50/50"
                  >
                    <span><span className="block text-sm font-semibold text-slate-800">Visão da empresa</span><span className="mt-1 block text-xs text-slate-500">Ambiente demonstrativo</span></span>
                    <Building2 className="size-4 text-slate-400 transition group-hover:text-teal-700" />
                  </button>
                </div>
                <div className="mt-4"><DemoNotice /></div>
              </>
            )}
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">
            IR Tech Atendimento · Acesso protegido · {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </main>
  );
}

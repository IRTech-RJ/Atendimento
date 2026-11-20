import { ArrowRight, Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { DemoNotice } from "../components/DemoNotice";
import type { WorkspaceMode } from "../types/workspace";

interface LoginPageProps {
  onEnterDemo: (mode: WorkspaceMode) => void;
}

export function LoginPage({ onEnterDemo }: LoginPageProps) {
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Acesso à plataforma</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Bem-vindo(a)</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entre no seu espaço de atendimento para continuar.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              E-mail
              <input
                type="email"
                placeholder="voce@empresa.com.br"
                disabled
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500 outline-none placeholder:text-slate-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Senha
              <span className="relative mt-1.5 block">
                <input
                  type="password"
                  placeholder="Sua senha"
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500 outline-none placeholder:text-slate-400"
                />
                <LockKeyhole className="absolute right-3.5 top-3 size-4 text-slate-400" />
              </span>
            </label>
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-300 px-4 py-3 text-sm font-semibold text-white"
            >
              Acesso real ainda não configurado
            </button>
          </div>

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
              <span>
                <span className="block text-sm font-semibold text-slate-800">Painel IR Tech</span>
                <span className="mt-1 block text-xs text-slate-500">Visão administrativa</span>
              </span>
              <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
            </button>
            <button
              onClick={() => onEnterDemo("company")}
              className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-500 hover:bg-teal-50/50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-800">Espaço da empresa</span>
                <span className="mt-1 block text-xs text-slate-500">Painel do cliente</span>
              </span>
              <Building2 className="size-4 text-slate-400 transition group-hover:text-teal-700" />
            </button>
          </div>
          <div className="mt-5">
            <DemoNotice />
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">IR Tech Atendimento · {new Date().getFullYear()}</p>
        </div>
      </section>
    </main>
  );
}

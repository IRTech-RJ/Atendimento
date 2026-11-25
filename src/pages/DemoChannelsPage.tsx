import { MessageCircle, Send } from "lucide-react";

const channels = [
  {
    name: "WhatsApp Business",
    label: "Meta Coexistência",
    description: "Pareie o app WhatsApp Business pelo fluxo oficial da Meta.",
    icon: MessageCircle,
    iconClass: "bg-emerald-50 text-emerald-700",
    action: "Ver requisitos",
    available: true,
  },
  {
    name: "Meta Cloud API",
    label: "Disponível",
    description: "Conexão oficial para receber e responder mensagens do WhatsApp.",
    icon: MessageCircle,
    iconClass: "bg-sky-50 text-sky-700",
    action: "Configurar conexão",
    available: false,
  },
  {
    name: "Telegram Bot",
    label: "Em breve",
    description: "Estamos preparando o suporte a bots Telegram no atendimento.",
    icon: Send,
    iconClass: "bg-indigo-50 text-indigo-700",
    action: "Em breve",
    available: false,
  },
] as const;

export function DemoChannelsPage() {
  return (
    <section className="mt-7 space-y-5">
      <div className="max-w-3xl">
        <p className="text-sm leading-6 text-slate-500">
          Conecte os canais da sua empresa em um só lugar. Esta é uma demonstração; para ativar conexões reais, entre no ambiente da sua empresa.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {channels.map(({ name, label, description, icon: Icon, iconClass, action, available }) => (
          <article key={name} className="flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${iconClass}`}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-950">{name}</h2>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    label === "Em breve" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
              </div>
            </div>
            <div className="mt-5 flex-1 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
              {available
                ? "A configuração de produção depende do aplicativo próprio e da aprovação da Meta."
                : "As conexões reais são configuradas no ambiente autenticado da empresa."}
            </div>
            <button
              type="button"
              disabled
              className="mt-4 self-start cursor-not-allowed rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
            >
              {action}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

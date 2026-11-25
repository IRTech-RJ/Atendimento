import { CheckCircle2, MessageSquare, Search, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { PageHeading } from "../components/PageHeading";
import type { DemoConversation, DemoMessage } from "../types/workspace";

interface DemoConversationsPageProps {
  conversations: DemoConversation[];
}

export function DemoConversationsPage({ conversations }: DemoConversationsPageProps) {
  const [records, setRecords] = useState(conversations);
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"Todas" | "Aberta" | "Pendente" | "Resolvida">("Todas");

  const visible = useMemo(() => records.filter((conversation) => {
    const matchesFilter = filter === "Todas" || conversation.status === filter;
    const query = search.toLowerCase();
    const matchesSearch = !query ||
      conversation.contactName.toLowerCase().includes(query) ||
      conversation.subject.toLowerCase().includes(query) ||
      conversation.department.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [records, search, filter]);

  const selected = records.find((conversation) => conversation.id === selectedId) ?? visible[0] ?? null;

  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get("reply") ?? "").trim();
    if (!body) return;
    const message: DemoMessage = {
      id: `reply-${Date.now()}`,
      from: "agent",
      body,
      time: "Agora",
    };
    setRecords((current) => current.map((conversation) =>
      conversation.id === selected.id
        ? { ...conversation, messages: [...conversation.messages, message], lastTime: "Agora", unread: 0 }
        : conversation,
    ));
    form.reset();
  }

  function resolveConversation() {
    if (!selected) return;
    setRecords((current) => current.map((conversation) =>
      conversation.id === selected.id
        ? { ...conversation, status: "Resolvida", unread: 0 }
        : conversation,
    ));
  }

  return (
    <div>
      <PageHeading
        eyebrow="Atendimento"
        title="Conversas"
        description="Acompanhe, responda e organize todas as solicitações dos clientes."
      />
      <section className="grid min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 p-4">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar conversa"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
              />
            </label>
            <div className="mt-3 flex gap-1 overflow-x-auto">
              {(["Todas", "Aberta", "Pendente", "Resolvida"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    filter === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[510px] overflow-y-auto">
            {visible.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                  selected?.id === conversation.id ? "bg-teal-50/70" : "hover:bg-slate-50"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {conversation.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{conversation.contactName}</span>
                    <span className="text-[11px] text-slate-400">{conversation.lastTime}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.subject}</span>
                  <span className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{conversation.department}</span>
                    {conversation.unread > 0 && (
                      <span className="grid size-5 place-items-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                        {conversation.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
            {visible.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma conversa encontrada.</p>
            )}
          </div>
        </aside>

        {selected ? (
          <div className="flex min-h-[560px] flex-col">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                  {selected.initials}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{selected.contactName}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{selected.contactPhone} · {selected.department}</p>
                </div>
              </div>
              <button
                onClick={resolveConversation}
                disabled={selected.status === "Resolvida"}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 disabled:cursor-default disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                {selected.status === "Resolvida" ? "Resolvida" : "Resolver"}
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
              <div className="mx-auto max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-[11px] text-slate-400">
                Hoje
              </div>
              {selected.messages.map((message) => (
                <div key={message.id} className={`flex ${message.from === "agent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.from === "agent"
                      ? "rounded-br-md bg-slate-900 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                  }`}>
                    <p>{message.body}</p>
                    <p className={`mt-1 text-[10px] ${message.from === "agent" ? "text-slate-400" : "text-slate-400"}`}>
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={sendReply} className="border-t border-slate-100 p-4">
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 focus-within:border-teal-500">
                <textarea
                  name="reply"
                  rows={2}
                  placeholder="Escreva uma resposta..."
                  className="min-h-12 flex-1 resize-none px-2 py-2 text-sm outline-none"
                />
                <button className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white" aria-label="Enviar resposta">
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="grid min-h-[560px] place-items-center text-center text-sm text-slate-500">
            <div>
              <MessageSquare className="mx-auto size-8 text-slate-300" />
              <p className="mt-3">Selecione uma conversa.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

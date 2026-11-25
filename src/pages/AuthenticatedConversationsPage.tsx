import { ArrowLeft, CheckCheck, CircleCheck, LoaderCircle, MessageCircle, RefreshCw, Search, Send, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../services/auth";

interface ConversationRecord {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_provider: string;
  department_name: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  updated_at: string;
}

interface MessageRecord {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  body: string;
  provider: string;
  provider_status: string | null;
  created_at: string;
}

interface AuthenticatedConversationsPageProps {
  tenantPath: string;
}

const filters = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "pending", label: "Pendentes" },
  { value: "resolved", label: "Resolvidas" },
] as const;

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusLabel(status: ConversationRecord["status"]): string {
  if (status === "pending") return "Pendente";
  if (status === "resolved" || status === "closed") return "Resolvida";
  return "Aberta";
}

export function AuthenticatedConversationsPage({ tenantPath }: AuthenticatedConversationsPageProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileListVisible, setMobileListVisible] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadConversations() {
      try {
        const result = await apiRequest<{ conversations: ConversationRecord[] }>(`${tenantPath}/conversations`);
        if (!active) return;
        setConversations(result.conversations);
        setSelectedId((current) =>
          current && result.conversations.some((conversation) => conversation.id === current)
            ? current
            : result.conversations[0]?.id ?? "",
        );
        setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as conversas.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadConversations();
    const interval = window.setInterval(() => void loadConversations(), 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey, tenantPath]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    async function loadMessages() {
      try {
        const result = await apiRequest<{ messages: MessageRecord[] }>(
          `${tenantPath}/conversations/${selectedId}/messages`,
        );
        if (active) {
          setMessages(result.messages);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as mensagens.");
      }
    }

    void loadMessages();
    const interval = window.setInterval(() => void loadMessages(), 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey, selectedId, tenantPath]);

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return conversations.filter((conversation) => {
      const matchesFilter = filter === "all" ||
        (filter === "resolved"
          ? conversation.status === "resolved" || conversation.status === "closed"
          : conversation.status === filter);
      const matchesSearch = !query ||
        conversation.contact_name.toLocaleLowerCase("pt-BR").includes(query) ||
        conversation.subject.toLocaleLowerCase("pt-BR").includes(query) ||
        conversation.department_name.toLocaleLowerCase("pt-BR").includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [conversations, filter, search]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const latestMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestMessageId]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selected || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const result = await apiRequest<{ message: MessageRecord }>(
        `${tenantPath}/conversations/${selected.id}/messages`,
        { method: "POST", body: { direction: "outbound", body } },
      );
      setMessages((current) => [...current, result.message]);
      setDraft("");
      setRefreshKey((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a resposta.");
    } finally {
      setSending(false);
    }
  }

  async function resolveConversation() {
    if (!selected || selected.status === "resolved" || selected.status === "closed") return;
    setError("");
    try {
      await apiRequest(`${tenantPath}/conversations/${selected.id}`, {
        method: "PATCH",
        body: { status: "resolved" },
      });
      setRefreshKey((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a conversa.");
    }
  }

  const telegramConversation = selected?.contact_provider === "telegram";

  return (
    <section className="mt-7 space-y-4">
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`min-h-0 border-b border-slate-200 lg:flex lg:flex-col lg:border-b-0 lg:border-r ${mobileListVisible ? "flex flex-col" : "hidden"}`}>
          <div className="border-b border-slate-100 p-4">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar conversa"
                aria-label="Buscar conversa"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              />
            </label>
            <div className="mt-3 flex gap-1 overflow-x-auto">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={filter === item.value}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    filter === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setMobileListVisible(false);
                }}
                aria-current={selected?.id === conversation.id ? "true" : undefined}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                  selected?.id === conversation.id ? "bg-teal-50/70" : "hover:bg-slate-50"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold uppercase text-white">
                  {conversation.contact_name.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{conversation.contact_name}</span>
                    <span className="text-[11px] text-slate-400">{formatTime(conversation.updated_at)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.subject || "Nova conversa"}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-slate-400">{conversation.department_name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      conversation.status === "resolved" || conversation.status === "closed"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {statusLabel(conversation.status)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
            {!loading && visibleConversations.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma conversa encontrada.</p>
            )}
            {loading && (
              <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" />Carregando conversas…
              </p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            <span>{visibleConversations.length} conversas</span>
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-1.5 hover:text-slate-700">
              <RefreshCw className="size-3.5" />Atualizar
            </button>
          </div>
        </aside>

        {selected ? (
          <div className={`min-h-[620px] min-w-0 flex-col ${mobileListVisible ? "hidden lg:flex" : "flex"}`}>
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                  onClick={() => setMobileListVisible(true)}
                  aria-label="Voltar para a lista de conversas"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                  {selected.contact_name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">{selected.contact_name}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                    {telegramConversation ? <Send className="size-3.5 text-sky-600" /> : <MessageCircle className="size-3.5 text-emerald-600" />}
                    {telegramConversation ? "Telegram" : selected.contact_phone}
                    <span aria-hidden="true">·</span>{selected.department_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void resolveConversation()}
                disabled={selected.status === "resolved" || selected.status === "closed"}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
              >
                <CircleCheck className="size-4" />
                {selected.status === "resolved" || selected.status === "closed" ? "Resolvida" : "Resolver"}
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f7f9fa] px-4 py-5 sm:px-6">
              {messages.length === 0 && (
                <p className="mx-auto mt-8 max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500">
                  Esta conversa ainda não tem mensagens.
                </p>
              )}
              {messages.map((message) => {
                const outgoing = message.direction === "outbound";
                return (
                  <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                    <article className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      outgoing
                        ? "rounded-br-md bg-slate-900 text-white"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${outgoing ? "text-slate-400" : "text-slate-400"}`}>
                        {formatTime(message.created_at)}
                        {outgoing && <CheckCheck className="size-3" />}
                      </p>
                    </article>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(event) => void sendReply(event)} className="border-t border-slate-100 bg-white p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 transition focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/10">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  maxLength={telegramConversation ? 4096 : 10000}
                  placeholder="Escreva uma resposta…"
                  aria-label="Mensagem de resposta"
                  className="min-h-12 flex-1 resize-none px-2 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Enviar resposta"
                >
                  {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
              <p className="mt-2 text-right text-[10px] text-slate-400">{draft.length}/{telegramConversation ? 4096 : 10000}</p>
            </form>
          </div>
        ) : (
          <div className="hidden min-h-[620px] place-items-center text-center text-sm text-slate-500 lg:grid">
            <div>
              <Smartphone className="mx-auto size-9 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">Sua central de conversas</p>
              <p className="mt-1">Selecione uma conversa para ver o histórico e responder.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

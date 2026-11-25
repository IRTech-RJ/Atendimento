import { Mail, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "../components/PageHeading";
import type { DemoContact } from "../types/workspace";

export function DemoContactsPage({ contacts }: { contacts: DemoContact[] }) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const query = search.toLowerCase();
    return contacts.filter((contact) =>
      !query ||
      contact.name.toLowerCase().includes(query) ||
      contact.phone.includes(query) ||
      contact.email.toLowerCase().includes(query),
    );
  }, [contacts, search]);

  return (
    <div>
      <PageHeading eyebrow="CRM" title="Contatos" description="Clientes e histórico de relacionamento da empresa." />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500" />
          </label>
        </div>
        <div className="divide-y divide-slate-100">
          {visible.map((contact) => (
            <article key={contact.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                {contact.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-900">{contact.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{contact.phone} · {contact.city}</p>
              </div>
              <div className="min-w-52">
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Mail className="size-3.5" />{contact.email}</p>
                <p className="mt-1 text-[11px] text-slate-400">Último contato: {contact.lastContact}</p>
              </div>
              <div className="flex min-w-44 flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                    <Tag className="size-3" />{tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum contato encontrado.</p>}
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { data, giorniA } from "@/lib/format";
import { formattaTelefono } from "@/lib/telefono";
import { BadgeScadenza } from "@/components/badge-scadenza";

const PER_PAGINA = 50;

export default async function ClientiPage({ searchParams }: PageProps<"/clienti">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const pagina = Math.max(1, Number(sp.p) || 1);
  const profilo = await richiediProfilo();
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, codice, nome, cognome, cittadinanza, telefono, permesso_tipo, permesso_scadenza, updated_at, offices(nome)", { count: "exact" })
    .order("cognome")
    .order("nome")
    .range((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA - 1);
  if (q) {
    const parole = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (const w of parole) query = query.ilike("search_text", `%${w.replace(/[%_,()]/g, "")}%`);
  }
  const { data: clienti, count } = await query;
  const pagine = Math.ceil((count ?? 0) / PER_PAGINA);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clienti</h1>
          <p className="text-sm text-slate-500">{count ?? 0} anagrafiche</p>
        </div>
        <Link href="/clienti/nuovo" className="btn-primary">
          <Plus size={16} /> Nuovo cliente
        </Link>
      </div>

      <form className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Cerca per nome, cognome, codice fiscale, telefono, passaporto…" className="input pl-9" />
        </div>
        <button className="btn-secondary">Cerca</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">N.</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="hidden px-4 py-3 md:table-cell">Cittadinanza</th>
              <th className="hidden px-4 py-3 md:table-cell">Telefono</th>
              <th className="px-4 py-3">Permesso</th>
              {profilo.ruolo === "admin_rete" && <th className="hidden px-4 py-3 lg:table-cell">Sede</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clienti?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400">{c.codice}</td>
                <td className="px-4 py-3">
                  <Link href={`/clienti/${c.id}`} className="font-medium text-brand-700 hover:underline">
                    {c.cognome} {c.nome}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">{c.cittadinanza ?? "—"}</td>
                <td className="hidden px-4 py-3 md:table-cell">{formattaTelefono(c.telefono) || "—"}</td>
                <td className="px-4 py-3">
                  <div className="text-xs text-slate-500">{c.permesso_tipo ?? "—"}</div>
                  {c.permesso_scadenza && (
                    <div className="flex items-center gap-2">
                      {data(c.permesso_scadenza)} <BadgeScadenza giorni={giorniA(c.permesso_scadenza)} />
                    </div>
                  )}
                </td>
                {profilo.ruolo === "admin_rete" && <td className="hidden px-4 py-3 lg:table-cell">{c.offices?.nome}</td>}
              </tr>
            ))}
            {!clienti?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  {q ? "Nessun cliente trovato." : "Nessun cliente. Crea la prima anagrafica."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagine > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {pagina > 1 && (
            <Link className="btn-secondary" href={`/clienti?q=${encodeURIComponent(q)}&p=${pagina - 1}`}>
              ← Precedente
            </Link>
          )}
          <span className="btn-ghost">
            Pagina {pagina} di {pagine}
          </span>
          {pagina < pagine && (
            <Link className="btn-secondary" href={`/clienti?q=${encodeURIComponent(q)}&p=${pagina + 1}`}>
              Successiva →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

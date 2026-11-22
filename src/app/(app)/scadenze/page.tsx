import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { data, dataTraGiorni, giorniA } from "@/lib/format";
import { formattaTelefono } from "@/lib/telefono";
import { BadgeScadenza } from "@/components/badge-scadenza";
import { oggiISO } from "@/lib/contesto";

const FINESTRE = [30, 60, 90, 180];

export default async function ScadenzePage({ searchParams }: PageProps<"/scadenze">) {
  const sp = await searchParams;
  const giorni = FINESTRE.includes(Number(sp.giorni)) ? Number(sp.giorni) : 90;
  const supabase = await createClient();
  const oggi = oggiISO();
  const fine = dataTraGiorni(giorni);
  const scadutiDa = dataTraGiorni(-60);

  const [permessi, passaporti, pratiche] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nome, cognome, telefono, permesso_tipo, permesso_scadenza")
      .gte("permesso_scadenza", scadutiDa)
      .lte("permesso_scadenza", fine)
      .order("permesso_scadenza"),
    supabase
      .from("clients")
      .select("id, nome, cognome, telefono, passaporto_numero, passaporto_scadenza")
      .gte("passaporto_scadenza", scadutiDa)
      .lte("passaporto_scadenza", fine)
      .order("passaporto_scadenza"),
    supabase
      .from("cases")
      .select("id, tipo, stato, prossima_scadenza, client_id, clients(nome, cognome)")
      .gte("prossima_scadenza", oggi)
      .lte("prossima_scadenza", fine)
      .not("stato", "in", "(conclusa_positiva,conclusa_negativa,archiviata)")
      .order("prossima_scadenza"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Scadenze</h1>
          <p className="text-sm text-slate-500">Permessi e passaporti in scadenza (inclusi quelli scaduti da meno di 60 giorni) e scadenze delle pratiche.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {FINESTRE.map((g) => (
            <Link key={g} href={`/scadenze?giorni=${g}`} className={`rounded-md px-3 py-1.5 ${g === giorni ? "bg-brand-600 text-white" : "text-slate-600"}`}>
              {g} gg
            </Link>
          ))}
        </div>
      </div>

      <Tabella
        titolo="Permessi di soggiorno"
        righe={(permessi.data ?? []).map((c) => ({ id: c.id, href: `/clienti/${c.id}`, nome: `${c.cognome} ${c.nome}`, dettaglio: c.permesso_tipo, telefono: c.telefono, scadenza: c.permesso_scadenza }))}
      />
      <Tabella
        titolo="Passaporti"
        righe={(passaporti.data ?? []).map((c) => ({ id: c.id, href: `/clienti/${c.id}`, nome: `${c.cognome} ${c.nome}`, dettaglio: c.passaporto_numero, telefono: c.telefono, scadenza: c.passaporto_scadenza }))}
      />
      <Tabella
        titolo="Pratiche"
        righe={(pratiche.data ?? []).map((p) => ({
          id: p.id,
          href: `/clienti/${p.client_id}?tab=pratiche`,
          nome: `${p.clients?.cognome} ${p.clients?.nome}`,
          dettaglio: p.tipo,
          telefono: null,
          scadenza: p.prossima_scadenza,
        }))}
      />
    </div>
  );
}

function Tabella({ titolo, righe }: { titolo: string; righe: { id: string; href: string; nome: string; dettaglio: string | null; telefono: string | null; scadenza: string | null }[] }) {
  return (
    <div className="card">
      <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">
        {titolo} <span className="text-sm font-normal text-slate-400">({righe.length})</span>
      </h2>
      {righe.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">Nessuna scadenza nel periodo.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {righe.map((r) => (
            <Link key={r.id} href={r.href} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
              <span className="flex-1 font-medium">{r.nome}</span>
              <span className="text-slate-500">{r.dettaglio}</span>
              {r.telefono && <span className="hidden text-slate-400 sm:inline">{formattaTelefono(r.telefono)}</span>}
              <span className="flex w-36 items-center justify-end gap-2">
                {data(r.scadenza)} <BadgeScadenza giorni={giorniA(r.scadenza)} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

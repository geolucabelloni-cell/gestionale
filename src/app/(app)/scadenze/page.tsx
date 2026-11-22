import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { data, dataTraGiorni, giorniA } from "@/lib/format";
import { formattaTelefono } from "@/lib/telefono";
import { BadgeScadenza } from "@/components/badge-scadenza";
import { oggiISO } from "@/lib/contesto";
import { richiediProfilo } from "@/lib/auth";
import { caricaAttivita } from "@/lib/attivita";
import { operatoriVisibili } from "@/lib/agenda";
import { ListaAttivita } from "@/components/attivita/lista-attivita";

const FINESTRE = [30, 60, 90, 180];

export default async function ScadenzePage({ searchParams }: PageProps<"/scadenze">) {
  const sp = await searchParams;
  const giorni = FINESTRE.includes(Number(sp.giorni)) ? Number(sp.giorni) : 90;
  const profilo = await richiediProfilo();
  const solo = sp.chi === "mie" ? "mie" : "tutte";
  const conCompletate = sp.completate === "1";
  const supabase = await createClient();
  const oggi = oggiISO();
  const [attivita, operatori] = await Promise.all([
    caricaAttivita(supabase, { assegnatoA: solo === "mie" ? profilo.id : undefined, conCompletate }),
    operatoriVisibili(supabase),
  ]);
  const filtri = (chi: string, comp: boolean) => `/scadenze?giorni=${giorni}&chi=${chi}${comp ? "&completate=1" : ""}`;
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
          <h1 className="text-2xl font-semibold">Scadenze e attività</h1>
          <p className="text-sm text-slate-500">Le cose da fare dello studio e, sotto, le scadenze di permessi, passaporti e pratiche.</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold">Attività</h2>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <Link href={filtri("tutte", conCompletate)} className={`rounded-md px-3 py-1.5 ${solo === "tutte" ? "bg-brand-600 text-white" : "text-slate-600"}`}>
              Tutte
            </Link>
            <Link href={filtri("mie", conCompletate)} className={`rounded-md px-3 py-1.5 ${solo === "mie" ? "bg-brand-600 text-white" : "text-slate-600"}`}>
              Le mie
            </Link>
          </div>
          <Link href={filtri(solo, !conCompletate)} className="btn-ghost text-xs">
            {conCompletate ? "Nascondi completate" : "Mostra completate"}
          </Link>
        </div>
        <ListaAttivita attivita={attivita} operatori={operatori} oggi={oggi} tra7={dataTraGiorni(7)} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold">Scadenze documenti e pratiche</h2>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {FINESTRE.map((g) => (
            <Link key={g} href={`/scadenze?giorni=${g}&chi=${solo}${conCompletate ? "&completate=1" : ""}`} className={`rounded-md px-3 py-1.5 ${g === giorni ? "bg-brand-600 text-white" : "text-slate-600"}`}>
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

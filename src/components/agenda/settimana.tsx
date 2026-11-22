"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, MapPin } from "lucide-react";
import { FormAppuntamento, type Appuntamento } from "./form-appuntamento";
import { etichettaGiorno } from "@/lib/tempo";

const ORA_INIZIO = 8;
const ORA_FINE = 20;
const PX_ORA = 80;
const COLORI = ["bg-orange-100 border-orange-400 text-orange-900", "bg-sky-100 border-sky-400 text-sky-900", "bg-emerald-100 border-emerald-400 text-emerald-900", "bg-violet-100 border-violet-400 text-violet-900", "bg-rose-100 border-rose-400 text-rose-900", "bg-amber-100 border-amber-400 text-amber-900", "bg-teal-100 border-teal-400 text-teal-900"];

export type ApptVista = Appuntamento & { minuti: number; nomeCliente: string; nomeOperatore: string | null };

/** Dispone gli appuntamenti sovrapposti affiancati: restituisce corsia e numero di corsie del gruppo. */
function disponi(lista: ApptVista[]) {
  const ord = [...lista].sort((a, b) => a.minuti - b.minuti);
  const pos = new Map<string, { corsia: number; corsie: number }>();
  let gruppo: ApptVista[] = [];
  let fineGruppo = -1;
  const chiudi = () => {
    const fineCorsie: number[] = [];
    const assegnate: [string, number][] = [];
    for (const a of gruppo) {
      let c = fineCorsie.findIndex((f) => f <= a.minuti);
      if (c === -1) c = fineCorsie.length;
      fineCorsie[c] = a.minuti + a.durata;
      assegnate.push([a.id, c]);
    }
    for (const [id, c] of assegnate) pos.set(id, { corsia: c, corsie: fineCorsie.length });
    gruppo = [];
  };
  for (const a of ord) {
    if (gruppo.length && a.minuti >= fineGruppo) chiudi();
    gruppo.push(a);
    fineGruppo = Math.max(fineGruppo, a.minuti + a.durata);
  }
  chiudi();
  return pos;
}

export function AgendaSettimana(p: {
  giorni: string[];
  oggi: string;
  appuntamenti: ApptVista[];
  operatori: { id: string; nome: string }[];
  sedi?: { id: string; nome: string }[];
  prec: string;
  succ: string;
  filtroOperatore: string | null;
}) {
  const [modifica, setModifica] = useState<Partial<Appuntamento> | null>(null);
  const colore = (id: string | null) => (id ? COLORI[Math.max(0, p.operatori.findIndex((o) => o.id === id)) % COLORI.length] : "bg-slate-100 border-slate-400 text-slate-800");
  const ore = Array.from({ length: ORA_FINE - ORA_INIZIO }, (_, i) => ORA_INIZIO + i);
  const qs = p.filtroOperatore ? `&operatore=${p.filtroOperatore}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-1">
          <Link href={`/agenda?settimana=${p.prec}${qs}`} className="btn-secondary px-2" aria-label="Settimana precedente">
            <ChevronLeft size={16} />
          </Link>
          <Link href={`/agenda?${qs.slice(1)}`} className="btn-secondary">
            Oggi
          </Link>
          <Link href={`/agenda?settimana=${p.succ}${qs}`} className="btn-secondary px-2" aria-label="Settimana successiva">
            <ChevronRight size={16} />
          </Link>
        </div>
        <form className="flex">
          <input type="hidden" name="settimana" value={p.giorni[0]} />
          <select name="operatore" defaultValue={p.filtroOperatore ?? ""} className="input w-48" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            <option value="">Tutti gli operatori</option>
            {p.operatori.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </form>
        <button className="btn-primary" onClick={() => setModifica({ data: p.giorni.includes(p.oggi) ? p.oggi : p.giorni[0], ora: "09:00", durata: 30 })}>
          <Plus size={16} /> Nuovo appuntamento
        </button>
      </div>

      <div className="card overflow-x-auto">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `56px repeat(${p.giorni.length}, 1fr)` }}>
          <div className="border-b border-slate-200" />
          {p.giorni.map((g) => (
            <div key={g} className={`border-b border-l border-slate-200 px-2 py-2 text-center text-sm capitalize ${g === p.oggi ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>
              {etichettaGiorno(g)}
            </div>
          ))}

          <div className="relative">
            {ore.map((h) => (
              <div key={h} className="pr-2 text-right text-xs text-slate-400" style={{ height: PX_ORA }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {p.giorni.map((g) => (
            <div key={g} className="relative border-l border-slate-200" style={{ height: PX_ORA * ore.length }}>
              {ore.map((h) => (
                <button
                  key={h}
                  className="block w-full border-t border-slate-100 hover:bg-brand-50/50"
                  style={{ height: PX_ORA }}
                  title={`Nuovo appuntamento ${g} ${h}:00`}
                  onClick={() => setModifica({ data: g, ora: `${String(h).padStart(2, "0")}:00`, durata: 30, operatore_id: p.filtroOperatore })}
                />
              ))}
              {(() => {
                const delGiorno = p.appuntamenti.filter((a) => a.data === g);
                const pos = disponi(delGiorno);
                return delGiorno.map((a) => {
                  const { corsia, corsie } = pos.get(a.id) ?? { corsia: 0, corsie: 1 };
                  const top = Math.max(0, ((a.minuti - ORA_INIZIO * 60) / 60) * PX_ORA);
                  const h = Math.max(22, (a.durata / 60) * PX_ORA - 2);
                  const annullato = a.stato === "annullato" || a.stato === "non_presentato";
                  return (
                    <button
                      key={a.id}
                      onClick={() => setModifica(a)}
                      className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm ${colore(a.operatore_id)} ${annullato ? "line-through opacity-50" : ""} ${a.stato === "completato" ? "opacity-60" : ""}`}
                      style={{ top, height: h, left: `calc(${(corsia / corsie) * 100}% + 2px)`, width: `calc(${100 / corsie}% - 4px)` }}
                    >
                      <div className="font-semibold">
                        {a.ora} {a.nomeCliente}
                      </div>
                      <div className="truncate">{a.titolo}</div>
                      {a.luogo !== "In sede" && (
                        <div className="flex items-center gap-0.5 truncate">
                          <MapPin size={10} /> {a.luogo}
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          ))}
        </div>
      </div>

      {p.operatori.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {p.operatori.map((o) => (
            <span key={o.id} className={`rounded border-l-4 px-2 py-0.5 ${colore(o.id)}`}>
              {o.nome}
            </span>
          ))}
        </div>
      )}

      {modifica && <FormAppuntamento key={modifica.id ?? "nuovo"} iniziale={modifica} operatori={p.operatori} sedi={p.sedi} onChiudi={() => setModifica(null)} />}
    </div>
  );
}

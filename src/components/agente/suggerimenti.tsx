"use client";

import { useState, useTransition } from "react";
import { Sparkles, CalendarPlus, ListTodo } from "lucide-react";
import { creaDaSuggerimenti } from "@/app/(app)/agente/actions";
import type { AttivitaEstratte } from "@/lib/ai/claude";
import { data as fmtData } from "@/lib/format";

/** Mostra le attività/appuntamenti proposti dall'AI e li crea dopo conferma. */
export function Suggerimenti({
  suggerimenti,
  clientId,
  origine,
  onFatto,
}: {
  suggerimenti: AttivitaEstratte;
  clientId: string | null;
  origine: "ai" | "whatsapp";
  onFatto: (msg: string) => void;
}) {
  const [selAtt, setSelAtt] = useState(() => suggerimenti.attivita.map(() => true));
  const [selApp, setSelApp] = useState(() => suggerimenti.appuntamenti.map(() => true));
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  const totale = suggerimenti.attivita.length + suggerimenti.appuntamenti.length;

  if (totale === 0) return null;
  return (
    <div className="card border-violet-200 bg-violet-50/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-violet-800">
        <Sparkles size={16} /> L&apos;AI propone {totale === 1 ? "una cosa" : `${totale} cose`} da mettere in agenda
      </div>
      <div className="space-y-1.5">
        {suggerimenti.attivita.map((a, i) => (
          <label key={`a${i}`} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-violet-600" checked={selAtt[i]} onChange={(e) => setSelAtt(selAtt.map((v, j) => (j === i ? e.target.checked : v)))} />
            <ListTodo size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              <strong className="font-medium">{a.titolo}</strong>
              {a.scadenza && <span className="text-slate-500"> · entro il {fmtData(a.scadenza)}</span>}
              {a.priorita === "alta" && <span className="text-red-600"> · priorità alta</span>}
              {a.descrizione && <span className="block text-xs text-slate-500">{a.descrizione}</span>}
            </span>
          </label>
        ))}
        {suggerimenti.appuntamenti.map((a, i) => (
          <label key={`p${i}`} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-violet-600" checked={selApp[i]} onChange={(e) => setSelApp(selApp.map((v, j) => (j === i ? e.target.checked : v)))} />
            <CalendarPlus size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              <strong className="font-medium">{a.titolo}</strong>
              <span className="text-slate-500">
                {" "}
                · {fmtData(a.data)} {a.ora ?? "(ora da definire)"} · {a.luogo}
              </span>
            </span>
          </label>
        ))}
      </div>
      {errore && <p className="mt-2 text-sm text-red-600">{errore}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => onFatto("")} disabled={inCorso}>
          Ignora
        </button>
        <button
          className="btn-ai"
          disabled={inCorso || (!selAtt.some(Boolean) && !selApp.some(Boolean))}
          onClick={() =>
            avvia(async () => {
              const r = await creaDaSuggerimenti({
                clientId,
                origine,
                attivita: suggerimenti.attivita.filter((_, i) => selAtt[i]),
                appuntamenti: suggerimenti.appuntamenti.filter((_, i) => selApp[i]),
              });
              if (r.errore) setErrore(r.errore);
              else onFatto(r.ok ?? "");
            })
          }
        >
          Aggiungi selezionati
        </button>
      </div>
    </div>
  );
}

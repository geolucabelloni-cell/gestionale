"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { associaACliente, cercaClienti } from "../actions";

export function AssociaCliente({ officeId, telefono }: { officeId: string; telefono: string }) {
  const [aperto, setAperto] = useState(false);
  const [q, setQ] = useState("");
  const [risultati, setRisultati] = useState<{ id: string; nome: string; cognome: string; telefono: string | null; office_id: string }[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  if (!aperto)
    return (
      <button className="btn-secondary" onClick={() => setAperto(true)}>
        <Link2 size={16} /> Associa a cliente esistente
      </button>
    );

  return (
    <div className="w-full space-y-2 rounded-lg border border-slate-200 p-3">
      <form
        method="post"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          avvia(async () => setRisultati((await cercaClienti(q)).filter((c) => c.office_id === officeId)));
        }}
      >
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente per nome o codice fiscale" autoFocus />
        <button className="btn-secondary" disabled={inCorso}>
          Cerca
        </button>
        <button type="button" className="btn-ghost" onClick={() => setAperto(false)}>
          Chiudi
        </button>
      </form>
      {errore && <p className="text-sm text-red-600">{errore}</p>}
      {risultati.map((c) => (
        <button
          key={c.id}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
          disabled={inCorso}
          onClick={() =>
            avvia(async () => {
              const r = await associaACliente(officeId, telefono, c.id);
              if (r.errore) setErrore(r.errore);
              else setAperto(false);
            })
          }
        >
          <span>
            {c.cognome} {c.nome}
          </span>
          <span className="text-xs text-slate-400">{c.telefono ? "+" + c.telefono : "senza telefono"}</span>
        </button>
      ))}
    </div>
  );
}

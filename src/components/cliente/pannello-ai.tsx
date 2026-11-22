"use client";

import { useState, useTransition } from "react";
import { Sparkles, Send } from "lucide-react";
import { aiDomanda, aiRiassunto } from "@/app/(app)/clienti/actions";

export function PannelloAi({ clientId, attiva }: { clientId: string; attiva: boolean }) {
  const [risposta, setRisposta] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [domanda, setDomanda] = useState("");
  const [inCorso, avvia] = useTransition();

  if (!attiva) return null;

  const esegui = (fn: () => Promise<{ testo?: string; errore?: string }>) =>
    avvia(async () => {
      setErrore(null);
      const r = await fn();
      if (r.errore) setErrore(r.errore);
      else setRisposta(r.testo ?? "");
    });

  return (
    <div className="card mb-4 border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={18} className="text-violet-600" />
        <span className="font-medium">Assistente AI</span>
        <span className="flex-1" />
        <button className="btn-ai" disabled={inCorso} onClick={() => esegui(() => aiRiassunto(clientId))}>
          Riepiloga la storia del cliente
        </button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          esegui(() => aiDomanda(clientId, domanda));
        }}
      >
        <input
          className="input"
          value={domanda}
          onChange={(e) => setDomanda(e.target.value)}
          placeholder="Chiedi qualcosa su questo cliente, es. 'Quali documenti mancano per il rinnovo?'"
        />
        <button className="btn-secondary" disabled={inCorso || !domanda.trim()}>
          <Send size={16} />
        </button>
      </form>
      {inCorso && <p className="mt-3 animate-pulse text-sm text-violet-700">L&apos;AI sta leggendo diario, pratiche e documenti…</p>}
      {errore && <p className="mt-3 text-sm text-red-600">{errore}</p>}
      {risposta && !inCorso && (
        <div className="mt-3 rounded-lg border border-violet-100 bg-white p-4 text-sm whitespace-pre-wrap">
          {risposta}
          <div className="mt-2 text-right">
            <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setRisposta(null)}>
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

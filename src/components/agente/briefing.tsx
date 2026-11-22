"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { aiBriefing } from "@/app/(app)/agente/actions";

export function Briefing() {
  const [testo, setTesto] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  return (
    <div className="card border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={18} className="text-violet-600" />
        <div className="flex-1">
          <div className="font-medium">Briefing del giorno</div>
          <div className="text-xs text-slate-500">L&apos;agente AI legge agenda, attività, WhatsApp e scadenze e ti dice da dove partire.</div>
        </div>
        <button
          className="btn-ai"
          disabled={inCorso}
          onClick={() =>
            avvia(async () => {
              setErrore(null);
              const r = await aiBriefing();
              if (r.errore) setErrore(r.errore);
              else setTesto(r.testo ?? "");
            })
          }
        >
          {inCorso ? "Preparazione…" : testo ? "Aggiorna" : "Prepara il briefing"}
        </button>
      </div>
      {errore && <p className="mt-3 text-sm text-red-600">{errore}</p>}
      {testo && <div className="mt-3 rounded-lg border border-violet-100 bg-white p-4 text-sm whitespace-pre-wrap">{testo}</div>}
    </div>
  );
}

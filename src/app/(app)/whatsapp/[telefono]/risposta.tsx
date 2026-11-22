"use client";

import { useState, useTransition } from "react";
import { Send, Sparkles, CheckCircle2, ListTodo } from "lucide-react";
import { inviaRisposta, rigeneraBozza, segnaGestito } from "../actions";
import { aiSuggerisciDaWhatsapp } from "@/app/(app)/agente/actions";
import { Suggerimenti } from "@/components/agente/suggerimenti";
import type { AttivitaEstratte } from "@/lib/ai/claude";

export function Risposta(p: {
  officeId: string;
  telefono: string;
  bozza: string;
  motivo: string | null;
  daGestire: boolean;
  finestraAperta: boolean;
  configurato: boolean;
}) {
  const [testo, setTesto] = useState(p.bozza);
  const [motivo, setMotivo] = useState(p.motivo);
  const [msg, setMsg] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();
  const [sugg, setSugg] = useState<{ s: AttivitaEstratte; clientId: string | null } | null>(null);

  return (
    <div className="card mt-4 space-y-3 p-4">
      {p.daGestire && motivo && (
        <div className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">
          <Sparkles size={14} className="mr-1 inline" />
          <strong>Perché serve un operatore:</strong> {motivo}
          {p.bozza && <div className="mt-1 text-xs text-violet-600">La risposta qui sotto è una bozza preparata dall&apos;AI: controllala prima di inviare.</div>}
        </div>
      )}
      {!p.configurato && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Canale WhatsApp della sede non configurato: vai in Impostazioni sede.</div>}
      {p.configurato && !p.finestraAperta && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sono passate più di 24 ore dall&apos;ultimo messaggio del cliente: WhatsApp permette solo messaggi modello approvati.
        </div>
      )}
      <textarea className="input" rows={4} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi la risposta…" />
      {msg && <p className={`text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.testo}</p>}
      {sugg && (
        <Suggerimenti
          suggerimenti={sugg.s}
          clientId={sugg.clientId}
          origine="whatsapp"
          onFatto={(m) => {
            setSugg(null);
            if (m) setMsg({ tipo: "ok", testo: m });
          }}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="btn-ghost mr-auto text-violet-700"
          disabled={inCorso}
          onClick={() =>
            avvia(async () => {
              setMsg(null);
              const r = await aiSuggerisciDaWhatsapp(p.officeId, p.telefono);
              if (r.errore) return setMsg({ tipo: "errore", testo: r.errore });
              const n = (r.suggerimenti?.attivita.length ?? 0) + (r.suggerimenti?.appuntamenti.length ?? 0);
              if (!n) setMsg({ tipo: "ok", testo: "Nessuna attività da creare in questa conversazione." });
              else setSugg({ s: r.suggerimenti!, clientId: r.clientId ?? null });
            })
          }
        >
          <ListTodo size={16} /> Crea attività dalla chat
        </button>
        {p.daGestire && (
          <button className="btn-ghost" disabled={inCorso} onClick={() => avvia(() => segnaGestito(p.officeId, p.telefono))}>
            <CheckCircle2 size={16} /> Segna come gestito
          </button>
        )}
        <button
          className="btn-secondary"
          disabled={inCorso}
          onClick={() =>
            avvia(async () => {
              setMsg(null);
              const r = await rigeneraBozza(p.officeId, p.telefono);
              if (r.errore) setMsg({ tipo: "errore", testo: r.errore });
              else {
                setTesto(r.bozza ?? "");
                setMotivo(r.motivo ?? null);
              }
            })
          }
        >
          <Sparkles size={16} className="text-violet-600" /> {inCorso ? "…" : "Proponi risposta AI"}
        </button>
        <button
          className="btn-primary"
          disabled={inCorso || !testo.trim() || !p.configurato || !p.finestraAperta}
          onClick={() =>
            avvia(async () => {
              const r = await inviaRisposta(p.officeId, p.telefono, testo);
              if (r.errore) setMsg({ tipo: "errore", testo: r.errore });
              else {
                setMsg({ tipo: "ok", testo: "Messaggio inviato" });
                setTesto("");
              }
            })
          }
        >
          <Send size={16} /> Invia
        </button>
      </div>
    </div>
  );
}

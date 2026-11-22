"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { MessageCircle, Sparkles, Trash2, CornerDownRight, ListTodo } from "lucide-react";
import { aggiungiNota, eliminaNota } from "@/app/(app)/clienti/actions";
import { aiSuggerisciDaNota } from "@/app/(app)/agente/actions";
import { Suggerimenti } from "@/components/agente/suggerimenti";
import type { AttivitaEstratte } from "@/lib/ai/claude";
import { dataLunga, ora } from "@/lib/format";

type Nota = {
  id: string;
  numero: number;
  data_visita: string;
  testo: string;
  origine: string;
  rettifica_di: string | null;
  created_at: string;
  autore: string | null;
};

export function Diario({ clientId, note, puoEliminare, aiAttiva }: { clientId: string; note: Nota[]; puoEliminare: boolean; aiAttiva: boolean }) {
  const [rettifica, setRettifica] = useState<Nota | null>(null);
  const [, avvia] = useTransition();
  const [suggerimenti, setSuggerimenti] = useState<AttivitaEstratte | null>(null);
  const [statoAi, setStatoAi] = useState<string | null>(null);
  const analizza = async (noteId: string) => {
    setSuggerimenti(null);
    setStatoAi("L'AI sta cercando attività e appuntamenti nella nota…");
    const r = await aiSuggerisciDaNota(noteId);
    if (r.errore) return setStatoAi(r.errore);
    const n = (r.suggerimenti?.attivita.length ?? 0) + (r.suggerimenti?.appuntamenti.length ?? 0);
    setStatoAi(n ? null : "Nessuna attività da aggiungere trovata nella nota.");
    if (n) setSuggerimenti(r.suggerimenti!);
  };
  const formRef = useRef<HTMLFormElement>(null);
  const [stato, azione, salvataggio] = useActionState(async (prec: Awaited<ReturnType<typeof aggiungiNota>>, fd: FormData) => {
    const r = await aggiungiNota(prec, fd);
    if (r?.ok) {
      formRef.current?.reset();
      setRettifica(null);
      // l'agente AI legge la nota appena scritta e propone attività/appuntamenti
      if (aiAttiva && r.id) void analizza(r.id);
    }
    return r;
  }, null);
  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

  // raggruppa per giorno di visita
  const giorni = new Map<string, Nota[]>();
  for (const n of note) giorni.set(n.data_visita, [...(giorni.get(n.data_visita) ?? []), n]);
  const perNumero = new Map(note.map((n) => [n.id, n.numero]));

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={inviaSenzaReset(azione)} className="card space-y-3 p-4">
        <input type="hidden" name="client_id" value={clientId} />
        {rettifica && <input type="hidden" name="rettifica_di" value={rettifica.id} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{rettifica ? `Rettifica della nota n. ${rettifica.numero}` : "Nuova nota"}</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500" htmlFor="data_visita">
              Data visita
            </label>
            <input id="data_visita" type="date" name="data_visita" defaultValue={oggi} max={oggi} className="input w-auto" />
          </div>
        </div>
        <textarea
          name="testo"
          rows={4}
          required
          className="input"
          placeholder="Cosa è successo oggi: documenti consegnati, richieste del cliente, prossimi passi…"
        />
        {stato?.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
        <div className="flex justify-end gap-2">
          {rettifica && (
            <button type="button" className="btn-ghost" onClick={() => setRettifica(null)}>
              Annulla rettifica
            </button>
          )}
          <button className="btn-primary" disabled={salvataggio}>
            {salvataggio ? "Salvataggio…" : "Aggiungi al diario"}
          </button>
        </div>
      </form>

      {statoAi && <p className="animate-pulse text-sm text-violet-700">{statoAi}</p>}
      {suggerimenti && (
        <Suggerimenti
          suggerimenti={suggerimenti}
          clientId={clientId}
          origine="ai"
          onFatto={(msg) => {
            setSuggerimenti(null);
            setStatoAi(msg || null);
          }}
        />
      )}

      {note.length === 0 && <p className="py-8 text-center text-slate-500">Nessuna nota nel diario.</p>}

      {[...giorni.entries()].map(([giorno, lista]) => (
        <div key={giorno}>
          <div className="mb-2 text-sm font-semibold text-slate-500 capitalize">{dataLunga(giorno)}</div>
          <div className="space-y-2 border-l-2 border-brand-100 pl-4">
            {lista.map((n) => (
              <div key={n.id} className="card p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="badge bg-brand-50 text-brand-700">n. {n.numero}</span>
                  {n.origine === "whatsapp" && (
                    <span className="badge bg-green-50 text-green-700">
                      <MessageCircle size={12} className="mr-1" /> WhatsApp
                    </span>
                  )}
                  {n.origine === "ai" && (
                    <span className="badge bg-violet-50 text-violet-700">
                      <Sparkles size={12} className="mr-1" /> AI
                    </span>
                  )}
                  {n.origine === "sistema" && <span className="badge bg-slate-100 text-slate-600">Importata da TeamSystem</span>}
                  {n.rettifica_di && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <CornerDownRight size={12} /> rettifica la nota n. {perNumero.get(n.rettifica_di) ?? "?"}
                    </span>
                  )}
                  <span>
                    {n.autore ?? "Sistema"} · ore {ora(n.created_at)}
                  </span>
                  <span className="flex-1" />
                  {aiAttiva && (
                    <button className="inline-flex items-center gap-0.5 hover:text-violet-600" onClick={() => void analizza(n.id)} title="Estrai attività e appuntamenti con l'AI">
                      <ListTodo size={13} /> Attività
                    </button>
                  )}
                  <button className="hover:text-brand-600" onClick={() => setRettifica(n)} title="Aggiungi una rettifica">
                    Rettifica
                  </button>
                  {puoEliminare && (
                    <button
                      className="hover:text-red-600"
                      title="Elimina nota"
                      onClick={() => confirm(`Eliminare la nota n. ${n.numero}?`) && avvia(() => void eliminaNota(n.id, clientId))}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.testo}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

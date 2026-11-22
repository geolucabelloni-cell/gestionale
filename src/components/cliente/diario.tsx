"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { MessageCircle, Sparkles, Trash2, CornerDownRight } from "lucide-react";
import { aggiungiNota, eliminaNota } from "@/app/(app)/clienti/actions";
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

export function Diario({ clientId, note, puoEliminare }: { clientId: string; note: Nota[]; puoEliminare: boolean }) {
  const [rettifica, setRettifica] = useState<Nota | null>(null);
  const [, avvia] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [stato, azione, salvataggio] = useActionState(async (prec: Awaited<ReturnType<typeof aggiungiNota>>, fd: FormData) => {
    const r = await aggiungiNota(prec, fd);
    if (r?.ok) {
      formRef.current?.reset();
      setRettifica(null);
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
      <form ref={formRef} action={azione} className="card space-y-3 p-4">
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
                  {n.rettifica_di && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <CornerDownRight size={12} /> rettifica la nota n. {perNumero.get(n.rettifica_di) ?? "?"}
                    </span>
                  )}
                  <span>
                    {n.autore ?? "Sistema"} · ore {ora(n.created_at)}
                  </span>
                  <span className="flex-1" />
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

"use client";

import Link from "next/link";
import { inviaSenzaReset } from "@/lib/form";
import { useActionState, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Sparkles, MessageCircle, Flag } from "lucide-react";
import { cambiaStatoAttivita, eliminaAttivita, salvaAttivita } from "@/app/(app)/scadenze/actions";
import { ClientePicker } from "@/components/cliente-picker";
import { data as fmtData } from "@/lib/format";

export type Attivita = {
  id: string;
  titolo: string;
  descrizione: string | null;
  scadenza: string | null;
  priorita: "bassa" | "normale" | "alta";
  stato: "da_fare" | "fatto";
  origine: string;
  client_id: string | null;
  nomeCliente: string | null;
  assegnato_a: string | null;
  nomeAssegnato: string | null;
};

const GRUPPI = [
  { id: "scadute", label: "Scadute", colore: "text-red-600" },
  { id: "oggi", label: "Oggi", colore: "text-brand-700" },
  { id: "settimana", label: "Prossimi 7 giorni", colore: "text-slate-700" },
  { id: "dopo", label: "Più avanti", colore: "text-slate-500" },
  { id: "senza", label: "Senza scadenza", colore: "text-slate-500" },
  { id: "fatte", label: "Completate", colore: "text-green-700" },
] as const;

export function ListaAttivita({
  attivita,
  operatori,
  oggi,
  tra7,
  clienteFisso,
  compatta,
}: {
  attivita: Attivita[];
  operatori: { id: string; nome: string }[];
  oggi: string;
  tra7: string;
  clienteFisso?: { id: string; nome: string; cognome: string };
  compatta?: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [stato, azione, salvataggio] = useActionState(async (prec: Awaited<ReturnType<typeof salvaAttivita>>, fd: FormData) => {
    const r = await salvaAttivita(prec, fd);
    if (r?.ok) formRef.current?.reset();
    return r;
  }, null);

  const gruppo = (a: Attivita) => {
    if (a.stato === "fatto") return "fatte";
    if (!a.scadenza) return "senza";
    if (a.scadenza < oggi) return "scadute";
    if (a.scadenza === oggi) return "oggi";
    if (a.scadenza <= tra7) return "settimana";
    return "dopo";
  };

  return (
    <div className="space-y-4">
      {!aperto ? (
        <button className="btn-primary" onClick={() => setAperto(true)}>
          <Plus size={16} /> Nuova attività / scadenza
        </button>
      ) : (
        <form ref={formRef} method="post" onSubmit={inviaSenzaReset(azione)} className="card grid gap-3 p-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <input name="titolo" required autoFocus placeholder="Cosa c'è da fare? es. Chiamare per appuntamento in Questura" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Scadenza</label>
            <input type="date" name="scadenza" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Assegnata a</label>
            <select name="assegnato_a" className="input" defaultValue="">
              <option value="">— tutti —</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Priorità</label>
            <select name="priorita" className="input" defaultValue="normale">
              <option value="bassa">Bassa</option>
              <option value="normale">Normale</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          {clienteFisso ? (
            <input type="hidden" name="client_id" value={clienteFisso.id} />
          ) : (
            <div className="sm:col-span-3">
              <label className="label">Cliente (facoltativo)</label>
              <ClientePicker name="client_id" />
            </div>
          )}
          <div className={clienteFisso ? "sm:col-span-6" : "sm:col-span-3"}>
            <label className="label">Dettagli</label>
            <input name="descrizione" className="input" />
          </div>
          {stato?.errore && <p className="text-sm text-red-600 sm:col-span-6">{stato.errore}</p>}
          <div className="flex justify-end gap-2 sm:col-span-6">
            <button type="button" className="btn-ghost" onClick={() => setAperto(false)}>
              Chiudi
            </button>
            <button className="btn-primary" disabled={salvataggio}>
              Aggiungi
            </button>
          </div>
        </form>
      )}

      {attivita.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nessuna attività.</p>}
      {GRUPPI.map((g) => {
        const lista = attivita.filter((a) => gruppo(a) === g.id);
        if (!lista.length) return null;
        return (
          <div key={g.id}>
            <h3 className={`mb-1 text-sm font-semibold ${g.colore}`}>
              {g.label} <span className="font-normal text-slate-400">({lista.length})</span>
            </h3>
            <div className="card divide-y divide-slate-100">
              {lista.map((a) => (
                <RigaAttivita key={a.id} a={a} compatta={compatta} mostraCliente={!clienteFisso} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RigaAttivita({ a, compatta, mostraCliente }: { a: Attivita; compatta?: boolean; mostraCliente: boolean }) {
  const [inCorso, avvia] = useTransition();
  const fatta = a.stato === "fatto";
  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 ${inCorso ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-brand-600"
        checked={fatta}
        disabled={inCorso}
        onChange={(e) => avvia(() => cambiaStatoAttivita(a.id, e.target.checked))}
        aria-label="Completata"
      />
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${fatta ? "text-slate-400 line-through" : "font-medium"}`}>
          {a.priorita === "alta" && !fatta && <Flag size={13} className="mr-1 inline text-red-500" />}
          {a.titolo}
          {a.origine === "ai" && <Sparkles size={12} className="ml-1 inline text-violet-500" aria-label="Creata dall'AI" />}
          {a.origine === "whatsapp" && <MessageCircle size={12} className="ml-1 inline text-green-600" />}
        </div>
        {!compatta && a.descrizione && <div className="text-xs text-slate-500">{a.descrizione}</div>}
        <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
          {a.scadenza && <span>scade il {fmtData(a.scadenza)}</span>}
          {mostraCliente && a.client_id && (
            <Link href={`/clienti/${a.client_id}?tab=agenda`} className="text-brand-600 hover:underline">
              {a.nomeCliente}
            </Link>
          )}
          {a.nomeAssegnato && <span>→ {a.nomeAssegnato}</span>}
        </div>
      </div>
      <button className="text-slate-300 hover:text-red-600" onClick={() => confirm("Eliminare l'attività?") && avvia(() => eliminaAttivita(a.id))} aria-label="Elimina">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

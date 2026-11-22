"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Paperclip, Plus, Trash2, ListChecks } from "lucide-react";
import {
  aggiungiVoceChecklist,
  caricaChecklistPredefinita,
  collegaDocumentoVoce,
  eliminaVoceChecklist,
  segnaVoceChecklist,
} from "@/app/(app)/clienti/actions";

export type VoceChecklist = { id: string; voce: string; fatto: boolean; document_id: string | null };
export type DocumentoBreve = { id: string; nome: string };

export function ChecklistPratica({ caseId, clientId, voci, documenti }: { caseId: string; clientId: string; voci: VoceChecklist[]; documenti: DocumentoBreve[] }) {
  const [nuova, setNuova] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  const fatte = voci.filter((v) => v.fatto).length;
  const perc = voci.length ? Math.round((fatte / voci.length) * 100) : 0;
  const nomeDoc = new Map(documenti.map((d) => [d.id, d.nome]));

  return (
    <div className={`mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 ${inCorso ? "opacity-70" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <ListChecks size={16} className="text-brand-600" />
        <span className="text-sm font-medium">Documenti</span>
        {voci.length > 0 && (
          <>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={perc} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full ${perc === 100 ? "bg-green-500" : "bg-brand-500"}`} style={{ width: `${perc}%` }} />
            </div>
            <span className="text-xs text-slate-500">
              {fatte} di {voci.length} consegnati
            </span>
          </>
        )}
      </div>

      {voci.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          Nessuna checklist.
          <button
            className="btn-secondary py-1 text-xs"
            disabled={inCorso}
            onClick={() => avvia(async () => setMsg((await caricaChecklistPredefinita(caseId, clientId)).errore ?? null))}
          >
            Carica la checklist predefinita
          </button>
        </div>
      )}

      <ul className="space-y-1">
        {voci.map((v) => (
          <li key={v.id} className="group flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => avvia(() => segnaVoceChecklist(v.id, !v.fatto, clientId))}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-label={`${v.voce}: ${v.fatto ? "consegnato (clic per segnare mancante)" : "mancante (clic per segnare consegnato)"}`}
            >
              {v.fatto ? <CheckCircle2 size={17} className="shrink-0 text-green-600" /> : <Circle size={17} className="shrink-0 text-slate-300" />}
              <span className={v.fatto ? "text-slate-500 line-through decoration-slate-300" : ""}>{v.voce}</span>
            </button>
            {v.document_id ? (
              <a href={`/api/documenti/${v.document_id}`} target="_blank" className="inline-flex max-w-56 items-center gap-1 truncate text-xs text-brand-600 hover:underline">
                <Paperclip size={12} /> {nomeDoc.get(v.document_id) ?? "documento"}
              </a>
            ) : (
              !v.fatto &&
              documenti.length > 0 && (
                <select
                  className="max-w-36 cursor-pointer rounded bg-transparent px-1 py-0.5 text-xs text-slate-400 hover:bg-white hover:text-slate-600"
                  value=""
                  onChange={(e) => e.target.value && avvia(() => collegaDocumentoVoce(v.id, e.target.value, clientId))}
                  aria-label="Collega un documento dell'archivio"
                >
                  <option value="">📎 collega</option>
                  {documenti.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              )
            )}
            <button
              className="text-slate-300 hover:text-red-600"
              onClick={() => avvia(() => eliminaVoceChecklist(v.id, clientId))}
              aria-label="Elimina voce"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>

      <form
        method="post"
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = nuova;
          setNuova("");
          avvia(() => aggiungiVoceChecklist(caseId, t, clientId));
        }}
      >
        <input className="input py-1 text-sm" value={nuova} onChange={(e) => setNuova(e.target.value)} placeholder="Aggiungi un documento richiesto…" />
        <button className="btn-secondary py-1" disabled={!nuova.trim() || inCorso} aria-label="Aggiungi">
          <Plus size={15} />
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-amber-700">{msg}</p>}
    </div>
  );
}

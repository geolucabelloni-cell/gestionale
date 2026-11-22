"use client";

import { useActionState, useState, useTransition } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { eliminaPratica, salvaPratica } from "@/app/(app)/clienti/actions";
import { data, giorniA, STATI_PRATICA, TIPI_PRATICA } from "@/lib/format";
import { BadgeScadenza } from "@/components/badge-scadenza";
import type { Database } from "@/lib/database.types";
import { ChecklistPratica, type DocumentoBreve, type VoceChecklist } from "./checklist-pratica";
import { PulsanteGeneraDocumento, type ModelloBreve } from "./genera-documento";

type Pratica = Database["public"]["Tables"]["cases"]["Row"];

const COLORI: Record<string, string> = {
  aperta: "bg-blue-50 text-blue-700",
  in_attesa_documenti: "bg-amber-50 text-amber-700",
  presentata: "bg-indigo-50 text-indigo-700",
  in_lavorazione: "bg-cyan-50 text-cyan-700",
  conclusa_positiva: "bg-green-50 text-green-700",
  conclusa_negativa: "bg-red-50 text-red-700",
  archiviata: "bg-slate-100 text-slate-500",
};

export function Pratiche({
  clientId,
  pratiche,
  checklist,
  documenti,
  modelli,
}: {
  clientId: string;
  pratiche: Pratica[];
  checklist: Record<string, VoceChecklist[]>;
  documenti: DocumentoBreve[];
  modelli: ModelloBreve[];
}) {
  const promemoria = modelli.find((m) => m.nome.toLowerCase().startsWith("promemoria documenti"));
  const listaPratiche = pratiche.map((p) => ({ id: p.id, tipo: p.tipo }));
  const [modifica, setModifica] = useState<Pratica | "nuova" | null>(null);
  const [, avvia] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModifica("nuova")}>
          <Plus size={16} /> Nuova pratica
        </button>
      </div>
      {modifica && <FormPratica clientId={clientId} pratica={modifica === "nuova" ? null : modifica} onChiudi={() => setModifica(null)} />}
      {pratiche.length === 0 && !modifica && <p className="py-8 text-center text-slate-500">Nessuna pratica registrata.</p>}
      {pratiche.map((p) => (
        <div key={p.id} className="card p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.tipo}</span>
                <span className={`badge ${COLORI[p.stato]}`}>{STATI_PRATICA[p.stato]}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
                <span>Aperta il {data(p.data_apertura)}</span>
                {p.riferimento_esterno && <span>Rif. {p.riferimento_esterno}</span>}
                {p.prossima_scadenza && (
                  <span className="flex items-center gap-1">
                    Prossima scadenza: {data(p.prossima_scadenza)} <BadgeScadenza giorni={giorniA(p.prossima_scadenza)} />
                  </span>
                )}
              </div>
              {p.descrizione && <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{p.descrizione}</p>}
            </div>
            <PulsanteGeneraDocumento piccolo etichetta="Documento" clientId={clientId} modelli={modelli} pratiche={listaPratiche} praticaIniziale={p.id} />
            {promemoria && (checklist[p.id] ?? []).some((v) => !v.fatto) && (
              <a className="btn-ghost py-1 text-xs" target="_blank" href={`/api/modelli/${promemoria.id}/pdf?cliente=${clientId}&pratica=${p.id}`}>
                Stampa documenti mancanti
              </a>
            )}
            <button className="btn-ghost px-2" onClick={() => setModifica(p)}>
              <Pencil size={15} />
            </button>
            <button className="btn-ghost px-2 text-red-600" onClick={() => confirm("Eliminare la pratica?") && avvia(() => eliminaPratica(p.id, clientId))}>
              <Trash2 size={15} />
            </button>
          </div>
          <ChecklistPratica caseId={p.id} clientId={clientId} voci={checklist[p.id] ?? []} documenti={documenti} />
        </div>
      ))}
    </div>
  );
}

function FormPratica({ clientId, pratica, onChiudi }: { clientId: string; pratica: Pratica | null; onChiudi: () => void }) {
  const [stato, azione, salvataggio] = useActionState(async (prec: Awaited<ReturnType<typeof salvaPratica>>, fd: FormData) => {
    const r = await salvaPratica(prec, fd);
    if (r?.ok) onChiudi();
    return r;
  }, null);
  return (
    <form method="post" onSubmit={inviaSenzaReset(azione)} className="card grid gap-3 border-brand-200 p-4 sm:grid-cols-2">
      <input type="hidden" name="client_id" value={clientId} />
      {pratica && <input type="hidden" name="id" value={pratica.id} />}
      <div>
        <label className="label">Tipo *</label>
        <input name="tipo" list="tipi-pratica" required defaultValue={pratica?.tipo ?? ""} className="input" />
        <datalist id="tipi-pratica">
          {TIPI_PRATICA.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="label">Stato</label>
        <select name="stato" defaultValue={pratica?.stato ?? "aperta"} className="input">
          {Object.entries(STATI_PRATICA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Data apertura</label>
        <input type="date" name="data_apertura" defaultValue={pratica?.data_apertura ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Prossima scadenza / appuntamento</label>
        <input type="date" name="prossima_scadenza" defaultValue={pratica?.prossima_scadenza ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Riferimento esterno (n. pratica Questura/Prefettura, RG…)</label>
        <input name="riferimento_esterno" defaultValue={pratica?.riferimento_esterno ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Descrizione</label>
        <textarea name="descrizione" rows={3} defaultValue={pratica?.descrizione ?? ""} className="input" />
      </div>
      {stato?.errore && <p className="text-sm text-red-600 sm:col-span-2">{stato.errore}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-ghost" onClick={onChiudi}>
          Annulla
        </button>
        <button className="btn-primary" disabled={salvataggio}>
          Salva pratica
        </button>
      </div>
    </form>
  );
}

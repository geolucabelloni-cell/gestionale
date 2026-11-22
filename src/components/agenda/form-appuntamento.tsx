"use client";

import { useActionState, useState, useTransition } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { X, Trash2 } from "lucide-react";
import { eliminaAppuntamento, salvaAppuntamento } from "@/app/(app)/agenda/actions";
import { ClientePicker, type ClienteScelto } from "@/components/cliente-picker";

export const TIPI_APPUNTAMENTO = [
  "Consulenza",
  "Primo colloquio",
  "Consegna documenti",
  "Compilazione kit postale",
  "Ritiro documenti",
  "Questura – impronte",
  "Questura – ritiro permesso",
  "Prefettura",
  "Udienza",
  "Altro",
];
export const LUOGHI = ["In sede", "Questura", "Prefettura", "Tribunale", "Telefono", "Online"];
export const STATI_APPUNTAMENTO: Record<string, string> = {
  programmato: "Programmato",
  confermato: "Confermato",
  completato: "Completato",
  annullato: "Annullato",
  non_presentato: "Non presentato",
};

export type Appuntamento = {
  id: string;
  client_id: string | null;
  nominativo: string | null;
  telefono: string | null;
  operatore_id: string | null;
  titolo: string;
  tipo: string;
  data: string;
  ora: string;
  durata: number;
  luogo: string;
  stato: string;
  note: string | null;
  cliente?: ClienteScelto;
};

export function FormAppuntamento({
  iniziale,
  operatori,
  sedi,
  onChiudi,
}: {
  iniziale: Partial<Appuntamento>;
  operatori: { id: string; nome: string }[];
  sedi?: { id: string; nome: string }[];
  onChiudi: () => void;
}) {
  const [conflitto, setConflitto] = useState(false);
  const [cliente, setCliente] = useState<ClienteScelto>(iniziale.cliente ?? null);
  const [, avvia] = useTransition();
  const [stato, azione, salvataggio] = useActionState(async (prec: Awaited<ReturnType<typeof salvaAppuntamento>>, fd: FormData) => {
    const r = await salvaAppuntamento(prec, fd);
    if (r?.ok === "conflitto") setConflitto(true);
    else if (r?.ok) onChiudi();
    return r;
  }, null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onChiudi}>
      <form method="post" onSubmit={inviaSenzaReset(azione)} className="card mt-10 w-full max-w-xl space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{iniziale.id ? "Modifica appuntamento" : "Nuovo appuntamento"}</h2>
          <button type="button" onClick={onChiudi} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            <X size={20} />
          </button>
        </div>
        {iniziale.id && <input type="hidden" name="id" value={iniziale.id} />}
        {conflitto && <input type="hidden" name="forza" value="1" />}

        {sedi && sedi.length > 1 && !iniziale.id && !cliente && (
          <div>
            <label className="label">Sede</label>
            <select name="office_id" className="input">
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Cliente</label>
          <ClientePicker name="client_id" iniziale={iniziale.cliente} onChange={setCliente} />
        </div>
        {!cliente && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Oppure nominativo (nuovo contatto)</label>
              <input name="nominativo" defaultValue={iniziale.nominativo ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Telefono</label>
              <input name="telefono" defaultValue={iniziale.telefono ? "+" + iniziale.telefono : ""} className="input" />
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Tipo</label>
            <select name="tipo" defaultValue={iniziale.tipo ?? "Consulenza"} className="input">
              {TIPI_APPUNTAMENTO.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Titolo (facoltativo)</label>
            <input name="titolo" defaultValue={iniziale.titolo ?? ""} placeholder="es. Rinnovo permesso" className="input" />
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" name="data" required defaultValue={iniziale.data} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Ora</label>
              <input type="time" name="ora" required step={300} defaultValue={iniziale.ora ?? "09:00"} className="input" />
            </div>
            <div>
              <label className="label">Durata</label>
              <select name="durata" defaultValue={String(iniziale.durata ?? 30)} className="input">
                {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Operatore</label>
            <select name="operatore_id" defaultValue={iniziale.operatore_id ?? ""} className="input">
              <option value="">— nessuno —</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Luogo</label>
            <select name="luogo" defaultValue={iniziale.luogo ?? "In sede"} className="input">
              {LUOGHI.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          {iniziale.id && (
            <div>
              <label className="label">Stato</label>
              <select name="stato" defaultValue={iniziale.stato} className="input">
                {Object.entries(STATI_APPUNTAMENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="label">Note</label>
          <textarea name="note" rows={2} defaultValue={iniziale.note ?? ""} className="input" />
        </div>

        {stato?.errore && <p className={`text-sm ${conflitto ? "text-amber-700" : "text-red-600"}`}>{stato.errore}</p>}
        <div className="flex items-center justify-between gap-2">
          {iniziale.id ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => confirm("Eliminare l'appuntamento?") && avvia(async () => {
                  await eliminaAppuntamento(iniziale.id!);
                  onChiudi();
                })}
            >
              <Trash2 size={15} /> Elimina
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onChiudi}>
              Annulla
            </button>
            <button className="btn-primary" disabled={salvataggio}>
              {conflitto ? "Conferma comunque" : "Salva"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

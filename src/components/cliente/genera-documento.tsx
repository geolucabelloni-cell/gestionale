"use client";

import { useState, useTransition } from "react";
import { FileText, X, Eye, Save } from "lucide-react";
import { salvaDocumentoGenerato } from "@/app/(app)/modelli/actions";

export type ModelloBreve = { id: string; nome: string; descrizione: string | null; richiede_pratica: boolean };
export type PraticaBreve = { id: string; tipo: string };

export function PulsanteGeneraDocumento(p: { clientId: string; modelli: ModelloBreve[]; pratiche: PraticaBreve[]; praticaIniziale?: string; modelloIniziale?: string; etichetta?: string; piccolo?: boolean }) {
  const [aperto, setAperto] = useState(false);
  return (
    <>
      <button className={p.piccolo ? "btn-ghost py-1 text-xs" : "btn-secondary"} onClick={() => setAperto(true)}>
        <FileText size={p.piccolo ? 14 : 16} /> {p.etichetta ?? "Genera documento"}
      </button>
      {aperto && <FinestraGenera {...p} onChiudi={() => setAperto(false)} />}
    </>
  );
}

function FinestraGenera({ clientId, modelli, pratiche, praticaIniziale, modelloIniziale, onChiudi }: Parameters<typeof PulsanteGeneraDocumento>[0] & { onChiudi: () => void }) {
  const [modello, setModello] = useState(modelloIniziale ?? modelli[0]?.id ?? "");
  const [pratica, setPratica] = useState(praticaIniziale ?? pratiche[0]?.id ?? "");
  const [esito, setEsito] = useState<{ ok?: string; errore?: string } | null>(null);
  const [inCorso, avvia] = useTransition();
  const m = modelli.find((x) => x.id === modello);
  const manca = !!m?.richiede_pratica && !pratica;
  const url = `/api/modelli/${modello}/pdf?cliente=${clientId}${pratica ? `&pratica=${pratica}` : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onChiudi}>
      <div className="card mt-16 w-full max-w-lg space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Genera documento</h2>
          <button onClick={onChiudi} className="text-slate-400 hover:text-slate-600" aria-label="Chiudi">
            <X size={20} />
          </button>
        </div>
        {modelli.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun modello disponibile. Crealo nella pagina Modelli.</p>
        ) : (
          <>
            <div>
              <label className="label">Modello</label>
              <select className="input" value={modello} onChange={(e) => setModello(e.target.value)}>
                {modelli.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
              {m?.descrizione && <p className="mt-1 text-xs text-slate-500">{m.descrizione}</p>}
            </div>
            <div>
              <label className="label">Pratica {m?.richiede_pratica ? "*" : "(facoltativa)"}</label>
              <select className="input" value={pratica} onChange={(e) => setPratica(e.target.value)}>
                <option value="">— nessuna —</option>
                {pratiche.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.tipo}
                  </option>
                ))}
              </select>
              {manca && <p className="mt-1 text-xs text-amber-700">Questo modello usa i dati di una pratica: creane una nella scheda Pratiche.</p>}
            </div>
            <p className="text-xs text-slate-500">I campi mancanti nell&apos;anagrafica restano come righe vuote da compilare a mano.</p>
            {esito?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{esito.ok}</p>}
            {esito?.errore && <p className="text-sm text-red-600">{esito.errore}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <a href={manca ? undefined : url} target="_blank" className={`btn-secondary ${manca ? "pointer-events-none opacity-50" : ""}`}>
                <Eye size={16} /> Anteprima e stampa
              </a>
              <button
                className="btn-primary"
                disabled={inCorso || manca || !modello}
                onClick={() => avvia(async () => setEsito(await salvaDocumentoGenerato(modello, clientId, pratica || null)))}
              >
                <Save size={16} /> {inCorso ? "Generazione…" : "Salva nell'archivio"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

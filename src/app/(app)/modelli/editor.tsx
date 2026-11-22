"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Save, Trash2, Eye, Copy, Globe, Building2 } from "lucide-react";
import { SEGNAPOSTO } from "@/lib/modelli";
import { eliminaChecklistModello, eliminaModello, salvaChecklistModello, salvaModello } from "./actions";
import type { Database } from "@/lib/database.types";

type Modello = Database["public"]["Tables"]["document_templates"]["Row"];
type Checklist = Database["public"]["Tables"]["checklist_templates"]["Row"];

function Ambito({ officeId }: { officeId: string | null }) {
  return officeId ? (
    <span className="badge bg-brand-50 text-brand-700">
      <Building2 size={11} className="mr-1" /> della sede
    </span>
  ) : (
    <span className="badge bg-slate-100 text-slate-600">
      <Globe size={11} className="mr-1" /> della rete
    </span>
  );
}

function Esito({ e }: { e: { ok?: string; errore?: string } | null }) {
  if (!e) return null;
  return <p className={`text-sm ${e.errore ? "text-red-600" : "text-green-700"}`}>{e.errore ?? e.ok}</p>;
}

// ---------------------------------------------------------------------
// Modelli di documento
// ---------------------------------------------------------------------
type Bozza = { id?: string; perRete: boolean; nome: string; descrizione: string; corpo: string; richiede_pratica: boolean; attivo: boolean };

const MODELLO_VUOTO = `# TITOLO DEL DOCUMENTO

Il/La sottoscritto/a **{{nome_completo}}**, {{nato_a}} a {{luogo_nascita}} il {{data_nascita}}, codice fiscale {{codice_fiscale}},

## DICHIARA

- primo punto
- secondo punto

{{luogo_data}}

Firma
{{firma}}`;

export function EditorModelli({ modelli, adminRete, officeId }: { modelli: Modello[]; adminRete: boolean; officeId: string | null }) {
  const daModello = (m: Modello): Bozza => ({ id: m.id, perRete: m.office_id === null, nome: m.nome, descrizione: m.descrizione ?? "", corpo: m.corpo, richiede_pratica: m.richiede_pratica, attivo: m.attivo });
  const [bozza, setBozza] = useState<Bozza | null>(modelli[0] ? daModello(modelli[0]) : null);
  const [esito, setEsito] = useState<{ ok?: string; errore?: string } | null>(null);
  const [inCorso, avvia] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const modificabile = !!bozza && (adminRete || !bozza.perRete);
  const originale = modelli.find((m) => m.id === bozza?.id);

  const inserisci = (k: string) => {
    if (!bozza || !area.current || !modificabile) return;
    const el = area.current;
    const t = `{{${k}}}`;
    const corpo = bozza.corpo.slice(0, el.selectionStart) + t + bozza.corpo.slice(el.selectionEnd);
    const pos = el.selectionStart + t.length;
    setBozza({ ...bozza, corpo });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="card h-fit divide-y divide-slate-100">
        {modelli.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setBozza(daModello(m));
              setEsito(null);
            }}
            className={`block w-full px-3 py-2.5 text-left text-sm ${bozza?.id === m.id ? "bg-brand-50" : "hover:bg-slate-50"} ${m.attivo ? "" : "opacity-50"}`}
          >
            <div className="font-medium">{m.nome}</div>
            <div className="mt-0.5">
              <Ambito officeId={m.office_id} />
            </div>
          </button>
        ))}
        <button
          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-brand-700 hover:bg-slate-50"
          onClick={() => {
            setBozza({ perRete: adminRete && !officeId, nome: "", descrizione: "", corpo: MODELLO_VUOTO, richiede_pratica: false, attivo: true });
            setEsito(null);
          }}
        >
          <Plus size={15} /> Nuovo modello
        </button>
      </div>

      {bozza && (
        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            {!modificabile && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Modello della rete: solo la sede centrale può modificarlo.
                <button
                  className="btn-secondary py-1 text-xs"
                  onClick={() => setBozza({ ...bozza, id: undefined, perRete: false })}
                >
                  <Copy size={13} /> Crea una versione per la mia sede
                </button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={bozza.nome} disabled={!modificabile} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
              </div>
              <div>
                <label className="label">Descrizione</label>
                <input className="input" value={bozza.descrizione} disabled={!modificabile} onChange={(e) => setBozza({ ...bozza, descrizione: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bozza.richiede_pratica} disabled={!modificabile} onChange={(e) => setBozza({ ...bozza, richiede_pratica: e.target.checked })} />
                Richiede una pratica (usa tipo pratica e checklist)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bozza.attivo} disabled={!modificabile} onChange={(e) => setBozza({ ...bozza, attivo: e.target.checked })} />
                Attivo
              </label>
              {adminRete && !bozza.id && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bozza.perRete} onChange={(e) => setBozza({ ...bozza, perRete: e.target.checked })} />
                  Valido per tutta la rete
                </label>
              )}
            </div>
            <div>
              <label className="label">Testo del documento</label>
              <textarea
                ref={area}
                className="input font-mono text-xs leading-relaxed"
                rows={22}
                value={bozza.corpo}
                disabled={!modificabile}
                onChange={(e) => setBozza({ ...bozza, corpo: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">
                <code># Titolo</code> · <code>## Sottotitolo</code> · <code>- elenco</code> · <code>**grassetto**</code> · riga vuota = nuovo paragrafo
              </p>
            </div>
            <Esito e={esito} />
            <div className="flex flex-wrap justify-end gap-2">
              {bozza.id && modificabile && (
                <button
                  className="btn-danger mr-auto"
                  disabled={inCorso}
                  onClick={() =>
                    confirm(`Eliminare il modello "${bozza.nome}"?`) &&
                    avvia(async () => {
                      const r = await eliminaModello(bozza.id!);
                      setEsito(r);
                      if (r.ok) setBozza(null);
                    })
                  }
                >
                  <Trash2 size={15} /> Elimina
                </button>
              )}
              {bozza.id && (
                <a href={`/api/modelli/${bozza.id}/pdf`} target="_blank" className="btn-secondary" title="Anteprima con un cliente di esempio (versione salvata)">
                  <Eye size={15} /> Anteprima
                </a>
              )}
              {modificabile && (
                <button
                  className="btn-primary"
                  disabled={inCorso}
                  onClick={() =>
                    avvia(async () => {
                      const r = await salvaModello(bozza);
                      setEsito(r);
                      if (r.id) setBozza({ ...bozza, id: r.id });
                    })
                  }
                >
                  <Save size={15} /> Salva
                </button>
              )}
            </div>
            {originale && originale.corpo !== bozza.corpo && <p className="text-right text-xs text-amber-700">Modifiche non salvate: l&apos;anteprima mostra l&apos;ultima versione salvata.</p>}
          </div>

          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Campi automatici {modificabile && <span className="font-normal text-slate-500">(clicca per inserirli nel punto del cursore)</span>}</h3>
            <div className="grid gap-1 sm:grid-cols-2">
              {SEGNAPOSTO.map((s) => (
                <button key={s.chiave} className="flex gap-2 rounded px-2 py-1 text-left text-xs hover:bg-slate-50 disabled:hover:bg-transparent" disabled={!modificabile} onClick={() => inserisci(s.chiave)}>
                  <code className="shrink-0 text-brand-700">{`{{${s.chiave}}}`}</code>
                  <span className="text-slate-500">{s.descrizione}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            I testi predefiniti sono una base di partenza: fateli verificare dal vostro legale prima di usarli con i clienti.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Checklist per tipo di pratica
// ---------------------------------------------------------------------
type BozzaChecklist = { id?: string; perRete: boolean; tipo_pratica: string; testo: string };

export function EditorChecklist({ checklist, adminRete, officeId }: { checklist: Checklist[]; adminRete: boolean; officeId: string | null }) {
  const daRiga = (c: Checklist): BozzaChecklist => ({ id: c.id, perRete: c.office_id === null, tipo_pratica: c.tipo_pratica, testo: c.voci.join("\n") });
  const [bozza, setBozza] = useState<BozzaChecklist | null>(checklist[0] ? daRiga(checklist[0]) : null);
  const [esito, setEsito] = useState<{ ok?: string; errore?: string } | null>(null);
  const [inCorso, avvia] = useTransition();
  const modificabile = !!bozza && (adminRete || !bozza.perRete);
  const tipiSede = new Set(checklist.filter((c) => c.office_id).map((c) => c.tipo_pratica.toLowerCase()));

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="card h-fit divide-y divide-slate-100">
        {checklist.map((c) => {
          const sostituita = !c.office_id && tipiSede.has(c.tipo_pratica.toLowerCase());
          return (
            <button
              key={c.id}
              onClick={() => {
                setBozza(daRiga(c));
                setEsito(null);
              }}
              className={`block w-full px-3 py-2.5 text-left text-sm ${bozza?.id === c.id ? "bg-brand-50" : "hover:bg-slate-50"} ${sostituita ? "opacity-50" : ""}`}
            >
              <div className="font-medium">{c.tipo_pratica}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <Ambito officeId={c.office_id} /> {c.voci.length} documenti {sostituita && "· sostituita dalla sede"}
              </div>
            </button>
          );
        })}
        <button
          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-brand-700 hover:bg-slate-50"
          onClick={() => {
            setBozza({ perRete: adminRete && !officeId, tipo_pratica: "", testo: "" });
            setEsito(null);
          }}
        >
          <Plus size={15} /> Nuova checklist
        </button>
      </div>

      {bozza && (
        <div className="card space-y-3 p-4">
          {!modificabile && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Checklist della rete: solo la sede centrale può modificarla.
              <button className="btn-secondary py-1 text-xs" onClick={() => setBozza({ ...bozza, id: undefined, perRete: false })}>
                <Copy size={13} /> Personalizza per la mia sede
              </button>
            </div>
          )}
          <div>
            <label className="label">Tipo di pratica</label>
            <input
              className="input"
              value={bozza.tipo_pratica}
              disabled={!modificabile}
              onChange={(e) => setBozza({ ...bozza, tipo_pratica: e.target.value })}
              placeholder="es. Rinnovo permesso di soggiorno"
            />
            <p className="mt-1 text-xs text-slate-500">Deve coincidere con il tipo scelto quando si crea la pratica: la checklist viene aggiunta in automatico.</p>
          </div>
          {adminRete && !bozza.id && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bozza.perRete} onChange={(e) => setBozza({ ...bozza, perRete: e.target.checked })} />
              Valida per tutta la rete
            </label>
          )}
          <div>
            <label className="label">Documenti richiesti (uno per riga)</label>
            <textarea className="input text-sm leading-relaxed" rows={14} value={bozza.testo} disabled={!modificabile} onChange={(e) => setBozza({ ...bozza, testo: e.target.value })} />
          </div>
          <Esito e={esito} />
          <div className="flex justify-end gap-2">
            {bozza.id && modificabile && (
              <button
                className="btn-danger mr-auto"
                disabled={inCorso}
                onClick={() =>
                  confirm(`Eliminare la checklist "${bozza.tipo_pratica}"?`) &&
                  avvia(async () => {
                    const r = await eliminaChecklistModello(bozza.id!);
                    setEsito(r);
                    if (r.ok) setBozza(null);
                  })
                }
              >
                <Trash2 size={15} /> Elimina
              </button>
            )}
            {modificabile && (
              <button
                className="btn-primary"
                disabled={inCorso}
                onClick={() =>
                  avvia(async () => {
                    const r = await salvaChecklistModello({ id: bozza.id, perRete: bozza.perRete, tipo_pratica: bozza.tipo_pratica, voci: bozza.testo.split("\n") });
                    setEsito(r);
                    if (r.id) setBozza({ ...bozza, id: r.id });
                  })
                }
              >
                <Save size={15} /> Salva
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">Le modifiche valgono per le nuove pratiche. Le pratiche già aperte mantengono la loro checklist (si può aggiornare dalla pratica).</p>
        </div>
      )}
    </div>
  );
}

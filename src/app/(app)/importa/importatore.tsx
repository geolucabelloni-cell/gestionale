"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, Sparkles, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { CAMPI, dataIso, mappaturaAutomatica, type TipoImport } from "@/lib/importazione";
import { aiMappaColonne, importaClienti, importaNote } from "./actions";

const BLOCCO = { clienti: 300, note: 1000 };

/** Legge il file come UTF-8; se trova caratteri non validi riprova come Windows-1252 (tipico degli export TeamSystem). */
async function leggiTesto(file: File) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

export function Importatore({ sedi, aiAttiva }: { sedi: { id: string; nome: string }[]; aiAttiva: boolean }) {
  const [tipo, setTipo] = useState<TipoImport>("clienti");
  const [sede, setSede] = useState(sedi[0]?.id ?? "");
  const [nomeFile, setNomeFile] = useState<string | null>(null);
  const [intestazioni, setIntestazioni] = useState<string[]>([]);
  const [righe, setRighe] = useState<Record<string, string>[]>([]);
  const [mappa, setMappa] = useState<Record<string, string>>({});
  const [progresso, setProgresso] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ testo: string; scarti: string[] } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  async function carica(file: File) {
    setEsito(null);
    setErrore(null);
    const testo = await leggiTesto(file);
    const r = Papa.parse<Record<string, string>>(testo, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    const campi = (r.meta.fields ?? []).filter(Boolean);
    if (!campi.length || !r.data.length) return setErrore("File vuoto o non leggibile. Esporta in CSV con la prima riga di intestazione.");
    setNomeFile(file.name);
    setIntestazioni(campi);
    setRighe(r.data);
    setMappa(mappaturaAutomatica(tipo, campi));
  }

  const mappate = (lista: Record<string, string>[]) =>
    lista.map((r) => Object.fromEntries(Object.entries(mappa).map(([campo, col]) => [campo, r[col] ?? ""])));

  const obbligatoriMancanti = CAMPI[tipo].filter(
    (c) => c.obbligatorio && !mappa[c.campo] && !(tipo === "clienti" && (c.campo === "nome" || c.campo === "cognome") && mappa.nominativo),
  );
  const chiaveNoteMancante = tipo === "note" && !mappa.codice_esterno && !mappa.codice_fiscale && !mappa.nominativo;

  async function importa() {
    setEsito(null);
    let dati = mappate(righe);
    if (tipo === "note") dati = dati.sort((a, b) => (dataIso(a.data) ?? "").localeCompare(dataIso(b.data) ?? ""));
    let creati = 0,
      aggiornati = 0,
      importate = 0;
    const scarti: string[] = [];
    for (let i = 0; i < dati.length; i += BLOCCO[tipo]) {
      setProgresso(`Importazione ${Math.min(i + BLOCCO[tipo], dati.length)} di ${dati.length}…`);
      const blocco = dati.slice(i, i + BLOCCO[tipo]);
      if (tipo === "clienti") {
        const r = await importaClienti(sede, blocco);
        if ("errore" in r && r.errore) {
          setProgresso(null);
          setErrore(r.errore);
          return;
        }
        if ("creati" in r) {
          creati += r.creati ?? 0;
          aggiornati += r.aggiornati ?? 0;
          scarti.push(...(r.scarti ?? []).map((s) => s.replace(/riga (\d+)/, (_, n) => `riga ${Number(n) + i + 1}`)));
        }
      } else {
        const r = await importaNote(sede, blocco);
        if ("errore" in r && r.errore) {
          setProgresso(null);
          setErrore(r.errore);
          return;
        }
        if ("importate" in r) {
          importate += r.importate ?? 0;
          scarti.push(...(r.scarti ?? []));
        }
      }
    }
    setProgresso(null);
    setEsito({
      testo: tipo === "clienti" ? `${creati} anagrafiche create, ${aggiornati} aggiornate.` : `${importate} note importate nel diario.`,
      scarti,
    });
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">1. Cosa vuoi importare</h2>
        <div className="flex flex-wrap gap-2">
          {(["clienti", "note"] as const).map((t) => (
            <button
              key={t}
              className={tipo === t ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                setTipo(t);
                setMappa(mappaturaAutomatica(t, intestazioni));
                setEsito(null);
              }}
            >
              {t === "clienti" ? "Anagrafiche clienti" : "Note / storico clienti"}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          {tipo === "clienti"
            ? "Importa prima le anagrafiche. Se rilanci l'importazione, i clienti con lo stesso codice o codice fiscale vengono aggiornati, non duplicati."
            : "Le note vengono collegate al cliente tramite codice TeamSystem, codice fiscale o nominativo, e numerate in ordine di data."}
        </p>
        {sedi.length > 1 && (
          <div className="max-w-sm">
            <label className="label">Sede di destinazione</label>
            <select className="input" value={sede} onChange={(e) => setSede(e.target.value)}>
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="btn-secondary cursor-pointer">
          <Upload size={16} /> {nomeFile ? "Cambia file CSV" : "Scegli file CSV"}
          <input type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && carica(e.target.files[0])} />
        </label>
        {nomeFile && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <FileSpreadsheet size={16} /> {nomeFile}: {righe.length} righe, {intestazioni.length} colonne
          </p>
        )}
        {errore && <p className="text-sm text-red-600">{errore}</p>}
      </section>

      {intestazioni.length > 0 && (
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">2. Abbina le colonne</h2>
            {aiAttiva && (
              <button
                className="btn-ai"
                disabled={inCorso}
                onClick={() =>
                  avvia(async () => {
                    const r = await aiMappaColonne(tipo, intestazioni, righe.slice(0, 5).map((x) => intestazioni.map((h) => x[h] ?? "")));
                    if (r.errore) setErrore(r.errore);
                    else setMappa(r.mappa ?? {});
                  })
                }
              >
                <Sparkles size={16} /> {inCorso ? "L'AI sta leggendo il file…" : "Abbina con l'AI"}
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPI[tipo].map((c) => (
              <div key={c.campo} className="flex items-center gap-2">
                <label className="w-1/2 text-sm">
                  {c.label}
                  {c.obbligatorio && <span className="text-red-500"> *</span>}
                </label>
                <select
                  className="input w-1/2"
                  value={mappa[c.campo] ?? ""}
                  onChange={(e) => {
                    const m = { ...mappa };
                    if (e.target.value) m[c.campo] = e.target.value;
                    else delete m[c.campo];
                    setMappa(m);
                  }}
                >
                  <option value="">— non importare —</option>
                  {intestazioni.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {intestazioni.length > 0 && (
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">3. Anteprima e importazione</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {Object.keys(mappa).map((k) => (
                    <th key={k} className="px-2 py-1.5 whitespace-nowrap">
                      {CAMPI[tipo].find((c) => c.campo === k)?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappate(righe.slice(0, 5)).map((r, i) => (
                  <tr key={i}>
                    {Object.keys(mappa).map((k) => (
                      <td key={k} className="max-w-48 truncate px-2 py-1.5">
                        {r[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {obbligatoriMancanti.length > 0 && <p className="text-sm text-amber-700">Abbina i campi obbligatori: {obbligatoriMancanti.map((c) => c.label).join(", ")}</p>}
          {chiaveNoteMancante && <p className="text-sm text-amber-700">Abbina almeno uno tra codice cliente, codice fiscale o nominativo.</p>}
          {progresso && <p className="animate-pulse text-sm text-brand-700">{progresso}</p>}
          {esito && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 size={16} className="mr-1 inline" /> {esito.testo}
              {esito.scarti.length > 0 && (
                <details className="mt-2 text-amber-800">
                  <summary>{esito.scarti.length} righe non importate</summary>
                  <ul className="mt-1 max-h-48 list-disc overflow-auto pl-5 text-xs">
                    {esito.scarti.slice(0, 300).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button className="btn-primary" disabled={!!progresso || obbligatoriMancanti.length > 0 || chiaveNoteMancante || !sede} onClick={() => void importa()}>
              Importa {righe.length} righe
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Trash2,
  Pencil,
  ChevronRight,
  Download,
  MessageCircle,
  Files,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  analizzaDocumentoAi,
  creaCartella,
  eliminaCartella,
  eliminaDocumento,
  registraDocumento,
  rinominaCartella,
  rinominaDocumento,
  spostaDocumento,
} from "@/app/(app)/clienti/actions";
import { dataOra, dimensione } from "@/lib/format";

type Cartella = { id: string; nome: string; parent_id: string | null };
type Documento = {
  id: string;
  nome: string;
  folder_id: string | null;
  mime_type: string | null;
  dimensione: number | null;
  origine: string;
  ai_riepilogo: string | null;
  ai_tipo_documento: string | null;
  created_at: string;
};

const TUTTI = "__tutti__";

function nomeSicuro(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._ -]/g, "").replace(/\s+/g, "_").slice(0, 120) || "file";
}

export function Archivio(props: { clientId: string; officeId: string; cartelle: Cartella[]; documenti: Documento[]; aiAttiva: boolean }) {
  const { clientId, officeId, cartelle, documenti, aiAttiva } = props;
  const [selezionata, setSelezionata] = useState<string>(TUTTI);
  const [aperte, setAperte] = useState<Set<string>>(new Set());
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);
  const [caricamento, setCaricamento] = useState<string | null>(null);
  const [usaAi, setUsaAi] = useState(true);
  const [inCorso, avvia] = useTransition();
  const inputFile = useRef<HTMLInputElement>(null);

  const figli = useMemo(() => {
    const m = new Map<string | null, Cartella[]>();
    for (const c of cartelle) m.set(c.parent_id, [...(m.get(c.parent_id) ?? []), c]);
    return m;
  }, [cartelle]);
  const percorso = (id: string | null): Cartella[] => {
    const c = cartelle.find((x) => x.id === id);
    return c ? [...percorso(c.parent_id), c] : [];
  };
  const contaDoc = (id: string): number => documenti.filter((d) => d.folder_id === id).length + (figli.get(id) ?? []).reduce((s, f) => s + contaDoc(f.id), 0);

  const cartellaCorrente = selezionata === TUTTI ? null : selezionata;
  const visibili = selezionata === TUTTI ? documenti : documenti.filter((d) => d.folder_id === selezionata);
  const sottocartelle = cartellaCorrente ? (figli.get(cartellaCorrente) ?? []) : [];

  const esito = (r: { errore?: string; ok?: string } | undefined | void) => {
    if (r?.errore) setMessaggio({ tipo: "errore", testo: r.errore });
    else if (r?.ok) setMessaggio({ tipo: "ok", testo: r.ok });
  };

  async function carica(fileList: FileList) {
    const files = Array.from(fileList); // copia: il FileList si svuota quando si resetta l'input
    const supabase = createClient();
    setMessaggio(null);
    let i = 0;
    for (const file of files) {
      i++;
      setCaricamento(`Caricamento ${i}/${files.length}: ${file.name}`);
      const path = `${officeId}/${clientId}/${crypto.randomUUID()}-${nomeSicuro(file.name)}`;
      const { error } = await supabase.storage.from("documenti").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) {
        setMessaggio({ tipo: "errore", testo: `${file.name}: ${error.message}` });
        continue;
      }
      if (usaAi && aiAttiva) setCaricamento(`Analisi AI ${i}/${files.length}: ${file.name}`);
      const r = await registraDocumento({
        clientId,
        folderId: cartellaCorrente,
        nome: file.name,
        storagePath: path,
        mime: file.type || "application/octet-stream",
        dimensione: file.size,
        analizzaConAi: usaAi && aiAttiva,
      });
      if (r.errore) setMessaggio({ tipo: "errore", testo: r.errore });
    }
    setCaricamento(null);
    if (inputFile.current) inputFile.current.value = "";
    setMessaggio((m) => m ?? { tipo: "ok", testo: `${files.length} file caricati${!cartellaCorrente && usaAi && aiAttiva ? " e archiviati dall'AI nelle cartelle" : ""}` });
  }

  const nuovaCartella = () => {
    const nome = prompt(cartellaCorrente ? `Nuova sottocartella in "${percorso(cartellaCorrente).map((c) => c.nome).join(" / ")}"` : "Nome della nuova cartella");
    if (nome) avvia(async () => esito(await creaCartella(clientId, cartellaCorrente, nome)));
    if (cartellaCorrente) setAperte(new Set([...aperte, cartellaCorrente]));
  };

  function NodoCartella({ c, livello }: { c: Cartella; livello: number }) {
    const sub = figli.get(c.id) ?? [];
    const aperta = aperte.has(c.id);
    const n = contaDoc(c.id);
    return (
      <div>
        <div
          className={`flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-sm ${selezionata === c.id ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-100"}`}
          style={{ paddingLeft: 8 + livello * 14 }}
          onClick={() => setSelezionata(c.id)}
        >
          <button
            className={`shrink-0 transition ${sub.length ? "" : "invisible"} ${aperta ? "rotate-90" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              const s = new Set(aperte);
              if (aperta) s.delete(c.id);
              else s.add(c.id);
              setAperte(s);
            }}
          >
            <ChevronRight size={14} />
          </button>
          {selezionata === c.id ? <FolderOpen size={16} className="shrink-0 text-amber-500" /> : <Folder size={16} className="shrink-0 text-amber-500" />}
          <span className="flex-1 truncate">{c.nome}</span>
          {n > 0 && <span className="text-xs text-slate-400">{n}</span>}
        </div>
        {aperta && sub.map((s) => <NodoCartella key={s.id} c={s} livello={livello + 1} />)}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Albero cartelle */}
      <div className="card h-fit p-2">
        <div
          className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${selezionata === TUTTI ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-100"}`}
          onClick={() => setSelezionata(TUTTI)}
        >
          <Files size={16} /> <span className="flex-1">Tutti i documenti</span>
          <span className="text-xs text-slate-400">{documenti.length}</span>
        </div>
        <div className="my-1 border-t border-slate-100" />
        {(figli.get(null) ?? []).map((c) => (
          <NodoCartella key={c.id} c={c} livello={0} />
        ))}
        <button className="btn-ghost mt-2 w-full justify-start text-xs" onClick={nuovaCartella} disabled={inCorso}>
          <FolderPlus size={14} /> {cartellaCorrente ? "Nuova sottocartella" : "Nuova cartella"}
        </button>
      </div>

      {/* Contenuto */}
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <div className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <button className="text-slate-500 hover:underline" onClick={() => setSelezionata(TUTTI)}>
              Archivio
            </button>
            {percorso(cartellaCorrente).map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-slate-300" />
                <button className="hover:underline" onClick={() => setSelezionata(c.id)}>
                  {c.nome}
                </button>
              </span>
            ))}
          </div>
          {cartellaCorrente && (
            <>
              <button
                className="btn-ghost"
                title="Rinomina cartella"
                onClick={() => {
                  const c = cartelle.find((x) => x.id === cartellaCorrente)!;
                  const nome = prompt("Nuovo nome", c.nome);
                  if (nome && nome !== c.nome) avvia(async () => esito(await rinominaCartella(c.id, clientId, nome)));
                }}
              >
                <Pencil size={15} />
              </button>
              <button
                className="btn-ghost text-red-600"
                title="Elimina cartella"
                onClick={() => {
                  if (confirm("Eliminare la cartella e le sue sottocartelle vuote?"))
                    avvia(async () => {
                      const r = await eliminaCartella(cartellaCorrente, clientId);
                      esito(r);
                      if (!r.errore) setSelezionata(TUTTI);
                    });
                }}
              >
                <Trash2 size={15} />
              </button>
              <button className="btn-secondary" onClick={nuovaCartella}>
                <FolderPlus size={15} /> Sottocartella
              </button>
            </>
          )}
          {aiAttiva && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600" title="L'AI riconosce il documento, scrive un riepilogo e (se carichi in 'Tutti i documenti') sceglie la cartella">
              <input type="checkbox" checked={usaAi} onChange={(e) => setUsaAi(e.target.checked)} />
              <Sparkles size={13} className="text-violet-600" /> Analizza con AI
            </label>
          )}
          <label className={`btn-primary cursor-pointer ${caricamento ? "pointer-events-none opacity-60" : ""}`}>
            <Upload size={15} /> Carica file
            <input ref={inputFile} type="file" multiple className="hidden" onChange={(e) => e.target.files?.length && carica(e.target.files)} />
          </label>
        </div>

        {caricamento && <div className="animate-pulse rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">{caricamento}</div>}
        {messaggio && (
          <div className={`rounded-lg px-4 py-2 text-sm ${messaggio.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {messaggio.testo}
          </div>
        )}

        {sottocartelle.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sottocartelle.map((s) => (
              <button key={s.id} className="card flex items-center gap-2 p-3 text-left text-sm hover:border-brand-300" onClick={() => {
                setSelezionata(s.id);
                setAperte(new Set([...aperte, cartellaCorrente!]));
              }}>
                <Folder size={18} className="text-amber-500" /> <span className="flex-1 truncate">{s.nome}</span>
                <span className="text-xs text-slate-400">{contaDoc(s.id)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="card divide-y divide-slate-100">
          {visibili.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nessun documento in questa cartella.</p>}
          {visibili.map((d) => (
            <RigaDocumento
              key={d.id}
              d={d}
              clientId={clientId}
              cartelle={cartelle}
              percorso={(id) => percorso(id).map((c) => c.nome).join(" / ")}
              mostraCartella={selezionata === TUTTI}
              aiAttiva={aiAttiva}
              onEsito={esito}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RigaDocumento(p: {
  d: Documento;
  clientId: string;
  cartelle: Cartella[];
  percorso: (id: string | null) => string;
  mostraCartella: boolean;
  aiAttiva: boolean;
  onEsito: (r: { errore?: string; ok?: string } | undefined) => void;
}) {
  const { d, clientId } = p;
  const [inCorso, avvia] = useTransition();
  const immagine = d.mime_type?.startsWith("image/");
  const analizzabile = d.mime_type === "application/pdf" || immagine;
  const opzioni = p.cartelle.map((c) => ({ id: c.id, nome: p.percorso(c.id) })).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className={`flex flex-wrap items-start gap-3 p-3 ${inCorso ? "opacity-60" : ""}`}>
      <div className="mt-0.5 text-slate-400">{immagine ? <ImageIcon size={20} /> : <FileText size={20} />}</div>
      <div className="min-w-0 flex-1">
        <a href={`/api/documenti/${d.id}`} target="_blank" className="font-medium break-all text-brand-700 hover:underline">
          {d.nome}
        </a>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
          <span>{dataOra(d.created_at)}</span>
          {d.dimensione ? <span>{dimensione(d.dimensione)}</span> : null}
          {d.origine === "whatsapp" && (
            <span className="inline-flex items-center gap-1 text-green-600">
              <MessageCircle size={12} /> da WhatsApp
            </span>
          )}
          {p.mostraCartella && <span>📁 {d.folder_id ? p.percorso(d.folder_id) : "Senza cartella"}</span>}
        </div>
        {(d.ai_tipo_documento || d.ai_riepilogo) && (
          <div className="mt-1 text-xs text-violet-700">
            <Sparkles size={11} className="mr-1 inline" />
            {d.ai_tipo_documento && <strong>{d.ai_tipo_documento}: </strong>}
            {d.ai_riepilogo}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <select
          className="input w-40 py-1 text-xs"
          value={d.folder_id ?? ""}
          title="Sposta in cartella"
          onChange={(e) => avvia(() => spostaDocumento(d.id, e.target.value || null, clientId))}
        >
          <option value="">Senza cartella</option>
          {opzioni.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
        <a className="btn-ghost px-2" href={`/api/documenti/${d.id}?download=1`} title="Scarica">
          <Download size={15} />
        </a>
        {p.aiAttiva && analizzabile && (
          <button className="btn-ghost px-2 text-violet-600" title="Analizza con AI" disabled={inCorso} onClick={() => avvia(async () => p.onEsito(await analizzaDocumentoAi(d.id, clientId)))}>
            <Sparkles size={15} />
          </button>
        )}
        <button
          className="btn-ghost px-2"
          title="Rinomina"
          onClick={() => {
            const nome = prompt("Nuovo nome", d.nome);
            if (nome && nome !== d.nome) avvia(() => rinominaDocumento(d.id, nome, clientId));
          }}
        >
          <Pencil size={15} />
        </button>
        <button
          className="btn-ghost px-2 text-red-600"
          title="Elimina"
          onClick={() => confirm(`Eliminare "${d.nome}"?`) && avvia(() => eliminaDocumento(d.id, clientId))}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Sparkles, Upload } from "lucide-react";
import { salvaCliente, aiEstraiDaDocumento } from "@/app/(app)/clienti/actions";
import { LINGUE, TIPI_PERMESSO } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Cliente = Partial<Database["public"]["Tables"]["clients"]["Row"]>;

const CAMPI_AI = [
  "nome",
  "cognome",
  "sesso",
  "data_nascita",
  "luogo_nascita",
  "cittadinanza",
  "codice_fiscale",
  "passaporto_numero",
  "passaporto_scadenza",
  "permesso_tipo",
  "permesso_numero",
  "permesso_scadenza",
  "indirizzo",
] as const;

export function ClienteForm({ cliente, sedi, aiAttiva }: { cliente?: Cliente; sedi?: { id: string; nome: string }[]; aiAttiva: boolean }) {
  const [stato, azione, salvataggio] = useActionState(salvaCliente, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [estrazione, avviaEstrazione] = useTransition();
  const [msgAi, setMsgAi] = useState<string | null>(null);

  function compilaDaDocumento(file: File) {
    setMsgAi(null);
    avviaEstrazione(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await aiEstraiDaDocumento(fd);
      if (r.errore || !r.dati) return setMsgAi(r.errore ?? "Errore");
      const form = formRef.current!;
      let compilati = 0;
      for (const campo of CAMPI_AI) {
        const v = r.dati[campo];
        const el = form.elements.namedItem(campo) as HTMLInputElement | HTMLSelectElement | null;
        if (v && el && !el.value) {
          el.value = v;
          compilati++;
        }
      }
      setMsgAi(`${r.dati.tipo_documento}: compilati ${compilati} campi. Controlla i dati prima di salvare.`);
    });
  }

  const c = cliente ?? {};
  return (
    <form ref={formRef} action={azione} className="space-y-6">
      {c.id && <input type="hidden" name="id" value={c.id} />}

      {aiAttiva && (
        <div className="card flex flex-wrap items-center gap-3 border-violet-200 bg-violet-50/50 p-4">
          <Sparkles className="text-violet-600" size={20} />
          <div className="flex-1 text-sm">
            <div className="font-medium">Compila da documento</div>
            <div className="text-slate-500">Carica la foto o il PDF di passaporto, permesso di soggiorno o carta d&apos;identità: l&apos;AI compila i campi vuoti.</div>
          </div>
          <label className="btn-ai cursor-pointer">
            <Upload size={16} /> {estrazione ? "Lettura in corso…" : "Carica documento"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={estrazione}
              onChange={(e) => e.target.files?.[0] && compilaDaDocumento(e.target.files[0])}
            />
          </label>
          {msgAi && <div className="w-full text-sm text-violet-800">{msgAi}</div>}
        </div>
      )}

      <Sezione titolo="Dati anagrafici">
        {sedi && sedi.length > 0 && !c.id && (
          <Campo label="Sede *">
            <select name="office_id" className="input" required defaultValue={sedi[0]?.id}>
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo label="Nome *">
          <input name="nome" required defaultValue={c.nome ?? ""} className="input" />
        </Campo>
        <Campo label="Cognome *">
          <input name="cognome" required defaultValue={c.cognome ?? ""} className="input" />
        </Campo>
        <Campo label="Sesso">
          <select name="sesso" defaultValue={c.sesso ?? ""} className="input">
            <option value="">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">X</option>
          </select>
        </Campo>
        <Campo label="Data di nascita">
          <input type="date" name="data_nascita" defaultValue={c.data_nascita ?? ""} className="input" />
        </Campo>
        <Campo label="Luogo di nascita">
          <input name="luogo_nascita" defaultValue={c.luogo_nascita ?? ""} className="input" />
        </Campo>
        <Campo label="Cittadinanza">
          <input name="cittadinanza" defaultValue={c.cittadinanza ?? ""} className="input" />
        </Campo>
        <Campo label="Codice fiscale">
          <input name="codice_fiscale" defaultValue={c.codice_fiscale ?? ""} className="input uppercase" maxLength={16} />
        </Campo>
        <Campo label="Stato civile">
          <select name="stato_civile" defaultValue={c.stato_civile ?? ""} className="input">
            <option value="">—</option>
            {["Celibe/Nubile", "Coniugato/a", "Unito/a civilmente", "Separato/a", "Divorziato/a", "Vedovo/a"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Campo>
      </Sezione>

      <Sezione titolo="Contatti">
        <Campo label="Telefono / WhatsApp">
          <input name="telefono" defaultValue={c.telefono ? "+" + c.telefono : ""} placeholder="+39 333 1234567" className="input" />
        </Campo>
        <Campo label="Email">
          <input type="email" name="email" defaultValue={c.email ?? ""} className="input" />
        </Campo>
        <Campo label="Lingua preferita">
          <select name="lingua_preferita" defaultValue={c.lingua_preferita ?? "it"} className="input">
            {Object.entries(LINGUE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Indirizzo">
          <input name="indirizzo" defaultValue={c.indirizzo ?? ""} className="input" />
        </Campo>
        <Campo label="Città">
          <input name="citta" defaultValue={c.citta ?? ""} className="input" />
        </Campo>
        <Campo label="CAP">
          <input name="cap" defaultValue={c.cap ?? ""} className="input" maxLength={5} />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="whatsapp_attivo" defaultChecked={c.whatsapp_attivo ?? true} /> Contattabile su WhatsApp
        </label>
      </Sezione>

      <Sezione titolo="Documenti di soggiorno">
        <Campo label="N. passaporto">
          <input name="passaporto_numero" defaultValue={c.passaporto_numero ?? ""} className="input uppercase" />
        </Campo>
        <Campo label="Scadenza passaporto">
          <input type="date" name="passaporto_scadenza" defaultValue={c.passaporto_scadenza ?? ""} className="input" />
        </Campo>
        <div />
        <Campo label="Tipo permesso di soggiorno">
          <input name="permesso_tipo" list="tipi-permesso" defaultValue={c.permesso_tipo ?? ""} className="input" />
          <datalist id="tipi-permesso">
            {TIPI_PERMESSO.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Campo>
        <Campo label="N. permesso">
          <input name="permesso_numero" defaultValue={c.permesso_numero ?? ""} className="input uppercase" />
        </Campo>
        <Campo label="Scadenza permesso">
          <input type="date" name="permesso_scadenza" defaultValue={c.permesso_scadenza ?? ""} className="input" />
        </Campo>
      </Sezione>

      <Sezione titolo="Altro">
        <div className="sm:col-span-2 lg:col-span-3">
          <Campo label="Note generali">
            <textarea name="note_generali" rows={3} defaultValue={c.note_generali ?? ""} className="input" />
          </Campo>
        </div>
        <Campo label="Etichette (separate da virgola)">
          <input name="tags" defaultValue={(c.tags ?? []).join(", ")} placeholder="es. famiglia, urgente" className="input" />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consenso_privacy" defaultChecked={c.consenso_privacy ?? false} /> Consenso privacy firmato
        </label>
        <input type="hidden" name="consenso_privacy_data" value={c.consenso_privacy_data ?? ""} />
      </Sezione>

      {stato?.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => history.back()}>
          Annulla
        </button>
        <button className="btn-primary" disabled={salvataggio}>
          {salvataggio ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </form>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-semibold">{titolo}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

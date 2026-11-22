"use client";

import { useActionState, useState, useTransition } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { creaUtente, impostaAttivo, reimpostaPassword, salvaSede } from "./actions";
import { ETICHETTE_RUOLO_CLIENT } from "./etichette";
import type { Database } from "@/lib/database.types";

type Sede = Database["public"]["Tables"]["offices"]["Row"];

export const MODELLO_ISTRUZIONI = `INDIRIZZO: Via ..., n. ..., Città
ORARI: lunedì–venerdì 9:00–13:00 e 15:00–19:00; sabato 9:00–12:00
APPUNTAMENTI: si prenotano scrivendo qui su WhatsApp o chiamando lo 0X XXXXXXX
DOCUMENTI DA PORTARE PER IL RINNOVO DEL PERMESSO: passaporto, permesso in scadenza, codice fiscale, contratto di lavoro e ultime 3 buste paga, CUD/730, contratto d'affitto o dichiarazione di ospitalità, 4 foto tessera, marca da bollo da 16 €
DOCUMENTI PER RICONGIUNGIMENTO: ...
TARIFFE (solo se volete che l'AI le comunichi): ...
LINGUE PARLATE IN SEDE: italiano, inglese, francese, arabo
NOTE: non diamo consulenze legali via WhatsApp: per valutare il caso serve un appuntamento.`;

export function FormSede({
  sede,
  haToken,
  haTokenGlobale,
  aiAttiva,
  webhookUrl,
  haTokenCallbell,
  webhookCallbell,
}: {
  sede: Sede;
  haToken: boolean;
  haTokenGlobale: boolean;
  aiAttiva: boolean;
  webhookUrl: string;
  haTokenCallbell: boolean;
  webhookCallbell: string | null;
}) {
  const [stato, azione, salvataggio] = useActionState(salvaSede, null);
  const [provider, setProvider] = useState(sede.wa_provider);
  return (
    <form onSubmit={inviaSenzaReset(azione)} className="space-y-6">
      <input type="hidden" name="id" value={sede.id} />
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Dati della sede</h2>
        <Campo label="Nome">
          <input name="nome" required defaultValue={sede.nome} className="input" />
        </Campo>
        <Campo label="Città">
          <input name="citta" defaultValue={sede.citta ?? ""} className="input" />
        </Campo>
        <Campo label="Indirizzo">
          <input name="indirizzo" defaultValue={sede.indirizzo ?? ""} className="input" />
        </Campo>
        <Campo label="Telefono">
          <input name="telefono" defaultValue={sede.telefono ?? ""} className="input" />
        </Campo>
        <Campo label="Email">
          <input name="email" type="email" defaultValue={sede.email ?? ""} className="input" />
        </Campo>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Assistente AI su WhatsApp</h2>
        {!aiAttiva && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">L&apos;AI non è configurata sul server (ANTHROPIC_API_KEY mancante).</p>}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="ai_risposta_automatica" defaultChecked={sede.ai_risposta_automatica} className="mt-1" />
          <span>
            <strong>Risposte automatiche alle domande semplici</strong>
            <br />
            <span className="text-slate-500">
              L&apos;AI risponde da sola a orari, documenti da portare, stato pratica e conferme di ricezione. Consulenze, urgenze e casi dubbi vengono passati a un operatore con una bozza di risposta già pronta.
            </span>
          </span>
        </label>
        <Campo label="Informazioni per l'AI (orari, indirizzo, documenti richiesti, tariffe…)">
          <textarea name="ai_istruzioni" rows={12} defaultValue={sede.ai_istruzioni || MODELLO_ISTRUZIONI} className="input font-mono text-xs" />
        </Campo>
        <p className="text-xs text-slate-500">L&apos;AI risponde solo con le informazioni scritte qui e con i dati del cliente: tutto ciò che non è scritto viene passato a un operatore.</p>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Collegamento WhatsApp</h2>
        <div className="sm:col-span-2">
          <label className="label">Fornitore WhatsApp</label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="wa_provider" value="callbell" checked={provider === "callbell"} onChange={() => setProvider("callbell")} /> Callbell (quello che usate oggi)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="wa_provider" value="meta" checked={provider === "meta"} onChange={() => setProvider("meta")} /> Meta WhatsApp Cloud API (diretto)
            </label>
          </div>
        </div>

        {provider === "callbell" ? (
          <>
            <div className="sm:col-span-2">
              <Campo label={`Chiave API Callbell ${haTokenCallbell ? "(impostata – lascia vuoto per non modificarla)" : ""}`}>
                <input name="callbell_api_token" type="password" autoComplete="off" className="input" placeholder={haTokenCallbell ? "••••••••" : "Callbell → Impostazioni → API"} />
              </Campo>
            </div>
            <Campo label="UUID canale WhatsApp (se avete più numeri)">
              <input name="callbell_channel_uuid" defaultValue={sede.callbell_channel_uuid ?? ""} className="input" />
            </Campo>
            <input type="hidden" name="wa_phone_number_id" value={sede.wa_phone_number_id ?? ""} />
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
              {webhookCallbell ? (
                <>
                  URL da inserire in Callbell (Impostazioni → Integrazioni → Webhook, evento <code>message_created</code> e <code>message_status_updated</code>):
                  <br />
                  <code className="font-mono break-all select-all">{webhookCallbell}</code>
                  <br />
                  L&apos;URL contiene un codice segreto: non condividerlo.
                </>
              ) : (
                "Salva le impostazioni per generare l'URL del webhook da inserire in Callbell."
              )}
            </div>
          </>
        ) : (
          <>
            <Campo label="Phone Number ID">
              <input name="wa_phone_number_id" defaultValue={sede.wa_phone_number_id ?? ""} className="input" placeholder="es. 123456789012345" />
            </Campo>
            <Campo label="Numero visualizzato">
              <input name="wa_numero_visualizzato" defaultValue={sede.wa_numero_visualizzato ?? ""} className="input" placeholder="+39 333 1234567" />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label={`Token di accesso della sede ${haToken ? "(impostato – lascia vuoto per non modificarlo)" : haTokenGlobale ? "(facoltativo: si usa il token della rete)" : ""}`}>
                <input name="wa_access_token" type="password" autoComplete="off" className="input" placeholder={haToken ? "••••••••" : "EAAG…"} />
              </Campo>
              {haToken && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" name="rimuovi_token" /> Rimuovi il token della sede
                </label>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
              URL del webhook da inserire in Meta: <code className="font-mono">{webhookUrl}</code>
              <br />
              Campo da sottoscrivere: <code>messages</code>. Il token di verifica è quello impostato sul server (WHATSAPP_VERIFY_TOKEN).
            </div>
          </>
        )}
        {provider === "callbell" && <input type="hidden" name="wa_numero_visualizzato" value={sede.wa_numero_visualizzato ?? ""} />}
      </section>

      {stato?.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
      {stato?.ok && <p className="text-sm text-green-700">{stato.ok}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={salvataggio}>
          {salvataggio ? "Salvataggio…" : "Salva impostazioni"}
        </button>
      </div>
    </form>
  );
}

export function FormUtente({ officeId, ruoli }: { officeId: string; ruoli: string[] }) {
  const [stato, azione, salvataggio] = useActionState(creaUtente, null);
  return (
    <form onSubmit={inviaSenzaReset(azione)} className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
      <h3 className="text-sm font-semibold sm:col-span-2">Aggiungi utente</h3>
      <input type="hidden" name="office_id" value={officeId} />
      <input name="nome_completo" required placeholder="Nome e cognome" className="input" />
      <input name="email" type="email" required placeholder="Email" className="input" />
      <input name="password" type="text" required minLength={8} placeholder="Password iniziale (min. 8 caratteri)" className="input" autoComplete="off" />
      <select name="ruolo" className="input">
        {ruoli.map((r) => (
          <option key={r} value={r}>
            {ETICHETTE_RUOLO_CLIENT[r]}
          </option>
        ))}
      </select>
      {stato?.errore && <p className="text-sm text-red-600 sm:col-span-2">{stato.errore}</p>}
      {stato?.ok && <p className="text-sm text-green-700 sm:col-span-2">{stato.ok}</p>}
      <div className="flex justify-end sm:col-span-2">
        <button className="btn-primary" disabled={salvataggio}>
          Crea utente
        </button>
      </div>
    </form>
  );
}

export function AzioniUtente({ userId, attivo }: { userId: string; attivo: boolean }) {
  const [inCorso, avvia] = useTransition();
  return (
    <div className="flex gap-1">
      <button
        className="btn-ghost text-xs"
        disabled={inCorso}
        onClick={() => {
          const pw = prompt("Nuova password (min. 8 caratteri)");
          if (pw) avvia(async () => alert((await reimpostaPassword(userId, pw)).errore ?? "Password aggiornata"));
        }}
      >
        Reimposta password
      </button>
      <button
        className={`btn-ghost text-xs ${attivo ? "text-red-600" : "text-green-700"}`}
        disabled={inCorso}
        onClick={() => avvia(async () => void (await impostaAttivo(userId, !attivo)))}
      >
        {attivo ? "Disattiva" : "Riattiva"}
      </button>
    </div>
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

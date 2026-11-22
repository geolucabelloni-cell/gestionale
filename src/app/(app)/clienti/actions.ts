"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { richiediProfilo } from "@/lib/auth";
import { normalizzaTelefono } from "@/lib/telefono";
import { caricaContestoCliente, oggiISO } from "@/lib/contesto";
import { analizzaDocumento, BUCKET, percorsoStorage } from "@/lib/documenti";
import {
  AiNonConfigurata,
  AiRifiuto,
  domandaSuCliente,
  estraiDatiDocumento,
  mimeSupportatoDaAi,
  riassuntoCliente,
  type DatiDocumento,
} from "@/lib/ai/claude";
import type { Database, Json } from "@/lib/database.types";

type Esito = { errore?: string; ok?: string; id?: string } | null;

/** office_id dei record figli viene sempre ricopiato dal cliente da un trigger nel database. */
const DA_TRIGGER = "00000000-0000-0000-0000-000000000000";

function messaggioErroreAi(e: unknown) {
  if (e instanceof AiNonConfigurata) return "AI non configurata (manca ANTHROPIC_API_KEY).";
  if (e instanceof AiRifiuto) return "L'AI non ha potuto elaborare questa richiesta.";
  console.error(e);
  return "Errore durante l'elaborazione AI. Riprova.";
}

async function log(azione: string, entita: string, entitaId: string | null, officeId: string | null, dettagli?: Json) {
  const supabase = await createClient();
  const p = await richiediProfilo();
  await supabase.from("audit_log").insert({ azione, entita, entita_id: entitaId, office_id: officeId, user_id: p.id, dettagli: dettagli ?? null });
}

// ---------------------------------------------------------------------
// Anagrafica
// ---------------------------------------------------------------------
const testo = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function salvaCliente(_: Esito, f: FormData): Promise<Esito> {
  const profilo = await richiediProfilo();
  const supabase = await createClient();
  const id = testo(f, "id");

  const nome = testo(f, "nome");
  const cognome = testo(f, "cognome");
  if (!nome || !cognome) return { errore: "Nome e cognome sono obbligatori" };

  const dati: Database["public"]["Tables"]["clients"]["Update"] = {
    nome,
    cognome,
    sesso: testo(f, "sesso"),
    data_nascita: testo(f, "data_nascita"),
    luogo_nascita: testo(f, "luogo_nascita"),
    cittadinanza: testo(f, "cittadinanza"),
    codice_fiscale: testo(f, "codice_fiscale")?.toUpperCase() ?? null,
    stato_civile: testo(f, "stato_civile"),
    telefono: normalizzaTelefono(testo(f, "telefono")),
    whatsapp_attivo: f.get("whatsapp_attivo") === "on",
    email: testo(f, "email")?.toLowerCase() ?? null,
    indirizzo: testo(f, "indirizzo"),
    citta: testo(f, "citta"),
    cap: testo(f, "cap"),
    lingua_preferita: testo(f, "lingua_preferita") ?? "it",
    passaporto_numero: testo(f, "passaporto_numero")?.toUpperCase() ?? null,
    passaporto_scadenza: testo(f, "passaporto_scadenza"),
    permesso_tipo: testo(f, "permesso_tipo"),
    permesso_numero: testo(f, "permesso_numero")?.toUpperCase() ?? null,
    permesso_scadenza: testo(f, "permesso_scadenza"),
    note_generali: testo(f, "note_generali"),
    consenso_privacy: f.get("consenso_privacy") === "on",
    tags: (testo(f, "tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
  if (dati.consenso_privacy && !testo(f, "consenso_privacy_data")) dati.consenso_privacy_data = oggiISO();
  else dati.consenso_privacy_data = testo(f, "consenso_privacy_data");

  let clientId = id;
  if (id) {
    const { error } = await supabase.from("clients").update(dati).eq("id", id);
    if (error) return { errore: "Salvataggio non riuscito: " + error.message };
    await log("modifica_cliente", "clients", id, null);
  } else {
    const officeId = profilo.ruolo === "admin_rete" ? (testo(f, "office_id") ?? profilo.office_id) : profilo.office_id;
    if (!officeId) return { errore: "Seleziona la sede del cliente" };
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...dati, nome, cognome, office_id: officeId, created_by: profilo.id })
      .select("id")
      .single();
    if (error || !data) return { errore: "Creazione non riuscita: " + (error?.message ?? "") };
    clientId = data.id;
    await log("crea_cliente", "clients", clientId, officeId);
  }

  if (clientId && dati.telefono) await associaMessaggiWhatsapp(clientId);
  revalidatePath("/clienti");
  redirect(`/clienti/${clientId}`);
}

/**
 * Collega al cliente i messaggi WhatsApp arrivati dal suo numero prima che avesse
 * un'anagrafica, e sposta gli eventuali allegati nella sua cartella WhatsApp.
 */
export async function associaMessaggiWhatsapp(clientId: string) {
  const supabase = await createClient();
  // verifica accesso con la sessione dell'utente (RLS)
  const { data: cli } = await supabase.from("clients").select("id, office_id, telefono").eq("id", clientId).single();
  if (!cli?.telefono) return;
  const admin = createAdminClient();
  const { data: orfani } = await admin
    .from("whatsapp_messages")
    .select("id, media_path, media_mime, created_at")
    .eq("office_id", cli.office_id)
    .eq("telefono", cli.telefono)
    .is("client_id", null);
  if (!orfani?.length) return;

  const { data: cartellaWa } = await admin.from("folders").select("id").eq("client_id", clientId).ilike("nome", "whatsapp").is("parent_id", null).maybeSingle();
  for (const m of orfani) {
    let documentId: string | null = null;
    if (m.media_path) {
      const nome = m.media_path.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "");
      const nuovo = percorsoStorage(cli.office_id, clientId, nome);
      const mv = await admin.storage.from(BUCKET).move(m.media_path, nuovo);
      if (!mv.error) {
        const { data: doc } = await admin
          .from("documents")
          .insert({ client_id: clientId, office_id: cli.office_id, folder_id: cartellaWa?.id ?? null, nome, storage_path: nuovo, mime_type: m.media_mime, origine: "whatsapp" })
          .select("id")
          .single();
        documentId = doc?.id ?? null;
      }
    }
    await admin
      .from("whatsapp_messages")
      .update({ client_id: clientId, ...(documentId ? { document_id: documentId, media_path: null } : {}) })
      .eq("id", m.id);
  }
}

export async function eliminaCliente(clientId: string) {
  const profilo = await richiediProfilo();
  if (profilo.ruolo === "operatore") return { errore: "Solo il titolare può eliminare un cliente" };
  const supabase = await createClient();
  const { data: docs } = await supabase.from("documents").select("storage_path").eq("client_id", clientId);
  const { data: cli } = await supabase.from("clients").select("office_id, nome, cognome").eq("id", clientId).single();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return { errore: error.message };
  if (docs?.length) await supabase.storage.from(BUCKET).remove(docs.map((d) => d.storage_path));
  await log("elimina_cliente", "clients", clientId, cli?.office_id ?? null, { nome: `${cli?.nome} ${cli?.cognome}` });
  revalidatePath("/clienti");
  redirect("/clienti");
}

// ---------------------------------------------------------------------
// Diario
// ---------------------------------------------------------------------
export async function aggiungiNota(_: Esito, f: FormData): Promise<Esito> {
  await richiediProfilo();
  const supabase = await createClient();
  const clientId = String(f.get("client_id"));
  const t = String(f.get("testo") ?? "").trim();
  if (!t) return { errore: "Scrivi il testo della nota" };
  const { data: nuova, error } = await supabase.from("client_notes").insert({
    client_id: clientId,
    office_id: DA_TRIGGER,
    numero: 0, // assegnato dal trigger (progressivo per cliente)
    testo: t,
    data_visita: testo(f, "data_visita") ?? oggiISO(),
    rettifica_di: testo(f, "rettifica_di"),
  }).select("id").single();
  if (error) return { errore: "Nota non salvata: " + error.message };
  revalidatePath(`/clienti/${clientId}`);
  return { ok: "Nota aggiunta", id: nuova.id };
}

export async function eliminaNota(noteId: string, clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
  if (error) return { errore: error.message };
  await log("elimina_nota", "client_notes", noteId, null);
  revalidatePath(`/clienti/${clientId}`);
  return { ok: "Nota eliminata" };
}

// ---------------------------------------------------------------------
// Pratiche
// ---------------------------------------------------------------------
export async function salvaPratica(_: Esito, f: FormData): Promise<Esito> {
  await richiediProfilo();
  const supabase = await createClient();
  const id = testo(f, "id");
  const clientId = String(f.get("client_id"));
  const tipo = testo(f, "tipo");
  if (!tipo) return { errore: "Indica il tipo di pratica" };
  const dati = {
    tipo,
    stato: (testo(f, "stato") ?? "aperta") as Database["public"]["Enums"]["stato_pratica"],
    descrizione: testo(f, "descrizione"),
    data_apertura: testo(f, "data_apertura") ?? oggiISO(),
    prossima_scadenza: testo(f, "prossima_scadenza"),
    riferimento_esterno: testo(f, "riferimento_esterno"),
  };
  const { error } = id
    ? await supabase.from("cases").update(dati).eq("id", id)
    : await supabase.from("cases").insert({ ...dati, client_id: clientId, office_id: DA_TRIGGER });
  if (error) return { errore: error.message };
  revalidatePath(`/clienti/${clientId}`);
  return { ok: "Pratica salvata" };
}

export async function eliminaPratica(id: string, clientId: string) {
  const supabase = await createClient();
  await supabase.from("cases").delete().eq("id", id);
  revalidatePath(`/clienti/${clientId}`);
}

// ---------------------------------------------------------------------
// Cartelle e documenti
// ---------------------------------------------------------------------
export async function creaCartella(clientId: string, parentId: string | null, nome: string) {
  const supabase = await createClient();
  const n = nome.trim();
  if (!n) return { errore: "Nome cartella vuoto" };
  const { error } = await supabase
    .from("folders")
    .insert({ client_id: clientId, parent_id: parentId, nome: n, office_id: DA_TRIGGER });
  if (error) return { errore: error.code === "23505" ? "Esiste già una cartella con questo nome" : error.message };
  revalidatePath(`/clienti/${clientId}`);
  return { ok: "Cartella creata" };
}

export async function rinominaCartella(id: string, clientId: string, nome: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("folders").update({ nome: nome.trim() }).eq("id", id);
  if (error) return { errore: error.code === "23505" ? "Esiste già una cartella con questo nome" : error.message };
  revalidatePath(`/clienti/${clientId}`);
  return { ok: "Cartella rinominata" };
}

export async function eliminaCartella(id: string, clientId: string) {
  const supabase = await createClient();
  const { data: tutte } = await supabase.from("folders").select("id, parent_id").eq("client_id", clientId);
  // raccoglie la cartella e tutte le sottocartelle
  const ids = new Set([id]);
  let cambiato = true;
  while (cambiato) {
    cambiato = false;
    for (const f of tutte ?? []) {
      if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
        ids.add(f.id);
        cambiato = true;
      }
    }
  }
  const { count } = await supabase.from("documents").select("id", { count: "exact", head: true }).in("folder_id", [...ids]);
  if (count) return { errore: "La cartella contiene documenti: spostali o eliminali prima" };
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) return { errore: error.message };
  revalidatePath(`/clienti/${clientId}`);
  return { ok: "Cartella eliminata" };
}

export async function registraDocumento(input: {
  clientId: string;
  folderId: string | null;
  nome: string;
  storagePath: string;
  mime: string;
  dimensione: number;
  analizzaConAi: boolean;
}) {
  const profilo = await richiediProfilo();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      client_id: input.clientId,
      office_id: DA_TRIGGER,
      folder_id: input.folderId,
      nome: input.nome,
      storage_path: input.storagePath,
      mime_type: input.mime,
      dimensione: input.dimensione,
      uploaded_by: profilo.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([input.storagePath]);
    return { errore: error?.message ?? "Errore" };
  }
  if (input.analizzaConAi && mimeSupportatoDaAi(input.mime)) {
    try {
      // l'utente ha scelto la cartella: l'AI aggiunge solo tipo e riepilogo
      await analizzaDocumento(supabase, data.id, { sposta: !input.folderId });
    } catch (e) {
      console.error(e);
    }
  }
  revalidatePath(`/clienti/${input.clientId}`);
  return { ok: "Caricato" };
}

export async function analizzaDocumentoAi(documentId: string, clientId: string) {
  const supabase = await createClient();
  try {
    const r = await analizzaDocumento(supabase, documentId, { sposta: false });
    if (!r) return { errore: "Formato non analizzabile (servono PDF o immagini) o AI non configurata" };
    revalidatePath(`/clienti/${clientId}`);
    return { ok: `${r.tipo_documento}: ${r.riepilogo}`, cartella: r.cartella_suggerita };
  } catch (e) {
    return { errore: messaggioErroreAi(e) };
  }
}

export async function spostaDocumento(documentId: string, folderId: string | null, clientId: string) {
  const supabase = await createClient();
  await supabase.from("documents").update({ folder_id: folderId }).eq("id", documentId);
  revalidatePath(`/clienti/${clientId}`);
}

export async function rinominaDocumento(documentId: string, nome: string, clientId: string) {
  const supabase = await createClient();
  if (!nome.trim()) return;
  await supabase.from("documents").update({ nome: nome.trim() }).eq("id", documentId);
  revalidatePath(`/clienti/${clientId}`);
}

export async function eliminaDocumento(documentId: string, clientId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, nome, office_id").eq("id", documentId).single();
  if (!doc) return;
  await supabase.from("documents").delete().eq("id", documentId);
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  await log("elimina_documento", "documents", documentId, doc.office_id, { nome: doc.nome });
  revalidatePath(`/clienti/${clientId}`);
}

// ---------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------
export async function aiRiassunto(clientId: string) {
  await richiediProfilo();
  const supabase = await createClient();
  try {
    const ctx = await caricaContestoCliente(supabase, clientId, 200);
    return { testo: await riassuntoCliente(ctx, oggiISO()) };
  } catch (e) {
    return { errore: messaggioErroreAi(e) };
  }
}

export async function aiDomanda(clientId: string, domanda: string) {
  await richiediProfilo();
  if (!domanda.trim()) return { errore: "Scrivi una domanda" };
  const supabase = await createClient();
  try {
    const ctx = await caricaContestoCliente(supabase, clientId, 200);
    return { testo: await domandaSuCliente(ctx, domanda, oggiISO()) };
  } catch (e) {
    return { errore: messaggioErroreAi(e) };
  }
}

export async function aiEstraiDaDocumento(f: FormData): Promise<{ dati?: DatiDocumento; errore?: string }> {
  await richiediProfilo();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { errore: "Seleziona un file" };
  if (!mimeSupportatoDaAi(file.type)) return { errore: "Carica una foto (JPG/PNG) o un PDF" };
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { dati: await estraiDatiDocumento(base64, file.type) };
  } catch (e) {
    return { errore: messaggioErroreAi(e) };
  }
}

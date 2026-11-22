import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiDisponibile, generaRispostaWhatsapp, AiRifiuto } from "@/lib/ai/claude";
import { caricaContestoCliente, oggiISO } from "@/lib/contesto";
import { analizzaDocumento, BUCKET, estensione, nomeFileSicuro, percorsoStorage } from "@/lib/documenti";
import { inviaTesto, scaricaMedia, testoDelMessaggio, type WaMessaggio, type WaStato } from "@/lib/whatsapp";

/** Attesa prima di rispondere: se il cliente scrive più messaggi di fila si risponde una volta sola. */
const ATTESA_RAGGRUPPAMENTO_MS = Number(process.env.WHATSAPP_ATTESA_MS ?? 8000);
/** Non reinviare il messaggio di cortesia se lo studio ha già scritto di recente. */
const ORE_SILENZIO_CORTESIA = 6;

export type Sede = {
  id: string;
  nome: string;
  wa_phone_number_id: string | null;
  wa_access_token: string | null;
  ai_risposta_automatica: boolean;
  ai_istruzioni: string;
};

/** Dati della sede necessari a WhatsApp/AI, incluso il token (solo lato server). */
export async function caricaSede(officeId: string): Promise<Sede | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("offices")
    .select("id, nome, wa_phone_number_id, ai_risposta_automatica, ai_istruzioni, office_secrets(wa_access_token)")
    .eq("id", officeId)
    .single();
  if (!data) return null;
  const { office_secrets, ...resto } = data;
  return { ...resto, wa_access_token: office_secrets?.wa_access_token ?? null };
}

export async function aggiornaStato(stato: WaStato) {
  const db = createAdminClient();
  await db.from("whatsapp_messages").update({ stato_invio: stato.status }).eq("wa_message_id", stato.id);
}

/** Salva un messaggio in arrivo, archivia eventuali allegati e restituisce l'id del record (null se duplicato o sede sconosciuta). */
export async function registraMessaggioInArrivo(phoneNumberId: string, m: WaMessaggio, nomeProfilo?: string) {
  const db = createAdminClient();
  const { data: sede } = await db.from("offices").select("id, nome").eq("wa_phone_number_id", phoneNumberId).maybeSingle();
  if (!sede) {
    console.warn(`[whatsapp] nessuna sede configurata per phone_number_id ${phoneNumberId}`);
    return null;
  }

  const { data: cliente } = await db
    .from("clients")
    .select("id")
    .eq("office_id", sede.id)
    .eq("telefono", m.from)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: msg, error } = await db
    .from("whatsapp_messages")
    .insert({
      office_id: sede.id,
      client_id: cliente?.id ?? null,
      wa_message_id: m.id,
      telefono: m.from,
      nome_profilo: nomeProfilo ?? null,
      direzione: "in",
      tipo: m.type,
      testo: testoDelMessaggio(m) || null,
      // created_at = istante di ricezione (precisione al microsecondo): il timestamp di
      // WhatsApp è al secondo e non basta a capire quale messaggio è arrivato per ultimo
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null; // già ricevuto (Meta ritrasmette i webhook)
    throw error;
  }
  return msg.id;
}

/** Elaborazione lenta (download allegati + AI), da eseguire dopo aver risposto 200 a Meta. */
export async function elaboraMessaggio(messageId: string, m: WaMessaggio) {
  const db = createAdminClient();
  const { data: rec } = await db.from("whatsapp_messages").select("*").eq("id", messageId).single();
  if (!rec) return;
  const sede = await caricaSede(rec.office_id);
  if (!sede) return;

  // 1. Allegati (foto e documenti) → archivio del cliente
  const media = m.image ?? m.document;
  if (media) {
    try {
      await archiviaAllegato(sede, rec.id, rec.client_id, media.id, media.filename ?? null, media.caption ?? null);
    } catch (e) {
      console.error("[whatsapp] errore archiviazione allegato", e);
    }
  }

  // 2. Messaggi raggruppati: aspetta e verifica che questo sia ancora l'ultimo messaggio del cliente
  if (ATTESA_RAGGRUPPAMENTO_MS > 0) await new Promise((r) => setTimeout(r, ATTESA_RAGGRUPPAMENTO_MS));
  const { data: ultimo } = await db
    .from("whatsapp_messages")
    .select("id")
    .eq("office_id", sede.id)
    .eq("telefono", rec.telefono)
    .eq("direzione", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (ultimo && ultimo.id !== rec.id) return; // risponderà l'elaborazione del messaggio più recente

  await rispondiConAi(sede, rec.id);
}

async function archiviaAllegato(
  sede: Sede,
  messageId: string,
  clientId: string | null,
  mediaId: string,
  filename: string | null,
  caption: string | null,
) {
  const db = createAdminClient();
  const { buffer, mime } = await scaricaMedia(mediaId, sede.wa_access_token);
  const nome = filename ? nomeFileSicuro(filename) : `whatsapp_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${estensione(mime)}`;

  if (!clientId) {
    // numero sconosciuto: il file resta "in sospeso" finché non si crea/associa l'anagrafica
    const path = `${sede.id}/non-associati/${crypto.randomUUID()}-${nome}`;
    await db.storage.from(BUCKET).upload(path, buffer, { contentType: mime });
    await db.from("whatsapp_messages").update({ media_path: path, media_mime: mime }).eq("id", messageId);
    return;
  }

  const path = percorsoStorage(sede.id, clientId, nome);
  const up = await db.storage.from(BUCKET).upload(path, buffer, { contentType: mime });
  if (up.error) throw up.error;
  const { data: cartellaWa } = await db.from("folders").select("id").eq("client_id", clientId).ilike("nome", "whatsapp").is("parent_id", null).maybeSingle();
  const { data: doc } = await db
    .from("documents")
    .insert({
      client_id: clientId,
      office_id: sede.id,
      folder_id: cartellaWa?.id ?? null,
      nome,
      storage_path: path,
      mime_type: mime,
      dimensione: buffer.length,
      origine: "whatsapp",
      ai_riepilogo: caption,
    })
    .select("id")
    .single();
  if (!doc) return;
  await db.from("whatsapp_messages").update({ document_id: doc.id, media_mime: mime }).eq("id", messageId);
  try {
    await analizzaDocumento(db, doc.id, { sposta: true, rinomina: true });
  } catch (e) {
    console.error("[whatsapp] analisi AI documento fallita", e);
  }
}

async function rispondiConAi(sede: Sede, messageId: string) {
  const db = createAdminClient();
  const { data: rec } = await db.from("whatsapp_messages").select("*").eq("id", messageId).single();
  if (!rec) return;

  const daGestire = async (motivo: string, bozza: string | null = null, categoria: string | null = null) => {
    await db.from("whatsapp_messages").update({ da_gestire: true, ai_motivo: motivo, ai_bozza: bozza, ai_categoria: categoria }).eq("id", rec.id);
  };

  if (!sede.ai_risposta_automatica) return daGestire("Risposta automatica disattivata per la sede");
  if (!aiDisponibile()) return daGestire("AI non configurata");
  if (rec.tipo === "audio") return daGestire("Messaggio vocale: da ascoltare");
  if (!sede.wa_phone_number_id) return daGestire("Numero WhatsApp della sede non configurato");

  const contesto = await caricaContestoCliente(db, rec.client_id, 25);
  const { data: storico } = await db
    .from("whatsapp_messages")
    .select("direzione, testo, tipo, created_at, documents(nome, ai_tipo_documento)")
    .eq("office_id", sede.id)
    .eq("telefono", rec.telefono)
    .order("created_at", { ascending: false })
    .limit(20);
  const conversazione = (storico ?? []).reverse().map((s) => ({
    direzione: s.direzione,
    data: new Date(s.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
    testo:
      (s.testo ?? "") +
      (s.tipo !== "text" ? ` [allegato: ${s.tipo}${s.documents ? ` – ${s.documents.ai_tipo_documento ?? s.documents.nome}` : ""}]` : ""),
  }));

  let ris;
  try {
    ris = await generaRispostaWhatsapp({
      nomeSede: sede.nome,
      istruzioniSede: sede.ai_istruzioni,
      contesto,
      conversazione,
      oggi: oggiISO(),
    });
  } catch (e) {
    console.error("[whatsapp] errore AI", e);
    return daGestire(e instanceof AiRifiuto ? "L'AI non ha potuto rispondere a questo messaggio" : "Errore AI: rispondere manualmente");
  }

  if (ris.rispondi_automaticamente && ris.risposta.trim()) {
    try {
      const waId = await inviaTesto({ phoneNumberId: sede.wa_phone_number_id, a: rec.telefono, testo: ris.risposta, tokenSede: sede.wa_access_token });
      await db.from("whatsapp_messages").insert({
        office_id: sede.id,
        client_id: rec.client_id,
        wa_message_id: waId,
        telefono: rec.telefono,
        direzione: "out",
        testo: ris.risposta,
        ai_gestito: true,
        ai_categoria: ris.categoria,
        stato_invio: "sent",
      });
      await db
        .from("whatsapp_messages")
        .update({ ai_gestito: true, ai_categoria: ris.categoria, ai_motivo: ris.motivo, da_gestire: false })
        .eq("office_id", sede.id)
        .eq("telefono", rec.telefono)
        .eq("direzione", "in")
        .eq("da_gestire", false)
        .is("ai_categoria", null);
      await db.from("whatsapp_messages").update({ ai_gestito: true, ai_categoria: ris.categoria, ai_motivo: ris.motivo }).eq("id", rec.id);
    } catch (e) {
      console.error("[whatsapp] invio fallito", e);
      await daGestire("Invio automatico fallito: inviare manualmente", ris.risposta, ris.categoria);
    }
    return;
  }

  await daGestire(ris.motivo, ris.risposta, ris.categoria);

  // Messaggio di cortesia (solo se lo studio non ha scritto nelle ultime ore)
  if (ris.messaggio_attesa.trim()) {
    const da = new Date(Date.now() - ORE_SILENZIO_CORTESIA * 3600_000).toISOString();
    const { count } = await db
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("office_id", sede.id)
      .eq("telefono", rec.telefono)
      .eq("direzione", "out")
      .gte("created_at", da);
    if (!count) {
      try {
        const waId = await inviaTesto({ phoneNumberId: sede.wa_phone_number_id, a: rec.telefono, testo: ris.messaggio_attesa, tokenSede: sede.wa_access_token });
        await db.from("whatsapp_messages").insert({
          office_id: sede.id,
          client_id: rec.client_id,
          wa_message_id: waId,
          telefono: rec.telefono,
          direzione: "out",
          testo: ris.messaggio_attesa,
          ai_gestito: true,
          ai_categoria: "cortesia",
          stato_invio: "sent",
        });
      } catch (e) {
        console.error("[whatsapp] invio cortesia fallito", e);
      }
    }
  }
}

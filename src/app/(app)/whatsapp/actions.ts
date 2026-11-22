"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { richiediProfilo } from "@/lib/auth";
import { inviaTesto } from "@/lib/whatsapp";
import { caricaSede } from "@/lib/whatsapp-service";
import { caricaContestoCliente, oggiISO } from "@/lib/contesto";
import { generaRispostaWhatsapp, AiNonConfigurata } from "@/lib/ai/claude";
import { associaMessaggiWhatsapp } from "@/app/(app)/clienti/actions";

/** Verifica con la sessione dell'utente (RLS) che possa accedere alla sede. */
async function verificaSede(officeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("offices").select("id").eq("id", officeId).maybeSingle();
  if (!data) throw new Error("Accesso negato");
}

export async function inviaRisposta(officeId: string, telefono: string, testo: string) {
  const profilo = await richiediProfilo();
  if (!testo.trim()) return { errore: "Messaggio vuoto" };
  await verificaSede(officeId);
  const sede = await caricaSede(officeId);
  if (!sede?.wa_phone_number_id) return { errore: "Numero WhatsApp della sede non configurato (Impostazioni sede)" };

  const db = createAdminClient();
  // regola Meta: messaggi liberi solo entro 24 ore dall'ultimo messaggio del cliente
  const { data: ultimoIn } = await db
    .from("whatsapp_messages")
    .select("created_at")
    .eq("office_id", officeId)
    .eq("telefono", telefono)
    .eq("direzione", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultimoIn || Date.now() - new Date(ultimoIn.created_at).getTime() > 24 * 3600_000) {
    return { errore: "Sono passate più di 24 ore dall'ultimo messaggio del cliente: WhatsApp consente solo messaggi modello (template) approvati da Meta." };
  }

  let waId: string | null;
  try {
    waId = await inviaTesto({ phoneNumberId: sede.wa_phone_number_id, a: telefono, testo, tokenSede: sede.wa_access_token });
  } catch (e) {
    return { errore: e instanceof Error ? e.message : "Invio non riuscito" };
  }
  const { data: cli } = await db.from("clients").select("id").eq("office_id", officeId).eq("telefono", telefono).limit(1).maybeSingle();
  await db.from("whatsapp_messages").insert({
    office_id: officeId,
    client_id: cli?.id ?? null,
    wa_message_id: waId,
    telefono,
    direzione: "out",
    testo,
    inviato_da: profilo.id,
    stato_invio: "sent",
  });
  await db.from("whatsapp_messages").update({ da_gestire: false }).eq("office_id", officeId).eq("telefono", telefono).eq("da_gestire", true);
  revalidatePath(`/whatsapp/${telefono}`);
  revalidatePath("/whatsapp");
  return { ok: "Inviato" };
}

export async function segnaGestito(officeId: string, telefono: string) {
  await richiediProfilo();
  const supabase = await createClient();
  await supabase.from("whatsapp_messages").update({ da_gestire: false }).eq("office_id", officeId).eq("telefono", telefono).eq("da_gestire", true);
  revalidatePath(`/whatsapp/${telefono}`);
  revalidatePath("/whatsapp");
}

export async function rigeneraBozza(officeId: string, telefono: string) {
  await richiediProfilo();
  await verificaSede(officeId);
  const sede = await caricaSede(officeId);
  if (!sede) return { errore: "Sede non trovata" };
  const supabase = await createClient();
  const { data: storico } = await supabase
    .from("whatsapp_messages")
    .select("direzione, testo, tipo, created_at, client_id")
    .eq("office_id", officeId)
    .eq("telefono", telefono)
    .order("created_at", { ascending: false })
    .limit(20);
  const clientId = storico?.find((s) => s.client_id)?.client_id ?? null;
  try {
    const r = await generaRispostaWhatsapp({
      nomeSede: sede.nome,
      istruzioniSede: sede.ai_istruzioni,
      contesto: await caricaContestoCliente(supabase, clientId, 25),
      conversazione: (storico ?? []).reverse().map((s) => ({
        direzione: s.direzione,
        data: new Date(s.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
        testo: (s.testo ?? "") + (s.tipo !== "text" ? ` [allegato: ${s.tipo}]` : ""),
      })),
      oggi: oggiISO(),
    });
    return { bozza: r.risposta, motivo: r.motivo };
  } catch (e) {
    return { errore: e instanceof AiNonConfigurata ? e.message : "Errore AI, riprova" };
  }
}

/** Associa la conversazione a un cliente esistente (e salva il numero in anagrafica se mancante). */
export async function associaACliente(officeId: string, telefono: string, clientId: string) {
  await richiediProfilo();
  const supabase = await createClient();
  const { data: cli } = await supabase.from("clients").select("id, office_id, telefono").eq("id", clientId).single();
  if (!cli || cli.office_id !== officeId) return { errore: "Cliente non valido per questa sede" };
  if (!cli.telefono) await supabase.from("clients").update({ telefono }).eq("id", clientId);
  else if (cli.telefono !== telefono) return { errore: `Il cliente ha già un altro numero (+${cli.telefono}). Modificalo in anagrafica.` };
  await associaMessaggiWhatsapp(clientId);
  revalidatePath(`/whatsapp/${telefono}`);
  return { ok: "Conversazione associata" };
}

export async function cercaClienti(q: string) {
  await richiediProfilo();
  const supabase = await createClient();
  let query = supabase.from("clients").select("id, nome, cognome, telefono, office_id").order("cognome").limit(10);
  for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) query = query.ilike("search_text", `%${w.replace(/[%_,()]/g, "")}%`);
  const { data } = await query;
  return data ?? [];
}

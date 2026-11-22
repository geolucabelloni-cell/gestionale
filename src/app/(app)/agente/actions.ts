"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { caricaContestoCliente } from "@/lib/contesto";
import { AiNonConfigurata, AiRifiuto, briefingGiornaliero, estraiAttivita, type AttivitaEstratte } from "@/lib/ai/claude";
import { aggiungiGiorni, oggiRoma, partiRoma, romaToISO } from "@/lib/tempo";
import { data as fmtData } from "@/lib/format";

function erroreAi(e: unknown) {
  if (e instanceof AiNonConfigurata) return "AI non configurata (manca ANTHROPIC_API_KEY).";
  if (e instanceof AiRifiuto) return "L'AI non ha potuto elaborare questa richiesta.";
  console.error(e);
  return "Errore AI, riprova.";
}

export async function aiSuggerisciDaNota(noteId: string): Promise<{ suggerimenti?: AttivitaEstratte; errore?: string }> {
  await richiediProfilo();
  const supabase = await createClient();
  const { data: nota } = await supabase.from("client_notes").select("testo, client_id, data_visita").eq("id", noteId).single();
  if (!nota) return { errore: "Nota non trovata" };
  try {
    const contesto = await caricaContestoCliente(supabase, nota.client_id, 10);
    return { suggerimenti: await estraiAttivita({ testo: `Nota del ${nota.data_visita}: ${nota.testo}`, contesto, oggi: oggiRoma(), origine: "nota" }) };
  } catch (e) {
    return { errore: erroreAi(e) };
  }
}

export async function aiSuggerisciDaWhatsapp(officeId: string, telefono: string): Promise<{ suggerimenti?: AttivitaEstratte; errore?: string; clientId?: string | null }> {
  await richiediProfilo();
  const supabase = await createClient();
  const { data: msg } = await supabase
    .from("whatsapp_messages")
    .select("direzione, testo, tipo, created_at, client_id")
    .eq("office_id", officeId)
    .eq("telefono", telefono)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!msg?.length) return { errore: "Nessun messaggio" };
  const clientId = msg.find((m) => m.client_id)?.client_id ?? null;
  const testo = msg
    .reverse()
    .map((m) => `[${new Date(m.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}] ${m.direzione === "in" ? "CLIENTE" : "STUDIO"}: ${m.testo ?? `[${m.tipo}]`}`)
    .join("\n");
  try {
    const contesto = await caricaContestoCliente(supabase, clientId, 10);
    return { suggerimenti: await estraiAttivita({ testo, contesto, oggi: oggiRoma(), origine: "whatsapp" }), clientId };
  } catch (e) {
    return { errore: erroreAi(e) };
  }
}

export async function creaDaSuggerimenti(input: { clientId: string | null; origine: "ai" | "whatsapp"; attivita: AttivitaEstratte["attivita"]; appuntamenti: AttivitaEstratte["appuntamenti"] }) {
  const p = await richiediProfilo();
  const supabase = await createClient();
  if (input.attivita.length) {
    const { error } = await supabase.from("tasks").insert(
      input.attivita.map((a) => ({
        titolo: a.titolo,
        descrizione: a.descrizione,
        scadenza: a.scadenza,
        priorita: a.priorita,
        client_id: input.clientId,
        origine: input.origine,
        office_id: p.office_id!,
      })),
    );
    if (error) return { errore: error.message };
  }
  for (const a of input.appuntamenti) {
    const inizio = romaToISO(a.data, a.ora ?? "09:00");
    const { error } = await supabase.from("appointments").insert({
      client_id: input.clientId,
      nominativo: input.clientId ? null : "Da WhatsApp",
      titolo: a.titolo,
      tipo: a.tipo,
      luogo: a.luogo,
      inizio,
      fine: new Date(new Date(inizio).getTime() + 30 * 60000).toISOString(),
      note: a.ora ? null : "Orario da confermare (non indicato nel testo)",
      office_id: p.office_id!,
    });
    if (error) return { errore: error.message };
  }
  revalidatePath("/scadenze");
  revalidatePath("/agenda");
  revalidatePath("/");
  if (input.clientId) revalidatePath(`/clienti/${input.clientId}`);
  return { ok: `Creati: ${input.attivita.length} attività, ${input.appuntamenti.length} appuntamenti` };
}

export async function aiBriefing(): Promise<{ testo?: string; errore?: string }> {
  const p = await richiediProfilo();
  const supabase = await createClient();
  const oggi = oggiRoma();
  const [appt, att, wa, perm] = await Promise.all([
    supabase
      .from("appointments")
      .select("inizio, titolo, tipo, luogo, stato, operatore_id, clients(nome, cognome, permesso_tipo, permesso_scadenza), nominativo")
      .gte("inizio", romaToISO(oggi, "00:00"))
      .lt("inizio", romaToISO(aggiungiGiorni(oggi, 1), "00:00"))
      .neq("stato", "annullato")
      .order("inizio"),
    supabase
      .from("tasks")
      .select("titolo, scadenza, priorita, assegnato_a, clients(nome, cognome)")
      .eq("stato", "da_fare")
      .or(`assegnato_a.eq.${p.id},assegnato_a.is.null`)
      .or(`scadenza.lte.${aggiungiGiorni(oggi, 3)},scadenza.is.null,priorita.eq.alta`)
      .order("scadenza", { nullsFirst: false })
      .limit(40),
    supabase.from("conversazioni_whatsapp").select("telefono, nome_profilo, ultimo_testo, ultimo_at").gt("da_gestire", 0).limit(20),
    supabase.from("clients").select("nome, cognome, permesso_tipo, permesso_scadenza").gte("permesso_scadenza", aggiungiGiorni(oggi, -30)).lte("permesso_scadenza", aggiungiGiorni(oggi, 30)).order("permesso_scadenza").limit(20),
  ]);

  const righe: string[] = ["<appuntamenti_di_oggi>"];
  for (const a of appt.data ?? []) {
    const chi = a.clients ? `${a.clients.cognome} ${a.clients.nome}` : a.nominativo;
    righe.push(`- ${partiRoma(a.inizio).ora} ${chi}: ${a.titolo} (${a.tipo}, ${a.luogo})${a.operatore_id === p.id ? " [tuo]" : ""}${a.clients?.permesso_scadenza ? ` – permesso ${a.clients.permesso_tipo ?? ""} scade il ${fmtData(a.clients.permesso_scadenza)}` : ""}`);
  }
  righe.push("</appuntamenti_di_oggi>", "<attivita_aperte>");
  for (const t of att.data ?? []) righe.push(`- ${t.titolo}${t.clients ? ` (${t.clients.cognome} ${t.clients.nome})` : ""}${t.scadenza ? ` scadenza ${fmtData(t.scadenza)}` : ""}${t.priorita === "alta" ? " PRIORITÀ ALTA" : ""}`);
  righe.push("</attivita_aperte>", "<whatsapp_in_attesa_di_risposta>");
  for (const w of wa.data ?? []) righe.push(`- ${w.nome_profilo ?? "+" + w.telefono}: "${(w.ultimo_testo ?? "").slice(0, 150)}"`);
  righe.push("</whatsapp_in_attesa_di_risposta>", "<permessi_in_scadenza_30gg>");
  for (const c of perm.data ?? []) righe.push(`- ${c.cognome} ${c.nome}: ${c.permesso_tipo ?? "permesso"} scade il ${fmtData(c.permesso_scadenza)}`);
  righe.push("</permessi_in_scadenza_30gg>");

  try {
    return { testo: await briefingGiornaliero({ utente: p.nome_completo, sede: p.sede_nome ?? "", oggi, dati: righe.join("\n") }) };
  } catch (e) {
    return { errore: erroreAi(e) };
  }
}

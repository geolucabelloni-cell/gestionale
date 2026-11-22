"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { richiediProfilo, type Profilo } from "@/lib/auth";

type Esito = { errore?: string; ok?: string } | null;
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function puoGestireSede(p: Profilo, officeId: string) {
  return p.ruolo === "admin_rete" || (p.ruolo === "titolare" && p.office_id === officeId);
}

export async function salvaSede(_: Esito, f: FormData): Promise<Esito> {
  const p = await richiediProfilo();
  const id = t(f, "id");
  if (!puoGestireSede(p, id)) return { errore: "Non autorizzato" };
  const supabase = await createClient();
  const phoneId = t(f, "wa_phone_number_id") || null;
  const { error } = await supabase
    .from("offices")
    .update({
      nome: t(f, "nome"),
      citta: t(f, "citta") || null,
      indirizzo: t(f, "indirizzo") || null,
      telefono: t(f, "telefono") || null,
      email: t(f, "email") || null,
      wa_phone_number_id: phoneId,
      wa_provider: t(f, "wa_provider") === "callbell" ? "callbell" : "meta",
      callbell_channel_uuid: t(f, "callbell_channel_uuid") || null,
      wa_numero_visualizzato: t(f, "wa_numero_visualizzato") || null,
      ai_risposta_automatica: f.get("ai_risposta_automatica") === "on",
      ai_istruzioni: t(f, "ai_istruzioni"),
    })
    .eq("id", id);
  if (error) return { errore: error.code === "23505" ? "Questo Phone Number ID è già usato da un'altra sede" : error.message };

  const admin = createAdminClient();
  const { data: segreti } = await admin.from("office_secrets").select("*").eq("office_id", id).maybeSingle();
  const nuovi = { office_id: id, wa_access_token: segreti?.wa_access_token ?? null, callbell_api_token: segreti?.callbell_api_token ?? null, callbell_webhook_token: segreti?.callbell_webhook_token ?? null };
  const token = t(f, "wa_access_token");
  if (token) nuovi.wa_access_token = token;
  if (f.get("rimuovi_token") === "on") nuovi.wa_access_token = null;
  const tokenCallbell = t(f, "callbell_api_token");
  if (tokenCallbell) nuovi.callbell_api_token = tokenCallbell;
  if (t(f, "wa_provider") === "callbell" && !nuovi.callbell_webhook_token) nuovi.callbell_webhook_token = crypto.randomUUID().replaceAll("-", "");
  await admin.from("office_secrets").upsert(nuovi);
  revalidatePath("/impostazioni");
  return { ok: "Impostazioni salvate" };
}

export async function creaUtente(_: Esito, f: FormData): Promise<Esito> {
  const p = await richiediProfilo();
  const officeId = t(f, "office_id");
  const ruolo = t(f, "ruolo") as Profilo["ruolo"];
  if (!puoGestireSede(p, officeId)) return { errore: "Non autorizzato" };
  if (!["operatore", "titolare", "admin_rete"].includes(ruolo)) return { errore: "Ruolo non valido" };
  if (p.ruolo !== "admin_rete" && ruolo !== "operatore") return { errore: "Il titolare può creare solo operatori" };
  const email = t(f, "email").toLowerCase();
  const password = t(f, "password");
  if (password.length < 8) return { errore: "La password deve avere almeno 8 caratteri" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { errore: error?.message.includes("already") ? "Esiste già un utente con questa email" : (error?.message ?? "Errore") };
  const { error: e2 } = await admin.from("profiles").insert({ id: data.user.id, email, nome_completo: t(f, "nome_completo"), ruolo, office_id: officeId });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { errore: e2.message };
  }
  revalidatePath("/impostazioni");
  revalidatePath("/rete");
  return { ok: `Utente ${email} creato. Comunica la password all'utente.` };
}

export async function impostaAttivo(userId: string, attivo: boolean) {
  const p = await richiediProfilo();
  if (userId === p.id) return { errore: "Non puoi disattivare te stesso" };
  const admin = createAdminClient();
  const { data: u } = await admin.from("profiles").select("office_id, ruolo").eq("id", userId).single();
  if (!u || !puoGestireSede(p, u.office_id ?? "") || (p.ruolo !== "admin_rete" && u.ruolo !== "operatore")) return { errore: "Non autorizzato" };
  await admin.from("profiles").update({ attivo }).eq("id", userId);
  await admin.auth.admin.updateUserById(userId, { ban_duration: attivo ? "none" : "876000h" });
  revalidatePath("/impostazioni");
  return { ok: attivo ? "Utente riattivato" : "Utente disattivato" };
}

export async function reimpostaPassword(userId: string, password: string) {
  const p = await richiediProfilo();
  if (password.length < 8) return { errore: "Almeno 8 caratteri" };
  const admin = createAdminClient();
  const { data: u } = await admin.from("profiles").select("office_id, ruolo").eq("id", userId).single();
  if (!u || (userId !== p.id && (!puoGestireSede(p, u.office_id ?? "") || (p.ruolo !== "admin_rete" && u.ruolo !== "operatore")))) return { errore: "Non autorizzato" };
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  return error ? { errore: error.message } : { ok: "Password aggiornata" };
}

/** Sede centrale: apre una nuova sede in franchising con il suo titolare. */
export async function creaSede(_: Esito, f: FormData): Promise<Esito> {
  const p = await richiediProfilo();
  if (p.ruolo !== "admin_rete") return { errore: "Non autorizzato" };
  const supabase = await createClient();

  // copia le istruzioni AI della sede centrale come base di partenza
  const { data: modello } = p.office_id ? await supabase.from("offices").select("ai_istruzioni").eq("id", p.office_id).single() : { data: null };
  const { data: sede, error } = await supabase
    .from("offices")
    .insert({ nome: t(f, "nome"), citta: t(f, "citta") || null, ai_istruzioni: modello?.ai_istruzioni ?? "" })
    .select("id")
    .single();
  if (error || !sede) return { errore: error?.message ?? "Errore" };

  if (t(f, "email")) {
    const fd = new FormData();
    fd.set("office_id", sede.id);
    fd.set("ruolo", "titolare");
    fd.set("email", t(f, "email"));
    fd.set("password", t(f, "password"));
    fd.set("nome_completo", t(f, "nome_completo"));
    const r = await creaUtente(null, fd);
    if (r?.errore) return { errore: `Sede creata, ma utente non creato: ${r.errore}` };
  }
  revalidatePath("/rete");
  return { ok: "Sede creata" };
}

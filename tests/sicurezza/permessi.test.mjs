/**
 * Simulazione di accessi non autorizzati direttamente sul database (come farebbe un utente esperto
 * con la chiave pubblica). Ogni test DEVE risultare bloccato.
 * Richiede Supabase locale preparato con: node tests/supporto/prepara-db.mjs
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { ADMIN } from "../supporto/ambiente.mjs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const nuovo = () => createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const PW = "Password123!";

/** Una lettura/modifica è "bloccata" se dà errore o non restituisce righe. */
const bloccato = (r) => !!r.error || !r.data || (Array.isArray(r.data) && r.data.length === 0);
const conErrore = (r) => !!r.error;

const d = {};
async function utente(email, ruolo, officeId) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").insert({ id: data.user.id, email, ruolo, office_id: officeId, nome_completo: email });
  const c = nuovo();
  await c.auth.signInWithPassword({ email, password: PW });
  return { c, id: data.user.id };
}

before(async () => {
  d.milano = (await admin.from("offices").select("id").eq("nome", "Sede di prova").single()).data.id;
  d.torino = (await admin.from("offices").insert({ nome: "Torino" }).select("id").single()).data.id;
  d.tor = await utente("titolare@torino.test", "titolare", d.torino);
  d.op = await utente("operatore@milano.test", "operatore", d.milano);
  d.adm = nuovo();
  await d.adm.auth.signInWithPassword({ email: ADMIN.email, password: ADMIN.password });
  const m = d.milano;
  d.cli = (await d.adm.from("clients").insert({ office_id: m, nome: "Amina", cognome: "Benali", telefono: "393331112222" }).select("id").single()).data.id;
  await d.adm.from("client_notes").insert({ client_id: d.cli, office_id: m, numero: 0, testo: "Nota riservata" });
  d.nota = (await admin.from("client_notes").select("id").eq("client_id", d.cli).single()).data.id;
  d.file = `${m}/${d.cli}/segreto.pdf`;
  await d.adm.storage.from("documenti").upload(d.file, new Blob(["%PDF-1.4"]), { contentType: "application/pdf" });
  d.doc = (await d.adm.from("documents").insert({ client_id: d.cli, office_id: m, nome: "segreto.pdf", storage_path: d.file }).select("id").single()).data.id;
  d.pratica = (await d.adm.from("cases").insert({ client_id: d.cli, office_id: m, tipo: "Rinnovo" }).select("id").single()).data.id;
  await d.adm.from("case_checklist").insert({ case_id: d.pratica, office_id: m, voce: "Passaporto" });
  await d.adm.from("tasks").insert({ office_id: m, titolo: "Attività", client_id: d.cli });
  await d.adm.from("appointments").insert({ office_id: m, client_id: d.cli, titolo: "Appuntamento", inizio: "2030-12-01T09:00:00Z", fine: "2030-12-01T09:30:00Z" });
  await d.adm.from("document_templates").insert({ office_id: m, nome: "Modello sede", corpo: "x" });
  await admin.from("whatsapp_messages").insert({ office_id: m, client_id: d.cli, telefono: "393331112222", direzione: "in", testo: "Messaggio originale", wa_message_id: "orig-1" });
  await admin.from("office_secrets").upsert({ office_id: m, wa_access_token: "TOKEN-SEGRETO", callbell_webhook_token: "segreto" });
  await admin.from("audit_log").insert({ office_id: m, user_id: d.op.id, azione: "test" });
});

const TABELLE = ["offices", "office_secrets", "profiles", "clients", "client_notes", "cases", "case_checklist", "folders", "documents", "whatsapp_messages", "audit_log", "appointments", "tasks", "document_templates", "checklist_templates", "conversazioni_whatsapp", "scadenze_permessi"];

describe("1. sconosciuto senza login (con la chiave pubblica)", () => {
  const anon = nuovo();
  for (const t of TABELLE) test(`non legge ${t}`, async () => assert.ok(bloccato(await anon.from(t).select("*").limit(1))));
  test("non inserisce clienti", async () => assert.ok(conErrore(await anon.from("clients").insert({ office_id: d.milano, nome: "x", cognome: "y" }))));
  test("non usa le funzioni interne", async () => assert.ok(conErrore(await anon.rpc("is_admin_rete"))));
  test("non scarica file", async () => assert.ok(conErrore(await anon.storage.from("documenti").download(d.file))));
  test("non elenca file", async () => assert.ok(bloccato(await anon.storage.from("documenti").list(`${d.milano}/${d.cli}`))));
});

describe("2. chi si registra da solo", () => {
  const reg = nuovo();
  let id = null;
  before(async () => {
    const r = await reg.auth.signUp({ email: "intruso@test.local", password: PW });
    id = r.data.user?.id ?? null;
  });
  for (const t of ["clients", "client_notes", "documents", "whatsapp_messages", "offices", "profiles", "tasks"]) test(`non legge ${t}`, async () => assert.ok(bloccato(await reg.from(t).select("*"))));
  test("non si crea un profilo da amministratore", async () => assert.ok(!id || conErrore(await reg.from("profiles").insert({ id, ruolo: "admin_rete", office_id: d.milano }))));
  test("non crea sedi", async () => assert.ok(conErrore(await reg.from("offices").insert({ nome: "falsa" }))));
});

describe("3. titolare di un'altra sede", () => {
  const c = () => d.tor.c;
  for (const t of ["clients", "client_notes", "cases", "case_checklist", "documents", "folders", "whatsapp_messages", "appointments", "tasks", "audit_log", "office_secrets", "document_templates"])
    test(`non legge ${t} dell'altra sede`, async () => assert.ok(bloccato(await c().from(t).select("*").eq("office_id", d.milano))));
  test("non modifica clienti dell'altra sede", async () => assert.ok(bloccato(await c().from("clients").update({ nome: "HACK" }).eq("id", d.cli).select())));
  test("non sposta clienti nella propria sede", async () => assert.ok(bloccato(await c().from("clients").update({ office_id: d.torino }).eq("id", d.cli).select())));
  test("non scrive note sui clienti dell'altra sede", async () => assert.ok(conErrore(await c().from("client_notes").insert({ client_id: d.cli, office_id: d.torino, numero: 0, testo: "x" }))));
  test("non crea attività nell'altra sede", async () => assert.ok(conErrore(await c().from("tasks").insert({ office_id: d.milano, titolo: "x" }))));
  test("non crea attività sui clienti dell'altra sede", async () => assert.ok(conErrore(await c().from("tasks").insert({ client_id: d.cli, titolo: "x" }))));
  test("non modifica la checklist dell'altra sede", async () => assert.ok(conErrore(await c().from("case_checklist").insert({ case_id: d.pratica, office_id: d.torino, voce: "x" }))));
  test("non scarica file", async () => assert.ok(conErrore(await c().storage.from("documenti").download(d.file))));
  test("non carica file nella cartella dell'altra sede", async () => assert.ok(conErrore(await c().storage.from("documenti").upload(`${d.milano}/x.pdf`, new Blob(["x"])))));
  test("non cancella file", async () => assert.ok(bloccato(await c().storage.from("documenti").remove([d.file]))));
  test("non crea link di download", async () => assert.ok(conErrore(await c().storage.from("documenti").createSignedUrl(d.file, 60))));
  test("non registra documenti che puntano ai file dell'altra sede", async () =>
    assert.ok(conErrore(await c().from("documents").insert({ client_id: d.cli, office_id: d.torino, nome: "x", storage_path: d.file }))));
  test("non modifica l'altra sede", async () => assert.ok(bloccato(await c().from("offices").update({ nome: "HACK" }).eq("id", d.milano).select())));
  test("non cambia il numero WhatsApp della propria sede", async () => assert.ok(conErrore(await c().from("offices").update({ wa_phone_number_id: "RUBATO" }).eq("id", d.torino))));
  test("non attiva/disattiva la propria sede", async () => assert.ok(conErrore(await c().from("offices").update({ attiva: false }).eq("id", d.torino))));
  test("non modifica i modelli della rete", async () => assert.ok(bloccato(await c().from("document_templates").update({ corpo: "HACK" }).is("office_id", null).select())));
  test("non crea modelli per tutta la rete", async () => assert.ok(conErrore(await c().from("document_templates").insert({ office_id: null, nome: "x", corpo: "x" }))));
  test("non si promuove sede centrale", async () => assert.ok(bloccato(await c().from("profiles").update({ ruolo: "admin_rete" }).eq("id", d.tor.id).select())));
  test("non si sposta in un'altra sede", async () => assert.ok(bloccato(await c().from("profiles").update({ office_id: d.milano }).eq("id", d.tor.id).select())));
});

describe("4. operatore oltre il proprio ruolo", () => {
  const c = () => d.op.c;
  test("non elimina clienti", async () => assert.ok(bloccato(await c().from("clients").delete().eq("id", d.cli).select())));
  test("non elimina note del diario", async () => assert.ok(bloccato(await c().from("client_notes").delete().eq("id", d.nota).select())));
  test("non modifica note del diario", async () => assert.ok(bloccato(await c().from("client_notes").update({ testo: "falsa" }).eq("id", d.nota).select())));
  test("non riscrive messaggi WhatsApp", async () => assert.ok(conErrore(await c().from("whatsapp_messages").update({ testo: "falso" }).eq("office_id", d.milano))));
  test("non cambia il file di un documento", async () => assert.ok(conErrore(await c().from("documents").update({ storage_path: "altro" }).eq("id", d.doc))));
  test("non sposta documenti su altri clienti", async () => assert.ok(conErrore(await c().from("documents").update({ client_id: d.cli }).eq("id", d.doc))));
  test("non legge i token WhatsApp", async () => assert.ok(bloccato(await c().from("office_secrets").select("*"))));
  test("non modifica la sede", async () => assert.ok(bloccato(await c().from("offices").update({ nome: "x" }).eq("id", d.milano).select())));
  test("non modifica i modelli della sede", async () => assert.ok(bloccato(await c().from("document_templates").update({ corpo: "x" }).eq("office_id", d.milano).select())));
  test("non cancella il registro attività", async () => assert.ok(bloccato(await c().from("audit_log").delete().eq("office_id", d.milano).select())));
  test("non modifica il registro attività", async () => assert.ok(conErrore(await c().from("audit_log").update({ azione: "x" }).eq("office_id", d.milano))));
  test("non legge il registro attività", async () => assert.ok(bloccato(await c().from("audit_log").select("*"))));
  test("non si promuove titolare", async () => assert.ok(bloccato(await c().from("profiles").update({ ruolo: "titolare" }).eq("id", d.op.id).select())));
  test("non crea profili", async () => assert.ok(conErrore(await c().from("profiles").insert({ id: d.op.id, ruolo: "admin_rete" }))));
});

describe("5. integrità", () => {
  test("il messaggio WhatsApp è rimasto quello originale", async () => {
    const { data } = await admin.from("whatsapp_messages").select("testo").eq("wa_message_id", "orig-1").single();
    assert.equal(data.testo, "Messaggio originale");
  });
  test("il cliente non è stato modificato né spostato", async () => {
    const { data } = await admin.from("clients").select("nome, office_id").eq("id", d.cli).single();
    assert.deepEqual(data, { nome: "Amina", office_id: d.milano });
  });
  test("un utente disattivato perde subito l'accesso", async () => {
    await admin.from("profiles").update({ attivo: false }).eq("id", d.op.id);
    assert.ok(bloccato(await d.op.c.from("clients").select("*")));
  });
});

import { expect, test } from "@playwright/test";
import { accedi, attendi, creaCliente, db, registroServizi, sedeDiProva, webhookMeta } from "../supporto/aiuti";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await db.from("offices").update({ wa_provider: "meta", wa_phone_number_id: "PHONE-TEST" }).eq("id", await sedeDiProva());
  await creaCliente({ nome: "Fatou", cognome: "Diop", telefono: "393400000001" });
});

test("webhook Meta: firma e verifica", async ({ baseURL }) => {
  expect((await fetch(baseURL + "/api/whatsapp/webhook", { method: "POST", body: "{}" })).status).toBe(401);
  expect((await fetch(baseURL + "/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": "sha256=" + "z".repeat(64) }, body: "{}" })).status).toBe(401);
  const ok = await fetch(baseURL + "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verifica-test&hub.challenge=42");
  expect(await ok.text()).toBe("42");
  expect((await fetch(baseURL + "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42")).status).toBe(403);
});

test("domanda semplice: risposta automatica dell'AI", async ({ baseURL }) => {
  expect((await webhookMeta(baseURL!, "393400000001", "Fatou", { type: "text", text: { body: "Quali sono gli orari?" } })).status).toBe(200);
  const risposta = await attendi(async () => {
    const { data } = await db.from("whatsapp_messages").select("testo, ai_gestito").eq("telefono", "393400000001").eq("direzione", "out").maybeSingle();
    return data;
  }, "risposta automatica inviata");
  expect(risposta.ai_gestito).toBe(true);
  expect((await registroServizi()).some((r) => r.url.endsWith("/messages") && (r.corpo.to as string) === "393400000001")).toBe(true);
});

test("più messaggi di fila: una sola risposta", async ({ baseURL }) => {
  const prima = (await registroServizi()).filter((r) => r.url.startsWith("/v1/messages")).length;
  for (const t of ["Ciao", "una domanda", "quali sono gli orari?"]) await webhookMeta(baseURL!, "393400000002", "Raffica", { type: "text", text: { body: t } });
  await new Promise((r) => setTimeout(r, 5000));
  const dopo = (await registroServizi()).filter((r) => r.url.startsWith("/v1/messages")).length;
  expect(dopo - prima).toBe(1);
});

test("numero sconosciuto con domanda legale e foto: passa all'operatore, poi anagrafica dalla chat", async ({ page, baseURL }) => {
  await webhookMeta(baseURL!, "393400000003", "Karim Haddad", { type: "text", text: { body: "Posso fare il ricongiungimento con mia moglie?" } });
  await webhookMeta(baseURL!, "393400000003", "Karim Haddad", { type: "image", image: { id: "MEDIA1", mime_type: "image/png" } });
  await attendi(async () => (await db.from("whatsapp_messages").select("id").eq("telefono", "393400000003").eq("da_gestire", true).limit(1)).data?.length, "chat da gestire");

  await accedi(page);
  await page.goto("/whatsapp");
  await page.getByText("Karim Haddad").first().click();
  await expect(page.getByText("Perché serve un operatore")).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue(/appuntamento/);
  await page.click("button:has-text('Invia')");
  await expect(page.getByText("Messaggio inviato")).toBeVisible();

  await page.click("text=Crea anagrafica");
  await expect(page.locator("input[name=cognome]")).toHaveValue("Haddad");
  await page.click("button:has-text('Salva')");
  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}$/);
  await page.goto(page.url() + "?tab=documenti");
  await expect(page.getByText("da WhatsApp")).toBeVisible();
});

test("Callbell: webhook con codice segreto, risposta AI tramite Callbell", async ({ page }) => {
  await accedi(page);
  await page.goto("/impostazioni");
  await page.check("input[value=callbell]");
  await page.fill("input[name=callbell_api_token]", "token-callbell-test");
  await page.click("button:has-text('Salva impostazioni')");
  await expect(page.getByText("Impostazioni salvate")).toBeVisible();
  await page.reload();
  const url = (await page.locator("code.select-all").innerText()).trim();
  expect(url).toContain("/api/callbell/webhook/");

  const invia = (corpo: unknown, u = url) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  expect((await invia({}, url.replace(/token=.*/, "token=sbagliato"))).status).toBe(401);
  expect((await invia({}, url.replace(/\?token=.*/, ""))).status).toBe(401);
  await invia({ event: "message_created", payload: { uuid: "cb-1", text: "Gli orari di sabato?", status: "received", from: "+393400000001", contact: { name: "Fatou", phoneNumber: "+393400000001" } } });
  await attendi(async () => (await registroServizi()).find((r) => r.url === "/cb/v1/messages/send" && r.corpo.to === "+393400000001"), "risposta inviata tramite Callbell");

  // messaggio scritto dall'operatore nell'app Callbell: registrato nello storico
  await invia({ event: "message_created", payload: { uuid: "cb-out-op", text: "Ti aspettiamo", status: "sent", from: "+390200000000", to: "+393400000001", contact: { phoneNumber: "+393400000001" } } });
  await invia({ event: "message_status_updated", payload: { uuid: "cb-out-op", status: "read" } });
  const msg = await attendi(async () => (await db.from("whatsapp_messages").select("direzione, stato_invio").eq("wa_message_id", "cb-out-op").maybeSingle()).data, "messaggio operatore registrato");
  expect(msg).toEqual({ direzione: "out", stato_invio: "read" });
});

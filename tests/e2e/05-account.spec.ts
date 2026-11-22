import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { accedi, db, sedeDiProva } from "../supporto/aiuti";

const EMAIL = "operatrice@test.local";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: "Iniziale123", email_confirm: true });
  if (error) throw error;
  await db.from("profiles").insert({ id: data.user.id, email: EMAIL, nome_completo: "Giulia Verdi", ruolo: "operatore", office_id: await sedeDiProva() });
});

test("profilo: cambio nome e password", async ({ page }) => {
  await accedi(page, EMAIL, "Iniziale123");
  await page.goto("/profilo");
  await page.fill("#nome_completo", "Giulia Verdi Bianchi");
  await page.locator("form", { has: page.locator("#nome_completo") }).getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Nome aggiornato")).toBeVisible();

  await page.fill("#attuale", "sbagliata1");
  await page.fill("#nuova", "NuovaPassword1");
  await page.fill("#conferma", "NuovaPassword1");
  await page.click("button:has-text('Cambia password')");
  await expect(page.getByText("La password attuale non è corretta")).toBeVisible();

  await page.fill("#attuale", "Iniziale123");
  await page.fill("#nuova", "sololettere");
  await page.fill("#conferma", "sololettere");
  await page.click("button:has-text('Cambia password')");
  await expect(page.getByText(/sia lettere sia numeri/)).toBeVisible();

  // dopo un errore i campi password si svuotano (non restano scritti a schermo)
  await expect(page.locator("#attuale")).toHaveValue("");
  await page.fill("#attuale", "Iniziale123");
  await page.fill("#nuova", "NuovaPassword1");
  await page.fill("#conferma", "NuovaPassword1");
  await page.click("button:has-text('Cambia password')");
  await expect(page.getByText("Password aggiornata")).toBeVisible();

  await page.click("button:has-text('Esci')");
  await accedi(page, EMAIL, "NuovaPassword1");
});

test("password dimenticata: messaggio neutro e reimpostazione dal link", async ({ page }) => {
  await page.goto("/login");
  await page.click("text=Password dimenticata?");
  await page.waitForURL("**/password-dimenticata");
  await page.waitForLoadState("networkidle");
  await page.fill("#email", "nessuno@esempio.it");
  await page.click("button:has-text('Invia il link')");
  await expect(page.getByText(/Se l'indirizzo è registrato/)).toBeVisible();

  // link come quello dell'email (generato dal server di autenticazione)
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: EMAIL });
  if (error) throw error;
  await page.goto(`/auth/conferma?token_hash=${data.properties.hashed_token}&type=recovery&next=/reimposta-password`);
  await expect(page.getByRole("heading", { name: "Scegli una nuova password" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.fill("#password", "Reimpostata123");
  await page.fill("#conferma", "Diversa123");
  await page.click("button:has-text('Salva la nuova password')");
  await expect(page.getByText("Le due password non coincidono")).toBeVisible();
  await page.fill("#password", "Reimpostata123");
  await page.fill("#conferma", "Reimpostata123");
  await page.click("button:has-text('Salva la nuova password')");
  await expect(page.getByText("Password aggiornata.")).toBeVisible();

  // link già usato o inventato
  await page.click("button:has-text('Esci')");
  await page.goto(`/auth/conferma?token_hash=${data.properties.hashed_token}&type=recovery&next=/reimposta-password`);
  await expect(page.getByText(/link è scaduto/)).toBeVisible();
  // un link non può portare fuori dal gestionale
  await page.goto(`/auth/conferma?token_hash=x&type=recovery&next=//sito-esterno.it`);
  expect(new URL(page.url()).host).toBe("127.0.0.1:3100");
});

test("l'operatore non vede impostazioni, backup e rete", async ({ page }) => {
  await accedi(page, EMAIL, "Reimpostata123");
  await expect(page.getByRole("link", { name: "Impostazioni sede" })).toHaveCount(0);
  expect((await page.request.get("/api/backup")).status()).toBe(403);
  await page.goto("/rete");
  await expect(page).toHaveURL(/\/$/);
});

test("backup dei dati in ZIP (sede centrale)", async ({ page }) => {
  await accedi(page);
  const r = await page.request.get("/api/backup");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toBe("application/zip");
  const zip = await JSZip.loadAsync(await r.body());
  const file = Object.keys(zip.files);
  for (const f of ["clienti.csv", "diario_note.csv", "pratiche.csv", "appuntamenti.csv", "attivita.csv", "whatsapp_messaggi.csv", "LEGGIMI.txt"]) expect(file).toContain(f);
  const clienti = await zip.file("clienti.csv")!.async("string");
  expect(clienti.startsWith("﻿")).toBe(true);
  expect(clienti).toContain("Benali");
  const { count } = await db.from("audit_log").select("id", { count: "exact", head: true }).eq("azione", "backup_dati");
  expect(count).toBeGreaterThan(0);
});

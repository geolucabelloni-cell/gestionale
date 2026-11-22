import path from "node:path";
import { expect, test } from "@playwright/test";
import { accedi, db } from "../supporto/aiuti";

const DOC = path.join(__dirname, "..", "fixtures", "documento.png");

test.describe.configure({ mode: "serial" });

test("accesso: credenziali sbagliate e corrette", async ({ page }) => {
  await page.goto("/clienti");
  await expect(page).toHaveURL(/\/login$/);
  await page.fill("#email", "admin@test.local");
  await page.fill("#password", "sbagliata");
  await page.click("button:has-text('Accedi')");
  await expect(page.getByText("Email o password non corretti")).toBeVisible();
  await accedi(page);
  await expect(page.getByRole("heading", { name: /Buon|Buonasera/ })).toBeVisible();
});

test("anagrafica, diario, archivio, pratica con checklist e documenti PDF", async ({ page }) => {
  await accedi(page);

  // nuovo cliente compilato dal documento (AI)
  await page.goto("/clienti/nuovo");
  await page.setInputFiles("input[type=file]", DOC);
  await expect(page.getByText(/compilati \d+ campi/)).toBeVisible();
  await expect(page.locator("input[name=cognome]")).toHaveValue("Benali");
  await page.fill("input[name=telefono]", "+39 333 1112222");
  await page.click("button:has-text('Salva')");
  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}$/);
  const url = page.url();
  const clientId = url.split("/").pop()!;

  // diario: numerazione progressiva e proposta di attività dall'AI
  for (const t of ["Prima visita: portato passaporto.", "Manca il CUD. Impronte in Questura il 3 dicembre alle 10:30."]) {
    await page.fill("textarea[name=testo]", t);
    await page.click("button:has-text('Aggiungi al diario')");
    await expect(page.getByText(t)).toBeVisible();
  }
  await expect(page.locator("span.badge", { hasText: "n. 2" })).toBeVisible();
  await expect(page.getByText(/L'AI propone/)).toBeVisible();
  await page.click("button:has-text('Aggiungi selezionati')");
  await expect(page.getByText("Creati: 1 attività, 1 appuntamenti")).toBeVisible();

  // archivio: sottocartella e caricamento con classificazione AI
  await page.goto(url + "?tab=documenti");
  await page.getByText("Famiglia", { exact: true }).click();
  page.once("dialog", (d) => d.accept("Coniuge"));
  await page.click("button:has-text('Sottocartella')");
  await expect(page.getByRole("button", { name: "Coniuge" })).toBeVisible();
  await page.getByText("Tutti i documenti").click();
  await page.setInputFiles("input[type=file][multiple]", DOC);
  await expect(page.getByText("1 file caricati e archiviati dall'AI nelle cartelle")).toBeVisible();
  await expect(page.getByText("📁 Documenti di identità")).toBeVisible();
  const href = await page.locator("a[href^='/api/documenti/']").first().getAttribute("href");
  expect((await page.request.get(href!)).status()).toBe(200);

  // pratica: checklist automatica, spunte, collegamento documento
  await page.goto(url + "?tab=pratiche");
  await page.click("button:has-text('Nuova pratica')");
  await page.fill("input[name=tipo]", "Rinnovo permesso di soggiorno");
  await page.fill("input[name=riferimento_esterno]", "MI-2030-1");
  await page.click("button:has-text('Salva pratica')");
  await expect(page.getByText("0 di 10 consegnati")).toBeVisible();
  await page.getByRole("button", { name: /^Codice fiscale: mancante/ }).click();
  await expect(page.getByText("1 di 10 consegnati")).toBeVisible();
  await page.locator("li", { hasText: "Passaporto in corso" }).locator("select").selectOption({ index: 1 });
  await expect(page.getByText("2 di 10 consegnati")).toBeVisible();

  // documenti PDF
  const stampa = await page.locator("a", { hasText: "Stampa documenti mancanti" }).getAttribute("href");
  const pdf = await page.request.get(stampa!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.getByRole("button", { name: "Genera documento" }).click();
  await page.locator(".fixed select").first().selectOption({ label: "Ricevuta consegna documenti" });
  await page.click("button:has-text(\"Salva nell'archivio\")");
  await expect(page.getByText(/Salvato in "Pratiche e istanze"/)).toBeVisible();

  const { count } = await db.from("documents").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("origine", "generato");
  expect(count).toBe(1);
});

test("ricerca clienti e pagina non trovata", async ({ page }) => {
  await accedi(page);
  await page.goto("/clienti?q=benali");
  await expect(page.getByRole("link", { name: "Benali Amina" })).toBeVisible();
  await page.goto("/clienti?q=inesistente");
  await expect(page.getByText("Nessun cliente trovato.")).toBeVisible();
  await page.goto("/clienti/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();
});

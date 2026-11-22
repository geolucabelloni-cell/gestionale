import { expect, test } from "@playwright/test";
import { accedi, creaCliente } from "../supporto/aiuti";

test.describe.configure({ mode: "serial" });

test("agenda: nuovo appuntamento e avviso di sovrapposizione", async ({ page }) => {
  await creaCliente({ nome: "Ousmane", cognome: "Sow" });
  await accedi(page);
  await page.goto("/agenda?settimana=2030-12-02");
  await page.click("button:has-text('Nuovo appuntamento')");
  await page.fill("input[placeholder^='Cerca cliente']", "Sow");
  await page.locator("div.z-20 button", { hasText: "Sow Ousmane" }).click();
  await page.fill("input[name=data]", "2030-12-02");
  await page.fill("input[name=ora]", "11:00");
  await page.selectOption("select[name=operatore_id]", { label: "Mario Rossi" });
  await page.click("form button:has-text('Salva')");
  await expect(page.getByText("11:00 Sow Ousmane")).toBeVisible();

  await page.click("button:has-text('Nuovo appuntamento')");
  await page.fill("input[name=nominativo]", "Nuovo Contatto");
  await page.fill("input[name=data]", "2030-12-02");
  await page.fill("input[name=ora]", "11:15");
  await page.selectOption("select[name=operatore_id]", { label: "Mario Rossi" });
  await page.click("form button:has-text('Salva')");
  await expect(page.getByText(/già un appuntamento/)).toBeVisible();
  await expect(page.locator("input[name=nominativo]")).toHaveValue("Nuovo Contatto"); // i dati non si perdono
  await page.click("button:has-text('Conferma comunque')");
  await expect(page.getByText("11:15 Nuovo Contatto")).toBeVisible();
});

test("attività: creazione, scadute, completamento", async ({ page }) => {
  await accedi(page);
  await page.goto("/scadenze");
  await page.click("button:has-text('Nuova attività')");
  await page.fill("input[name=titolo]", "Inviare kit postale");
  await page.fill("input[name=scadenza]", "2020-01-01");
  await page.selectOption("select[name=priorita]", "alta");
  await page.click("form button:has-text('Aggiungi')");
  await expect(page.locator("h3", { hasText: "Scadute" })).toBeVisible();
  const riga = page.locator("div.flex.items-start", { hasText: "Inviare kit postale" });
  await riga.locator("input[type=checkbox]").click();
  await expect(page.getByText("Inviare kit postale")).toBeHidden();
  await page.click("text=Mostra completate");
  await expect(page.locator("h3", { hasText: "Completate" })).toBeVisible();
});

test("briefing del giorno", async ({ page }) => {
  await accedi(page);
  await page.click("button:has-text('Prepara il briefing')");
  await expect(page.getByText("Briefing di prova.")).toBeVisible();
});

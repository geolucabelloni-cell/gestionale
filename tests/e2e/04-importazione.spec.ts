import path from "node:path";
import { expect, test } from "@playwright/test";
import { accedi } from "../supporto/aiuti";

const FIX = path.join(__dirname, "..", "fixtures");

test("importazione CSV da TeamSystem: anagrafiche, aggiornamento senza duplicati, note in ordine", async ({ page }) => {
  await accedi(page);
  await page.goto("/importa");
  await page.setInputFiles("input[type=file]", path.join(FIX, "clienti_teamsystem.csv")); // codifica Windows con accenti
  await expect(page.getByText(/4 righe, \d+ colonne/)).toBeVisible();
  await page.click("button:has-text(\"Abbina con l'AI\")");
  await expect(page.locator("td", { hasText: "José" })).toBeVisible();
  await page.click("button:has-text('Importa 4 righe')");
  await expect(page.getByText("3 anagrafiche create, 0 aggiornate.")).toBeVisible();
  await expect(page.getByText("1 righe non importate")).toBeVisible();
  await page.click("button:has-text('Importa 4 righe')");
  await expect(page.getByText("0 anagrafiche create, 3 aggiornate.")).toBeVisible();

  await page.click("button:has-text('Note / storico')");
  await page.setInputFiles("input[type=file]", path.join(FIX, "note_teamsystem.csv"));
  await expect(page.getByText(/note_teamsystem.csv: 4 righe/)).toBeVisible();
  await page.click("button:has-text('Importa 4 righe')");
  await expect(page.getByText("3 note importate nel diario.")).toBeVisible();

  await page.goto("/clienti?q=Mamadou");
  await page.locator("table a", { hasText: "Diallo" }).first().click();
  const note = page.locator("div.card p.text-sm");
  await expect(note.first()).toHaveText("Primo contatto: richiesta rinnovo"); // la più recente in alto
  await expect(page.getByText("Importata da TeamSystem").first()).toBeVisible();
});

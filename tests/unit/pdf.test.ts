import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { creaPdf } from "@/lib/pdf";

test("genera un PDF valido con accenti, € e nomi stranieri, anche su più pagine", async () => {
  const testo = "# TITOLO\n\nIl sottoscritto **Nguyễn Thị Hoa**, città: Perù – 16 € «ok».\n\n" + "- voce\n".repeat(80) + "Ελληνικά 日本";
  const bytes = await creaPdf({ titoloDocumento: "Prova", testo, intestazione: { sede: "IOSTRANIERO – Prova", sottotitolo: "Via Roma 1" } });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2);
  assert.equal(doc.getTitle(), "Prova");
});

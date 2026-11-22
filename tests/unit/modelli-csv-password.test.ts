import { test } from "node:test";
import assert from "node:assert/strict";
import { compilaModello, RIGA_DA_COMPILARE } from "@/lib/modelli";
import { aCsv } from "@/lib/csv";
import { controllaPassword } from "@/lib/password";
import { normalizzaTelefono } from "@/lib/telefono";

test("compila i segnaposto e lascia righe da compilare per i dati mancanti", () => {
  const t = compilaModello("{{nome_completo}} nato a {{luogo_nascita}} {{pratica_riferimento}}.", { nome_completo: "Mario Rossi" });
  assert.equal(t, `Mario Rossi nato a ${RIGA_DA_COMPILARE} .`);
  assert.match(compilaModello("Firma\n{{firma}}", {}), /Firma\n\n_{20,}/);
});

test("CSV per Excel: BOM, punto e virgola, virgolette, niente formule", () => {
  const csv = aCsv([{ a: "x;y", b: 'di "lui"', c: "=SOMMA(A1)", d: ["uno", "due"], e: null }]);
  assert.ok(csv.startsWith("﻿a;b;c;d;e\r\n"));
  assert.ok(csv.includes('"x;y"'));
  assert.ok(csv.includes('"di ""lui"""'));
  assert.ok(csv.includes("'=SOMMA(A1)"));
  assert.ok(csv.includes("uno, due"));
});

test("regole password", () => {
  assert.ok(controllaPassword("corta1"));
  assert.ok(controllaPassword("solelettereeee"));
  assert.ok(controllaPassword("12345678901"));
  assert.ok(controllaPassword("Password123", "Password124"));
  assert.equal(controllaPassword("Password123", "Password123"), null);
});

test("numeri di telefono nel formato WhatsApp", () => {
  assert.equal(normalizzaTelefono("333 111 2222"), "393331112222");
  assert.equal(normalizzaTelefono("+39 333-111-2222"), "393331112222");
  assert.equal(normalizzaTelefono("0033612345678"), "33612345678");
  assert.equal(normalizzaTelefono(""), null);
});

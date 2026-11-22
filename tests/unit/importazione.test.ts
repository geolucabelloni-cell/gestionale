import { test } from "node:test";
import assert from "node:assert/strict";
import { dataIso, mappaturaAutomatica } from "@/lib/importazione";

test("riconosce le colonne tipiche di un export TeamSystem", () => {
  const m = mappaturaAutomatica("clienti", ["Cod. Cliente", "Cognome", "Nome", "Cod_Fiscale", "Cellulare", "Data Nascita", "Nazionalità", "Scadenza Permesso", "E-mail", "Comune"]);
  assert.equal(m.codice_esterno, "Cod. Cliente");
  assert.equal(m.cognome, "Cognome");
  assert.equal(m.nome, "Nome");
  assert.equal(m.codice_fiscale, "Cod_Fiscale");
  assert.equal(m.telefono, "Cellulare");
  assert.equal(m.cittadinanza, "Nazionalità");
  assert.equal(m.permesso_scadenza, "Scadenza Permesso");
  assert.equal(m.email, "E-mail");
});

test("una colonna non viene usata per due campi", () => {
  const m = mappaturaAutomatica("clienti", ["Nome"]);
  const usate = Object.values(m);
  assert.equal(new Set(usate).size, usate.length);
});

test("date in vari formati", () => {
  assert.equal(dataIso("31/12/2025"), "2025-12-31");
  assert.equal(dataIso("1-2-99 10:30"), "1999-02-01");
  assert.equal(dataIso("01.02.25"), "2025-02-01");
  assert.equal(dataIso("2025-3-4"), "2025-03-04");
  assert.equal(dataIso("32/01/2025"), null);
  assert.equal(dataIso("abc"), null);
  assert.equal(dataIso(""), null);
});

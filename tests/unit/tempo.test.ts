import { test } from "node:test";
import assert from "node:assert/strict";
import { aggiungiGiorni, lunediDi, partiRoma, romaToISO } from "@/lib/tempo";

test("ora italiana → UTC con ora legale e solare", () => {
  assert.equal(romaToISO("2026-11-23", "09:30"), "2026-11-23T08:30:00.000Z"); // solare (+1)
  assert.equal(romaToISO("2026-07-01", "09:30"), "2026-07-01T07:30:00.000Z"); // legale (+2)
});

test("UTC → data e ora italiane", () => {
  assert.deepEqual(partiRoma("2026-11-23T08:30:00.000Z"), { data: "2026-11-23", ora: "09:30", minuti: 570 });
  // a mezzanotte italiana la data è quella del giorno dopo rispetto a UTC
  assert.equal(partiRoma("2026-07-01T22:30:00.000Z").data, "2026-07-02");
});

test("lunedì della settimana e somma di giorni", () => {
  assert.equal(lunediDi("2026-11-22"), "2026-11-16"); // domenica
  assert.equal(lunediDi("2026-11-23"), "2026-11-23"); // lunedì
  assert.equal(aggiungiGiorni("2026-12-31", 1), "2027-01-01");
  assert.equal(aggiungiGiorni("2026-03-01", -1), "2026-02-28");
});

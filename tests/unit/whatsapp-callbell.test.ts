import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verificaFirma, testoDelMessaggio } from "@/lib/whatsapp";
import { leggiEventoCallbell, scaricaAllegatoCallbell } from "@/lib/callbell";

test("firma dei webhook Meta", () => {
  process.env.WHATSAPP_APP_SECRET = "segreto";
  const corpo = '{"a":1}';
  const firma = "sha256=" + crypto.createHmac("sha256", "segreto").update(corpo).digest("hex");
  assert.equal(verificaFirma(corpo, firma), true);
  assert.equal(verificaFirma(corpo + " ", firma), false);
  assert.equal(verificaFirma(corpo, null), false);
  assert.equal(verificaFirma(corpo, "sha256=" + "z".repeat(64)), false); // non esadecimale: niente eccezioni
  assert.equal(verificaFirma(corpo, "sha256=abc"), false);
});

test("testo dei vari tipi di messaggio WhatsApp", () => {
  assert.equal(testoDelMessaggio({ from: "1", id: "1", timestamp: "1", type: "text", text: { body: "ciao" } }), "ciao");
  assert.equal(testoDelMessaggio({ from: "1", id: "1", timestamp: "1", type: "image", image: { id: "m", caption: "foto" } }), "foto");
});

test("evento Callbell in arrivo, in uscita e di stato", () => {
  const inArrivo = leggiEventoCallbell({ event: "message_created", payload: { uuid: "u1", text: "Ciao", status: "received", from: "+393331112222", attachments: ["https://x/y.png"], contact: { name: "Amina", phoneNumber: "+39 333 1112222" } } });
  assert.deepEqual(inArrivo, { tipo: "messaggio", id: "u1", telefono: "393331112222", nome: "Amina", testo: "Ciao", allegati: ["https://x/y.png"], inArrivo: true, canale: null });
  const uscita = leggiEventoCallbell({ event: "message_created", payload: { uuid: "u2", text: "Ok", status: "sent", from: "+390200000000", to: "+393331112222", contact: { phoneNumber: "+393331112222" } } });
  assert.equal(uscita.tipo === "messaggio" && uscita.inArrivo, false);
  assert.deepEqual(leggiEventoCallbell({ event: "message_status_updated", payload: { uuid: "u2", status: "read" } }), { tipo: "stato", id: "u2", stato: "read" });
  assert.deepEqual(leggiEventoCallbell({}), { tipo: "altro" });
});

test("allegati Callbell: niente indirizzi interni o non https", async () => {
  delete process.env.CALLBELL_API_URL;
  for (const url of ["http://esempio.it/a.png", "https://169.254.169.254/latest", "https://10.0.0.1/x", "https://localhost/x", "https://192.168.1.1/x", "ftp://x/y"]) {
    await assert.rejects(scaricaAllegatoCallbell(url), /non consentito|non valido/, url);
  }
});

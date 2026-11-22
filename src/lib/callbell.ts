import "server-only";

/**
 * Client minimale per l'API di Callbell (https://docs.callbell.eu).
 * Callbell è un fornitore ufficiale WhatsApp Business: lo studio può continuare a usarlo
 * e il gestionale riceve i messaggi via webhook e risponde tramite la sua API.
 *
 * NOTA: i nomi dei campi del webhook vengono letti in modo tollerante (payload annidato o meno,
 * allegati come stringhe o oggetti) perché il formato va confermato con l'account reale.
 */

const BASE = process.env.CALLBELL_API_URL || "https://api.callbell.eu/v1";

export async function inviaTestoCallbell(opts: { token: string; a: string; testo: string; channelUuid?: string | null }) {
  const res = await fetch(`${BASE}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: "+" + opts.a.replace(/^\+/, ""),
      from: "whatsapp",
      type: "text",
      content: { text: opts.testo },
      ...(opts.channelUuid ? { channel_uuid: opts.channelUuid } : {}),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: { uuid?: string }; error?: unknown; errors?: unknown };
  if (!res.ok) throw new Error(`Invio Callbell fallito (${res.status}): ${JSON.stringify(json.error ?? json.errors ?? json).slice(0, 200)}`);
  return json.message?.uuid ?? null;
}

const MAX_ALLEGATO = 25 * 1024 * 1024;

/** Scarica un allegato ricevuto via Callbell: solo HTTPS pubblico, max 25 MB, timeout 30 s. */
export async function scaricaAllegatoCallbell(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("URL allegato non valido");
  }
  // ammessi solo indirizzi HTTPS pubblici (niente reti interne); http://127.0.0.1 solo nei test locali
  const testLocale = !!process.env.CALLBELL_API_URL?.startsWith("http://127.0.0.1") && u.protocol === "http:" && u.hostname === "127.0.0.1";
  const hostPrivato = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(u.hostname);
  if (!testLocale && (u.protocol !== "https:" || hostPrivato)) throw new Error("URL allegato non consentito");
  const res = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Download allegato Callbell fallito (${res.status})`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_ALLEGATO) throw new Error("Allegato troppo grande");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_ALLEGATO) throw new Error("Allegato troppo grande");
  const mime = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
  return { buffer, mime };
}

type Obj = Record<string, unknown>;
const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

export type EventoCallbell =
  | { tipo: "messaggio"; id: string; telefono: string; nome: string | null; testo: string | null; allegati: string[]; inArrivo: boolean; canale: string | null }
  | { tipo: "stato"; id: string; stato: string }
  | { tipo: "altro" };

/** Interpreta un evento webhook di Callbell. */
export function leggiEventoCallbell(body: unknown): EventoCallbell {
  const b = (body ?? {}) as Obj;
  const evento = str(b.event) ?? "";
  const p = ((b.payload as Obj) ?? b) as Obj;
  const contatto = (p.contact ?? {}) as Obj;
  const id = str(p.uuid) ?? str(p.id);
  if (!id) return { tipo: "altro" };

  if (evento.includes("status")) return { tipo: "stato", id, stato: str(p.status) ?? "" };
  if (evento && !evento.includes("message")) return { tipo: "altro" };

  const status = (str(p.status) ?? "").toLowerCase();
  const telContatto = str(contatto.phoneNumber) ?? str(contatto.phone_number);
  const from = str(p.from);
  const to = str(p.to);
  // in arrivo se lo stato è "received" oppure se il mittente è il contatto
  const inArrivo = status === "received" || (!!telContatto && !!from && from.replace(/\D/g, "") === telContatto.replace(/\D/g, ""));
  const telefono = (telContatto ?? (inArrivo ? from : to) ?? "").replace(/\D/g, "");
  const allegati = (Array.isArray(p.attachments) ? p.attachments : [])
    .map((a) => (typeof a === "string" ? a : str((a as Obj)?.url) ?? str((a as Obj)?.payload)))
    .filter((x): x is string => !!x);
  return {
    tipo: "messaggio",
    id,
    telefono,
    nome: str(contatto.name),
    testo: str(p.text) ?? str((p.content as Obj | undefined)?.text),
    allegati,
    inArrivo,
    canale: str(p.channel),
  };
}

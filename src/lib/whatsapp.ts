import "server-only";
import crypto from "node:crypto";

/** Client minimale per la WhatsApp Business Cloud API (Meta). */

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const GRAPH = `${process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com"}/${API_VERSION}`;

export function verificaFirma(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const atteso = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const ricevuto = signatureHeader.slice("sha256=".length);
  if (ricevuto.length !== atteso.length) return false;
  return crypto.timingSafeEqual(Buffer.from(ricevuto, "hex"), Buffer.from(atteso, "hex"));
}

function token(tokenSede?: string | null) {
  const t = tokenSede || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!t) throw new Error("WhatsApp non configurato: manca il token di accesso");
  return t;
}

export async function inviaTesto(opts: { phoneNumberId: string; a: string; testo: string; tokenSede?: string | null }) {
  const res = await fetch(`${GRAPH}/${opts.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token(opts.tokenSede)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: opts.a,
      type: "text",
      text: { preview_url: false, body: opts.testo },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) throw new Error(`Invio WhatsApp fallito: ${json.error?.message ?? res.status}`);
  return json.messages?.[0]?.id ?? null;
}

export async function scaricaMedia(mediaId: string, tokenSede?: string | null) {
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token(tokenSede)}` } });
  if (!meta.ok) throw new Error(`Media WhatsApp non trovato (${meta.status})`);
  const info = (await meta.json()) as { url: string; mime_type: string; file_size?: number };
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token(tokenSede)}` } });
  if (!file.ok) throw new Error(`Download media fallito (${file.status})`);
  return { buffer: Buffer.from(await file.arrayBuffer()), mime: info.mime_type.split(";")[0].trim() };
}

// --- Tipi del payload webhook (solo i campi usati) ---
export type WaMedia = { id: string; mime_type?: string; caption?: string; filename?: string };
export type WaMessaggio = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WaMedia;
  document?: WaMedia;
  audio?: WaMedia;
  video?: WaMedia;
  sticker?: WaMedia;
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
};
export type WaStato = { id: string; status: string; recipient_id: string };
export type WaWebhook = {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id: string; display_phone_number?: string };
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WaMessaggio[];
        statuses?: WaStato[];
      };
    }[];
  }[];
};

export function testoDelMessaggio(m: WaMessaggio): string {
  switch (m.type) {
    case "text":
      return m.text?.body ?? "";
    case "image":
    case "document":
    case "video":
      return m[m.type]?.caption ?? "";
    case "button":
      return m.button?.text ?? "";
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "location":
      return `Posizione: ${m.location?.name ?? ""} ${m.location?.address ?? ""} (${m.location?.latitude}, ${m.location?.longitude})`.trim();
    default:
      return "";
  }
}

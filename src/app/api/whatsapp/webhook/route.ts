import { after, NextResponse, type NextRequest } from "next/server";
import { verificaFirma, type WaMessaggio, type WaWebhook } from "@/lib/whatsapp";
import { aggiornaStato, elaboraMessaggio, registraMessaggioInArrivo } from "@/lib/whatsapp-service";

export const maxDuration = 120;

/** Verifica del webhook richiesta da Meta in fase di configurazione. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Ricezione messaggi e notifiche di stato. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verificaFirma(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Firma non valida", { status: 401 });
  }

  let body: WaWebhook;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("JSON non valido", { status: 400 });
  }

  const daElaborare: { id: string; m: WaMessaggio }[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v?.metadata) continue;
      for (const s of v.statuses ?? []) await aggiornaStato(s);
      for (const m of v.messages ?? []) {
        const nome = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        const id = await registraMessaggioInArrivo(v.metadata.phone_number_id, m, nome);
        if (id) daElaborare.push({ id, m });
      }
    }
  }

  // Meta vuole una risposta entro pochi secondi: AI e allegati si elaborano dopo
  if (daElaborare.length) {
    after(async () => {
      await Promise.all(
        daElaborare.map(({ id, m }) => elaboraMessaggio(id, m).catch((e) => console.error("[whatsapp] elaborazione fallita", e))),
      );
    });
  }
  return NextResponse.json({ ok: true });
}

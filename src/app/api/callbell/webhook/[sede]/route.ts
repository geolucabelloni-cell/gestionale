import crypto from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leggiEventoCallbell, scaricaAllegatoCallbell } from "@/lib/callbell";
import { elaboraMessaggio, registraInArrivo } from "@/lib/whatsapp-service";

export const maxDuration = 120;

/**
 * Webhook Callbell di una sede: https://<dominio>/api/callbell/webhook/<id-sede>?token=<segreto>
 * Il segreto è generato nelle Impostazioni sede e va incollato in Callbell (Impostazioni → Webhook).
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/callbell/webhook/[sede]">) {
  const { sede } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const db = createAdminClient();
  const { data: segreti } = await db.from("office_secrets").select("callbell_webhook_token").eq("office_id", sede).maybeSingle();
  const atteso = segreti?.callbell_webhook_token ?? "";
  if (!atteso || token.length !== atteso.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(atteso))) {
    return new NextResponse("Non autorizzato", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("JSON non valido", { status: 400 });
  }
  const ev = leggiEventoCallbell(body);

  if (ev.tipo === "stato") {
    await db.from("whatsapp_messages").update({ stato_invio: ev.stato }).eq("wa_message_id", ev.id);
  } else if (ev.tipo === "messaggio" && ev.telefono) {
    if (ev.inArrivo) {
      const id = await registraInArrivo(sede, {
        idEsterno: ev.id,
        telefono: ev.telefono,
        nomeProfilo: ev.nome,
        tipo: ev.allegati.length ? "document" : "text",
        testo: ev.testo,
      });
      if (id) {
        after(async () => {
          // il primo allegato viene archiviato con il messaggio, gli altri come messaggi separati
          const [primo, ...altri] = ev.allegati;
          for (const [i, url] of altri.entries()) {
            const idAltro = await registraInArrivo(sede, { idEsterno: `${ev.id}#${i + 1}`, telefono: ev.telefono, nomeProfilo: ev.nome, tipo: "document", testo: null });
            if (idAltro) await elaboraMessaggio(idAltro, { scarica: () => scaricaAllegatoCallbell(url), filename: null, caption: null }).catch(console.error);
          }
          await elaboraMessaggio(id, primo ? { scarica: () => scaricaAllegatoCallbell(primo), filename: null, caption: null } : null).catch((e) =>
            console.error("[callbell] elaborazione fallita", e),
          );
        });
      }
    } else {
      // messaggio inviato dallo studio direttamente dall'app Callbell: lo registriamo per avere lo storico completo
      const { data: cli } = await db.from("clients").select("id").eq("office_id", sede).eq("telefono", ev.telefono).limit(1).maybeSingle();
      const { error } = await db.from("whatsapp_messages").insert({
        office_id: sede,
        client_id: cli?.id ?? null,
        wa_message_id: ev.id,
        telefono: ev.telefono,
        direzione: "out",
        testo: ev.testo,
        tipo: ev.allegati.length ? "document" : "text",
        stato_invio: "sent",
      });
      if (!error) {
        await db.from("whatsapp_messages").update({ da_gestire: false }).eq("office_id", sede).eq("telefono", ev.telefono).eq("da_gestire", true);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

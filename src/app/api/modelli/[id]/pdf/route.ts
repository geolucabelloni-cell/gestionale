import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfilo } from "@/lib/auth";
import { generaDocumento } from "@/lib/genera-documento";

/** Anteprima / stampa di un modello compilato: /api/modelli/<id>/pdf?cliente=<id>&pratica=<id> */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/modelli/[id]/pdf">) {
  const profilo = await getProfilo();
  if (!profilo) return new NextResponse("Non autorizzato", { status: 401 });
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  try {
    const { bytes, nomeFile } = await generaDocumento(await createClient(), {
      templateId: id,
      clientId: sp.get("cliente") || null,
      caseId: sp.get("pratica") || null,
      operatore: profilo.nome_completo,
      officeIdUtente: profilo.office_id,
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nomeFile)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Errore", { status: 400 });
  }
}

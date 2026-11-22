import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/documenti";

/** Apre/scarica un documento con un link temporaneo (60 s). L'accesso è verificato dalla RLS. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/documenti/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, nome").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Documento non trovato", { status: 404 });
  const download = req.nextUrl.searchParams.has("download");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60, download ? { download: doc.nome } : undefined);
  if (error || !data) return new NextResponse("Errore archivio", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

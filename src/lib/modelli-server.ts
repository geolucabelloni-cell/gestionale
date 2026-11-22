import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Modelli di documento attivi visibili all'utente: quelli della sede sostituiscono quelli della rete con lo stesso nome. */
export async function caricaModelliDocumento(db: SupabaseClient<Database>, officeId?: string | null) {
  let q = db.from("document_templates").select("id, nome, descrizione, richiede_pratica, office_id").eq("attivo", true).order("nome");
  if (officeId) q = q.or(`office_id.is.null,office_id.eq.${officeId}`);
  const { data } = await q;
  const lista = data ?? [];
  const nomiSede = new Set(lista.filter((m) => m.office_id).map((m) => m.nome.toLowerCase()));
  return lista
    .filter((m) => m.office_id || !nomiSede.has(m.nome.toLowerCase()))
    .map(({ id, nome, descrizione, richiede_pratica }) => ({ id, nome, descrizione, richiede_pratica }));
}

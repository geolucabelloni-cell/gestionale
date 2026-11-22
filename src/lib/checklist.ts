import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Db = SupabaseClient<Database>;

/**
 * Aggiunge alla pratica le voci della checklist predefinita per il suo tipo.
 * Ha la precedenza la checklist della sede; altrimenti si usa quella della rete.
 * Le voci già presenti non vengono duplicate. Restituisce quante voci ha aggiunto.
 */
export async function applicaChecklistPredefinita(db: Db, caseId: string, tipo: string) {
  const { data: pratica } = await db.from("cases").select("office_id").eq("id", caseId).single();
  if (!pratica) return 0;
  const { data: modelli } = await db
    .from("checklist_templates")
    .select("office_id, voci")
    .ilike("tipo_pratica", tipo.trim())
    .or(`office_id.eq.${pratica.office_id},office_id.is.null`);
  const modello = modelli?.find((m) => m.office_id === pratica.office_id) ?? modelli?.find((m) => m.office_id === null);
  if (!modello?.voci.length) return 0;

  const { data: esistenti } = await db.from("case_checklist").select("voce, ordine").eq("case_id", caseId);
  const gia = new Set((esistenti ?? []).map((e) => e.voce.toLowerCase()));
  const base = Math.max(0, ...(esistenti ?? []).map((e) => e.ordine));
  const nuove = modello.voci.filter((v) => !gia.has(v.toLowerCase()));
  if (!nuove.length) return 0;
  const { error } = await db
    .from("case_checklist")
    .insert(nuove.map((voce, i) => ({ case_id: caseId, office_id: pratica.office_id, voce, ordine: base + i + 1 })));
  return error ? 0 : nuove.length;
}

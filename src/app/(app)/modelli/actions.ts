"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo, richiediRuolo } from "@/lib/auth";
import { generaDocumento } from "@/lib/genera-documento";
import { BUCKET, percorsoStorage } from "@/lib/documenti";

type Esito = { errore?: string; ok?: string; id?: string };

// ---------------------------------------------------------------------
// Generazione documenti
// ---------------------------------------------------------------------
export async function salvaDocumentoGenerato(templateId: string, clientId: string, caseId: string | null): Promise<Esito> {
  const p = await richiediProfilo();
  const supabase = await createClient();
  try {
    const { bytes, nomeFile, officeId } = await generaDocumento(supabase, { templateId, clientId, caseId, operatore: p.nome_completo, officeIdUtente: p.office_id });
    const path = percorsoStorage(officeId!, clientId, nomeFile);
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf" });
    if (up.error) return { errore: up.error.message };
    const { data: cartella } = await supabase.from("folders").select("id").eq("client_id", clientId).ilike("nome", "pratiche e istanze").is("parent_id", null).maybeSingle();
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        client_id: clientId,
        office_id: officeId!,
        folder_id: cartella?.id ?? null,
        nome: nomeFile,
        storage_path: path,
        mime_type: "application/pdf",
        dimensione: bytes.length,
        origine: "generato",
        uploaded_by: p.id,
      })
      .select("id")
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return { errore: error.message };
    }
    revalidatePath(`/clienti/${clientId}`);
    return { ok: `Salvato in "Pratiche e istanze": ${nomeFile}`, id: doc.id };
  } catch (e) {
    return { errore: e instanceof Error ? e.message : "Errore nella generazione" };
  }
}

// ---------------------------------------------------------------------
// Gestione modelli di documento
// ---------------------------------------------------------------------
async function officeDiDestinazione(perRete: boolean) {
  const p = await richiediRuolo("admin_rete", "titolare");
  if (perRete && p.ruolo !== "admin_rete") throw new Error("Solo la sede centrale può modificare i modelli della rete");
  return perRete ? null : p.office_id;
}

export async function salvaModello(input: { id?: string; perRete: boolean; nome: string; descrizione: string; corpo: string; richiede_pratica: boolean; attivo: boolean }): Promise<Esito> {
  try {
    const officeId = await officeDiDestinazione(input.perRete);
    const supabase = await createClient();
    if (!input.nome.trim()) return { errore: "Dai un nome al modello" };
    const dati = { nome: input.nome.trim(), descrizione: input.descrizione.trim() || null, corpo: input.corpo, richiede_pratica: input.richiede_pratica, attivo: input.attivo };
    const r = input.id
      ? await supabase.from("document_templates").update(dati).eq("id", input.id).select("id").single()
      : await supabase.from("document_templates").insert({ ...dati, office_id: officeId }).select("id").single();
    if (r.error) return { errore: r.error.code === "PGRST116" ? "Non hai i permessi per modificare questo modello" : r.error.message };
    revalidatePath("/modelli");
    return { ok: "Modello salvato", id: r.data.id };
  } catch (e) {
    return { errore: e instanceof Error ? e.message : "Errore" };
  }
}

export async function eliminaModello(id: string): Promise<Esito> {
  await richiediRuolo("admin_rete", "titolare");
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").delete().eq("id", id).select("id");
  if (!data?.length) return { errore: "Non hai i permessi per eliminare questo modello" };
  revalidatePath("/modelli");
  return { ok: "Modello eliminato" };
}

// ---------------------------------------------------------------------
// Gestione modelli di checklist
// ---------------------------------------------------------------------
export async function salvaChecklistModello(input: { id?: string; perRete: boolean; tipo_pratica: string; voci: string[] }): Promise<Esito> {
  try {
    const officeId = await officeDiDestinazione(input.perRete);
    const supabase = await createClient();
    const tipo = input.tipo_pratica.trim();
    if (!tipo) return { errore: "Indica il tipo di pratica" };
    const voci = input.voci.map((v) => v.trim()).filter(Boolean);
    const r = input.id
      ? await supabase.from("checklist_templates").update({ tipo_pratica: tipo, voci }).eq("id", input.id).select("id").single()
      : await supabase.from("checklist_templates").insert({ office_id: officeId, tipo_pratica: tipo, voci }).select("id").single();
    if (r.error) return { errore: r.error.code === "23505" ? "Esiste già una checklist per questo tipo di pratica" : r.error.code === "PGRST116" ? "Non hai i permessi" : r.error.message };
    revalidatePath("/modelli");
    return { ok: "Checklist salvata", id: r.data.id };
  } catch (e) {
    return { errore: e instanceof Error ? e.message : "Errore" };
  }
}

export async function eliminaChecklistModello(id: string): Promise<Esito> {
  await richiediRuolo("admin_rete", "titolare");
  const supabase = await createClient();
  const { data } = await supabase.from("checklist_templates").delete().eq("id", id).select("id");
  if (!data?.length) return { errore: "Non hai i permessi per eliminare questa checklist" };
  revalidatePath("/modelli");
  return { ok: "Checklist eliminata" };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ContestoCliente } from "@/lib/ai/claude";

type Db = SupabaseClient<Database>;

/** Carica tutto ciò che serve all'AI per conoscere un cliente. */
export async function caricaContestoCliente(db: Db, clientId: string | null, maxNote = 40): Promise<ContestoCliente> {
  if (!clientId) return { cliente: null, note: [], pratiche: [], documenti: [] };

  const [cli, note, pratiche, docs, cartelle] = await Promise.all([
    db
      .from("clients")
      .select(
        "codice, nome, cognome, sesso, data_nascita, luogo_nascita, cittadinanza, codice_fiscale, stato_civile, telefono, email, citta, lingua_preferita, passaporto_numero, passaporto_scadenza, permesso_tipo, permesso_numero, permesso_scadenza, note_generali, tags",
      )
      .eq("id", clientId)
      .single(),
    db.from("client_notes").select("numero, data_visita, testo").eq("client_id", clientId).order("numero", { ascending: false }).limit(maxNote),
    db.from("cases").select("tipo, stato, descrizione, prossima_scadenza, riferimento_esterno").eq("client_id", clientId).order("data_apertura"),
    db.from("documents").select("nome, folder_id, ai_tipo_documento, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(60),
    db.from("folders").select("id, nome").eq("client_id", clientId),
  ]);

  const nomiCartelle = new Map((cartelle.data ?? []).map((f) => [f.id, f.nome]));
  return {
    cliente: cli.data ?? null,
    note: (note.data ?? []).reverse(),
    pratiche: pratiche.data ?? [],
    documenti: (docs.data ?? []).map((d) => ({
      nome: d.nome,
      cartella: d.folder_id ? (nomiCartelle.get(d.folder_id) ?? null) : null,
      ai_tipo_documento: d.ai_tipo_documento,
      created_at: d.created_at,
    })),
  };
}

export function oggiISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { classificaDocumento, mimeSupportatoDaAi, aiDisponibile } from "@/lib/ai/claude";

type Db = SupabaseClient<Database>;

export const BUCKET = "documenti";

export function nomeFileSicuro(nome: string) {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 120) || "file"
  );
}

export function percorsoStorage(officeId: string, clientId: string, nome: string) {
  return `${officeId}/${clientId}/${crypto.randomUUID()}-${nomeFileSicuro(nome)}`;
}

const ESTENSIONI: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
export function estensione(mime: string) {
  return ESTENSIONI[mime] ?? "bin";
}

/**
 * Analizza un documento con l'AI: tipo, riepilogo e spostamento nella cartella suggerita.
 * Restituisce null se il formato non è supportato o l'AI non è configurata.
 */
export async function analizzaDocumento(db: Db, documentId: string, opzioni: { sposta: boolean; rinomina?: boolean }) {
  const { data: doc } = await db.from("documents").select("*, clients(nome, cognome)").eq("id", documentId).single();
  if (!doc || !aiDisponibile() || !mimeSupportatoDaAi(doc.mime_type)) return null;

  const { data: file, error } = await db.storage.from(BUCKET).download(doc.storage_path);
  if (error || !file) throw new Error("File non trovato nell'archivio");
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const { data: cartelle } = await db.from("folders").select("id, nome, parent_id").eq("client_id", doc.client_id);
  const lista = cartelle ?? [];
  // nome completo con percorso (es. "Famiglia / Coniuge") per le sottocartelle
  const percorso = (id: string): string => {
    const f = lista.find((x) => x.id === id);
    if (!f) return "";
    return f.parent_id ? `${percorso(f.parent_id)} / ${f.nome}` : f.nome;
  };
  const nomi = lista.map((f) => ({ id: f.id, nome: percorso(f.id) }));
  const cliente = doc.clients ? `${doc.clients.nome} ${doc.clients.cognome}` : "";

  const ris = await classificaDocumento(base64, doc.mime_type!, nomi.map((n) => n.nome), cliente);

  const update: Database["public"]["Tables"]["documents"]["Update"] = {
    ai_tipo_documento: ris.tipo_documento,
    ai_riepilogo: ris.riepilogo + (ris.scadenza ? ` (scadenza: ${ris.scadenza})` : ""),
  };
  if (opzioni.sposta) {
    const dest = nomi.find((n) => n.nome.toLowerCase() === ris.cartella_suggerita.toLowerCase());
    if (dest) update.folder_id = dest.id;
  }
  if (opzioni.rinomina && ris.nome_file_suggerito) {
    const ext = doc.nome.includes(".") ? doc.nome.slice(doc.nome.lastIndexOf(".")) : "";
    update.nome = ris.nome_file_suggerito + ext;
  }
  await db.from("documents").update(update).eq("id", documentId);
  return ris;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { compilaModello } from "@/lib/modelli";
import { creaPdf } from "@/lib/pdf";
import { data as fmtData } from "@/lib/format";
import { formattaTelefono } from "@/lib/telefono";
import { oggiRoma } from "@/lib/tempo";

type Db = SupabaseClient<Database>;

/** "IOSTRANIERO – Sede di Milano" (senza ripetere il marchio se è già nel nome della sede). */
function intestazione(sede: string) {
  const marchio = process.env.NEXT_PUBLIC_NOME_STUDIO || "IOSTRANIERO";
  return sede.toLowerCase().includes(marchio.toLowerCase()) ? sede : `${marchio} – ${sede}`;
}

type DatiCliente = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  | "nome" | "cognome" | "sesso" | "data_nascita" | "luogo_nascita" | "cittadinanza" | "codice_fiscale" | "indirizzo" | "cap" | "citta"
  | "telefono" | "email" | "passaporto_numero" | "passaporto_scadenza" | "permesso_tipo" | "permesso_numero" | "permesso_scadenza"
> & { office_id: string | null };

const ESEMPIO: DatiCliente = {
  nome: "Amina",
  cognome: "Benali",
  sesso: "F",
  data_nascita: "1990-03-12",
  luogo_nascita: "Casablanca (Marocco)",
  cittadinanza: "Marocco",
  codice_fiscale: "BNLMNA90C52Z330X",
  indirizzo: "Via Roma 1",
  cap: "20100",
  citta: "Milano",
  telefono: "393331112222",
  email: "amina@example.com",
  passaporto_numero: "AB1234567",
  passaporto_scadenza: "2030-05-01",
  permesso_tipo: "Lavoro subordinato",
  permesso_numero: "I12345678",
  permesso_scadenza: "2026-12-12",
  office_id: null,
};

/**
 * Compila un modello con i dati di cliente, sede e pratica e restituisce il PDF.
 * Tutte le letture passano dal client dell'utente: la RLS garantisce che veda solo i propri dati.
 * Senza clientId usa un cliente di esempio (anteprima del modello).
 */
export async function generaDocumento(db: Db, opts: { templateId: string; clientId: string | null; caseId: string | null; operatore: string; officeIdUtente: string | null }) {
  const { data: modello } = await db.from("document_templates").select("*").eq("id", opts.templateId).maybeSingle();
  if (!modello) throw new Error("Modello non trovato");

  let cliente: DatiCliente = ESEMPIO;
  if (opts.clientId) {
    const { data } = await db.from("clients").select("*").eq("id", opts.clientId).maybeSingle();
    if (!data) throw new Error("Cliente non trovato");
    cliente = data;
  }
  const officeId = cliente.office_id ?? modello.office_id ?? opts.officeIdUtente;
  const { data: sede } = officeId ? await db.from("offices").select("nome, indirizzo, citta, telefono, email").eq("id", officeId).maybeSingle() : { data: null };

  let pratica: { tipo: string; riferimento_esterno: string | null } | null = null;
  let consegnati: string[] = [];
  let mancanti: string[] = [];
  if (opts.caseId) {
    const { data } = await db.from("cases").select("tipo, riferimento_esterno, client_id").eq("id", opts.caseId).maybeSingle();
    if (!data || (opts.clientId && data.client_id !== opts.clientId)) throw new Error("Pratica non valida");
    pratica = data;
    const { data: voci } = await db.from("case_checklist").select("voce, fatto").eq("case_id", opts.caseId).order("ordine");
    consegnati = (voci ?? []).filter((v) => v.fatto).map((v) => v.voce);
    mancanti = (voci ?? []).filter((v) => !v.fatto).map((v) => v.voce);
  } else if (!opts.clientId) {
    pratica = { tipo: "Rinnovo permesso di soggiorno", riferimento_esterno: "MI-2026-12345" };
    consegnati = ["Passaporto in corso di validità", "Codice fiscale"];
    mancanti = ["CU o Modello 730 dell'ultimo anno", "Marca da bollo da 16 €"];
  }
  if (modello.richiede_pratica && !pratica) throw new Error("Per questo modello scegli una pratica");

  const elenco = (l: string[]) => (l.length ? l.map((v) => `- ${v}`).join("\n") : "- nessuno");
  const sedeNome = sede?.nome ?? "IOSTRANIERO";
  const oggi = fmtData(oggiRoma());
  const valori: Record<string, string | null> = {
    nome: cliente.nome,
    cognome: cliente.cognome,
    nome_completo: `${cliente.nome} ${cliente.cognome}`,
    nato_a: cliente.sesso === "F" ? "nata" : cliente.sesso === "M" ? "nato" : "nato/a",
    data_nascita: cliente.data_nascita ? fmtData(cliente.data_nascita) : null,
    luogo_nascita: cliente.luogo_nascita,
    cittadinanza: cliente.cittadinanza,
    codice_fiscale: cliente.codice_fiscale,
    indirizzo_completo: [cliente.indirizzo, [cliente.cap, cliente.citta].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    telefono: cliente.telefono ? formattaTelefono(cliente.telefono) : null,
    email: cliente.email,
    passaporto_numero: cliente.passaporto_numero,
    passaporto_scadenza: cliente.passaporto_scadenza ? fmtData(cliente.passaporto_scadenza) : null,
    permesso_tipo: cliente.permesso_tipo,
    permesso_numero: cliente.permesso_numero,
    permesso_scadenza: cliente.permesso_scadenza ? fmtData(cliente.permesso_scadenza) : null,
    pratica_tipo: pratica?.tipo ?? null,
    pratica_riferimento: pratica?.riferimento_esterno ? `(rif. ${pratica.riferimento_esterno})` : null,
    documenti_consegnati: elenco(consegnati),
    documenti_mancanti: elenco(mancanti),
    sede_nome: sedeNome,
    sede_indirizzo: [sede?.indirizzo, sede?.citta].filter(Boolean).join(", ") || null,
    sede_telefono: sede?.telefono ?? null,
    sede_email: sede?.email ?? null,
    operatore: opts.operatore || null,
    data_oggi: oggi,
    luogo_data: `${sede?.citta ?? "Luogo"}, ${oggi}`,
  };

  const testo = compilaModello(modello.corpo, valori);
  const bytes = await creaPdf({
    titoloDocumento: `${modello.nome} – ${valori.nome_completo}`,
    testo,
    intestazione: { sede: intestazione(sedeNome), sottotitolo: [valori.sede_indirizzo, sede?.telefono, sede?.email].filter(Boolean).join(" · ") },
  });
  const nomeFile = `${modello.nome} - ${cliente.cognome} ${cliente.nome} - ${oggiRoma()}.pdf`;
  return { bytes, nomeFile, officeId: cliente.office_id };
}

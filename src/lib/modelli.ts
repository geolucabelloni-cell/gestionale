/** Segnaposto disponibili nei modelli di documento: {{nome}}, {{codice_fiscale}}, ... */
export const SEGNAPOSTO: { chiave: string; descrizione: string }[] = [
  { chiave: "nome_completo", descrizione: "Nome e cognome del cliente" },
  { chiave: "nome", descrizione: "Nome" },
  { chiave: "cognome", descrizione: "Cognome" },
  { chiave: "nato_a", descrizione: "«nato» o «nata» secondo il sesso" },
  { chiave: "data_nascita", descrizione: "Data di nascita" },
  { chiave: "luogo_nascita", descrizione: "Luogo di nascita" },
  { chiave: "cittadinanza", descrizione: "Cittadinanza" },
  { chiave: "codice_fiscale", descrizione: "Codice fiscale" },
  { chiave: "indirizzo_completo", descrizione: "Indirizzo, CAP e città" },
  { chiave: "telefono", descrizione: "Telefono" },
  { chiave: "email", descrizione: "Email" },
  { chiave: "passaporto_numero", descrizione: "Numero passaporto" },
  { chiave: "passaporto_scadenza", descrizione: "Scadenza passaporto" },
  { chiave: "permesso_tipo", descrizione: "Tipo di permesso di soggiorno" },
  { chiave: "permesso_numero", descrizione: "Numero permesso" },
  { chiave: "permesso_scadenza", descrizione: "Scadenza permesso" },
  { chiave: "pratica_tipo", descrizione: "Tipo di pratica" },
  { chiave: "pratica_riferimento", descrizione: "Riferimento pratica (n. Questura/Prefettura)" },
  { chiave: "documenti_consegnati", descrizione: "Elenco documenti già consegnati (checklist)" },
  { chiave: "documenti_mancanti", descrizione: "Elenco documenti mancanti (checklist)" },
  { chiave: "sede_nome", descrizione: "Nome della sede" },
  { chiave: "sede_indirizzo", descrizione: "Indirizzo della sede" },
  { chiave: "sede_telefono", descrizione: "Telefono della sede" },
  { chiave: "sede_email", descrizione: "Email della sede" },
  { chiave: "operatore", descrizione: "Operatore che genera il documento" },
  { chiave: "data_oggi", descrizione: "Data di oggi" },
  { chiave: "luogo_data", descrizione: "«Città, data di oggi»" },
  { chiave: "firma", descrizione: "Riga per la firma" },
];

/** Segnaposto che, se vuoti, scompaiono invece di lasciare una riga da compilare a mano. */
const VUOTI_AMMESSI = new Set(["pratica_riferimento", "email"]);
export const RIGA_DA_COMPILARE = "____________________";

export function compilaModello(corpo: string, valori: Record<string, string | null | undefined>) {
  return corpo.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => {
    if (k === "firma") return "\n" + "_".repeat(34);
    const v = valori[k];
    if (v === null || v === undefined || v === "") return VUOTI_AMMESSI.has(k) ? "" : RIGA_DA_COMPILARE;
    return v;
  });
}

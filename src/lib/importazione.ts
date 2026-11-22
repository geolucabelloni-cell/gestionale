/** Definizione dei campi importabili e riconoscimento automatico delle colonne CSV. */

export type TipoImport = "clienti" | "note";

export const CAMPI: Record<TipoImport, { campo: string; label: string; sinonimi: string[]; obbligatorio?: boolean }[]> = {
  clienti: [
    { campo: "codice_esterno", label: "Codice cliente (TeamSystem)", sinonimi: ["codice", "cod", "codice cliente", "cod cliente", "id", "id cliente", "codice anagrafica"] },
    { campo: "cognome", label: "Cognome", sinonimi: ["cognome", "surname", "last name"], obbligatorio: true },
    { campo: "nome", label: "Nome", sinonimi: ["nome", "name", "first name"], obbligatorio: true },
    { campo: "nominativo", label: "Nominativo (cognome e nome insieme)", sinonimi: ["nominativo", "ragione sociale", "denominazione", "cognome e nome", "cognome nome"] },
    { campo: "sesso", label: "Sesso", sinonimi: ["sesso", "genere", "sex"] },
    { campo: "data_nascita", label: "Data di nascita", sinonimi: ["data nascita", "data di nascita", "nato il", "nascita"] },
    { campo: "luogo_nascita", label: "Luogo di nascita", sinonimi: ["luogo nascita", "luogo di nascita", "comune nascita", "nato a"] },
    { campo: "cittadinanza", label: "Cittadinanza", sinonimi: ["cittadinanza", "nazionalita", "nazionalità", "stato estero", "nazione"] },
    { campo: "codice_fiscale", label: "Codice fiscale", sinonimi: ["codice fiscale", "cod fiscale", "cf", "c.f.", "codfisc"] },
    { campo: "telefono", label: "Telefono / cellulare", sinonimi: ["cellulare", "telefono", "tel", "cell", "mobile", "whatsapp", "telefono cellulare"] },
    { campo: "email", label: "Email", sinonimi: ["email", "e-mail", "mail", "posta elettronica"] },
    { campo: "indirizzo", label: "Indirizzo", sinonimi: ["indirizzo", "via", "residenza", "indirizzo residenza"] },
    { campo: "citta", label: "Città", sinonimi: ["citta", "città", "comune", "localita", "località", "comune residenza"] },
    { campo: "cap", label: "CAP", sinonimi: ["cap", "c.a.p."] },
    { campo: "passaporto_numero", label: "N. passaporto", sinonimi: ["passaporto", "n passaporto", "numero passaporto"] },
    { campo: "passaporto_scadenza", label: "Scadenza passaporto", sinonimi: ["scadenza passaporto", "passaporto scadenza"] },
    { campo: "permesso_tipo", label: "Tipo permesso", sinonimi: ["tipo permesso", "permesso", "motivo permesso", "titolo soggiorno"] },
    { campo: "permesso_numero", label: "N. permesso", sinonimi: ["numero permesso", "n permesso", "n. permesso"] },
    { campo: "permesso_scadenza", label: "Scadenza permesso", sinonimi: ["scadenza permesso", "scadenza", "data scadenza", "permesso scadenza"] },
    { campo: "note_generali", label: "Note", sinonimi: ["note", "annotazioni", "osservazioni"] },
  ],
  note: [
    { campo: "codice_esterno", label: "Codice cliente (TeamSystem)", sinonimi: ["codice", "cod", "codice cliente", "cod cliente", "id cliente"] },
    { campo: "codice_fiscale", label: "Codice fiscale del cliente", sinonimi: ["codice fiscale", "cf", "cod fiscale"] },
    { campo: "nominativo", label: "Nominativo cliente (se mancano codici)", sinonimi: ["nominativo", "cliente", "cognome e nome", "ragione sociale"] },
    { campo: "data", label: "Data", sinonimi: ["data", "data nota", "data visita", "giorno", "data inserimento"], obbligatorio: true },
    { campo: "testo", label: "Testo della nota", sinonimi: ["nota", "note", "testo", "descrizione", "annotazione", "memo", "storico"], obbligatorio: true },
  ],
};

const normalizza = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_.\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Prima ipotesi di mappatura basata sui nomi delle colonne. */
export function mappaturaAutomatica(tipo: TipoImport, intestazioni: string[]) {
  const mappa: Record<string, string> = {};
  const usate = new Set<string>();
  const norm = intestazioni.map((h) => [h, normalizza(h)] as const);
  // prima le corrispondenze esatte, poi quelle parziali
  for (const esatta of [true, false]) {
    for (const c of CAMPI[tipo]) {
      if (mappa[c.campo]) continue;
      const trovata = norm.find(([h, n]) => !usate.has(h) && c.sinonimi.some((s) => (esatta ? n === normalizza(s) : n.includes(normalizza(s)) && normalizza(s).length > 3)));
      if (trovata) {
        mappa[c.campo] = trovata[0];
        usate.add(trovata[0]);
      }
    }
  }
  return mappa;
}

/** "31/12/2025", "31-12-25", "2025-12-31", "31/12/2025 10:30" → "2025-12-31" */
export function dataIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    let anno = m[3];
    if (anno.length === 2) anno = (Number(anno) > 40 ? "19" : "20") + anno;
    const g = Number(m[1]);
    const mese = Number(m[2]);
    if (mese < 1 || mese > 12 || g < 1 || g > 31) return null;
    return `${anno}-${String(mese).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  }
  return null;
}

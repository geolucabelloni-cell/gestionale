export function data(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, g] = d.slice(0, 10).split("-");
  return `${g}/${m}/${y}`;
}

export function dataOra(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ora(d: string) {
  return new Date(d).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
}

export function dataLunga(d: string) {
  return new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function giorniA(d: string | null | undefined) {
  if (!d) return null;
  const oggi = new Date(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }) + "T00:00:00Z");
  const target = new Date(d.slice(0, 10) + "T00:00:00Z");
  return Math.round((target.getTime() - oggi.getTime()) / 86400000);
}

export function dimensione(b: number | null | undefined) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export const STATI_PRATICA: Record<string, string> = {
  aperta: "Aperta",
  in_attesa_documenti: "In attesa documenti",
  presentata: "Presentata",
  in_lavorazione: "In lavorazione",
  conclusa_positiva: "Conclusa – esito positivo",
  conclusa_negativa: "Conclusa – esito negativo",
  archiviata: "Archiviata",
};

export const TIPI_PRATICA = [
  "Rinnovo permesso di soggiorno",
  "Primo rilascio permesso di soggiorno",
  "Conversione permesso",
  "Permesso UE soggiornanti di lungo periodo",
  "Ricongiungimento familiare",
  "Coesione familiare",
  "Cittadinanza per residenza",
  "Cittadinanza per matrimonio",
  "Decreto flussi / Nulla osta lavoro",
  "Protezione internazionale",
  "Ricorso / Contenzioso",
  "Carta di soggiorno familiare UE",
  "Test di lingua italiana",
  "Altro",
];

export const TIPI_PERMESSO = [
  "Lavoro subordinato",
  "Lavoro autonomo",
  "Attesa occupazione",
  "Motivi familiari",
  "Studio",
  "UE soggiornanti di lungo periodo",
  "Protezione speciale",
  "Protezione sussidiaria",
  "Asilo politico",
  "Cure mediche",
  "Minore età",
  "Richiesta asilo",
  "Altro",
];

export const LINGUE: Record<string, string> = {
  it: "Italiano",
  en: "Inglese",
  fr: "Francese",
  es: "Spagnolo",
  ar: "Arabo",
  bn: "Bengalese",
  ur: "Urdu",
  hi: "Hindi",
  pa: "Punjabi",
  zh: "Cinese",
  ro: "Rumeno",
  sq: "Albanese",
  uk: "Ucraino",
  ru: "Russo",
  pt: "Portoghese",
  tl: "Filippino",
  wo: "Wolof",
};

/** Data (YYYY-MM-DD, fuso Europe/Rome) spostata di n giorni rispetto a oggi. */
export function dataTraGiorni(n: number) {
  return new Date(Date.now() + n * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

/** Ore trascorse da un timestamp ISO. */
export function oreTrascorse(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3600_000;
}

export function istanteFa(giorni: number) {
  return new Date(Date.now() - giorni * 86400000).toISOString();
}

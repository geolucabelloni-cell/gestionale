/** CSV compatibile con Excel in italiano: separatore ";", UTF-8 con BOM, campi tra virgolette quando serve. */
export function aCsv(righe: Record<string, unknown>[], colonne?: string[]) {
  const cols = colonne ?? [...new Set(righe.flatMap((r) => Object.keys(r)))];
  const cella = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    // evita che Excel interpreti il contenuto come formula (CSV injection)
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(";"), ...righe.map((r) => cols.map((c) => cella(r[c])).join(";"))].join("\r\n") + "\r\n";
}

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * Genera un PDF A4 da un testo di modello già compilato.
 * Sintassi del testo:
 *   # Titolo           → titolo centrato in grassetto
 *   ## Sottotitolo     → sottotitolo centrato in grassetto
 *   - voce             → elenco puntato
 *   **parola**         → grassetto
 *   riga vuota         → nuovo paragrafo
 */

const ASSETS = path.join(process.cwd(), "assets");
let cacheAsset: Promise<{ regular: Buffer; bold: Buffer; logo: Buffer }> | null = null;
function asset() {
  cacheAsset ??= Promise.all([
    fs.readFile(path.join(ASSETS, "fonts/LiberationSans-Regular.ttf")),
    fs.readFile(path.join(ASSETS, "fonts/LiberationSans-Bold.ttf")),
    fs.readFile(path.join(ASSETS, "logo-iostraniero.png")),
  ]).then(([regular, bold, logo]) => ({ regular, bold, logo }));
  return cacheAsset;
}

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 62, top: 120, bottom: 70 };
const ARANCIO = rgb(0.92, 0.4, 0.04);
const GRIGIO = rgb(0.4, 0.43, 0.48);
const NERO = rgb(0.1, 0.1, 0.12);

type Intestazione = { sede: string; sottotitolo: string };
type Pezzo = { testo: string; grassetto: boolean };
/** Una parola può avere parti in grassetto e parti normali (es. "**Rossi**,"). */
type Parola = Pezzo[];

export async function creaPdf(opts: { titoloDocumento: string; testo: string; intestazione: Intestazione }) {
  const { regular, bold, logo } = await asset();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(opts.titoloDocumento);
  doc.setCreator("IOSTRANIERO");
  doc.setProducer("IOSTRANIERO gestionale");
  const fR = await doc.embedFont(regular, { subset: true });
  const fB = await doc.embedFont(bold, { subset: true });
  const img = await doc.embedPng(logo);
  const supportati = new Set([...fR.getCharacterSet(), 10]);
  const pulisci = (s: string) =>
    [...s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')]
      .map((c) => (supportati.has(c.codePointAt(0)!) ? c : "?"))
      .join("");

  const larghezza = A4.w - 2 * M.x;
  const pagine: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;
  const nuovaPagina = () => {
    pagina = doc.addPage([A4.w, A4.h]);
    pagine.push(pagina);
    // intestazione
    pagina.drawImage(img, { x: M.x, y: A4.h - 92, width: 46, height: 46 });
    pagina.drawText(pulisci(opts.intestazione.sede), { x: M.x + 58, y: A4.h - 64, size: 13, font: fB, color: ARANCIO });
    if (opts.intestazione.sottotitolo)
      pagina.drawText(pulisci(opts.intestazione.sottotitolo), { x: M.x + 58, y: A4.h - 80, size: 8.5, font: fR, color: GRIGIO });
    pagina.drawLine({ start: { x: M.x, y: A4.h - 102 }, end: { x: A4.w - M.x, y: A4.h - 102 }, thickness: 1, color: ARANCIO });
    y = A4.h - M.top;
  };
  const spazio = (h: number) => {
    if (y - h < M.bottom) nuovaPagina();
  };

  const parole = (riga: string, tuttoGrassetto = false): Parola[] => {
    const out: Parola[] = [];
    let corrente: Parola = [];
    riga.split(/(\*\*[^*]+\*\*)/g).forEach((seg) => {
      const g = tuttoGrassetto || (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4);
      const t = seg.startsWith("**") && seg.endsWith("**") && seg.length > 4 ? seg.slice(2, -2) : seg;
      for (const pezzo of t.split(/(\s+)/)) {
        if (!pezzo) continue;
        if (/^\s+$/.test(pezzo)) {
          if (corrente.length) out.push(corrente);
          corrente = [];
        } else corrente.push({ testo: pulisci(pezzo), grassetto: g });
      }
    });
    if (corrente.length) out.push(corrente);
    return out;
  };
  const misura = (p: Parola, size: number) => p.reduce((s, x) => s + (x.grassetto ? fB : fR).widthOfTextAtSize(x.testo, size), 0);

  const scriviParagrafo = (riga: string, o: { size: number; tuttoGrassetto?: boolean; centrato?: boolean; rientro?: number; interlinea?: number }) => {
    const size = o.size;
    const lh = size * (o.interlinea ?? 1.45);
    const rientro = o.rientro ?? 0;
    const max = larghezza - rientro;
    const sp = fR.widthOfTextAtSize(" ", size);
    const ws = parole(riga, o.tuttoGrassetto);
    const righe: Parola[][] = [];
    let corrente: Parola[] = [];
    let w = 0;
    for (const p of ws) {
      const pw = misura(p, size);
      if (corrente.length && w + sp + pw > max) {
        righe.push(corrente);
        corrente = [];
        w = 0;
      }
      w += (corrente.length ? sp : 0) + pw;
      corrente.push(p);
    }
    if (corrente.length) righe.push(corrente);
    for (const r of righe) {
      spazio(lh);
      const wr = r.reduce((s, p, i) => s + misura(p, size) + (i ? sp : 0), 0);
      let x = M.x + rientro + (o.centrato ? (max - wr) / 2 : 0);
      for (const p of r) {
        for (const pz of p) {
          const f = pz.grassetto ? fB : fR;
          pagina.drawText(pz.testo, { x, y: y - size, size, font: f, color: NERO });
          x += f.widthOfTextAtSize(pz.testo, size);
        }
        x += sp;
      }
      y -= lh;
    }
  };

  nuovaPagina();
  for (const grezza of opts.testo.replace(/\r/g, "").split("\n")) {
    const riga = grezza.trimEnd();
    if (!riga.trim()) {
      y -= 9;
      continue;
    }
    if (riga.startsWith("# ")) {
      spazio(40);
      scriviParagrafo(riga.slice(2), { size: 15, tuttoGrassetto: true, centrato: true, interlinea: 1.3 });
      y -= 8;
    } else if (riga.startsWith("## ")) {
      spazio(30);
      y -= 4;
      scriviParagrafo(riga.slice(3), { size: 11.5, tuttoGrassetto: true, centrato: true });
      y -= 2;
    } else if (/^\s*[-•]\s+/.test(riga)) {
      spazio(16);
      const size = 10.5;
      pagina.drawText("•", { x: M.x + 8, y: y - size, size, font: fB, color: ARANCIO });
      scriviParagrafo(riga.replace(/^\s*[-•]\s+/, ""), { size, rientro: 22 });
    } else {
      scriviParagrafo(riga, { size: 10.5 });
    }
  }

  // piè di pagina
  pagine.forEach((p, i) => {
    const t = `${opts.intestazione.sede} – pagina ${i + 1} di ${pagine.length}`;
    const s = pulisci(t);
    p.drawText(s, { x: (A4.w - fR.widthOfTextAtSize(s, 8)) / 2, y: 34, size: 8, font: fR, color: GRIGIO });
  });
  return doc.save();
}

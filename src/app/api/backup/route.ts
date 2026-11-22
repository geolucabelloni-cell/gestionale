import { NextResponse, type NextRequest } from "next/server";
import { strToU8, Zip, ZipDeflate } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { getProfilo } from "@/lib/auth";
import { aCsv } from "@/lib/csv";
import { oggiRoma } from "@/lib/tempo";

export const maxDuration = 300;

/** Tabelle esportate: nome del file nel backup → tabella. Le letture passano dalla RLS dell'utente. */
const TABELLE: [string, string][] = [
  ["sedi", "offices"],
  ["utenti", "profiles"],
  ["clienti", "clients"],
  ["diario_note", "client_notes"],
  ["pratiche", "cases"],
  ["pratiche_checklist", "case_checklist"],
  ["cartelle", "folders"],
  ["documenti_elenco", "documents"],
  ["appuntamenti", "appointments"],
  ["attivita", "tasks"],
  ["whatsapp_messaggi", "whatsapp_messages"],
  ["modelli_documento", "document_templates"],
  ["modelli_checklist", "checklist_templates"],
  ["registro_attivita", "audit_log"],
];
const BLOCCO = 1000;

/** Backup dei dati in ZIP (un CSV per tabella). Sede centrale: tutte le sedi; titolare: la propria. */
export async function GET(req: NextRequest) {
  const p = await getProfilo();
  if (!p || (p.ruolo !== "admin_rete" && p.ruolo !== "titolare")) return new NextResponse("Non autorizzato", { status: 403 });
  const supabase = await createClient();
  const richiesta = req.nextUrl.searchParams.get("sede");
  const sede = p.ruolo === "admin_rete" ? richiesta || null : p.office_id; // null = tutta la rete

  await supabase.from("audit_log").insert({ azione: "backup_dati", entita: "offices", entita_id: sede, office_id: sede ?? p.office_id, user_id: p.id });

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const scrittore = writable.getWriter();
  const zip = new Zip((err, dati, fine) => {
    if (err) {
      void scrittore.abort(err);
      return;
    }
    void scrittore.write(dati);
    if (fine) void scrittore.close();
  });
  const aggiungi = (nome: string, testo: string) => {
    const f = new ZipDeflate(nome, { level: 6 });
    zip.add(f);
    f.push(strToU8(testo), true);
  };

  (async () => {
    const conteggi: string[] = [];
    for (const [file, tabella] of TABELLE) {
      const righe: Record<string, unknown>[] = [];
      for (let da = 0; ; da += BLOCCO) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase.from(tabella as any) as any).select("*").range(da, da + BLOCCO - 1);
        if (sede) q = tabella === "offices" ? q.eq("id", sede) : ["document_templates", "checklist_templates"].includes(tabella) ? q.or(`office_id.is.null,office_id.eq.${sede}`) : q.eq("office_id", sede);
        const { data, error } = await q;
        if (error) throw new Error(`${tabella}: ${error.message}`);
        righe.push(...(data as Record<string, unknown>[]));
        if (data.length < BLOCCO) break;
      }
      // campi tecnici inutili nel backup
      for (const r of righe) delete r.search_text;
      aggiungi(`${file}.csv`, aCsv(righe));
      conteggi.push(`${file}.csv: ${righe.length} righe`);
    }
    aggiungi(
      "LEGGIMI.txt",
      [
        "BACKUP DATI – IOSTRANIERO",
        `Creato il ${new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })} da ${p.nome_completo} (${p.email})`,
        `Ambito: ${sede ? "una sede" : "tutta la rete"}`,
        "",
        "Ogni file .csv si apre con Excel (separatore punto e virgola, UTF-8).",
        "I file dei documenti (PDF, foto) NON sono inclusi: 'documenti_elenco.csv' riporta nome, cartella e percorso di ciascuno.",
        "",
        "ATTENZIONE: questo file contiene dati personali dei clienti. Conservalo in un luogo protetto e non inviarlo per email.",
        "",
        ...conteggi,
      ].join("\r\n"),
    );
    zip.end();
  })().catch((e) => {
    console.error("[backup] errore", e);
    void scrittore.abort(e);
  });

  const nome = `backup-iostraniero-${sede ? "sede" : "rete"}-${oggiRoma()}.zip`;
  return new NextResponse(readable, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "no-store" },
  });
}

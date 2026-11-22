"use server";

import { createClient } from "@/lib/supabase/server";
import { richiediRuolo } from "@/lib/auth";
import { normalizzaTelefono } from "@/lib/telefono";
import { CAMPI, dataIso, type TipoImport } from "@/lib/importazione";
import { mappaColonneCsv } from "@/lib/ai/claude";

type Riga = Record<string, string | undefined>;
const v = (r: Riga, k: string) => {
  const s = r[k]?.trim();
  return s ? s : null;
};

export async function aiMappaColonne(tipo: TipoImport, intestazioni: string[], esempi: string[][]) {
  await richiediRuolo("admin_rete", "titolare");
  try {
    return { mappa: await mappaColonneCsv(CAMPI[tipo], intestazioni, esempi.slice(0, 5)) };
  } catch {
    return { errore: "AI non disponibile: abbina le colonne a mano" };
  }
}

function separaNominativo(n: string) {
  const parti = n.trim().split(/\s+/);
  return { cognome: parti[0] ?? "", nome: parti.slice(1).join(" ") || "-" };
}

/** Importa un blocco di anagrafiche. Aggiorna quelle già presenti (stesso codice esterno o codice fiscale). */
export async function importaClienti(officeId: string, righe: Riga[]) {
  const p = await richiediRuolo("admin_rete", "titolare");
  if (p.ruolo !== "admin_rete" && officeId !== p.office_id) return { errore: "Sede non valida" };
  const supabase = await createClient();

  const codici = righe.map((r) => v(r, "codice_esterno")).filter(Boolean) as string[];
  const cfs = righe.map((r) => v(r, "codice_fiscale")?.toUpperCase()).filter(Boolean) as string[];
  const esistenti = new Map<string, string>();
  if (codici.length) {
    const { data } = await supabase.from("clients").select("id, codice_esterno").eq("office_id", officeId).in("codice_esterno", codici);
    for (const c of data ?? []) esistenti.set("cod:" + c.codice_esterno, c.id);
  }
  if (cfs.length) {
    const { data } = await supabase.from("clients").select("id, codice_fiscale").eq("office_id", officeId).in("codice_fiscale", cfs);
    for (const c of data ?? []) esistenti.set("cf:" + c.codice_fiscale, c.id);
  }

  let creati = 0,
    aggiornati = 0;
  const scarti: string[] = [];
  const nuovi = [];
  for (const [i, r] of righe.entries()) {
    let nome = v(r, "nome");
    let cognome = v(r, "cognome");
    if ((!nome || !cognome) && v(r, "nominativo")) ({ nome, cognome } = separaNominativo(v(r, "nominativo")!));
    if (!nome || !cognome) {
      scarti.push(`riga ${i + 1}: manca nome o cognome`);
      continue;
    }
    const sesso = v(r, "sesso")?.toUpperCase().charAt(0);
    const dati = {
      nome,
      cognome,
      codice_esterno: v(r, "codice_esterno"),
      sesso: sesso === "M" || sesso === "F" ? sesso : null,
      data_nascita: dataIso(v(r, "data_nascita")),
      luogo_nascita: v(r, "luogo_nascita"),
      cittadinanza: v(r, "cittadinanza"),
      codice_fiscale: v(r, "codice_fiscale")?.toUpperCase() ?? null,
      telefono: normalizzaTelefono(v(r, "telefono")),
      email: v(r, "email")?.toLowerCase() ?? null,
      indirizzo: v(r, "indirizzo"),
      citta: v(r, "citta"),
      cap: v(r, "cap"),
      passaporto_numero: v(r, "passaporto_numero"),
      passaporto_scadenza: dataIso(v(r, "passaporto_scadenza")),
      permesso_tipo: v(r, "permesso_tipo"),
      permesso_numero: v(r, "permesso_numero"),
      permesso_scadenza: dataIso(v(r, "permesso_scadenza")),
      note_generali: v(r, "note_generali"),
    };
    // non sovrascrivere con valori vuoti
    const pieni = Object.fromEntries(Object.entries(dati).filter(([, x]) => x !== null)) as typeof dati;
    const id = (dati.codice_esterno && esistenti.get("cod:" + dati.codice_esterno)) || (dati.codice_fiscale && esistenti.get("cf:" + dati.codice_fiscale));
    if (id) {
      const { error } = await supabase.from("clients").update(pieni).eq("id", id);
      if (error) scarti.push(`riga ${i + 1}: ${error.message}`);
      else aggiornati++;
    } else {
      nuovi.push({ ...pieni, office_id: officeId, created_by: p.id, tags: ["importato"] });
    }
  }
  if (nuovi.length) {
    const { error, count } = await supabase.from("clients").insert(nuovi, { count: "exact" });
    if (error) scarti.push(`inserimento blocco: ${error.message}`);
    else creati = count ?? nuovi.length;
  }
  return { creati, aggiornati, scarti };
}

/** Importa un blocco di note del diario, abbinandole al cliente per codice, codice fiscale o nominativo. */
export async function importaNote(officeId: string, righe: Riga[]) {
  const p = await richiediRuolo("admin_rete", "titolare");
  if (p.ruolo !== "admin_rete" && officeId !== p.office_id) return { errore: "Sede non valida" };
  const supabase = await createClient();
  const { data: clienti } = await supabase.from("clients").select("id, codice_esterno, codice_fiscale, nome, cognome").eq("office_id", officeId).limit(100000);
  const perCod = new Map<string, string>();
  const perCf = new Map<string, string>();
  const perNome = new Map<string, string>();
  for (const c of clienti ?? []) {
    if (c.codice_esterno) perCod.set(c.codice_esterno, c.id);
    if (c.codice_fiscale) perCf.set(c.codice_fiscale, c.id);
    perNome.set(`${c.cognome} ${c.nome}`.toLowerCase().replace(/\s+/g, " "), c.id);
  }

  const scarti: string[] = [];
  const note: { client_id: string; data_visita: string; testo: string }[] = [];
  for (const [i, r] of righe.entries()) {
    const testo = v(r, "testo");
    const data = dataIso(v(r, "data"));
    const clientId =
      (v(r, "codice_esterno") && perCod.get(v(r, "codice_esterno")!)) ||
      (v(r, "codice_fiscale") && perCf.get(v(r, "codice_fiscale")!.toUpperCase())) ||
      (v(r, "nominativo") && perNome.get(v(r, "nominativo")!.toLowerCase().replace(/\s+/g, " ")));
    if (!testo) continue;
    if (!clientId) {
      scarti.push(`riga ${i + 1}: cliente non trovato`);
      continue;
    }
    if (!data) {
      scarti.push(`riga ${i + 1}: data non valida`);
      continue;
    }
    note.push({ client_id: clientId, data_visita: data, testo });
  }
  // ordine cronologico: la numerazione progressiva rispetta lo storico
  note.sort((a, b) => a.data_visita.localeCompare(b.data_visita));
  let importate = 0;
  for (let i = 0; i < note.length; i += 100) {
    const blocco = note.slice(i, i + 100).map((n) => ({ ...n, office_id: officeId, numero: 0, origine: "sistema" as const, author_id: p.id }));
    const { error } = await supabase.from("client_notes").insert(blocco);
    if (error) scarti.push(`blocco ${i / 100 + 1}: ${error.message}`);
    else importate += blocco.length;
  }
  return { importate, scarti };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { romaToISO } from "@/lib/tempo";
import { normalizzaTelefono } from "@/lib/telefono";
import type { Database } from "@/lib/database.types";

type Esito = { errore?: string; ok?: string } | null;
const t = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function salvaAppuntamento(_: Esito, f: FormData): Promise<Esito> {
  const p = await richiediProfilo();
  const supabase = await createClient();
  const id = t(f, "id");
  const data = t(f, "data");
  const ora = t(f, "ora");
  const durata = Number(t(f, "durata") ?? 30);
  if (!data || !ora) return { errore: "Indica data e ora" };
  const clientId = t(f, "client_id");
  const nominativo = t(f, "nominativo");
  if (!clientId && !nominativo) return { errore: "Scegli un cliente o scrivi il nominativo" };
  const inizio = romaToISO(data, ora);
  const fine = new Date(new Date(inizio).getTime() + Math.max(5, durata) * 60000).toISOString();

  const dati = {
    client_id: clientId,
    nominativo: clientId ? null : nominativo,
    telefono: clientId ? null : normalizzaTelefono(t(f, "telefono")),
    operatore_id: t(f, "operatore_id"),
    titolo: t(f, "titolo") ?? t(f, "tipo") ?? "Appuntamento",
    tipo: t(f, "tipo") ?? "Consulenza",
    inizio,
    fine,
    luogo: t(f, "luogo") ?? "In sede",
    stato: (t(f, "stato") ?? "programmato") as Database["public"]["Enums"]["stato_appuntamento"],
    note: t(f, "note"),
  };

  // avviso sovrapposizioni per lo stesso operatore
  if (dati.operatore_id) {
    let q = supabase
      .from("appointments")
      .select("id, titolo")
      .eq("operatore_id", dati.operatore_id)
      .not("stato", "in", "(annullato)")
      .lt("inizio", fine)
      .gt("fine", inizio);
    if (id) q = q.neq("id", id);
    const { data: conflitti } = await q;
    if (conflitti?.length && f.get("forza") !== "1") {
      return { errore: `L'operatore ha già un appuntamento in quell'orario (${conflitti[0].titolo}). Salva di nuovo per confermare comunque.`, ok: "conflitto" };
    }
  }

  const officeId = p.ruolo === "admin_rete" ? (t(f, "office_id") ?? p.office_id) : p.office_id;
  const { error } = id
    ? await supabase.from("appointments").update(dati).eq("id", id)
    : await supabase.from("appointments").insert({ ...dati, office_id: officeId! });
  if (error) return { errore: error.message };
  revalidatePath("/agenda");
  revalidatePath("/");
  if (clientId) revalidatePath(`/clienti/${clientId}`);
  return { ok: "Appuntamento salvato" };
}

export async function cambiaStatoAppuntamento(id: string, stato: Database["public"]["Enums"]["stato_appuntamento"]) {
  await richiediProfilo();
  const supabase = await createClient();
  await supabase.from("appointments").update({ stato }).eq("id", id);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function eliminaAppuntamento(id: string) {
  await richiediProfilo();
  const supabase = await createClient();
  await supabase.from("appointments").delete().eq("id", id);
  revalidatePath("/agenda");
  revalidatePath("/");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

type Esito = { errore?: string; ok?: string } | null;
type Priorita = Database["public"]["Enums"]["priorita"];
const t = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function aggiorna(clientId?: string | null) {
  revalidatePath("/scadenze");
  revalidatePath("/");
  if (clientId) revalidatePath(`/clienti/${clientId}`);
}

export async function salvaAttivita(_: Esito, f: FormData): Promise<Esito> {
  const p = await richiediProfilo();
  const supabase = await createClient();
  const id = t(f, "id");
  const titolo = t(f, "titolo");
  if (!titolo) return { errore: "Scrivi cosa c'è da fare" };
  const dati = {
    titolo,
    descrizione: t(f, "descrizione"),
    scadenza: t(f, "scadenza"),
    priorita: (t(f, "priorita") ?? "normale") as Priorita,
    assegnato_a: t(f, "assegnato_a"),
    client_id: t(f, "client_id"),
  };
  const { error } = id
    ? await supabase.from("tasks").update(dati).eq("id", id)
    : await supabase.from("tasks").insert({ ...dati, office_id: p.office_id! });
  if (error) return { errore: error.message };
  aggiorna(dati.client_id);
  return { ok: "Attività salvata" };
}

export async function creaAttivita(lista: { titolo: string; descrizione?: string | null; scadenza?: string | null; priorita?: Priorita; client_id?: string | null; assegnato_a?: string | null }[], origine = "ai") {
  const p = await richiediProfilo();
  const supabase = await createClient();
  if (!lista.length) return { ok: "Nessuna attività" };
  const { error } = await supabase.from("tasks").insert(
    lista.map((a) => ({
      titolo: a.titolo,
      descrizione: a.descrizione ?? null,
      scadenza: a.scadenza ?? null,
      priorita: a.priorita ?? "normale",
      client_id: a.client_id ?? null,
      assegnato_a: a.assegnato_a ?? null,
      origine,
      office_id: p.office_id!,
    })),
  );
  if (error) return { errore: error.message };
  aggiorna(lista[0].client_id);
  return { ok: `${lista.length} attività create` };
}

export async function cambiaStatoAttivita(id: string, fatto: boolean) {
  await richiediProfilo();
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").update({ stato: fatto ? "fatto" : "da_fare" }).eq("id", id).select("client_id").single();
  aggiorna(data?.client_id);
}

export async function eliminaAttivita(id: string) {
  await richiediProfilo();
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").delete().eq("id", id).select("client_id").single();
  aggiorna(data?.client_id);
}

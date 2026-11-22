import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profilo = {
  id: string;
  email: string | null;
  nome_completo: string;
  ruolo: "admin_rete" | "titolare" | "operatore";
  office_id: string | null;
  sede_nome: string | null;
};

/** Profilo dell'utente collegato (una sola query per richiesta). */
export const getProfilo = cache(async (): Promise<Profilo | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, nome_completo, ruolo, office_id, attivo, offices(nome)")
    .eq("id", user.id)
    .single();
  if (!data || !data.attivo) return null;
  return {
    id: data.id,
    email: data.email,
    nome_completo: data.nome_completo,
    ruolo: data.ruolo,
    office_id: data.office_id,
    sede_nome: data.offices?.nome ?? null,
  };
});

export async function richiediProfilo() {
  const p = await getProfilo();
  if (!p) redirect("/login");
  return p;
}

export async function richiediRuolo(...ruoli: Profilo["ruolo"][]) {
  const p = await richiediProfilo();
  if (!ruoli.includes(p.ruolo)) redirect("/");
  return p;
}

export const ETICHETTE_RUOLO: Record<Profilo["ruolo"], string> = {
  admin_rete: "Sede centrale",
  titolare: "Titolare sede",
  operatore: "Operatore",
};

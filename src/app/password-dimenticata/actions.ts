"use server";

import { createClient } from "@/lib/supabase/server";
import { indirizzoPubblico } from "@/lib/indirizzo";

export async function richiediReimpostazione(_: unknown, f: FormData) {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { errore: "Inserisci un indirizzo email valido" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await indirizzoPubblico()}/auth/conferma?next=/reimposta-password`,
  });
  if (error) console.error("[password] invio email di reimpostazione fallito", error.message);
  // stesso messaggio in ogni caso: non riveliamo quali email sono registrate
  return { ok: "Se l'indirizzo è registrato, riceverai a breve un'email con il link per scegliere una nuova password. Controlla anche lo spam." };
}

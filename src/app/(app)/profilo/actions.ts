"use server";

import { revalidatePath } from "next/cache";
import { createClient as clientSemplice } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { richiediProfilo } from "@/lib/auth";
import { controllaPassword } from "@/lib/password";

export async function cambiaPassword(_: unknown, f: FormData) {
  const p = await richiediProfilo();
  const attuale = String(f.get("attuale") ?? "");
  const nuova = String(f.get("nuova") ?? "");
  const errore = controllaPassword(nuova, String(f.get("conferma") ?? ""));
  if (errore) return { errore };
  if (nuova === attuale) return { errore: "La nuova password deve essere diversa da quella attuale" };

  // verifica la password attuale senza toccare la sessione in corso
  const verifica = clientSemplice(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error: errAccesso } = await verifica.auth.signInWithPassword({ email: p.email ?? "", password: attuale });
  if (errAccesso) return { errore: "La password attuale non è corretta" };
  await verifica.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: nuova });
  if (error) return { errore: "Impossibile salvare la password: " + error.message };
  return { ok: "Password aggiornata" };
}

export async function cambiaNome(_: unknown, f: FormData) {
  const p = await richiediProfilo();
  const nome = String(f.get("nome_completo") ?? "").trim();
  if (nome.length < 2) return { errore: "Scrivi nome e cognome" };
  // gli utenti non possono modificare il proprio profilo direttamente (ruolo/sede): si aggiorna solo il nome
  await createAdminClient().from("profiles").update({ nome_completo: nome.slice(0, 100) }).eq("id", p.id);
  revalidatePath("/", "layout");
  return { ok: "Nome aggiornato" };
}

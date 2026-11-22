"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { controllaPassword } from "@/lib/password";

export async function impostaNuovaPassword(_: unknown, f: FormData) {
  const pw = String(f.get("password") ?? "");
  const errore = controllaPassword(pw, String(f.get("conferma") ?? ""));
  if (errore) return { errore };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Il link è scaduto: richiedine uno nuovo da «Password dimenticata»." };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { errore: error.message.includes("different") ? "La nuova password deve essere diversa dalla precedente" : "Impossibile salvare la password: " + error.message };
  redirect("/?password=aggiornata");
}

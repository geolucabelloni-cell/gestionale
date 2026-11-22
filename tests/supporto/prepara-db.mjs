/** Azzera il database LOCALE e crea l'amministratore di prova. Uso: node tests/supporto/prepara-db.mjs */
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, RADICE } from "./ambiente.mjs";

export async function preparaDatabase() {
  execSync("npx supabase db reset", { cwd: RADICE, stdio: "ignore" });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // dopo il reset i servizi impiegano qualche secondo a ripartire
  for (let i = 0; ; i++) {
    const { error } = await db.from("offices").select("id").limit(1);
    if (!error) break;
    if (i > 60) throw new Error("Supabase locale non risponde dopo il reset: " + error.message);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const { data: sede, error: e1 } = await db.from("offices").insert({ nome: "Sede di prova", citta: "Milano", indirizzo: "Via Prova 1" }).select("id").single();
  if (e1) throw e1;
  let utente;
  for (let i = 0; ; i++) {
    const r = await db.auth.admin.createUser({ email: ADMIN.email, password: ADMIN.password, email_confirm: true });
    if (!r.error) {
      utente = r.data.user;
      break;
    }
    if (i > 30) throw r.error;
    await new Promise((res) => setTimeout(res, 1000));
  }
  const { error: e2 } = await db.from("profiles").insert({ id: utente.id, email: ADMIN.email, nome_completo: "Mario Rossi", ruolo: "admin_rete", office_id: sede.id });
  if (e2) throw e2;
  return { officeId: sede.id };
}



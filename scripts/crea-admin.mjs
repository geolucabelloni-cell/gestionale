#!/usr/bin/env node
/**
 * Crea il primo utente della sede centrale (admin_rete) e la sede centrale.
 *
 * Uso:
 *   node --env-file=.env.local scripts/crea-admin.mjs email@studio.it "PasswordSicura123" "Nome Cognome" "Sede centrale"
 */
import { createClient } from "@supabase/supabase-js";

const [email, password, nome = "Amministratore", nomeSede = "Sede centrale"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node --env-file=.env.local scripts/crea-admin.mjs <email> <password> ["Nome Cognome"] ["Nome sede"]');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let { data: sede } = await db.from("offices").select("id, nome").eq("nome", nomeSede).maybeSingle();
if (!sede) {
  const r = await db.from("offices").insert({ nome: nomeSede }).select("id, nome").single();
  if (r.error) throw r.error;
  sede = r.data;
  console.log(`Creata sede: ${sede.nome}`);
}

const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const { error: e2 } = await db.from("profiles").insert({ id: u.user.id, email, nome_completo: nome, ruolo: "admin_rete", office_id: sede.id });
if (e2) throw e2;
console.log(`Creato amministratore di rete: ${email}`);

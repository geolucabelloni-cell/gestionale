/**
 * Carica tests/.env.test e impedisce di lanciare i test contro un database reale.
 * I comandi di test vanno eseguiti dalla cartella principale del progetto.
 */
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export const RADICE = process.cwd();
// i valori di test hanno SEMPRE la precedenza su quelli già presenti nel sistema
// (es. una chiave AI reale): i test non devono mai chiamare servizi veri
Object.assign(process.env, parseEnv(fs.readFileSync(path.join(RADICE, "tests", ".env.test"), "utf8")));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`I test cancellano e ricreano il database: si possono eseguire solo su Supabase locale, non su ${url}`);
}

export const ADMIN = { email: "admin@test.local", password: "Password123!" };

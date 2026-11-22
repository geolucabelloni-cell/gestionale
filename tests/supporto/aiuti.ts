import crypto from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN } from "./ambiente.mjs";

/** Client con privilegi completi sul database LOCALE di test (per preparare dati e verificare risultati). */
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
export const SERVIZI = "http://127.0.0.1:4010";

export async function accedi(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Accedi')");
  await page.waitForURL((u) => u.pathname === "/");
}

export async function sedeDiProva() {
  const { data } = await db.from("offices").select("id").eq("nome", "Sede di prova").single();
  return data!.id as string;
}

export async function creaCliente(dati: { nome: string; cognome: string; telefono?: string }) {
  const { data, error } = await db
    .from("clients")
    .insert({ office_id: await sedeDiProva(), ...dati })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Simula un messaggio in arrivo da WhatsApp (Meta) con firma valida. */
export async function webhookMeta(baseURL: string, from: string, nome: string, messaggio: Record<string, unknown>, phoneNumberId = "PHONE-TEST") {
  const corpo = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ wa_id: from, profile: { name: nome } }],
              messages: [{ from, id: "wamid." + crypto.randomUUID(), timestamp: String(Math.floor(Date.now() / 1000)), ...messaggio }],
            },
          },
        ],
      },
    ],
  });
  const firma = "sha256=" + crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(corpo).digest("hex");
  return fetch(baseURL + "/api/whatsapp/webhook", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": firma }, body: corpo });
}

export async function registroServizi(): Promise<{ url: string; metodo: string; corpo: Record<string, unknown> }[]> {
  return (await fetch(SERVIZI + "/__registro")).json();
}

/** Attende che una condizione sul database diventi vera (elaborazioni in background). */
export async function attendi<T>(fn: () => Promise<T | null | undefined | false>, messaggio: string, ms = 15_000): Promise<T> {
  let ultimo: T | null | undefined | false = null;
  await expect
    .poll(
      async () => {
        ultimo = await fn();
        return !!ultimo;
      },
      { message: messaggio, timeout: ms },
    )
    .toBe(true);
  return ultimo as T;
}

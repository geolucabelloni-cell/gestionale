import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Arrivo dal link nell'email (reimpostazione password).
 * Supporta sia il formato con token_hash (consigliato: funziona anche aprendo l'email su un altro dispositivo)
 * sia quello con code. La sessione viene scritta direttamente sulla risposta di reindirizzamento.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const richiesto = sp.get("next") ?? "/";
  const next = richiesto.startsWith("/") && !richiesto.startsWith("//") && !richiesto.startsWith("/\\") ? richiesto : "/"; // solo percorsi interni

  // indirizzo come lo vede il browser (dietro proxy/CDN l'URL interno può avere un host diverso)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const base = `${proto}://${host}`;
  const risposta = NextResponse.redirect(new URL(next, base));

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => lista.forEach(({ name, value, options }) => risposta.cookies.set(name, value, options)),
    },
  });

  let ok = false;
  const tokenHash = sp.get("token_hash");
  const tipo = sp.get("type") as EmailOtpType | null;
  const code = sp.get("code");
  if (tokenHash && tipo) ok = !(await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  if (ok) return risposta;
  return NextResponse.redirect(new URL("/login?errore=link", base));
}

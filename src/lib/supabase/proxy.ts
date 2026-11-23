import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBBLICHE = ["/login", "/password-dimenticata", "/auth/conferma", "/api/whatsapp/webhook", "/api/callbell/webhook"];

export async function updateSession(request: NextRequest) {
  // Link dell'email di Supabase (modello standard): se arriva sulla pagina iniziale con ?code=,
  // lo passa alla pagina che completa l'accesso e porta a «Scegli una nuova password».
  // (Nel gestionale l'unica email con link è quella di reimpostazione password.)
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/conferma";
    url.search = "";
    url.searchParams.set("code", code);
    url.searchParams.set("next", "/reimposta-password");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const pubblica = PUBBLICHE.some((p) => path === p || path.startsWith(p + "/"));
  if (!user && !pubblica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

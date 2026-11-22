import { notFound } from "next/navigation";
import { richiediRuolo, ETICHETTE_RUOLO } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiDisponibile } from "@/lib/ai/claude";
import { FormSede, FormUtente, AzioniUtente } from "./forms";

export default async function ImpostazioniPage({ searchParams }: PageProps<"/impostazioni">) {
  const sp = await searchParams;
  const p = await richiediRuolo("admin_rete", "titolare");
  const officeId = (p.ruolo === "admin_rete" && typeof sp.sede === "string" ? sp.sede : p.office_id) ?? "";
  const supabase = await createClient();
  const { data: sede } = await supabase.from("offices").select("*").eq("id", officeId).maybeSingle();
  if (!sede) notFound();
  const { data: utenti } = await supabase.from("profiles").select("id, nome_completo, email, ruolo, attivo").eq("office_id", officeId).order("nome_completo");
  const { data: segreto } = await createAdminClient().from("office_secrets").select("wa_access_token, callbell_api_token, callbell_webhook_token").eq("office_id", officeId).maybeSingle();

  const dominio = process.env.NEXT_PUBLIC_APP_URL ?? "https://<dominio-del-gestionale>";
  const webhookUrl = `${dominio}/api/whatsapp/webhook`;
  const webhookCallbell = segreto?.callbell_webhook_token ? `${dominio}/api/callbell/webhook/${officeId}?token=${segreto.callbell_webhook_token}` : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Impostazioni sede</h1>
        <p className="text-sm text-slate-500">{sede.nome}</p>
      </div>

      <FormSede sede={sede} haTokenCallbell={!!segreto?.callbell_api_token} webhookCallbell={webhookCallbell} haToken={!!segreto?.wa_access_token} haTokenGlobale={!!process.env.WHATSAPP_ACCESS_TOKEN} aiAttiva={aiDisponibile()} webhookUrl={webhookUrl} />

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Utenti della sede</h2>
        <div className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {utenti?.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1">
                <div className={`font-medium ${u.attivo ? "" : "text-slate-400 line-through"}`}>{u.nome_completo || u.email}</div>
                <div className="text-xs text-slate-500">
                  {u.email} · {ETICHETTE_RUOLO[u.ruolo]}
                </div>
              </div>
              {u.id !== p.id && (p.ruolo === "admin_rete" || u.ruolo === "operatore") && <AzioniUtente userId={u.id} attivo={u.attivo} />}
            </div>
          ))}
        </div>
        <FormUtente officeId={officeId} ruoli={p.ruolo === "admin_rete" ? ["operatore", "titolare", "admin_rete"] : ["operatore"]} />
      </section>
    </div>
  );
}

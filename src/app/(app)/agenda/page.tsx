import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { aggiungiGiorni, lunediDi, oggiRoma, romaToISO } from "@/lib/tempo";
import { inVista, operatoriVisibili, SELECT_APPUNTAMENTO } from "@/lib/agenda";
import { AgendaSettimana } from "@/components/agenda/settimana";

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const sp = await searchParams;
  const profilo = await richiediProfilo();
  const oggi = oggiRoma();
  // di domenica (studio chiuso) si apre direttamente la settimana successiva
  const predefinita = new Date(oggi + "T12:00:00Z").getUTCDay() === 0 ? aggiungiGiorni(oggi, 1) : oggi;
  const base = typeof sp.settimana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.settimana) ? sp.settimana : predefinita;
  const lunedi = lunediDi(base);
  const giorni = Array.from({ length: 6 }, (_, i) => aggiungiGiorni(lunedi, i)); // lun–sab
  const operatore = typeof sp.operatore === "string" && sp.operatore ? sp.operatore : null;

  const supabase = await createClient();
  let q = supabase
    .from("appointments")
    .select(SELECT_APPUNTAMENTO)
    .gte("inizio", romaToISO(giorni[0], "00:00"))
    .lt("inizio", romaToISO(aggiungiGiorni(lunedi, 7), "00:00"))
    .order("inizio");
  if (operatore) q = q.eq("operatore_id", operatore);
  const [{ data }, operatori, sedi] = await Promise.all([
    q,
    operatoriVisibili(supabase),
    profilo.ruolo === "admin_rete" ? supabase.from("offices").select("id, nome").order("nome").then((r) => r.data ?? []) : Promise.resolve(undefined),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <AgendaSettimana
        giorni={giorni}
        oggi={oggi}
        appuntamenti={(data ?? []).map(inVista)}
        operatori={operatori}
        sedi={sedi}
        prec={aggiungiGiorni(lunedi, -7)}
        succ={aggiungiGiorni(lunedi, 7)}
        filtroOperatore={operatore}
      />
    </div>
  );
}

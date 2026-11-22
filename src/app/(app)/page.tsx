import Link from "next/link";
import { Users, MessageCircle, Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { data, dataOra, dataTraGiorni, giorniA, istanteFa } from "@/lib/format";
import { BadgeScadenza } from "@/components/badge-scadenza";
import { oggiISO } from "@/lib/contesto";
import { aiDisponibile } from "@/lib/ai/claude";
import { Briefing } from "@/components/agente/briefing";
import { aggiungiGiorni, partiRoma, romaToISO } from "@/lib/tempo";
import { caricaAttivita } from "@/lib/attivita";
import { CalendarDays, ListTodo, MapPin } from "lucide-react";

export default async function Dashboard() {
  const profilo = await richiediProfilo();
  const supabase = await createClient();
  const oggi = oggiISO();
  const tra60 = dataTraGiorni(60);
  const da7 = istanteFa(7);

  const [clienti, daGestire, aiGestiti, scadenze, notePiuRecenti, praticheScadenza, apptOggi, mieAttivita] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("conversazioni_whatsapp").select("*").gt("da_gestire", 0).order("ultimo_at", { ascending: false }).limit(5),
    supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("direzione", "out").eq("ai_gestito", true).gte("created_at", da7),
    supabase.from("scadenze_permessi").select("*").gte("permesso_scadenza", oggi).lte("permesso_scadenza", tra60).order("permesso_scadenza").limit(8),
    supabase.from("client_notes").select("id, numero, testo, data_visita, created_at, client_id, clients(nome, cognome)").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("cases")
      .select("id, tipo, prossima_scadenza, client_id, clients(nome, cognome)")
      .gte("prossima_scadenza", oggi)
      .lte("prossima_scadenza", tra60)
      .not("stato", "in", "(conclusa_positiva,conclusa_negativa,archiviata)")
      .order("prossima_scadenza")
      .limit(8),
    supabase
      .from("appointments")
      .select("id, inizio, titolo, luogo, stato, client_id, nominativo, clients(nome, cognome), profiles!appointments_operatore_id_fkey(nome_completo)")
      .gte("inizio", romaToISO(oggi, "00:00"))
      .lt("inizio", romaToISO(aggiungiGiorni(oggi, 1), "00:00"))
      .neq("stato", "annullato")
      .order("inizio"),
    caricaAttivita(supabase, { assegnatoA: profilo.id, limite: 8 }),
  ]);

  const ora = Number(new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", hour: "numeric" }));
  const saluto = ora < 13 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {saluto}
          {profilo.nome_completo ? `, ${profilo.nome_completo.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-slate-500">{profilo.ruolo === "admin_rete" ? "Panoramica di tutta la rete" : profilo.sede_nome}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi href="/clienti" icon={Users} label="Clienti in archivio" valore={clienti.count ?? 0} />
        <Kpi href="/agenda" icon={CalendarDays} label="Appuntamenti oggi" valore={apptOggi.data?.length ?? 0} />
        <Kpi href="/whatsapp" icon={MessageCircle} label="Chat WhatsApp da gestire" valore={daGestire.data?.length ?? 0} evidenzia={(daGestire.data?.length ?? 0) > 0} />
        <Kpi href="/whatsapp?filtro=tutte" icon={Bot} label="Risposte AI ultimi 7 giorni" valore={aiGestiti.count ?? 0} />
      </div>

      {aiDisponibile() && <Briefing />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Riquadro titolo="Appuntamenti di oggi" link="/agenda">
          {apptOggi.data?.length ? (
            apptOggi.data.map((a) => (
              <Link key={a.id} href={a.client_id ? `/clienti/${a.client_id}?tab=agenda` : "/agenda"} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                <span className="w-12 font-semibold text-brand-700">{partiRoma(a.inizio).ora}</span>
                <span className="flex-1">
                  <span className="font-medium">{a.clients ? `${a.clients.cognome} ${a.clients.nome}` : a.nominativo}</span>
                  <span className="block text-xs text-slate-500">
                    {a.titolo}
                    {a.profiles?.nome_completo ? ` · ${a.profiles.nome_completo}` : ""}
                  </span>
                </span>
                {a.luogo !== "In sede" && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} /> {a.luogo}
                  </span>
                )}
              </Link>
            ))
          ) : (
            <Vuoto testo="Nessun appuntamento oggi." />
          )}
        </Riquadro>

        <Riquadro titolo="Le mie attività" link="/scadenze?chi=mie">
          {mieAttivita.length ? (
            mieAttivita.map((t) => (
              <Link key={t.id} href={t.client_id ? `/clienti/${t.client_id}?tab=agenda` : "/scadenze"} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                <ListTodo size={15} className={t.priorita === "alta" ? "text-red-500" : "text-slate-400"} />
                <span className="flex-1">
                  {t.titolo}
                  {t.nomeCliente && <span className="block text-xs text-slate-500">{t.nomeCliente}</span>}
                </span>
                {t.scadenza && <span className={`text-xs ${t.scadenza < oggi ? "font-semibold text-red-600" : "text-slate-500"}`}>{data(t.scadenza)}</span>}
              </Link>
            ))
          ) : (
            <Vuoto testo="Nessuna attività aperta." />
          )}
        </Riquadro>

        <Riquadro titolo="WhatsApp da gestire" link="/whatsapp">
          {daGestire.data?.length ? (
            daGestire.data.map((c) => (
              <Link key={`${c.office_id}${c.telefono}`} href={`/whatsapp/${c.telefono}?sede=${c.office_id}`} className="block px-4 py-3 hover:bg-slate-50">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{c.nome_profilo ?? "+" + c.telefono}</span>
                  <span className="text-xs text-slate-400">{dataOra(c.ultimo_at)}</span>
                </div>
                <div className="truncate text-sm text-slate-500">{c.ultimo_testo ?? `[${c.ultimo_tipo}]`}</div>
              </Link>
            ))
          ) : (
            <Vuoto testo="Nessun messaggio in attesa." />
          )}
        </Riquadro>

        <Riquadro titolo="Permessi in scadenza (60 giorni)" link="/scadenze">
          {scadenze.data?.length ? (
            scadenze.data.map((s) => (
              <Link key={s.id} href={`/clienti/${s.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                <span>
                  <span className="font-medium">
                    {s.cognome} {s.nome}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{s.permesso_tipo}</span>
                </span>
                <span className="flex items-center gap-2">
                  {data(s.permesso_scadenza)} <BadgeScadenza giorni={giorniA(s.permesso_scadenza)} />
                </span>
              </Link>
            ))
          ) : (
            <Vuoto testo="Nessun permesso in scadenza." />
          )}
        </Riquadro>

        <Riquadro titolo="Scadenze pratiche (60 giorni)" link="/scadenze">
          {praticheScadenza.data?.length ? (
            praticheScadenza.data.map((p) => (
              <Link key={p.id} href={`/clienti/${p.client_id}?tab=pratiche`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                <span>
                  <span className="font-medium">
                    {p.clients?.cognome} {p.clients?.nome}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{p.tipo}</span>
                </span>
                <span className="flex items-center gap-2">
                  {data(p.prossima_scadenza)} <BadgeScadenza giorni={giorniA(p.prossima_scadenza)} />
                </span>
              </Link>
            ))
          ) : (
            <Vuoto testo="Nessuna scadenza." />
          )}
        </Riquadro>

        <Riquadro titolo="Ultime note nel diario">
          {notePiuRecenti.data?.length ? (
            notePiuRecenti.data.map((n) => (
              <Link key={n.id} href={`/clienti/${n.client_id}`} className="block px-4 py-3 hover:bg-slate-50">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {n.clients?.cognome} {n.clients?.nome} <span className="text-xs font-normal text-slate-400">· nota n. {n.numero}</span>
                  </span>
                  <span className="text-xs text-slate-400">{data(n.data_visita)}</span>
                </div>
                <div className="truncate text-sm text-slate-500">{n.testo}</div>
              </Link>
            ))
          ) : (
            <Vuoto testo="Nessuna nota." />
          )}
        </Riquadro>
      </div>
    </div>
  );
}

function Kpi({ href, icon: Icon, label, valore, evidenzia }: { href: string; icon: typeof Users; label: string; valore: number; evidenzia?: boolean }) {
  return (
    <Link href={href} className={`card flex items-center gap-4 p-4 hover:border-brand-300 ${evidenzia ? "border-red-200 bg-red-50/40" : ""}`}>
      <div className={`rounded-lg p-2.5 ${evidenzia ? "bg-red-100 text-red-600" : "bg-brand-50 text-brand-600"}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-semibold">{valore}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Link>
  );
}

function Riquadro({ titolo, link, children }: { titolo: string; link?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {titolo}
        </h2>
        {link && (
          <Link href={link} className="text-xs text-brand-600 hover:underline">
            Vedi tutto
          </Link>
        )}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function Vuoto({ testo }: { testo: string }) {
  return <p className="px-4 py-6 text-center text-sm text-slate-400">{testo}</p>;
}

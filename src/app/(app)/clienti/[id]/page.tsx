import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, MessageCircle, Phone, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { aiDisponibile } from "@/lib/ai/claude";
import { data, dataTraGiorni, giorniA, LINGUE, STATI_PRATICA } from "@/lib/format";
import { formattaTelefono } from "@/lib/telefono";
import { BadgeScadenza } from "@/components/badge-scadenza";
import { Diario } from "@/components/cliente/diario";
import { Archivio } from "@/components/cliente/archivio";
import { Pratiche } from "@/components/cliente/pratiche";
import { PannelloAi } from "@/components/cliente/pannello-ai";
import { ChatWhatsapp } from "@/components/chat-whatsapp";
import { EliminaCliente } from "@/components/cliente/elimina-cliente";
import { AppuntamentiCliente } from "@/components/agenda/appuntamenti-cliente";
import { ListaAttivita } from "@/components/attivita/lista-attivita";
import { inVista, operatoriVisibili, SELECT_APPUNTAMENTO } from "@/lib/agenda";
import { caricaAttivita } from "@/lib/attivita";
import { oggiRoma } from "@/lib/tempo";

const SCHEDE = [
  { id: "diario", label: "Diario" },
  { id: "documenti", label: "Documenti" },
  { id: "agenda", label: "Agenda e attività" },
  { id: "pratiche", label: "Pratiche" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "anagrafica", label: "Anagrafica" },
] as const;

export default async function ClientePage({ params, searchParams }: PageProps<"/clienti/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const scheda = SCHEDE.find((s) => s.id === sp.tab)?.id ?? "diario";
  const profilo = await richiediProfilo();
  const supabase = await createClient();

  const { data: c } = await supabase.from("clients").select("*, offices(nome)").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ count: nNote }, { count: nDoc }, { data: praticheAperte }, { count: nWa }, { count: nAtt }] = await Promise.all([
    supabase.from("client_notes").select("id", { count: "exact", head: true }).eq("client_id", id),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("client_id", id),
    supabase.from("cases").select("id, tipo, stato").eq("client_id", id).not("stato", "in", "(conclusa_positiva,conclusa_negativa,archiviata)"),
    supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("client_id", id).eq("da_gestire", true),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("client_id", id).eq("stato", "da_fare"),
  ]);
  const conteggi: Record<string, number | null> = { agenda: nAtt, diario: nNote, documenti: nDoc, pratiche: praticheAperte?.length ?? 0, whatsapp: nWa };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Intestazione */}
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400">
              Cliente n. {c.codice}
              {profilo.ruolo === "admin_rete" && ` · ${c.offices?.nome}`}
            </div>
            <h1 className="text-2xl font-semibold">
              {c.cognome} {c.nome}
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {c.cittadinanza && <span>{c.cittadinanza}</span>}
              {c.data_nascita && <span>nato/a il {data(c.data_nascita)}</span>}
              {c.telefono && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={14} /> {formattaTelefono(c.telefono)}
                </span>
              )}
              {c.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={14} /> {c.email}
                </span>
              )}
            </div>
            {c.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <span key={t} className="badge bg-slate-100 text-slate-600">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {c.telefono && (
              <Link href={`/whatsapp/${c.telefono}`} className="btn-secondary">
                <MessageCircle size={16} /> WhatsApp
              </Link>
            )}
            <Link href={`/clienti/${c.id}/modifica`} className="btn-secondary">
              <Pencil size={16} /> Modifica
            </Link>
            {profilo.ruolo !== "operatore" && <EliminaCliente clientId={c.id} />}
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
          <Info label="Permesso di soggiorno">
            {c.permesso_tipo ?? "—"}
            {c.permesso_scadenza && (
              <span className="ml-2">
                scad. {data(c.permesso_scadenza)} <BadgeScadenza giorni={giorniA(c.permesso_scadenza)} />
              </span>
            )}
          </Info>
          <Info label="Passaporto">
            {c.passaporto_numero ?? "—"}
            {c.passaporto_scadenza && (
              <span className="ml-2">
                scad. {data(c.passaporto_scadenza)} <BadgeScadenza giorni={giorniA(c.passaporto_scadenza)} />
              </span>
            )}
          </Info>
          <Info label="Pratiche in corso">
            {praticheAperte?.length ? praticheAperte.map((p) => `${p.tipo} (${STATI_PRATICA[p.stato]})`).join(", ") : "Nessuna"}
          </Info>
        </div>
      </div>

      <PannelloAi clientId={c.id} attiva={aiDisponibile()} />

      {/* Schede */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {SCHEDE.map((s) => (
          <Link
            key={s.id}
            href={`/clienti/${c.id}?tab=${s.id}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
              scheda === s.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {s.label}
            {!!conteggi[s.id] && (
              <span className={`ml-1.5 badge ${s.id === "whatsapp" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600"}`}>{conteggi[s.id]}</span>
            )}
          </Link>
        ))}
      </div>

      {scheda === "diario" && <SchedaDiario clientId={c.id} puoEliminare={profilo.ruolo !== "operatore"} />}
      {scheda === "documenti" && <SchedaDocumenti clientId={c.id} officeId={c.office_id} />}
      {scheda === "agenda" && <SchedaAgenda cliente={{ id: c.id, nome: c.nome, cognome: c.cognome }} />}
      {scheda === "pratiche" && <SchedaPratiche clientId={c.id} />}
      {scheda === "whatsapp" && <SchedaWhatsapp clientId={c.id} telefono={c.telefono} />}
      {scheda === "anagrafica" && <SchedaAnagrafica c={c} />}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{children}</div>
    </div>
  );
}

async function SchedaDiario({ clientId, puoEliminare }: { clientId: string; puoEliminare: boolean }) {
  const supabase = await createClient();
  const { data: note } = await supabase
    .from("client_notes")
    .select("id, numero, data_visita, testo, origine, rettifica_di, created_at, profiles(nome_completo)")
    .eq("client_id", clientId)
    .order("numero", { ascending: false });
  return (
    <Diario
      clientId={clientId}
      puoEliminare={puoEliminare}
      aiAttiva={aiDisponibile()}
      note={(note ?? []).map((n) => ({ ...n, autore: n.profiles?.nome_completo ?? null }))}
    />
  );
}

async function SchedaDocumenti({ clientId, officeId }: { clientId: string; officeId: string }) {
  const supabase = await createClient();
  const [{ data: cartelle }, { data: documenti }] = await Promise.all([
    supabase.from("folders").select("id, nome, parent_id").eq("client_id", clientId).order("nome"),
    supabase
      .from("documents")
      .select("id, nome, folder_id, mime_type, dimensione, origine, ai_riepilogo, ai_tipo_documento, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);
  return <Archivio clientId={clientId} officeId={officeId} cartelle={cartelle ?? []} documenti={documenti ?? []} aiAttiva={aiDisponibile()} />;
}

async function SchedaAgenda({ cliente }: { cliente: { id: string; nome: string; cognome: string } }) {
  const supabase = await createClient();
  const [{ data: appt }, attivita, operatori] = await Promise.all([
    supabase.from("appointments").select(SELECT_APPUNTAMENTO).eq("client_id", cliente.id).order("inizio"),
    caricaAttivita(supabase, { clientId: cliente.id, conCompletate: true }),
    operatoriVisibili(supabase),
  ]);
  const oggi = oggiRoma();
  return (
    <div className="space-y-8">
      <AppuntamentiCliente cliente={cliente} appuntamenti={(appt ?? []).map(inVista)} operatori={operatori} oggi={oggi} />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Attività e scadenze</h2>
        <ListaAttivita attivita={attivita} operatori={operatori} oggi={oggi} tra7={dataTraGiorni(7)} clienteFisso={cliente} />
      </div>
    </div>
  );
}

async function SchedaPratiche({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data: pratiche } = await supabase.from("cases").select("*").eq("client_id", clientId).order("data_apertura", { ascending: false });
  return <Pratiche clientId={clientId} pratiche={pratiche ?? []} />;
}

async function SchedaWhatsapp({ clientId, telefono }: { clientId: string; telefono: string | null }) {
  const supabase = await createClient();
  const { data: messaggi } = await supabase
    .from("whatsapp_messages")
    .select("id, direzione, testo, tipo, created_at, ai_gestito, ai_categoria, da_gestire, document_id, stato_invio")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (
    <div className="card p-4">
      {telefono && (
        <div className="mb-3 flex justify-end">
          <Link href={`/whatsapp/${telefono}`} className="btn-primary">
            Apri conversazione e rispondi
          </Link>
        </div>
      )}
      <ChatWhatsapp messaggi={messaggi ?? []} />
    </div>
  );
}

function SchedaAnagrafica({ c }: { c: Record<string, unknown> & { lingua_preferita: string } }) {
  const righe: [string, unknown][] = [
    ["Nome", c.nome],
    ["Cognome", c.cognome],
    ["Sesso", c.sesso],
    ["Data di nascita", data(c.data_nascita as string)],
    ["Luogo di nascita", c.luogo_nascita],
    ["Cittadinanza", c.cittadinanza],
    ["Codice fiscale", c.codice_fiscale],
    ["Stato civile", c.stato_civile],
    ["Telefono", formattaTelefono(c.telefono as string)],
    ["Email", c.email],
    ["Indirizzo", [c.indirizzo, c.cap, c.citta].filter(Boolean).join(", ")],
    ["Lingua preferita", LINGUE[c.lingua_preferita] ?? c.lingua_preferita],
    ["Passaporto", c.passaporto_numero],
    ["Scadenza passaporto", data(c.passaporto_scadenza as string)],
    ["Tipo permesso", c.permesso_tipo],
    ["N. permesso", c.permesso_numero],
    ["Scadenza permesso", data(c.permesso_scadenza as string)],
    ["Consenso privacy", c.consenso_privacy ? `Sì (${data(c.consenso_privacy_data as string)})` : "No"],
    ["Note generali", c.note_generali],
    ["Creato il", data(c.created_at as string)],
  ];
  return (
    <div className="card divide-y divide-slate-100">
      {righe.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-4 px-5 py-2.5 text-sm">
          <div className="text-slate-500">{k}</div>
          <div className="col-span-2 whitespace-pre-wrap">{(v as string) || "—"}</div>
        </div>
      ))}
    </div>
  );
}

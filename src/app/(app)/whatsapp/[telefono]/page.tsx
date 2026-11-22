import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserPlus, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formattaTelefono } from "@/lib/telefono";
import { oreTrascorse } from "@/lib/format";
import { ChatWhatsapp } from "@/components/chat-whatsapp";
import { Risposta } from "./risposta";
import { AssociaCliente } from "./associa-cliente";

export default async function ConversazionePage({ params, searchParams }: PageProps<"/whatsapp/[telefono]">) {
  const { telefono } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  // sede: quella indicata, altrimenti quella dell'ultimo messaggio con questo numero
  let officeId = typeof sp.sede === "string" ? sp.sede : null;
  if (!officeId) {
    const { data } = await supabase.from("whatsapp_messages").select("office_id").eq("telefono", telefono).order("created_at", { ascending: false }).limit(1).maybeSingle();
    officeId = data?.office_id ?? null;
  }
  if (!officeId) {
    // nessun messaggio: si può comunque aprire dalla scheda cliente
    const { data: cli } = await supabase.from("clients").select("office_id").eq("telefono", telefono).limit(1).maybeSingle();
    officeId = cli?.office_id ?? null;
  }
  if (!officeId) notFound();

  const [{ data: messaggi }, { data: cliente }, { data: sede }] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("id, direzione, testo, tipo, created_at, ai_gestito, ai_categoria, ai_bozza, ai_motivo, da_gestire, document_id, stato_invio, nome_profilo, media_path")
      .eq("office_id", officeId)
      .eq("telefono", telefono)
      .order("created_at", { ascending: true })
      .limit(300),
    supabase.from("clients").select("id, nome, cognome").eq("office_id", officeId).eq("telefono", telefono).limit(1).maybeSingle(),
    supabase.from("offices").select("nome, wa_phone_number_id").eq("id", officeId).single(),
  ]);

  const ultimaDaGestire = [...(messaggi ?? [])].reverse().find((m) => m.da_gestire);
  const nomeProfilo = [...(messaggi ?? [])].reverse().find((m) => m.nome_profilo)?.nome_profilo;
  const allegatiInSospeso = (messaggi ?? []).filter((m) => m.media_path).length;
  const ultimoIn = [...(messaggi ?? [])].reverse().find((m) => m.direzione === "in");
  const finestraAperta = !!ultimoIn && oreTrascorse(ultimoIn.created_at) < 24;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/whatsapp" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> Tutte le conversazioni
      </Link>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <div className="text-lg font-semibold">{cliente ? `${cliente.cognome} ${cliente.nome}` : (nomeProfilo ?? formattaTelefono(telefono))}</div>
          <div className="text-sm text-slate-500">
            {formattaTelefono(telefono)} · {sede?.nome}
          </div>
        </div>
        {cliente ? (
          <Link href={`/clienti/${cliente.id}`} className="btn-secondary">
            <User size={16} /> Scheda cliente
          </Link>
        ) : (
          <>
            <AssociaCliente officeId={officeId} telefono={telefono} />
            <Link href={`/clienti/nuovo?telefono=${telefono}&nome=${encodeURIComponent(nomeProfilo ?? "")}`} className="btn-primary">
              <UserPlus size={16} /> Crea anagrafica
            </Link>
          </>
        )}
      </div>

      {!cliente && allegatiInSospeso > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {allegatiInSospeso} allegati in attesa: verranno archiviati nella cartella WhatsApp quando crei o associ l&apos;anagrafica.
        </div>
      )}

      <div className="card p-4">
        <ChatWhatsapp messaggi={messaggi ?? []} />
      </div>

      <Risposta
        officeId={officeId}
        telefono={telefono}
        bozza={ultimaDaGestire?.ai_bozza ?? ""}
        motivo={ultimaDaGestire?.ai_motivo ?? null}
        daGestire={!!ultimaDaGestire}
        finestraAperta={finestraAperta}
        configurato={!!sede?.wa_phone_number_id}
      />
    </div>
  );
}

import Link from "next/link";
import { MessageCircle, Bot, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiediProfilo } from "@/lib/auth";
import { dataOra } from "@/lib/format";
import { formattaTelefono } from "@/lib/telefono";

export default async function WhatsappPage({ searchParams }: PageProps<"/whatsapp">) {
  const sp = await searchParams;
  const filtro = sp.filtro === "tutte" ? "tutte" : "da_gestire";
  const profilo = await richiediProfilo();
  const supabase = await createClient();

  let q = supabase.from("conversazioni_whatsapp").select("*").order("ultimo_at", { ascending: false }).limit(200);
  if (filtro === "da_gestire") q = q.gt("da_gestire", 0);
  const { data: conv } = await q;

  const clientIds = [...new Set((conv ?? []).map((c) => c.client_id).filter(Boolean))] as string[];
  const { data: clienti } = clientIds.length ? await supabase.from("clients").select("id, nome, cognome").in("id", clientIds) : { data: [] };
  const nomi = new Map((clienti ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`]));
  const { data: sedi } = profilo.ruolo === "admin_rete" ? await supabase.from("offices").select("id, nome") : { data: null };
  const nomiSedi = new Map((sedi ?? []).map((s) => [s.id, s.nome]));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-slate-500">L&apos;AI risponde da sola alle domande semplici; qui trovi quello che richiede un operatore.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          <Link href="/whatsapp" className={`rounded-md px-3 py-1.5 ${filtro === "da_gestire" ? "bg-brand-600 text-white" : "text-slate-600"}`}>
            Da gestire
          </Link>
          <Link href="/whatsapp?filtro=tutte" className={`rounded-md px-3 py-1.5 ${filtro === "tutte" ? "bg-brand-600 text-white" : "text-slate-600"}`}>
            Tutte
          </Link>
        </div>
      </div>

      <div className="card divide-y divide-slate-100">
        {!conv?.length && (
          <div className="p-12 text-center text-slate-500">
            <MessageCircle className="mx-auto mb-2 text-slate-300" size={36} />
            {filtro === "da_gestire" ? "Nessuna conversazione da gestire. 🎉" : "Nessuna conversazione."}
          </div>
        )}
        {conv?.map((c) => (
          <Link key={`${c.office_id}-${c.telefono}`} href={`/whatsapp/${c.telefono}?sede=${c.office_id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold text-green-700">
              {(c.client_id ? nomi.get(c.client_id) : c.nome_profilo)?.charAt(0) ?? "#"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.client_id ? nomi.get(c.client_id) : (c.nome_profilo ?? formattaTelefono(c.telefono))}</span>
                {!c.client_id && <span className="badge bg-amber-50 text-amber-700">non in anagrafica</span>}
                {profilo.ruolo === "admin_rete" && <span className="text-xs text-slate-400">{nomiSedi.get(c.office_id!)}</span>}
              </div>
              <div className="truncate text-sm text-slate-500">
                {c.ultima_direzione === "out" && <Bot size={12} className="mr-1 inline" />}
                {c.ultimo_testo ?? `[${c.ultimo_tipo}]`}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>{dataOra(c.ultimo_at)}</div>
              {!!c.da_gestire && (
                <span className="badge mt-1 bg-red-500 text-white">
                  <AlertCircle size={11} className="mr-1" /> {c.da_gestire}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

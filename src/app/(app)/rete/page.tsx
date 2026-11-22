import Link from "next/link";
import { richiediRuolo } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormNuovaSede } from "./form-nuova-sede";
import { istanteFa } from "@/lib/format";

export default async function RetePage() {
  await richiediRuolo("admin_rete");
  const supabase = await createClient();
  const da30 = istanteFa(30);
  const [{ data: sedi }, { data: clienti }, { data: utenti }, { data: note30 }, { data: ai30 }] = await Promise.all([
    supabase.from("offices").select("id, nome, citta, attiva, wa_phone_number_id, ai_risposta_automatica, created_at").order("nome"),
    supabase.from("clients").select("office_id"),
    supabase.from("profiles").select("office_id").eq("attivo", true),
    supabase.from("client_notes").select("office_id").gte("created_at", da30),
    supabase.from("whatsapp_messages").select("office_id").eq("ai_gestito", true).eq("direzione", "out").gte("created_at", da30),
  ]);
  const conta = (rows: { office_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.office_id) m.set(r.office_id, (m.get(r.office_id) ?? 0) + 1);
    return m;
  };
  const [nCli, nUt, nNote, nAi] = [conta(clienti), conta(utenti), conta(note30), conta(ai30)];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rete franchising</h1>
        <p className="text-sm text-slate-500">Sedi affiliate, utenti e attività degli ultimi 30 giorni.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Sede</th>
              <th className="px-4 py-3 text-right">Clienti</th>
              <th className="px-4 py-3 text-right">Utenti</th>
              <th className="px-4 py-3 text-right">Note (30 gg)</th>
              <th className="px-4 py-3 text-right">Risposte AI (30 gg)</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sedi?.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{s.nome}</div>
                  <div className="text-xs text-slate-500">{s.citta}</div>
                </td>
                <td className="px-4 py-3 text-right">{nCli.get(s.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">{nUt.get(s.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">{nNote.get(s.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">{nAi.get(s.id) ?? 0}</td>
                <td className="px-4 py-3">
                  {s.wa_phone_number_id ? (
                    <span className="badge bg-green-50 text-green-700">collegato{s.ai_risposta_automatica ? " · AI attiva" : ""}</span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-500">non collegato</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/impostazioni?sede=${s.id}`} className="text-brand-600 hover:underline">
                    Gestisci
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormNuovaSede />
    </div>
  );
}

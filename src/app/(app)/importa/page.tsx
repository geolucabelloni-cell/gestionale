import { richiediRuolo } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aiDisponibile } from "@/lib/ai/claude";
import { Importatore } from "./importatore";

export default async function ImportaPage() {
  const p = await richiediRuolo("admin_rete", "titolare");
  const supabase = await createClient();
  const { data: sedi } = await supabase.from("offices").select("id, nome").order("nome");
  const ordinate = (sedi ?? []).sort((a, b) => (a.id === p.office_id ? -1 : b.id === p.office_id ? 1 : 0));
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Importa da TeamSystem</h1>
        <p className="text-sm text-slate-500">
          Esporta da TeamSystem anagrafiche e note in formato CSV e caricale qui. I documenti non sono nel CSV: si possono caricare nelle cartelle del cliente (anche più file insieme, l&apos;AI li smista).
        </p>
      </div>
      <Importatore sedi={ordinate} aiAttiva={aiDisponibile()} />
    </div>
  );
}

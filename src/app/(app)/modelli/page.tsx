import Link from "next/link";
import { richiediRuolo } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EditorModelli, EditorChecklist } from "./editor";

export default async function ModelliPage({ searchParams }: PageProps<"/modelli">) {
  const sp = await searchParams;
  const scheda = sp.tab === "checklist" ? "checklist" : "documenti";
  const p = await richiediRuolo("admin_rete", "titolare");
  const supabase = await createClient();
  // modelli della rete e della propria sede (non quelli delle altre sedi)
  const ambito = p.office_id ? `office_id.is.null,office_id.eq.${p.office_id}` : "office_id.is.null";
  const [{ data: modelli }, { data: checklist }] = await Promise.all([
    supabase.from("document_templates").select("*").or(ambito).order("nome"),
    supabase.from("checklist_templates").select("*").or(ambito).order("tipo_pratica"),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Modelli</h1>
        <p className="text-sm text-slate-500">
          {p.ruolo === "admin_rete"
            ? "I modelli «della rete» valgono per tutte le sedi. Ogni sede può crearne di propri o personalizzare quelli della rete."
            : "I modelli «della rete» sono definiti dalla sede centrale: puoi crearne una versione personalizzata per la tua sede."}
        </p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: "documenti", label: "Modelli di documento (PDF)" },
          { id: "checklist", label: "Checklist documenti per pratica" },
        ].map((t) => (
          <Link
            key={t.id}
            href={`/modelli?tab=${t.id}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${scheda === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {scheda === "documenti" ? (
        <EditorModelli modelli={modelli ?? []} adminRete={p.ruolo === "admin_rete"} officeId={p.office_id} />
      ) : (
        <EditorChecklist checklist={checklist ?? []} adminRete={p.ruolo === "admin_rete"} officeId={p.office_id} />
      )}
    </div>
  );
}

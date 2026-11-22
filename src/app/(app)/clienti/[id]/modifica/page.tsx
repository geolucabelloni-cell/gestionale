import { notFound } from "next/navigation";
import { ClienteForm } from "@/components/cliente-form";
import { createClient } from "@/lib/supabase/server";
import { aiDisponibile } from "@/lib/ai/claude";

export default async function ModificaClientePage({ params }: PageProps<"/clienti/[id]/modifica">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!cliente) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">
        Modifica: {cliente.cognome} {cliente.nome}
      </h1>
      <ClienteForm cliente={cliente} aiAttiva={aiDisponibile()} />
    </div>
  );
}

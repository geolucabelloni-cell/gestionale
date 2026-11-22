import { ClienteForm } from "@/components/cliente-form";
import { richiediProfilo } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aiDisponibile } from "@/lib/ai/claude";

export default async function NuovoClientePage({ searchParams }: PageProps<"/clienti/nuovo">) {
  const sp = await searchParams;
  const profilo = await richiediProfilo();
  let sedi: { id: string; nome: string }[] | undefined;
  if (profilo.ruolo === "admin_rete") {
    const supabase = await createClient();
    const { data } = await supabase.from("offices").select("id, nome").eq("attiva", true).order("nome");
    sedi = data ?? [];
    // la sede dell'admin per prima
    sedi.sort((a, b) => (a.id === profilo.office_id ? -1 : b.id === profilo.office_id ? 1 : 0));
  }
  const telefono = typeof sp.telefono === "string" ? sp.telefono : undefined;
  const nome = typeof sp.nome === "string" ? sp.nome : "";
  const [n, ...resto] = nome.split(" ");
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">Nuovo cliente</h1>
      <ClienteForm cliente={{ telefono: telefono ?? null, nome: n || undefined, cognome: resto.join(" ") || undefined }} sedi={sedi} aiAttiva={aiDisponibile()} />
    </div>
  );
}

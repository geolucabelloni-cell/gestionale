import { richiediProfilo, ETICHETTE_RUOLO } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { oggiRoma } from "@/lib/tempo";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profilo = await richiediProfilo();
  const supabase = await createClient();
  // conversazioni (non singoli messaggi) che aspettano un operatore
  const { count } = await supabase.from("conversazioni_whatsapp").select("telefono", { count: "exact", head: true }).gt("da_gestire", 0);
  const { count: scadute } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("stato", "da_fare")
    .lte("scadenza", oggiRoma())
    .or(`assegnato_a.eq.${profilo.id},assegnato_a.is.null`);
  const nomeStudio = process.env.NEXT_PUBLIC_NOME_STUDIO || "IOSTRANIERO";

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        nomeStudio={nomeStudio}
        utente={profilo.nome_completo || profilo.email || ""}
        ruolo={ETICHETTE_RUOLO[profilo.ruolo]}
        sede={profilo.ruolo === "admin_rete" ? "Tutte le sedi" : (profilo.sede_nome ?? "")}
        ruoloCodice={profilo.ruolo}
        whatsappDaGestire={count ?? 0}
        attivitaScadute={scadute ?? 0}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

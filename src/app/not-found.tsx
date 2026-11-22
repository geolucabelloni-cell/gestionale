import { PaginaErrore } from "@/components/pagina-errore";

export default function NonTrovato() {
  return (
    <main className="min-h-screen">
      <PaginaErrore
        titolo="Pagina non trovata"
        testo="La pagina che cerchi non esiste oppure non hai i permessi per vederla (ad esempio un cliente di un'altra sede)."
      />
    </main>
  );
}

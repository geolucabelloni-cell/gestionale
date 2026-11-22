"use client";

import { useEffect } from "react";
import { PaginaErrore } from "@/components/pagina-errore";

export default function Errore({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PaginaErrore
      titolo="Qualcosa non ha funzionato"
      testo="Non siamo riusciti a caricare questa pagina. I dati salvati non sono stati persi. Riprova tra qualche istante; se il problema continua, contatta la sede centrale."
      codice={error.digest}
    >
      <button className="btn-primary" onClick={() => retry()}>
        Riprova
      </button>
    </PaginaErrore>
  );
}

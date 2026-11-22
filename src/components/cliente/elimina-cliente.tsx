"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eliminaCliente } from "@/app/(app)/clienti/actions";

export function EliminaCliente({ clientId }: { clientId: string }) {
  const [inCorso, avvia] = useTransition();
  return (
    <button
      className="btn-danger"
      disabled={inCorso}
      onClick={() => {
        if (confirm("Eliminare definitivamente il cliente con diario, pratiche e documenti? L'operazione non è reversibile.")) {
          avvia(async () => {
            const r = await eliminaCliente(clientId);
            if (r?.errore) alert(r.errore);
          });
        }
      }}
    >
      <Trash2 size={16} /> Elimina
    </button>
  );
}

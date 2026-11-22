"use client";
import { useActionState } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { creaSede } from "../impostazioni/actions";

export function FormNuovaSede() {
  const [stato, azione, inCorso] = useActionState(creaSede, null);
  return (
    <form method="post" onSubmit={inviaSenzaReset(azione)} className="card grid gap-3 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="font-semibold">Apri una nuova sede</h2>
        <p className="text-sm text-slate-500">Crea la sede e l&apos;account del titolare. Le informazioni per l&apos;AI vengono copiate dalla sede centrale e il titolare potrà adattarle.</p>
      </div>
      <input name="nome" required placeholder="Nome sede (es. Studio Torino Centro)" className="input" />
      <input name="citta" placeholder="Città" className="input" />
      <input name="nome_completo" placeholder="Nome e cognome del titolare" className="input" />
      <input name="email" type="email" placeholder="Email del titolare" className="input" />
      <input name="password" placeholder="Password iniziale del titolare (min. 10, lettere e numeri)" className="input" autoComplete="off" />
      {stato?.errore && <p className="text-sm text-red-600 sm:col-span-2">{stato.errore}</p>}
      {stato?.ok && <p className="text-sm text-green-700 sm:col-span-2">{stato.ok}</p>}
      <div className="flex justify-end sm:col-span-2">
        <button className="btn-primary" disabled={inCorso}>
          Crea sede
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { PASSWORD_MIN } from "@/lib/password";
import { impostaNuovaPassword } from "./actions";

export function FormNuovaPassword() {
  const [stato, azione, inCorso] = useActionState(impostaNuovaPassword, null);
  return (
    <form action={azione} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">
          Nuova password
        </label>
        <input id="password" name="password" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" className="input" />
        <p className="mt-1 text-xs text-slate-500">Almeno {PASSWORD_MIN} caratteri, con lettere e numeri.</p>
      </div>
      <div>
        <label className="label" htmlFor="conferma">
          Ripeti la password
        </label>
        <input id="conferma" name="conferma" type="password" required autoComplete="new-password" className="input" />
      </div>
      {stato?.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
      <button className="btn-primary w-full" disabled={inCorso}>
        {inCorso ? "Salvataggio…" : "Salva la nuova password"}
      </button>
    </form>
  );
}

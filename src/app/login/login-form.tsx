"use client";
import { useActionState } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { accedi } from "./actions";

export function LoginForm() {
  const [stato, azione, inCorso] = useActionState(accedi, null);
  return (
    <form onSubmit={inviaSenzaReset(azione)} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {stato?.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
      <button className="btn-primary w-full" disabled={inCorso}>
        {inCorso ? "Accesso…" : "Accedi"}
      </button>
    </form>
  );
}

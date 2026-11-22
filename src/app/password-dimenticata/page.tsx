"use client";

import Link from "next/link";
import { useActionState } from "react";
import { richiediReimpostazione } from "./actions";

export default function PasswordDimenticata() {
  const [stato, azione, inCorso] = useActionState(richiediReimpostazione, null);
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-600 p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-lg font-semibold">Password dimenticata</h1>
        {stato?.ok ? (
          <p className="text-sm text-slate-700">{stato.ok}</p>
        ) : (
          <form action={azione} className="space-y-4">
            <p className="text-sm text-slate-600">Scrivi l&apos;email con cui accedi: ti mandiamo un link per scegliere una nuova password.</p>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </div>
            {stato?.errore && <p className="text-sm text-red-600">{stato.errore}</p>}
            <button className="btn-primary w-full" disabled={inCorso}>
              {inCorso ? "Invio…" : "Invia il link"}
            </button>
          </form>
        )}
        <Link href="/login" className="block text-center text-sm text-brand-700 hover:underline">
          Torna all&apos;accesso
        </Link>
      </div>
    </main>
  );
}

"use client";

import { useActionState, useRef } from "react";
import { inviaSenzaReset } from "@/lib/form";
import { PASSWORD_MIN } from "@/lib/password";
import { cambiaNome, cambiaPassword } from "./actions";

export function FormNome({ nome }: { nome: string }) {
  const [stato, azione, inCorso] = useActionState(cambiaNome, null);
  return (
    <form method="post" onSubmit={inviaSenzaReset(azione)} className="flex flex-wrap items-end gap-2">
      <div className="min-w-60 flex-1">
        <label className="label" htmlFor="nome_completo">
          Nome e cognome
        </label>
        <input id="nome_completo" name="nome_completo" defaultValue={nome} required className="input" />
      </div>
      <button className="btn-secondary" disabled={inCorso}>
        Salva
      </button>
      {stato && <p className={`w-full text-sm ${stato.errore ? "text-red-600" : "text-green-700"}`}>{stato.errore ?? stato.ok}</p>}
    </form>
  );
}

export function FormPassword() {
  const formRef = useRef<HTMLFormElement>(null);
  const [stato, azione, inCorso] = useActionState(async (prec: Awaited<ReturnType<typeof cambiaPassword>> | null, fd: FormData) => {
    const r = await cambiaPassword(prec, fd);
    if (r.ok) formRef.current?.reset();
    return r;
  }, null);
  return (
    <form ref={formRef} action={azione} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="attuale">
          Password attuale
        </label>
        <input id="attuale" name="attuale" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="nuova">
          Nuova password
        </label>
        <input id="nuova" name="nuova" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="conferma">
          Ripeti la nuova password
        </label>
        <input id="conferma" name="conferma" type="password" required autoComplete="new-password" className="input" />
      </div>
      <p className="text-xs text-slate-500 sm:col-span-3">Almeno {PASSWORD_MIN} caratteri, con lettere e numeri. Non usare la stessa password di altri siti.</p>
      {stato && <p className={`text-sm sm:col-span-3 ${stato.errore ? "text-red-600" : "text-green-700"}`}>{stato.errore ?? stato.ok}</p>}
      <div className="flex justify-end sm:col-span-3">
        <button className="btn-primary" disabled={inCorso}>
          {inCorso ? "Salvataggio…" : "Cambia password"}
        </button>
      </div>
    </form>
  );
}

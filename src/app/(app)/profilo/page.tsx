import { richiediProfilo, ETICHETTE_RUOLO } from "@/lib/auth";
import { FormNome, FormPassword } from "./forms";

export default async function ProfiloPage() {
  const p = await richiediProfilo();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Il mio profilo</h1>
        <p className="text-sm text-slate-500">
          {p.email} · {ETICHETTE_RUOLO[p.ruolo]}
          {p.sede_nome ? ` · ${p.sede_nome}` : ""}
        </p>
      </div>
      <section className="card p-5">
        <FormNome nome={p.nome_completo} />
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Cambia password</h2>
        <FormPassword />
      </section>
    </div>
  );
}

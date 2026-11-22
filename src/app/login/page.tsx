import { redirect } from "next/navigation";
import { getProfilo } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  if (await getProfilo()) redirect("/");
  const nome = process.env.NEXT_PUBLIC_NOME_STUDIO || "IOSTRANIERO";
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-600 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iostraniero.png" alt={nome} className="mx-auto mb-2 h-32 w-32" />
          <h1 className="sr-only">{nome}</h1>
          <p className="text-sm text-white/80">Accedi al gestionale</p>
        </div>
        <div className="card p-6">
          {sp.errore === "link" && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Il link è scaduto o è già stato usato. Richiedine uno nuovo da «Password dimenticata?».</p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

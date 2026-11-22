import { redirect } from "next/navigation";
import { getProfilo } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getProfilo()) redirect("/");
  const nome = process.env.NEXT_PUBLIC_NOME_STUDIO || "Gestionale Studio";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl font-bold">
            {nome.charAt(0)}
          </div>
          <h1 className="text-2xl font-semibold">{nome}</h1>
          <p className="text-sm text-white/70">Accedi al gestionale</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

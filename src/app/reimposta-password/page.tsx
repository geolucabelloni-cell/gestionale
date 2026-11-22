import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormNuovaPassword } from "./form";

export default async function ReimpostaPassword() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?errore=link");
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-600 p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-lg font-semibold">Scegli una nuova password</h1>
        <p className="text-sm text-slate-600">Account: {user.email}</p>
        <FormNuovaPassword />
      </div>
    </main>
  );
}

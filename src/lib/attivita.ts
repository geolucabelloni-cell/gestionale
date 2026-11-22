import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Attivita } from "@/components/attivita/lista-attivita";

type Db = SupabaseClient<Database>;

export async function caricaAttivita(db: Db, filtro: { clientId?: string; assegnatoA?: string; conCompletate?: boolean; limite?: number }): Promise<Attivita[]> {
  let q = db
    .from("tasks")
    .select("id, titolo, descrizione, scadenza, priorita, stato, origine, client_id, assegnato_a, clients(nome, cognome), profiles!tasks_assegnato_a_fkey(nome_completo)")
    .order("stato")
    .order("scadenza", { ascending: true, nullsFirst: false })
    .order("created_at")
    .limit(filtro.limite ?? 500);
  if (filtro.clientId) q = q.eq("client_id", filtro.clientId);
  if (filtro.assegnatoA) q = q.or(`assegnato_a.eq.${filtro.assegnatoA},assegnato_a.is.null`);
  if (!filtro.conCompletate) q = q.eq("stato", "da_fare");
  const { data } = await q;
  return (data ?? []).map((a) => ({
    id: a.id,
    titolo: a.titolo,
    descrizione: a.descrizione,
    scadenza: a.scadenza,
    priorita: a.priorita,
    stato: a.stato,
    origine: a.origine,
    client_id: a.client_id,
    nomeCliente: a.clients ? `${a.clients.cognome} ${a.clients.nome}` : null,
    assegnato_a: a.assegnato_a,
    nomeAssegnato: a.profiles?.nome_completo ?? null,
  }));
}

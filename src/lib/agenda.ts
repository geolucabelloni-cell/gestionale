import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { partiRoma } from "@/lib/tempo";
import type { ApptVista } from "@/components/agenda/settimana";

type Db = SupabaseClient<Database>;

export const SELECT_APPUNTAMENTO = "*, clients(id, nome, cognome), profiles!appointments_operatore_id_fkey(nome_completo)";

type Riga = Database["public"]["Tables"]["appointments"]["Row"] & {
  clients: { id: string; nome: string; cognome: string } | null;
  profiles: { nome_completo: string } | null;
};

export function inVista(a: Riga): ApptVista {
  const { data, ora, minuti } = partiRoma(a.inizio);
  return {
    id: a.id,
    client_id: a.client_id,
    nominativo: a.nominativo,
    telefono: a.telefono,
    operatore_id: a.operatore_id,
    titolo: a.titolo,
    tipo: a.tipo,
    data,
    ora,
    minuti,
    durata: Math.round((new Date(a.fine).getTime() - new Date(a.inizio).getTime()) / 60000),
    luogo: a.luogo,
    stato: a.stato,
    note: a.note,
    cliente: a.clients ? { id: a.clients.id, nome: a.clients.nome, cognome: a.clients.cognome } : null,
    nomeCliente: a.clients ? `${a.clients.cognome} ${a.clients.nome}` : (a.nominativo ?? ""),
    nomeOperatore: a.profiles?.nome_completo ?? null,
  };
}

export async function operatoriVisibili(db: Db) {
  const { data } = await db.from("profiles").select("id, nome_completo, email").eq("attivo", true).order("nome_completo");
  return (data ?? []).map((o) => ({ id: o.id, nome: o.nome_completo || o.email || "?" }));
}

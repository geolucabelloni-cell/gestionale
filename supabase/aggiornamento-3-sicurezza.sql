-- IOSTRANIERO: AGGIORNAMENTO 3 – rinforzo sicurezza.
-- Da eseguire DOPO aggiornamento-2-modelli-checklist.sql. Supabase -> SQL Editor -> New query -> Run, una sola volta.

-- =====================================================================
-- Rinforzo sicurezza
-- =====================================================================

-- 1. Le funzioni interne non sono richiamabili da chi non ha fatto login
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated, service_role', f.firma);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2. Storico WhatsApp non modificabile dagli utenti: possono solo segnare una chat come gestita
revoke update on public.whatsapp_messages from authenticated, anon;
grant update (da_gestire) on public.whatsapp_messages to authenticated;

-- 3. Documenti: non si può cambiare il file a cui punta un documento, né spostarlo su un altro cliente
revoke update on public.documents from authenticated, anon;
grant update (nome, folder_id, ai_riepilogo, ai_tipo_documento) on public.documents to authenticated;

-- 4. Registro attività: solo inserimento, mai modifiche o cancellazioni
revoke update, delete, truncate on public.audit_log from authenticated, anon;

-- 5. Nessun accesso alle tabelle per chi non ha fatto login (oltre alla RLS)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 6. Impostazioni sensibili della sede modificabili solo dalla sede centrale:
--    numero WhatsApp Meta (instrada i messaggi in arrivo) e stato attivo/disattivo
create or replace function public.proteggi_campi_sede()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin_rete() then
    if new.wa_phone_number_id is distinct from old.wa_phone_number_id then
      raise exception 'Solo la sede centrale può modificare il numero WhatsApp collegato alla sede';
    end if;
    if new.attiva is distinct from old.attiva then
      raise exception 'Solo la sede centrale può attivare o disattivare una sede';
    end if;
  end if;
  return new;
end $$;
create trigger offices_campi_protetti before update on public.offices
  for each row execute function public.proteggi_campi_sede();
revoke execute on function public.proteggi_campi_sede() from public, anon;

-- 7. Archivio documenti: dimensione massima 25 MB per file
update storage.buckets set file_size_limit = 26214400 where id = 'documenti';

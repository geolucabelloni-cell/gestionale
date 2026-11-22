-- IOSTRANIERO: creazione completa del database.
-- Incollare TUTTO in Supabase -> SQL Editor -> New query -> Run (una sola volta, su progetto vuoto).

-- ===== supabase/migrations/20261122000000_schema_iniziale.sql =====
-- =====================================================================
-- Gestionale Studio – schema iniziale
-- Multi-sede (franchising): ogni dato appartiene a una "sede" (office).
-- La sede centrale (ruolo admin_rete) vede tutto; titolari e operatori
-- vedono solo i dati della propria sede (Row Level Security).
-- =====================================================================

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------
create type public.ruolo_utente as enum ('admin_rete', 'titolare', 'operatore');
create type public.origine_nota as enum ('manuale', 'whatsapp', 'ai', 'sistema');
create type public.direzione_msg as enum ('in', 'out');
create type public.stato_pratica as enum ('aperta', 'in_attesa_documenti', 'presentata', 'in_lavorazione', 'conclusa_positiva', 'conclusa_negativa', 'archiviata');

-- ---------------------------------------------------------------------
-- Sedi (franchisee)
-- ---------------------------------------------------------------------
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  citta text,
  indirizzo text,
  telefono text,
  email text,
  -- WhatsApp Business Cloud API
  wa_phone_number_id text unique,          -- ID numero (Meta)
  wa_numero_visualizzato text,             -- es. +39 333 1234567
  -- AI
  ai_risposta_automatica boolean not null default true,
  ai_istruzioni text not null default '',  -- base di conoscenza della sede: orari, prezzi, documenti richiesti...
  attiva boolean not null default true,
  created_at timestamptz not null default now()
);

-- Segreti della sede (token WhatsApp): nessuna policy => leggibili solo dal server (service role)
create table public.office_secrets (
  office_id uuid primary key references public.offices(id) on delete cascade,
  wa_access_token text                     -- token permanente (System User); se null si usa quello globale
);

-- ---------------------------------------------------------------------
-- Profili utente (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  office_id uuid references public.offices(id) on delete set null,
  nome_completo text not null default '',
  email text,
  ruolo public.ruolo_utente not null default 'operatore',
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funzioni di supporto per RLS (security definer = niente ricorsione)
-- ---------------------------------------------------------------------
create or replace function public.current_office_id()
returns uuid language sql stable security definer set search_path = public as $$
  select office_id from public.profiles where id = auth.uid() and attivo
$$;

create or replace function public.current_ruolo()
returns public.ruolo_utente language sql stable security definer set search_path = public as $$
  select ruolo from public.profiles where id = auth.uid() and attivo
$$;

create or replace function public.is_admin_rete()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select ruolo = 'admin_rete' from public.profiles where id = auth.uid() and attivo), false)
$$;

create or replace function public.can_access_office(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_rete() or target = public.current_office_id()
$$;

-- ---------------------------------------------------------------------
-- Clienti (anagrafica) – specifica per diritto dell'immigrazione
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete restrict,
  codice serial,                                   -- numero progressivo leggibile
  nome text not null,
  cognome text not null,
  sesso text check (sesso in ('M','F','X')),
  data_nascita date,
  luogo_nascita text,
  cittadinanza text,
  codice_fiscale text,
  stato_civile text,
  -- contatti
  telefono text,                                   -- formato E.164 senza + (es. 393331234567)
  whatsapp_attivo boolean not null default true,
  email text,
  indirizzo text,
  citta text,
  cap text,
  lingua_preferita text not null default 'it',     -- usata dall'AI per rispondere
  -- documenti di soggiorno
  passaporto_numero text,
  passaporto_scadenza date,
  permesso_tipo text,                              -- es. lavoro subordinato, famiglia, studio, protezione...
  permesso_numero text,
  permesso_scadenza date,
  -- altro
  note_generali text,
  consenso_privacy boolean not null default false,
  consenso_privacy_data date,
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(coalesce(nome,'') || ' ' || coalesce(cognome,'') || ' ' || coalesce(codice_fiscale,'') || ' ' ||
          coalesce(telefono,'') || ' ' || coalesce(email,'') || ' ' || coalesce(passaporto_numero,'') || ' ' ||
          coalesce(permesso_numero,''))
  ) stored
);
create index clients_office_idx on public.clients(office_id);
create index clients_telefono_idx on public.clients(telefono);
create index clients_permesso_scadenza_idx on public.clients(permesso_scadenza);
create index clients_search_idx on public.clients using gin (search_text gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Diario cliente: una nota per ogni contatto/visita, in ordine progressivo
-- Le note NON si modificano: si aggiunge una rettifica (storico affidabile).
-- ---------------------------------------------------------------------
create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete restrict,
  numero integer not null,                         -- progressivo per cliente (1, 2, 3...)
  data_visita date not null default current_date,
  testo text not null check (length(trim(testo)) > 0),
  origine public.origine_nota not null default 'manuale',
  rettifica_di uuid references public.client_notes(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, numero)
);
create index client_notes_client_idx on public.client_notes(client_id, numero desc);

create or replace function public.assegna_numero_nota()
returns trigger language plpgsql as $$
begin
  -- lock sul cliente per evitare numeri duplicati in inserimenti concorrenti
  perform 1 from public.clients where id = new.client_id for update;
  select coalesce(max(numero), 0) + 1 into new.numero from public.client_notes where client_id = new.client_id;
  select office_id into new.office_id from public.clients where id = new.client_id;
  if new.author_id is null then new.author_id := auth.uid(); end if;
  return new;
end $$;
create trigger client_notes_numero before insert on public.client_notes
  for each row execute function public.assegna_numero_nota();

-- ---------------------------------------------------------------------
-- Pratiche (permessi, ricongiungimenti, cittadinanza, ricorsi...)
-- ---------------------------------------------------------------------
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete restrict,
  tipo text not null,
  stato public.stato_pratica not null default 'aperta',
  descrizione text,
  data_apertura date not null default current_date,
  prossima_scadenza date,
  riferimento_esterno text,                        -- n. pratica questura/prefettura, RG tribunale...
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_client_idx on public.cases(client_id);
create index cases_scadenza_idx on public.cases(prossima_scadenza);

-- ---------------------------------------------------------------------
-- Cartelle e documenti
-- ---------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete restrict,
  parent_id uuid references public.folders(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  created_at timestamptz not null default now()
);
create unique index folders_nome_unico on public.folders(client_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete restrict,
  folder_id uuid references public.folders(id) on delete set null,
  nome text not null,
  storage_path text not null unique,
  mime_type text,
  dimensione bigint,
  origine text not null default 'caricamento',    -- caricamento | whatsapp
  ai_riepilogo text,
  ai_tipo_documento text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index documents_folder_idx on public.documents(folder_id);
create index documents_client_idx on public.documents(client_id);

-- Allinea office_id dei figli a quello del cliente (impedisce dati "fuori sede")
create or replace function public.allinea_office_da_cliente()
returns trigger language plpgsql as $$
begin
  select office_id into new.office_id from public.clients where id = new.client_id;
  if new.office_id is null then raise exception 'Cliente inesistente'; end if;
  return new;
end $$;
create trigger cases_office before insert or update of client_id on public.cases for each row execute function public.allinea_office_da_cliente();
create trigger folders_office before insert or update of client_id on public.folders for each row execute function public.allinea_office_da_cliente();
create trigger documents_office before insert or update of client_id on public.documents for each row execute function public.allinea_office_da_cliente();

-- Una sottocartella deve appartenere allo stesso cliente della cartella madre
create or replace function public.verifica_cartella_madre()
returns trigger language plpgsql as $$
declare madre_cliente uuid;
begin
  if new.parent_id is not null then
    select client_id into madre_cliente from public.folders where id = new.parent_id;
    if madre_cliente is distinct from new.client_id then raise exception 'Cartella madre di un altro cliente'; end if;
    if new.parent_id = new.id then raise exception 'Una cartella non può contenere se stessa'; end if;
  end if;
  return new;
end $$;
create trigger folders_madre before insert or update on public.folders for each row execute function public.verifica_cartella_madre();

-- Cartelle predefinite alla creazione del cliente
create or replace function public.crea_cartelle_predefinite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.folders (client_id, office_id, nome) values
    (new.id, new.office_id, 'Documenti di identità'),
    (new.id, new.office_id, 'Permesso di soggiorno'),
    (new.id, new.office_id, 'Lavoro e reddito'),
    (new.id, new.office_id, 'Famiglia'),
    (new.id, new.office_id, 'Pratiche e istanze'),
    (new.id, new.office_id, 'Ricevute e pagamenti'),
    (new.id, new.office_id, 'WhatsApp');
  return new;
end $$;
create trigger clients_cartelle after insert on public.clients for each row execute function public.crea_cartelle_predefinite();

-- ---------------------------------------------------------------------
-- WhatsApp
-- ---------------------------------------------------------------------
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  wa_message_id text unique,                       -- id Meta (idempotenza webhook)
  telefono text not null,                          -- numero del cliente (E.164 senza +)
  nome_profilo text,                               -- nome profilo WhatsApp
  direzione public.direzione_msg not null,
  tipo text not null default 'text',               -- text | image | document | audio | ...
  testo text,
  document_id uuid references public.documents(id) on delete set null,
  media_path text,                                 -- file ricevuto da numero non ancora associato a un cliente
  media_mime text,
  -- AI
  ai_categoria text,
  ai_gestito boolean not null default false,       -- risposta inviata automaticamente dall'AI
  ai_bozza text,                                   -- risposta suggerita per l'operatore
  ai_motivo text,
  da_gestire boolean not null default false,       -- serve un operatore
  inviato_da uuid references public.profiles(id) on delete set null,
  stato_invio text,                                -- sent | delivered | read | failed
  created_at timestamptz not null default now()
);
create index wa_office_tel_idx on public.whatsapp_messages(office_id, telefono, created_at desc);
create index wa_client_idx on public.whatsapp_messages(client_id, created_at desc);
create index wa_da_gestire_idx on public.whatsapp_messages(office_id) where da_gestire;

-- ---------------------------------------------------------------------
-- Registro attività (GDPR / controllo)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  office_id uuid references public.offices(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  azione text not null,
  entita text,
  entita_id uuid,
  dettagli jsonb,
  created_at timestamptz not null default now()
);
create index audit_office_idx on public.audit_log(office_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at automatico
-- ---------------------------------------------------------------------
create or replace function public.tocca_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger clients_updated before update on public.clients for each row execute function public.tocca_updated_at();
create trigger cases_updated before update on public.cases for each row execute function public.tocca_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.offices enable row level security;
alter table public.office_secrets enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;
alter table public.cases enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.audit_log enable row level security;

-- Sedi: tutti vedono la propria, admin rete tutte. Solo admin crea/elimina; titolare modifica la propria.
create policy offices_select on public.offices for select to authenticated using (public.can_access_office(id));
create policy offices_insert on public.offices for insert to authenticated with check (public.is_admin_rete());
create policy offices_update on public.offices for update to authenticated
  using (public.is_admin_rete() or (id = public.current_office_id() and public.current_ruolo() = 'titolare'))
  with check (public.is_admin_rete() or (id = public.current_office_id() and public.current_ruolo() = 'titolare'));
create policy offices_delete on public.offices for delete to authenticated using (public.is_admin_rete());

-- Profili: ognuno vede se stesso e i colleghi di sede; admin tutti.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.can_access_office(office_id));
-- Le modifiche ai profili passano dal server (service role) con controlli applicativi.

-- Dati della sede: accesso pieno per chi appartiene alla sede (o admin rete)
create policy clients_all on public.clients for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));
create policy cases_all on public.cases for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));
create policy folders_all on public.folders for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));
create policy documents_all on public.documents for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));
create policy wa_select on public.whatsapp_messages for select to authenticated using (public.can_access_office(office_id));
create policy wa_update on public.whatsapp_messages for update to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));

-- Note: lettura e inserimento; nessuna modifica; eliminazione solo titolare/admin.
create policy notes_select on public.client_notes for select to authenticated using (public.can_access_office(office_id));
create policy notes_insert on public.client_notes for insert to authenticated
  with check (exists (select 1 from public.clients c where c.id = client_id and public.can_access_office(c.office_id)));
create policy notes_delete on public.client_notes for delete to authenticated
  using (public.can_access_office(office_id) and public.current_ruolo() in ('admin_rete','titolare'));

-- Clienti: eliminazione solo titolare/admin (sovrascrive "for all" restringendo con policy restrictive)
create policy clients_delete_ruolo on public.clients as restrictive for delete to authenticated
  using (public.current_ruolo() in ('admin_rete','titolare'));

create policy audit_select on public.audit_log for select to authenticated
  using (public.is_admin_rete() or (office_id = public.current_office_id() and public.current_ruolo() = 'titolare'));
create policy audit_insert on public.audit_log for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_office(office_id));

-- ---------------------------------------------------------------------
-- Storage: bucket privato "documenti", percorso = {office_id}/{client_id}/{file}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documenti', 'documenti', false, 52428800)
on conflict (id) do nothing;

create policy documenti_select on storage.objects for select to authenticated
  using (bucket_id = 'documenti' and public.can_access_office(((storage.foldername(name))[1])::uuid));
create policy documenti_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and public.can_access_office(((storage.foldername(name))[1])::uuid));
create policy documenti_update on storage.objects for update to authenticated
  using (bucket_id = 'documenti' and public.can_access_office(((storage.foldername(name))[1])::uuid));
create policy documenti_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and public.can_access_office(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Viste utili
-- ---------------------------------------------------------------------
create or replace view public.scadenze_permessi with (security_invoker = true) as
  select c.id, c.office_id, c.nome, c.cognome, c.telefono, c.permesso_tipo, c.permesso_scadenza,
         (c.permesso_scadenza - current_date) as giorni_mancanti
  from public.clients c
  where c.permesso_scadenza is not null and c.permesso_scadenza <= current_date + 90;

create or replace view public.conversazioni_whatsapp with (security_invoker = true) as
  select distinct on (m.office_id, m.telefono)
         m.office_id, m.telefono,
         (select x.client_id from public.whatsapp_messages x
           where x.office_id = m.office_id and x.telefono = m.telefono and x.client_id is not null
           order by x.created_at desc limit 1) as client_id,
         (select x.nome_profilo from public.whatsapp_messages x
           where x.office_id = m.office_id and x.telefono = m.telefono and x.nome_profilo is not null
           order by x.created_at desc limit 1) as nome_profilo,
         m.testo as ultimo_testo, m.tipo as ultimo_tipo, m.direzione as ultima_direzione, m.created_at as ultimo_at,
         (select count(*) from public.whatsapp_messages x
           where x.office_id = m.office_id and x.telefono = m.telefono and x.da_gestire)::int as da_gestire
  from public.whatsapp_messages m
  order by m.office_id, m.telefono, m.created_at desc;

-- ===== supabase/migrations/20261123000000_agenda_attivita.sql =====
-- =====================================================================
-- Agenda appuntamenti e attività/scadenze (sostituiscono i fogli Excel)
-- =====================================================================

create type public.stato_appuntamento as enum ('programmato', 'confermato', 'completato', 'annullato', 'non_presentato');
create type public.stato_attivita as enum ('da_fare', 'fatto');
create type public.priorita as enum ('bassa', 'normale', 'alta');

-- ---------------------------------------------------------------------
-- Appuntamenti
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default public.current_office_id() references public.offices(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  nominativo text,                                   -- per chi non ha ancora un'anagrafica
  telefono text,
  operatore_id uuid references public.profiles(id) on delete set null,
  titolo text not null,
  tipo text not null default 'Consulenza',
  inizio timestamptz not null,
  fine timestamptz not null,
  luogo text not null default 'In sede',            -- In sede | Questura | Prefettura | Online | Telefono
  stato public.stato_appuntamento not null default 'programmato',
  note text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (fine > inizio)
);
create index appointments_office_inizio_idx on public.appointments(office_id, inizio);
create index appointments_client_idx on public.appointments(client_id);

-- ---------------------------------------------------------------------
-- Attività e scadenze
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default public.current_office_id() references public.offices(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  titolo text not null check (length(trim(titolo)) > 0),
  descrizione text,
  scadenza date,
  priorita public.priorita not null default 'normale',
  stato public.stato_attivita not null default 'da_fare',
  assegnato_a uuid references public.profiles(id) on delete set null,
  origine text not null default 'manuale',          -- manuale | ai | whatsapp | importazione
  completato_at timestamptz,
  completato_da uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index tasks_office_stato_idx on public.tasks(office_id, stato, scadenza);
create index tasks_client_idx on public.tasks(client_id);
create index tasks_assegnato_idx on public.tasks(assegnato_a) where stato = 'da_fare';

-- La sede di appuntamenti e attività legati a un cliente è sempre quella del cliente
create or replace function public.allinea_office_se_cliente()
returns trigger language plpgsql as $$
begin
  if new.client_id is not null then
    select office_id into new.office_id from public.clients where id = new.client_id;
  end if;
  if new.office_id is null then raise exception 'Sede mancante'; end if;
  return new;
end $$;
create trigger appointments_office before insert or update of client_id on public.appointments
  for each row execute function public.allinea_office_se_cliente();
create trigger tasks_office before insert or update of client_id on public.tasks
  for each row execute function public.allinea_office_se_cliente();

-- Completamento attività: chi e quando
create or replace function public.traccia_completamento()
returns trigger language plpgsql as $$
begin
  if new.stato = 'fatto' and (old.stato is distinct from 'fatto') then
    new.completato_at := now();
    new.completato_da := auth.uid();
  elsif new.stato = 'da_fare' then
    new.completato_at := null;
    new.completato_da := null;
  end if;
  return new;
end $$;
create trigger tasks_completamento before update of stato on public.tasks
  for each row execute function public.traccia_completamento();

alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
create policy appointments_all on public.appointments for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));
create policy tasks_all on public.tasks for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));

-- ---------------------------------------------------------------------
-- Importazione da TeamSystem: codice cliente del vecchio gestionale
-- ---------------------------------------------------------------------
alter table public.clients add column codice_esterno text;
create unique index clients_codice_esterno_idx on public.clients(office_id, codice_esterno) where codice_esterno is not null;

-- ===== supabase/migrations/20261123010000_callbell.sql =====
-- Canale WhatsApp per sede: Meta Cloud API diretta oppure Callbell
alter table public.offices
  add column wa_provider text not null default 'meta' check (wa_provider in ('meta', 'callbell')),
  add column callbell_channel_uuid text;

alter table public.office_secrets
  add column callbell_api_token text,
  add column callbell_webhook_token text;   -- segreto nell'URL del webhook per autenticare Callbell

-- ===== supabase/migrations/20261124000000_modelli_checklist.sql =====
-- =====================================================================
-- Modelli di documento (PDF) e checklist documenti per pratica
-- I modelli con office_id NULL valgono per tutta la rete (li gestisce la sede centrale);
-- quelli con office_id sono della singola sede (li gestisce il titolare).
-- =====================================================================

create or replace function public.puo_gestire_modello(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when target is null then public.is_admin_rete()
    else public.can_access_office(target) and public.current_ruolo() in ('admin_rete', 'titolare')
  end
$$;

-- ---------------------------------------------------------------------
-- Modelli di checklist per tipo di pratica
-- ---------------------------------------------------------------------
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.offices(id) on delete cascade,
  tipo_pratica text not null check (length(trim(tipo_pratica)) > 0),
  voci text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique nulls not distinct (office_id, tipo_pratica)
);

-- ---------------------------------------------------------------------
-- Checklist della singola pratica
-- ---------------------------------------------------------------------
create table public.case_checklist (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  voce text not null check (length(trim(voce)) > 0),
  ordine integer not null default 0,
  fatto boolean not null default false,
  document_id uuid references public.documents(id) on delete set null,
  nota text,
  fatto_at timestamptz,
  fatto_da uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index case_checklist_case_idx on public.case_checklist(case_id, ordine);

create or replace function public.allinea_office_da_pratica()
returns trigger language plpgsql as $$
begin
  select office_id into new.office_id from public.cases where id = new.case_id;
  if new.office_id is null then raise exception 'Pratica inesistente'; end if;
  if new.fatto and (tg_op = 'INSERT' or old.fatto is distinct from true) then
    new.fatto_at := now();
    new.fatto_da := auth.uid();
  elsif not new.fatto then
    new.fatto_at := null;
    new.fatto_da := null;
  end if;
  return new;
end $$;
create trigger case_checklist_office before insert or update on public.case_checklist
  for each row execute function public.allinea_office_da_pratica();

-- ---------------------------------------------------------------------
-- Modelli di documento
-- ---------------------------------------------------------------------
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.offices(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  descrizione text,
  corpo text not null default '',
  richiede_pratica boolean not null default false,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger document_templates_updated before update on public.document_templates
  for each row execute function public.tocca_updated_at();
create trigger checklist_templates_updated before update on public.checklist_templates
  for each row execute function public.tocca_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.checklist_templates enable row level security;
alter table public.case_checklist enable row level security;
alter table public.document_templates enable row level security;

create policy checklist_templates_select on public.checklist_templates for select to authenticated
  using (office_id is null or public.can_access_office(office_id));
create policy checklist_templates_write on public.checklist_templates for all to authenticated
  using (public.puo_gestire_modello(office_id)) with check (public.puo_gestire_modello(office_id));

create policy document_templates_select on public.document_templates for select to authenticated
  using (office_id is null or public.can_access_office(office_id));
create policy document_templates_write on public.document_templates for all to authenticated
  using (public.puo_gestire_modello(office_id)) with check (public.puo_gestire_modello(office_id));

create policy case_checklist_all on public.case_checklist for all to authenticated
  using (public.can_access_office(office_id)) with check (public.can_access_office(office_id));

-- ---------------------------------------------------------------------
-- Checklist predefinite della rete (indicative: da verificare e adattare)
-- ---------------------------------------------------------------------
insert into public.checklist_templates (office_id, tipo_pratica, voci) values
(null, 'Rinnovo permesso di soggiorno', array[
  'Passaporto in corso di validità (copia di tutte le pagine)',
  'Permesso di soggiorno in scadenza',
  'Codice fiscale',
  '4 foto tessera',
  'Marca da bollo da 16 €',
  'Contratto di lavoro / comunicazione UNILAV',
  'Ultime 3 buste paga',
  'CU o Modello 730 dell''ultimo anno',
  'Contratto d''affitto registrato o dichiarazione di ospitalità',
  'Ricevuta del bollettino postale per il permesso elettronico']),
(null, 'Primo rilascio permesso di soggiorno', array[
  'Passaporto con visto d''ingresso',
  'Nulla osta o documento che autorizza l''ingresso',
  'Codice fiscale',
  '4 foto tessera',
  'Marca da bollo da 16 €',
  'Contratto d''affitto registrato o dichiarazione di ospitalità',
  'Ricevuta del bollettino postale per il permesso elettronico']),
(null, 'Conversione permesso', array[
  'Passaporto in corso di validità',
  'Permesso di soggiorno attuale',
  'Codice fiscale',
  'Documentazione del nuovo titolo (contratto di lavoro, iscrizione, ecc.)',
  'Redditi (CU / 730 / buste paga)',
  'Contratto d''affitto o dichiarazione di ospitalità',
  'Marca da bollo da 16 €',
  '4 foto tessera']),
(null, 'Permesso UE soggiornanti di lungo periodo', array[
  'Passaporto in corso di validità',
  'Permesso di soggiorno in corso di validità',
  'Codice fiscale',
  'CU o Modello 730 dell''ultimo anno',
  'Ultime buste paga e contratto di lavoro',
  'Certificato di idoneità alloggiativa (se si includono familiari)',
  'Certificato di conoscenza della lingua italiana (A2) o esito del test',
  'Certificato di residenza / stato di famiglia',
  'Marca da bollo da 16 €',
  '4 foto tessera']),
(null, 'Ricongiungimento familiare', array[
  'Passaporto e permesso di soggiorno del richiedente',
  'Contratto di lavoro e ultime buste paga',
  'CU o Modello 730 (reddito minimo richiesto)',
  'Contratto d''affitto o di proprietà registrato',
  'Certificato di idoneità alloggiativa',
  'Assenso del proprietario (se l''alloggio non è intestato al richiedente)',
  'Passaporto del familiare da ricongiungere',
  'Certificati di stato civile / nascita tradotti e legalizzati',
  'Marca da bollo da 16 €']),
(null, 'Coesione familiare', array[
  'Passaporto del familiare',
  'Permesso di soggiorno del familiare già residente',
  'Certificati di stato civile / nascita tradotti e legalizzati',
  'Redditi del familiare residente (CU / 730 / buste paga)',
  'Contratto d''affitto e idoneità alloggiativa',
  'Marca da bollo da 16 €',
  '4 foto tessera']),
(null, 'Cittadinanza per residenza', array[
  'Passaporto in corso di validità',
  'Permesso di soggiorno',
  'Estratto dell''atto di nascita tradotto e legalizzato',
  'Certificato penale del Paese d''origine tradotto e legalizzato',
  'Certificazione di lingua italiana livello B1',
  'Redditi degli ultimi 3 anni (CU / 730)',
  'Ricevuta del contributo di 250 €',
  'Marca da bollo da 16 €',
  'SPID del cliente per la domanda online']),
(null, 'Cittadinanza per matrimonio', array[
  'Passaporto in corso di validità',
  'Permesso di soggiorno',
  'Estratto dell''atto di nascita tradotto e legalizzato',
  'Certificato penale del Paese d''origine tradotto e legalizzato',
  'Estratto dell''atto di matrimonio',
  'Certificazione di lingua italiana livello B1',
  'Ricevuta del contributo di 250 €',
  'Marca da bollo da 16 €',
  'SPID del cliente per la domanda online']),
(null, 'Decreto flussi / Nulla osta lavoro', array[
  'Copia del passaporto del lavoratore',
  'Documento d''identità e codice fiscale del datore di lavoro',
  'Visura camerale / documentazione dell''azienda',
  'Redditi del datore di lavoro',
  'Proposta di contratto di soggiorno',
  'Indicazione della sistemazione alloggiativa',
  'Marca da bollo da 16 €']),
(null, 'Protezione internazionale', array[
  'Documento d''identità o di viaggio (se disponibile)',
  'Memoria personale / racconto della storia',
  'Documentazione a sostegno della domanda',
  'Eventuali certificazioni mediche',
  'Dichiarazione di ospitalità / indirizzo']),
(null, 'Ricorso / Contenzioso', array[
  'Provvedimento impugnato con data di notifica',
  'Documento d''identità del cliente',
  'Procura alle liti firmata',
  'Documentazione a sostegno del ricorso',
  'Autocertificazione dei redditi (per il gratuito patrocinio)']),
(null, 'Carta di soggiorno familiare UE', array[
  'Passaporto del familiare',
  'Documento del cittadino UE / italiano',
  'Certificato di matrimonio o di parentela',
  'Attestazione di iscrizione anagrafica del cittadino UE',
  'Marca da bollo da 16 €',
  '4 foto tessera']),
(null, 'Test di lingua italiana', array[
  'Permesso di soggiorno',
  'Passaporto',
  'Marca da bollo da 16 €']);

-- ---------------------------------------------------------------------
-- Modelli di documento predefiniti della rete (testi da far verificare al legale)
-- ---------------------------------------------------------------------
insert into public.document_templates (office_id, nome, descrizione, richiede_pratica, corpo) values
(null, 'Conferimento di incarico', 'Mandato professionale del cliente allo studio', true,
'# CONFERIMENTO DI INCARICO PROFESSIONALE

Il/La sottoscritto/a **{{nome_completo}}**, {{nato_a}} a {{luogo_nascita}} il {{data_nascita}}, cittadinanza {{cittadinanza}}, codice fiscale {{codice_fiscale}}, residente in {{indirizzo_completo}}, telefono {{telefono}},

## CONFERISCE INCARICO

a {{sede_nome}}, con sede in {{sede_indirizzo}}, di assisterlo/a nella seguente pratica:

**{{pratica_tipo}}** {{pratica_riferimento}}

L''incarico comprende la consulenza, la raccolta e la verifica della documentazione, la compilazione e l''invio delle istanze e i contatti con gli uffici competenti relativi alla pratica indicata.

Il/La cliente si impegna a fornire documenti e informazioni veritieri e completi e a comunicare tempestivamente ogni variazione. Il compenso e le modalità di pagamento sono concordati separatamente.

Il/La cliente dichiara di aver ricevuto l''informativa sul trattamento dei dati personali.

{{luogo_data}}

Firma del cliente
{{firma}}

Per lo studio
{{firma}}'),

(null, 'Delega', 'Delega allo studio per presentare o ritirare documenti', false,
'# DELEGA

Il/La sottoscritto/a **{{nome_completo}}**, {{nato_a}} a {{luogo_nascita}} il {{data_nascita}}, cittadinanza {{cittadinanza}}, codice fiscale {{codice_fiscale}}, titolare di passaporto n. {{passaporto_numero}},

## DELEGA

{{sede_nome}}, nella persona di {{operatore}} o di altro incaricato dello studio, a presentare, integrare e ritirare in suo nome documenti e istanze presso gli uffici competenti (Questura, Prefettura, Poste Italiane, Comune e altri enti) relativi a:

{{pratica_tipo}} {{pratica_riferimento}}

Si allega copia del documento d''identità del delegante.

{{luogo_data}}

Firma del delegante
{{firma}}'),

(null, 'Informativa privacy e consenso', 'Informativa sul trattamento dei dati (art. 13 GDPR) con consenso', false,
'# INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI
## (art. 13 Regolamento UE 2016/679 – GDPR)

Gentile **{{nome_completo}}**,

{{sede_nome}}, con sede in {{sede_indirizzo}} ({{sede_email}}), in qualità di titolare del trattamento, la informa che i suoi dati personali, compresi quelli relativi al titolo di soggiorno e ai familiari, saranno trattati per:

- svolgere l''incarico affidato e le pratiche amministrative o legali richieste;
- adempiere agli obblighi di legge, contabili e fiscali;
- comunicare con lei, anche tramite telefono, email e WhatsApp.

I dati sono conservati in archivi elettronici protetti, su server situati nell''Unione Europea, per il tempo necessario allo svolgimento dell''incarico e agli obblighi di legge. Potranno essere comunicati agli uffici pubblici competenti e ai fornitori di servizi strettamente necessari (hosting, messaggistica), nominati responsabili del trattamento.

Lei ha diritto di accedere ai suoi dati, chiederne la rettifica o la cancellazione, limitarne il trattamento, opporsi e proporre reclamo al Garante per la protezione dei dati personali.

## CONSENSO

Il/La sottoscritto/a {{nome_completo}}, codice fiscale {{codice_fiscale}}, dichiara di aver letto l''informativa e acconsente al trattamento dei propri dati personali per le finalità indicate.

{{luogo_data}}

Firma
{{firma}}'),

(null, 'Ricevuta consegna documenti', 'Elenco dei documenti consegnati dal cliente per la pratica', true,
'# RICEVUTA DI CONSEGNA DOCUMENTI

{{sede_nome}} dichiara di aver ricevuto da **{{nome_completo}}** (codice fiscale {{codice_fiscale}}), per la pratica **{{pratica_tipo}}** {{pratica_riferimento}}, i seguenti documenti:

{{documenti_consegnati}}

Documenti ancora da consegnare:

{{documenti_mancanti}}

{{luogo_data}}

Per lo studio ({{operatore}})
{{firma}}

Firma del cliente
{{firma}}'),

(null, 'Promemoria documenti da portare', 'Elenco per il cliente dei documenti ancora mancanti', true,
'# DOCUMENTI DA PORTARE

Gentile **{{nome_completo}}**,

per proseguire con la pratica **{{pratica_tipo}}** abbiamo ancora bisogno dei seguenti documenti:

{{documenti_mancanti}}

Può portarli in sede ({{sede_indirizzo}}) oppure inviarne una foto leggibile su WhatsApp al numero dello studio.

Per informazioni: {{sede_telefono}} – {{sede_email}}

{{luogo_data}}

{{sede_nome}}');


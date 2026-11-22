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

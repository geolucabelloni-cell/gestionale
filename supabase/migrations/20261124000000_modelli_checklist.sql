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

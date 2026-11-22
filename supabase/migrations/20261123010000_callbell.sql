-- Canale WhatsApp per sede: Meta Cloud API diretta oppure Callbell
alter table public.offices
  add column wa_provider text not null default 'meta' check (wa_provider in ('meta', 'callbell')),
  add column callbell_channel_uuid text;

alter table public.office_secrets
  add column callbell_api_token text,
  add column callbell_webhook_token text;   -- segreto nell'URL del webhook per autenticare Callbell

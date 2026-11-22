-- IOSTRANIERO: crea la sede centrale e collega il primo amministratore.
-- PRIMA: Supabase -> Authentication -> Users -> "Add user" -> "Create new user"
--        (email e password, spuntare "Auto Confirm User").
-- POI: sostituire l'email qui sotto e lanciare in SQL Editor.

with sede as (
  insert into public.offices (nome) values ('IOSTRANIERO – Sede centrale') returning id
)
insert into public.profiles (id, email, nome_completo, ruolo, office_id)
select u.id, u.email, 'Amministratore', 'admin_rete', sede.id
from auth.users u, sede
where u.email = 'LA-VOSTRA-EMAIL@esempio.it';

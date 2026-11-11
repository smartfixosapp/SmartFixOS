alter table public.email_log add column if not exists order_id text;

alter table public.email_log add column if not exists order_status text;

alter table public.email_log add column if not exists dedupe_key text;

alter table public.email_log add column if not exists sender text;

create unique index if not exists email_log_dedupe_uidx
  on public.email_log (tenant_id, dedupe_key);

create index if not exists email_log_order_status_idx
  on public.email_log (tenant_id, order_id, order_status)
  where order_id is not null;

create index if not exists email_log_sent_subject_idx
  on public.email_log (tenant_id, to_email, subject)
  where status = 'sent';

comment on column public.email_log.dedupe_key is
  'Llave de un solo envio. Estatus: estatus:<order_id>:<status>:<timestamp de status_history>. Correo de ingreso: ingreso:<order_id>; reenvio forzado: ingreso:<order_id>:manual:<uuid>. Quien inserta primero con on_conflict=tenant_id,dedupe_key e ignore-duplicates envia; si no recibe fila, otro ya la reclamo.';

comment on column public.email_log.sender is
  'Quien reclamo el envio: ios, android, web, render o servidor.';

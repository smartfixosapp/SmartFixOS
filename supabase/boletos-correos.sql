alter table public.email_log add column if not exists order_id text;

alter table public.email_log add column if not exists order_status text;

alter table public.email_log add column if not exists dedupe_key text;

alter table public.email_log add column if not exists sender text;

create unique index if not exists email_log_dedupe_uidx
  on public.email_log (tenant_id, dedupe_key);

create index if not exists email_log_order_status_idx
  on public.email_log (tenant_id, order_id, order_status)
  where order_id is not null;

comment on column public.email_log.dedupe_key is
  'Bandera por boleto y estatus: estatus:<order_id>:<status>:<timestamp de la entrada de status_history>. Quien envia primero inserta la fila en pending con on_conflict ignore-duplicates; si no recibe fila, otro ya la reclamo y no envia.';

comment on column public.email_log.sender is
  'Quien reclamo el envio: ios, android, web, render o servidor.';

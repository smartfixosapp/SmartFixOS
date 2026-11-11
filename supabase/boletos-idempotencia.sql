create table if not exists public.assistant_ticket_requests (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  request_id uuid not null,
  order_id uuid,
  created_at timestamptz not null default now()
);

alter table public.assistant_ticket_requests enable row level security;

alter table public.assistant_ticket_requests alter column order_id drop not null;

alter table public.assistant_ticket_requests add column if not exists estado text not null default 'listo';

alter table public.assistant_ticket_requests add column if not exists actualizado_en timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.assistant_ticket_requests'::regclass
       and conname = 'assistant_ticket_requests_estado_chk'
  ) then
    alter table public.assistant_ticket_requests
      add constraint assistant_ticket_requests_estado_chk
      check (estado in ('creando', 'listo', 'fallido')) not valid;
  end if;
end $$;

create unique index if not exists assistant_ticket_requests_unique_idx
  on public.assistant_ticket_requests (tenant_id, request_id);

alter table public."order" add column if not exists client_request_id uuid;

create unique index if not exists order_client_request_uidx
  on public."order" (tenant_id, client_request_id)
  where client_request_id is not null;

comment on column public.assistant_ticket_requests.estado is
  'creando: reservada por POST /api/assistant/boleto/nuevo antes de crear. listo: order_id ya apunta al boleto. fallido: la creacion fallo y un reintento con la misma llave la puede retomar.';

comment on column public.assistant_ticket_requests.actualizado_en is
  'Ultimo cambio de la reserva. Una reserva en creando con mas de 3 minutos se considera abandonada y se puede retomar.';

comment on column public."order".client_request_id is
  'Llave de idempotencia del cliente (iOS WorkOrderWizard, Recarga, Desbloqueo y web lib/wizard/api.js). Un uuid por borrador; el insert directo usa on_conflict=id con resolution=ignore-duplicates y el mismo uuid en id y en client_request_id.';

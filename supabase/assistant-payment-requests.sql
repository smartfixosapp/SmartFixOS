create table if not exists public.assistant_payment_requests (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  request_id uuid not null,
  order_id text not null,
  pago_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists assistant_payment_requests_unique_idx on public.assistant_payment_requests (tenant_id, request_id);

alter table public.assistant_payment_requests enable row level security;

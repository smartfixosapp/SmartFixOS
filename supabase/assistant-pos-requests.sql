create table if not exists public.assistant_pos_requests (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  request_id uuid not null,
  venta_numero text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists assistant_pos_requests_unique_idx on public.assistant_pos_requests (tenant_id, request_id);

alter table public.assistant_pos_requests enable row level security;

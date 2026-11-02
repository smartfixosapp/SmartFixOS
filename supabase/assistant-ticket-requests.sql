create table if not exists public.assistant_ticket_requests (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  request_id uuid not null,
  order_id uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists assistant_ticket_requests_unique_idx on public.assistant_ticket_requests (tenant_id, request_id);

alter table public.assistant_ticket_requests enable row level security;

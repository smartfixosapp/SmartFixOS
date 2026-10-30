create table if not exists public.supplier_price (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  supplier text not null,
  part_key text not null,
  name text not null,
  sku text,
  model text,
  price numeric(10,2) not null,
  prev_price numeric(10,2),
  shipping numeric(10,2),
  stock text,
  url text,
  first_seen_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  unique (tenant_id, supplier, part_key)
);

create index if not exists supplier_price_tenant_seen_idx on public.supplier_price (tenant_id, seen_at desc);
create index if not exists supplier_price_tenant_name_idx on public.supplier_price (tenant_id, lower(name));

create table if not exists public.supplier_price_history (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  supplier text not null,
  part_key text not null,
  price numeric(10,2) not null,
  seen_at timestamptz not null default now()
);

create index if not exists supplier_price_history_lookup_idx on public.supplier_price_history (tenant_id, supplier, part_key, seen_at desc);

create table if not exists public.price_watch (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  query text not null,
  supplier text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  last_checked_at timestamptz
);

create unique index if not exists price_watch_unique_idx on public.price_watch (tenant_id, lower(query), coalesce(lower(supplier), ''));

alter table public.supplier_price enable row level security;
alter table public.supplier_price_history enable row level security;
alter table public.price_watch enable row level security;

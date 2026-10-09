create table if not exists public.billing_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  kind text not null,
  plan text,
  subscription_status text,
  next_billing_date timestamptz,
  amount numeric,
  currency text not null default 'USD',
  source text not null default 'tenant_change',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_event_tenant_idx on public.billing_event (tenant_id, created_at desc);
create index if not exists billing_event_recent_idx on public.billing_event (created_at desc);

alter table public.billing_event enable row level security;

create or replace function public.log_billing_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if new.subscription_status is distinct from old.subscription_status then
    if new.subscription_status = 'past_due' then
      k := 'payment_failed';
    elsif new.subscription_status = 'expired' then
      k := 'expired';
    elsif new.subscription_status = 'active' and coalesce(old.subscription_status, '') in ('past_due', 'expired', 'inactive') then
      k := 'recovered';
    elsif new.subscription_status = 'active' then
      k := 'activated';
    else
      k := 'status_changed';
    end if;
  elsif new.next_billing_date is distinct from old.next_billing_date
        and new.next_billing_date is not null
        and (old.next_billing_date is null or new.next_billing_date > old.next_billing_date) then
    k := 'renewed';
  elsif new.plan is distinct from old.plan then
    k := 'plan_changed';
  elsif new.status is distinct from old.status then
    k := case when new.status = 'suspended' then 'suspended' when new.status = 'active' then 'reactivated' else 'status_changed' end;
  else
    return new;
  end if;

  begin
    insert into public.billing_event (tenant_id, kind, plan, subscription_status, next_billing_date, amount, details)
    values (
      new.id::text,
      k,
      new.plan,
      new.subscription_status,
      new.next_billing_date,
      case when k in ('renewed', 'recovered', 'activated') then coalesce(nullif(new.monthly_cost, 0), case new.plan when 'solo' then 9.99 when 'team' then 49 end) else null end,
      jsonb_build_object(
        'old_plan', old.plan,
        'new_plan', new.plan,
        'old_subscription_status', old.subscription_status,
        'new_subscription_status', new.subscription_status,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists tenant_billing_log on public.tenant;
create trigger tenant_billing_log
after update of plan, status, subscription_status, next_billing_date on public.tenant
for each row execute function public.log_billing_change();

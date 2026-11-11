alter table public.part_link add column if not exists supplier_id text;

alter table public.part_link add column if not exists supplier_name text;

alter table public.part_link add column if not exists order_item_id text;

alter table public.part_link add column if not exists cost_none boolean;

comment on column public.part_link.supplier_id is
  'Id del suplidor (tabla supplier). Fuente de verdad del suplidor por pieza; sobrevive a que una app reescriba order.order_items.';

comment on column public.part_link.supplier_name is
  'Nombre del suplidor tal como se escogio. store queda como dato viejo y de respaldo.';

comment on column public.part_link.order_item_id is
  'id de la linea en order.order_items que este part_link costea. La linea apunta de vuelta con source_part_link_id.';

comment on column public.part_link.cost is
  'Costo TOTAL de la linea (costo unitario por cantidad), como lo escribe api/_lib/jaime.js. El costo unitario es cost / quantity de la linea.';

create or replace view public.order_item_costing
with (security_invoker = true)
as
select
  o.id::text as order_id,
  o.tenant_id::text as tenant_id,
  o.order_number,
  o.status,
  item.n as line_index,
  item.value->>'id' as item_id,
  item.value->>'type' as item_type,
  item.value->>'name' as item_name,
  case when (item.value->>'quantity') ~ '^[0-9]+(\.[0-9]+)?$' then (item.value->>'quantity')::numeric end as quantity,
  case when (item.value->>'price') ~ '^-?[0-9]+(\.[0-9]+)?$' then (item.value->>'price')::numeric end as unit_price,
  case when (item.value->>'total') ~ '^-?[0-9]+(\.[0-9]+)?$' then (item.value->>'total')::numeric end as line_total,
  coalesce(
    case when (item.value->>'cost') ~ '^-?[0-9]+(\.[0-9]+)?$' then (item.value->>'cost')::numeric end,
    case when pl.cost is not null then round(pl.cost::numeric / greatest(coalesce(case when (item.value->>'quantity') ~ '^[0-9]+$' then (item.value->>'quantity')::numeric end, 1), 1), 2) end
  ) as unit_cost,
  coalesce((item.value->>'cost_none')::text = 'true', pl.cost_none, false) as cost_none,
  coalesce(nullif(item.value->>'supplier_id', ''), pl.supplier_id) as supplier_id,
  coalesce(nullif(item.value->>'supplier_name', ''), pl.supplier_name, pl.store) as supplier_name,
  case
    when item.value ? 'cost' then 'order_items'
    when pl.id is not null and pl.cost is not null then 'part_link'
    else 'sin_costo'
  end as cost_source,
  pl.id::text as part_link_id,
  pl.purchase_order_id::text as purchase_order_id
from public."order" o
cross join lateral jsonb_array_elements(case when jsonb_typeof(o.order_items) = 'array' then o.order_items else '[]'::jsonb end) with ordinality as item(value, n)
left join public.part_link pl
  on pl.id::text = item.value->>'source_part_link_id'
 and pl.tenant_id::text = o.tenant_id::text
where coalesce(o.is_deleted, false) = false
  and jsonb_typeof(item.value) = 'object'
  and coalesce(item.value->>'type', 'part') <> 'discount';

comment on view public.order_item_costing is
  'PROPUESTA OLA 2. Solo lectura. Costo y suplidor por linea: primero lo que trae order_items (Android), si falta lo de part_link. Respeta RLS del que consulta (security_invoker).';

revoke all on public.order_item_costing from anon;
grant select on public.order_item_costing to authenticated;
grant select on public.order_item_costing to service_role;

create or replace function public.order_items_preserve_costing()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_keys constant text[] := array['cost', 'cost_none', 'supplier_id', 'supplier_name'];
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_prev jsonb;
  v_key text;
begin
  if new.order_items is null or old.order_items is null then
    return new;
  end if;
  if jsonb_typeof(new.order_items) <> 'array' or jsonb_typeof(old.order_items) <> 'array' then
    return new;
  end if;
  for v_item in select value from jsonb_array_elements(new.order_items) loop
    v_prev := null;
    if jsonb_typeof(v_item) = 'object' and v_item ? 'id' then
      select p.value into v_prev
        from jsonb_array_elements(old.order_items) as p(value)
       where jsonb_typeof(p.value) = 'object'
         and p.value->>'id' = v_item->>'id'
         and coalesce(p.value->>'source_part_link_id', '') = coalesce(v_item->>'source_part_link_id', coalesce(p.value->>'source_part_link_id', ''))
       order by (p.value->>'name' is not distinct from v_item->>'name') desc
       limit 1;
      if v_prev is not null then
        foreach v_key in array v_keys loop
          if not (v_item ? v_key) and (v_prev ? v_key) then
            v_item := v_item || jsonb_build_object(v_key, v_prev->v_key);
          end if;
        end loop;
      end if;
    end if;
    v_out := v_out || jsonb_build_array(v_item);
  end loop;
  new.order_items := v_out;
  return new;
end;
$$;

comment on function public.order_items_preserve_costing() is
  'PROPUESTA OLA 2. Funcion de disparador sin activar: si una app reescribe order_items sin las llaves cost, cost_none, supplier_id o supplier_name de una linea que ya las tenia, las conserva. Nunca borra ni cambia un valor que la app si mando. Se activa con boletos-piezas-activar.sql.';

update public.part_link pl
   set supplier_id = coalesce(pl.supplier_id, nullif(src.item->>'supplier_id', '')),
       supplier_name = coalesce(pl.supplier_name, nullif(src.item->>'supplier_name', '')),
       order_item_id = coalesce(pl.order_item_id, src.item->>'id')
  from (
    select o.tenant_id::text as tenant_id, i.value as item
      from public."order" o
     cross join lateral jsonb_array_elements(case when jsonb_typeof(o.order_items) = 'array' then o.order_items else '[]'::jsonb end) as i(value)
     where jsonb_typeof(i.value) = 'object'
       and nullif(i.value->>'source_part_link_id', '') is not null
  ) src
 where pl.id::text = src.item->>'source_part_link_id'
   and pl.tenant_id::text = src.tenant_id
   and (pl.supplier_id is null or pl.order_item_id is null or (pl.supplier_name is null and nullif(src.item->>'supplier_name', '') is not null));

update public.part_link
   set supplier_name = store
 where supplier_name is null
   and store is not null
   and btrim(store) <> '';

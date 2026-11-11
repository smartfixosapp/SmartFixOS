create or replace function public.update_order_status_v2(
  p_order_id text,
  p_new_status text,
  p_changed_by text,
  p_visible_to_customer boolean default true,
  p_via text default 'directo',
  p_note text default null,
  p_request_id uuid default null,
  p_expected_status text default null,
  p_tenant_id text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_keys constant text[] := array['intake','diagnosing','waiting_parts','por_reparar','in_progress','ready_for_pickup','waiting_customer','pending_order','part_arrived_waiting_device','reparacion_externa','scheduled','warranty','delivered','cancelled','not_repairable','abandoned'];
  v_open constant text[] := array['intake','diagnosing','waiting_parts','por_reparar','in_progress','ready_for_pickup','waiting_customer','pending_order','part_arrived_waiting_device','reparacion_externa','scheduled'];
  v_reopen_to constant text[] := array['intake','diagnosing','waiting_parts','por_reparar','in_progress','ready_for_pickup','waiting_customer','pending_order','part_arrived_waiting_device','reparacion_externa'];
  v_closed constant text[] := array['delivered','cancelled','not_repairable','abandoned'];
  v_vias constant text[] := array['directo','agendar','entrega','cierre','reclamo','reabrir','deshacer'];
  v_via text := coalesce(nullif(btrim(p_via), ''), 'directo');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_actor text := coalesce(nullif(btrim(coalesce(p_changed_by, '')), ''), 'Sistema');
  v_now timestamptz := now();
  v_iso text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_tenant_filter text := '';
  v_current text;
  v_history_text text;
  v_history jsonb;
  v_deleted boolean;
  v_reopen_count integer;
  v_last jsonb;
  v_prev jsonb;
  v_previous text;
  v_last_at timestamptz;
  v_required text;
  v_allowed boolean := false;
  v_reopen boolean := false;
  v_entry jsonb;
  v_rows integer;
begin
  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'boleto_requerido' using errcode = 'PT400';
  end if;
  if p_new_status is null or not (p_new_status = any (v_keys)) then
    raise exception 'estatus_invalido: %', coalesce(p_new_status, 'null') using errcode = 'PT400';
  end if;
  if not (v_via = any (v_vias)) then
    raise exception 'via_invalida: %', v_via using errcode = 'PT400';
  end if;
  if p_tenant_id is not null and btrim(p_tenant_id) <> '' then
    v_tenant_filter := format(' and tenant_id = %L', p_tenant_id);
  end if;

  execute format(
    'select status::text, status_history::text, coalesce(is_deleted, false), coalesce(reopen_count, 0)::integer from public."order" where id = %L%s for update',
    p_order_id, v_tenant_filter
  ) into v_current, v_history_text, v_deleted, v_reopen_count;
  get diagnostics v_rows = row_count;
  if v_rows = 0 or v_deleted then
    raise exception 'boleto_no_encontrado' using errcode = 'PT404';
  end if;

  begin
    v_history := coalesce(v_history_text, '[]')::jsonb;
  exception when others then
    v_history := '[]'::jsonb;
  end;
  if jsonb_typeof(v_history) <> 'array' then
    raise exception 'historial_no_es_lista' using errcode = 'PT409';
  end if;

  if p_request_id is not null and exists (
    select 1 from jsonb_array_elements(v_history) e where e->>'request_id' = p_request_id::text
  ) then
    return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', v_current, 'changed', false, 'repetido', true);
  end if;

  if p_expected_status is not null and v_current is distinct from p_expected_status then
    raise exception 'conflicto_estatus: esperado %, actual %', p_expected_status, coalesce(v_current, 'null') using errcode = 'PT409';
  end if;

  if v_current = p_new_status then
    return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', v_current, 'changed', false, 'repetido', false);
  end if;

  if v_via in ('cierre', 'reclamo', 'reabrir') and coalesce(length(v_note), 0) < 3 then
    raise exception 'nota_requerida' using errcode = 'PT422';
  end if;

  if v_via = 'deshacer' then
    select e.value into v_last
      from jsonb_array_elements(v_history) with ordinality as e(value, n)
     where e.value->>'status' is not null and coalesce(e.value->>'kind', 'status') = 'status'
     order by e.n desc limit 1;
    select e.value into v_prev
      from jsonb_array_elements(v_history) with ordinality as e(value, n)
     where e.value->>'status' is not null and coalesce(e.value->>'kind', 'status') = 'status'
     order by e.n desc offset 1 limit 1;
    v_previous := coalesce(v_last->>'from', v_prev->>'status');
    begin
      v_last_at := (v_last->>'timestamp')::timestamptz;
    exception when others then
      v_last_at := null;
    end;
    if v_previous is null or v_previous <> p_new_status then
      raise exception 'deshacer_no_coincide' using errcode = 'PT422';
    end if;
    if v_last_at is null or v_now - v_last_at > interval '10 minutes' or v_last_at - v_now > interval '1 minute' then
      raise exception 'deshacer_vencido' using errcode = 'PT422';
    end if;
  elsif v_via = 'reabrir' then
    if v_current = any (v_keys) and not (v_current = any (v_closed)) then
      raise exception 'no_esta_cerrado' using errcode = 'PT422';
    end if;
    if not (p_new_status = any (v_reopen_to)) then
      raise exception 'destino_reabrir_invalido' using errcode = 'PT422';
    end if;
    v_reopen := true;
  else
    if v_current is null or not (v_current = any (v_keys)) then
      raise exception 'requiere_flujo: reabrir' using errcode = 'PT422';
    end if;
    v_required := case p_new_status
      when 'scheduled' then 'agendar'
      when 'delivered' then 'entrega'
      when 'cancelled' then 'cierre'
      when 'not_repairable' then 'cierre'
      when 'abandoned' then 'cierre'
      when 'warranty' then 'reclamo'
      else 'directo'
    end;
    if v_via <> v_required then
      raise exception 'requiere_flujo: %', v_required using errcode = 'PT422';
    end if;
    v_allowed := case
      when v_current = any (v_open) then p_new_status <> 'warranty'
      when v_current = 'warranty' then p_new_status = 'in_progress'
      when v_current = 'delivered' then p_new_status = 'warranty'
      else false
    end;
    if not v_allowed then
      if v_current = any (v_closed) then
        raise exception 'requiere_flujo: reabrir' using errcode = 'PT422';
      end if;
      raise exception 'transicion_no_permitida: % a %', v_current, p_new_status using errcode = 'PT422';
    end if;
  end if;

  v_entry := jsonb_strip_nulls(jsonb_build_object(
    'status', p_new_status,
    'from', v_current,
    'timestamp', v_iso,
    'changed_by', v_actor,
    'actor_uid', auth.uid(),
    'note', v_note,
    'visible_to_customer', coalesce(p_visible_to_customer, true),
    'kind', 'status',
    'via', v_via,
    'request_id', p_request_id
  ));

  if v_reopen then
    execute format(
      'update public."order" set status = %L, status_history = %L, updated_date = %L, reopen_count = %L, last_reopen_reason = %L, last_reopen_at = %L where id = %L%s',
      p_new_status, (v_history || jsonb_build_array(v_entry))::text, v_iso, v_reopen_count + 1, v_note, v_iso, p_order_id, v_tenant_filter
    );
  else
    execute format(
      'update public."order" set status = %L, status_history = %L, updated_date = %L where id = %L%s',
      p_new_status, (v_history || jsonb_build_array(v_entry))::text, v_iso, p_order_id, v_tenant_filter
    );
  end if;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'sin_permiso_o_no_encontrado' using errcode = 'PT403';
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', p_new_status,
    'previous_status', v_current,
    'changed', true,
    'repetido', false,
    'reopen', v_reopen,
    'timestamp', v_iso,
    'email_dedupe_key', p_order_id || ':' || p_new_status || ':' || v_iso
  );
end;
$$;

revoke all on function public.update_order_status_v2(text, text, text, boolean, text, text, uuid, text, text) from public;
revoke all on function public.update_order_status_v2(text, text, text, boolean, text, text, uuid, text, text) from anon;
grant execute on function public.update_order_status_v2(text, text, text, boolean, text, text, uuid, text, text) to authenticated;
grant execute on function public.update_order_status_v2(text, text, text, boolean, text, text, uuid, text, text) to service_role;

comment on function public.update_order_status_v2(text, text, text, boolean, text, text, uuid, text, text) is
  'PROPUESTA OLA 2, PENDIENTE DE REVISION DE FRANCIS. NO sustituye a update_order_status: ninguna app la llama todavia. Regla comun de Android (tokens.json transitions), 16 claves, flujo obligatorio para agendar, entrega, cierre, reclamo y reabrir, deshacer en 10 minutos, idempotente por p_request_id y por mismo estatus, conflicto por p_expected_status, historial en status_history con actor, nota, via y request_id. security invoker: respeta RLS del que llama.';

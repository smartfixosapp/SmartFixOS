const FUNCTIONS_BASE_URL = Deno.env.get('VITE_FUNCTION_URL') || 'http://localhost:8585';

function tableNameToEntityName(tableName) {
  if (!tableName || typeof tableName !== 'string') return '';
  return tableName.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('');
}

function normalizePayload(body) {
  if (body.entity_name && body.event_type) {
    return { entityName: body.entity_name, eventType: body.event_type, data: body.data ?? body.record, oldData: body.old_data ?? body.old_record };
  }
  if (body.table && body.type) {
    const eventMap = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };
    return {
      entityName: tableNameToEntityName(body.table),
      eventType: eventMap[body.type] || body.type.toLowerCase(),
      data: body.record ?? body.data,
      oldData: body.old_record ?? body.old_data,
    };
  }
  return null;
}

/**
 * POST /onEntityFnTrigger - Webhook for Supabase DB events or SDK hook.
 */
export async function onEntityFnTriggerHandler(req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const norm = normalizePayload(body);
  if (!norm || !norm.entityName || !norm.eventType) {
    return Response.json({ error: 'Missing entity_name/event_type or table/type' }, { status: 400 });
  }

  const entitiesPath = new URL('../Entities', import.meta.url).pathname;
  const { createClientFromRequest } = await import('../../../../lib/unified-custom-sdk-supabase.js');
  const base44 = createClientFromRequest(req, { functionsBaseUrl: FUNCTIONS_BASE_URL, entitiesPath });

  let rules;
  try {
    rules = await base44.asServiceRole.entities.FnTriggerRule.filter({
      automation_type: 'entity',
      is_active: true,
      is_archived: false,
      entity_name: norm.entityName,
    });
  } catch (e) {
    console.error('Failed to load FnTriggerRule:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }

  const payload = { event: { type: norm.eventType }, data: norm.data, old_data: norm.oldData };
  const results = [];

  for (const r of rules || []) {
    const allowed = !r.event_types?.length || (Array.isArray(r.event_types) && r.event_types.includes(norm.eventType));
    if (!allowed || !r.function_name) continue;

    try {
      const res = await fetch(`${FUNCTIONS_BASE_URL}/${r.function_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const ok = res.ok;
      const resData = await res.json().catch(() => ({}));

      await base44.asServiceRole.entities.FnTriggerRule.update(r.id, {
        last_run_at: new Date().toISOString(),
        last_run_status: ok ? 'success' : 'failure',
        total_runs: (r.total_runs || 0) + 1,
        successful_runs: ok ? (r.successful_runs || 0) + 1 : (r.successful_runs || 0),
        failed_runs: ok ? (r.failed_runs || 0) : (r.failed_runs || 0) + 1,
        consecutive_failures: ok ? 0 : (r.consecutive_failures || 0) + 1,
      });
      results.push({ id: r.id, name: r.name, status: ok ? 'success' : 'failure', data: resData });
    } catch (err) {
      console.error(`FnTriggerRule ${r.id} (${r.function_name}):`, err);
      await base44.asServiceRole.entities.FnTriggerRule.update(r.id, {
        last_run_at: new Date().toISOString(),
        last_run_status: 'failure',
        total_runs: (r.total_runs || 0) + 1,
        failed_runs: (r.failed_runs || 0) + 1,
        consecutive_failures: (r.consecutive_failures || 0) + 1,
      });
      results.push({ id: r.id, name: r.name, status: 'failure', error: err.message });
    }
  }

  return Response.json({ triggered: results.length, results });
}

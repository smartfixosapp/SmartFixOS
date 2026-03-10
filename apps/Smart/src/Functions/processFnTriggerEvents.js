const FUNCTIONS_BASE_URL = Deno.env.get('VITE_FUNCTION_URL') || 'http://localhost:8585';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

function tableNameToEntityName(tableName) {
  if (!tableName || typeof tableName !== 'string') return '';
  return tableName.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('');
}

function pgEventToEventType(pgEvent) {
  const map = { insert: 'create', update: 'update', delete: 'delete' };
  return map[pgEvent] || pgEvent;
}

function isCronAuthorized(req) {
  if (!CRON_SECRET) return true;
  return req.headers.get('x-cron-secret') === CRON_SECRET;
}

/**
 * Process fn_trigger_event queue (Supabase). Call from cron. GET or POST /processFnTriggerEvents
 */
export async function processFnTriggerEventsHandler(req) {
  if (!isCronAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base44 = (await import('../../../../lib/unified-custom-sdk-supabase.js')).createClientFromRequest(req, {
    functionsBaseUrl: FUNCTIONS_BASE_URL,
    entitiesPath: new URL('../Entities', import.meta.url).pathname,
  });

  let events;
  try {
    events = await base44.asServiceRole.entities.FnTriggerEvent.filter(
      { processed_at: { $null: true } },
      'created_at',
      50
    );
  } catch (e) {
    console.error('Failed to load fn_trigger_event:', e);
    return Response.json({ error: e.message, processed: 0 }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return Response.json({ processed: 0, message: 'No pending events' });
  }

  const results = [];

  for (const ev of events) {
    const entityName = tableNameToEntityName(ev.table_name);
    const eventType = pgEventToEventType(ev.event_type);

    let rules;
    try {
      rules = await base44.asServiceRole.entities.FnTriggerRule.filter({
        automation_type: 'entity',
        is_active: true,
        is_archived: false,
        entity_name: entityName,
      });
    } catch (e) {
      await base44.asServiceRole.entities.FnTriggerEvent.update(ev.id, {
        processed_at: new Date().toISOString(),
        error: e.message,
      });
      results.push({ id: ev.id, status: 'error', error: e.message });
      continue;
    }

    const payload = {
      event: { type: eventType },
      data: ev.new_record ?? null,
      old_data: ev.old_record ?? null,
    };

    let lastError = null;
    let ran = 0;

    for (const r of rules || []) {
      const allowed = !r.event_types?.length || (Array.isArray(r.event_types) && r.event_types.includes(eventType));
      if (!allowed || !r.function_name) continue;

      try {
        const res = await fetch(`${FUNCTIONS_BASE_URL}/${r.function_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const ok = res.ok;
        ran++;
        await base44.asServiceRole.entities.FnTriggerRule.update(r.id, {
          last_run_at: new Date().toISOString(),
          last_run_status: ok ? 'success' : 'failure',
          total_runs: (r.total_runs || 0) + 1,
          successful_runs: ok ? (r.successful_runs || 0) + 1 : (r.successful_runs || 0),
          failed_runs: ok ? (r.failed_runs || 0) : (r.failed_runs || 0) + 1,
          consecutive_failures: ok ? 0 : (r.consecutive_failures || 0) + 1,
        });
        if (!ok) {
          const text = await res.text();
          lastError = text.slice(0, 500);
        }
      } catch (err) {
        lastError = err.message;
        ran++;
        await base44.asServiceRole.entities.FnTriggerRule.update(r.id, {
          last_run_at: new Date().toISOString(),
          last_run_status: 'failure',
          total_runs: (r.total_runs || 0) + 1,
          failed_runs: (r.failed_runs || 0) + 1,
          consecutive_failures: (r.consecutive_failures || 0) + 1,
        });
      }
    }

    await base44.asServiceRole.entities.FnTriggerEvent.update(ev.id, {
      processed_at: new Date().toISOString(),
      error: lastError || null,
    });
    results.push({ id: ev.id, table: ev.table_name, event: eventType, automations_run: ran, error: lastError || undefined });
  }

  return Response.json({ processed: results.length, results });
}

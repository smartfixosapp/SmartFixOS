const FUNCTIONS_BASE_URL = Deno.env.get('VITE_FUNCTION_URL') || 'http://localhost:8585';
const DB_BACKEND = Deno.env.get('DB_BACKEND') || 'supabase';

function tableNameToEntityName(tableName) {
  if (!tableName || typeof tableName !== 'string') return '';
  return tableName.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('');
}

function appwriteDocToData(doc) {
  if (!doc) return null;
  const out = { ...doc };
  if (out.$id !== undefined) { out.id = out.$id; delete out.$id; }
  if (out.$createdAt !== undefined) { out.created_at = out.$createdAt; delete out.$createdAt; }
  if (out.$updatedAt !== undefined) { out.updated_at = out.$updatedAt; delete out.$updatedAt; }
  if (out.$collectionId !== undefined) delete out.$collectionId;
  if (out.$databaseId !== undefined) delete out.$databaseId;
  if (out.$permissions !== undefined) delete out.$permissions;
  return out;
}

function normalizeAppwritePayload(body, headers) {
  const eventsHeader = headers?.get?.('X-Appwrite-Webhook-Events') || headers?.['X-Appwrite-Webhook-Events'];
  if (!eventsHeader || !body || typeof body !== 'object') return null;
  const eventStr = (typeof eventsHeader === 'string' ? eventsHeader : '').split(',')[0].trim();
  const match = eventStr.match(/\.documents\.(create|update|delete)$/i);
  if (!match) return null;
  const eventType = match[1].toLowerCase();
  const collectionId = body.$collectionId || (eventStr.match(/\.collections\.([^.]+)\.documents\./) || [])[1];
  if (!collectionId) return null;
  return {
    entityName: tableNameToEntityName(collectionId),
    eventType,
    data: appwriteDocToData(body),
    oldData: body.$old ? appwriteDocToData(body.$old) : null,
  };
}

function normalizeSupabaseOrGenericPayload(body) {
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

function normalizePayload(body, headers = {}) {
  const appwrite = normalizeAppwritePayload(body, headers);
  if (appwrite) return appwrite;
  return normalizeSupabaseOrGenericPayload(body);
}

/**
 * POST /onEntityFnTrigger - Webhook for Supabase/Appwrite DB events or SDK hook.
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

  const norm = normalizePayload(body, req.headers);
  if (!norm || !norm.entityName || !norm.eventType) {
    return Response.json({ error: 'Missing entity_name/event_type, table/type, or Appwrite webhook payload' }, { status: 400 });
  }

  const entitiesPath = new URL('../Entities', import.meta.url).pathname;
  const base44 = DB_BACKEND === 'appwrite'
    ? (await import('../../../../lib/unified-custom-sdk-appwrite.js')).createClientFromRequest(req, { functionsBaseUrl: FUNCTIONS_BASE_URL, entitiesPath })
    : (await import('../../../../lib/unified-custom-sdk-supabase.js')).createClientFromRequest(req, { functionsBaseUrl: FUNCTIONS_BASE_URL, entitiesPath });

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

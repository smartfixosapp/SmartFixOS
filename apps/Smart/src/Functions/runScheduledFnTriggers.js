const FUNCTIONS_BASE_URL = Deno.env.get('VITE_FUNCTION_URL') || 'http://localhost:8585';
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const DB_BACKEND = Deno.env.get('DB_BACKEND') || 'supabase';

function isCronAuthorized(req) {
  if (!CRON_SECRET) return true;
  return req.headers.get('x-cron-secret') === CRON_SECRET;
}

function isScheduledDue(rule, now) {
  if (rule.schedule_mode === 'one_time') {
    if (rule.total_runs >= 1) return false;
    const runAt = rule.one_time_date ? new Date(rule.one_time_date) : null;
    return runAt && now >= runAt;
  }
  if (rule.schedule_mode !== 'recurring') return false;

  const lastRun = rule.last_run_at ? new Date(rule.last_run_at) : null;
  const interval = rule.repeat_interval ?? 1;
  const unit = rule.repeat_unit || 'days';
  const startTime = rule.start_time || '00:00';

  if (unit === 'minutes') {
    if (!lastRun) return true;
    return now >= new Date(lastRun.getTime() + interval * 60 * 1000);
  }
  if (unit === 'hours') {
    if (!lastRun) return true;
    return now >= new Date(lastRun.getTime() + interval * 60 * 60 * 1000);
  }
  if (unit === 'days' || unit === 'weeks') {
    const [hh, mm] = startTime.split(':').map(Number);
    const todayStart = new Date(now);
    todayStart.setUTCHours(hh, mm, 0, 0);
    if (unit === 'weeks') {
      const dayOfWeek = now.getUTCDay();
      const repeatOnDays = rule.repeat_on_days || [dayOfWeek];
      if (!repeatOnDays.includes(dayOfWeek)) return false;
    }
    if (!lastRun) return now >= todayStart;
    const lastRunDay = new Date(lastRun);
    lastRunDay.setUTCHours(0, 0, 0, 0);
    const todayStartDay = new Date(todayStart);
    todayStartDay.setUTCHours(0, 0, 0, 0);
    return todayStartDay > lastRunDay && now >= todayStart;
  }
  return false;
}

/**
 * Run scheduled fn-trigger rules. Call from cron. GET or POST /runScheduledFnTriggers
 */
export async function runScheduledFnTriggersHandler(req) {
  if (!isCronAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitiesPath = new URL('../Entities', import.meta.url).pathname;
  const base44 = DB_BACKEND === 'appwrite'
    ? (await import('../../../../lib/unified-custom-sdk-appwrite.js')).createClientFromRequest(req, { functionsBaseUrl: FUNCTIONS_BASE_URL, entitiesPath })
    : (await import('../../../../lib/unified-custom-sdk-supabase.js')).createClientFromRequest(req, { functionsBaseUrl: FUNCTIONS_BASE_URL, entitiesPath });

  const now = new Date();
  let rules;
  try {
    rules = await base44.asServiceRole.entities.FnTriggerRule.filter({
      automation_type: 'scheduled',
      is_active: true,
      is_archived: false,
    });
  } catch (e) {
    console.error('Failed to load fn_trigger_rule:', e);
    return Response.json({ error: e.message, ran: 0 }, { status: 500 });
  }

  if (!rules || rules.length === 0) {
    return Response.json({ ran: 0, message: 'No scheduled fn-trigger rules' });
  }

  const results = [];
  for (const r of rules) {
    if (!isScheduledDue(r, now)) continue;
    const fnName = r.function_name;
    if (!fnName) continue;

    try {
      const res = await fetch(`${FUNCTIONS_BASE_URL}/${fnName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r.function_args || {}),
      });
      const ok = res.ok;
      const data = await res.json().catch(() => ({}));

      await base44.asServiceRole.entities.FnTriggerRule.update(r.id, {
        last_run_at: now.toISOString(),
        last_run_status: ok ? 'success' : 'failure',
        total_runs: (r.total_runs || 0) + 1,
        successful_runs: ok ? (r.successful_runs || 0) + 1 : (r.successful_runs || 0),
        failed_runs: ok ? (r.failed_runs || 0) : (r.failed_runs || 0) + 1,
        consecutive_failures: ok ? 0 : (r.consecutive_failures || 0) + 1,
      });
      results.push({ id: r.id, name: r.name, status: ok ? 'success' : 'failure', data });
    } catch (err) {
      console.error(`FnTriggerRule ${r.id} (${fnName}):`, err);
      await base44.asServiceRole.entities.FnTriggerRule.update(r.id, {
        last_run_at: now.toISOString(),
        last_run_status: 'failure',
        total_runs: (r.total_runs || 0) + 1,
        failed_runs: (r.failed_runs || 0) + 1,
        consecutive_failures: (r.consecutive_failures || 0) + 1,
      });
      results.push({ id: r.id, name: r.name, status: 'failure', error: err.message });
    }
  }

  return Response.json({ ran: results.length, results });
}

# Fn-Trigger Rules (Schedule + Entity Events)

All apps include **fn-trigger rules**: run Deno functions on a **schedule** or when an **entity event** (create/update/delete) occurs. Uses Deno + Supabase or Deno + Appwrite only.

## Naming

- **fn_trigger_rule** (Supabase table / Appwrite collection): stores rules
- **FnTriggerRule** (entity)
- **fn_trigger_event** (Supabase only): queue for Postgres trigger output
- **FnTriggerEvent** (entity)

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/runScheduledFnTriggers` | Run due scheduled rules (call from cron). Header: `x-cron-secret` if `CRON_SECRET` set. |
| `/onEntityFnTrigger` | Webhook for Supabase/Appwrite DB events or SDK hook. |
| `/processFnTriggerEvents` | Process fn_trigger_event queue (Supabase). Call from cron. |

## Setup

1. **Seeds** (Supabase): Run `005_fn_trigger_rule.sql`, `006_fn_trigger_event.sql`, `007_fn_trigger_data.sql` (generated with Base44 automations data).

2. **Cron**: When you start the functions server with `./start-functions-server.sh` (or `./start.sh`), a built-in loop runs every `FN_TRIGGER_CRON_INTERVAL` seconds (default 120) and calls `/runScheduledFnTriggers` and `/processFnTriggerEvents`. Set `CRON_SECRET` in `.env` and the script sends it as `x-cron-secret`. To use an external cron instead, disable this by stopping the functions server and calling the endpoints yourself (e.g. cron job with `curl`).

3. **Entity events**:
   - **Supabase**: Attach the trigger from `006_fn_trigger_event.sql` to your tables, or use Database Webhooks → `/onEntityFnTrigger`.
   - **Appwrite**: Use Database webhooks → `/onEntityFnTrigger`, or enable `fireEntityEventOnMutation: true` in the client.

4. **Appwrite**: Set `DB_BACKEND=appwrite`. Create `fn_trigger_rule` collection with same attributes as the Supabase table.

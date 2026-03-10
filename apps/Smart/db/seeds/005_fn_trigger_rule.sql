-- fn_trigger_rule: store schedule and entity-triggered function rules.
-- Supabase table; for Appwrite create collection fn_trigger_rule with same attributes.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."fn_trigger_rule" (
  id text PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,

  automation_type text NOT NULL CHECK (automation_type IN ('scheduled', 'entity')),
  name text NOT NULL,
  description text,
  function_name text NOT NULL,
  function_args jsonb,
  is_active boolean DEFAULT true,
  is_archived boolean DEFAULT false,

  last_run_at timestamptz,
  last_run_status text CHECK (last_run_status IN ('success', 'failure')),
  total_runs integer DEFAULT 0,
  successful_runs integer DEFAULT 0,
  failed_runs integer DEFAULT 0,
  consecutive_failures integer DEFAULT 0,

  schedule_mode text CHECK (schedule_mode IN ('recurring', 'one_time')),
  one_time_date timestamptz,
  schedule_type text CHECK (schedule_type IN ('simple', 'cron')),
  repeat_interval integer,
  repeat_unit text CHECK (repeat_unit IN ('minutes', 'hours', 'days', 'weeks')),
  start_time text,
  repeat_on_days integer[],
  repeat_on_day_of_month integer,
  cron_expression text,
  ends_type text CHECK (ends_type IN ('never', 'on_date', 'after_count')),
  ends_on_date timestamptz,
  ends_after_count integer,

  entity_name text,
  event_types text[] CHECK (event_types <@ ARRAY['create', 'update', 'delete']::text[])
);

CREATE OR REPLACE FUNCTION fn_trigger_rule_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "fn_trigger_rule_set_updated_at_trg" ON "public"."fn_trigger_rule";
CREATE TRIGGER "fn_trigger_rule_set_updated_at_trg"
BEFORE UPDATE ON "public"."fn_trigger_rule"
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_rule_set_updated_at();

COMMIT;

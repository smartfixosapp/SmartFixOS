-- fn_trigger_event: queue for Postgres table events. Processed by processFnTriggerEvents.
-- Attach triggers to tables that have entity fn-trigger rules (see comments below).
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."fn_trigger_event" (
  id text PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  table_name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  new_record jsonb,
  old_record jsonb,

  processed_at timestamptz,
  error text
);
ALTER TABLE "public"."fn_trigger_event" ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS fn_trigger_event_unprocessed
  ON "public"."fn_trigger_event" (created_at)
  WHERE processed_at IS NULL;

-- Grant permissions so trigger can fire regardless of which role updates a table
DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON "public"."fn_trigger_event" TO authenticated';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON "public"."fn_trigger_event" TO anon';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."fn_trigger_event" TO service_role';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- SECURITY DEFINER ensures the trigger can always INSERT regardless of caller role
CREATE OR REPLACE FUNCTION fn_trigger_event_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  new_j jsonb;
  old_j jsonb;
  op text;
BEGIN
  op := lower(TG_OP);
  new_j := NULL;
  old_j := NULL;
  IF TG_OP = 'INSERT' THEN
    new_j := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    new_j := to_jsonb(NEW);
    old_j := to_jsonb(OLD);
  ELSIF TG_OP = 'DELETE' THEN
    old_j := to_jsonb(OLD);
  END IF;

  INSERT INTO "public"."fn_trigger_event" (table_name, event_type, new_record, old_record)
  VALUES (TG_TABLE_NAME, op, new_j, old_j);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to the "order" table (enables handleOrderStatusChange emails)
DROP TRIGGER IF EXISTS fn_trigger_event_trg ON "public"."order";
CREATE TRIGGER fn_trigger_event_trg
  AFTER INSERT OR UPDATE OR DELETE ON "public"."order"
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_event_trigger_fn();

COMMIT;

-- ============================================================
-- 017_shift_tasks.sql
-- Tablas para el sistema de tareas de apertura/cierre de turno
-- ============================================================

-- ── shift_task — Tareas configuradas por el admin ────────────
CREATE TABLE IF NOT EXISTS "public"."shift_task" (
  id text PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "title" text NOT NULL,
  "description" text,
  "type" text CHECK ("type" IN ('opening', 'closing')) NOT NULL DEFAULT 'opening',
  "priority" text CHECK ("priority" IN ('normal', 'urgent')) DEFAULT 'normal',
  "assigned_to_employee_id" text,
  "assigned_to_role" text,
  "active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "tenant_id" text
);

-- ── shift_task_log — Registro de completaciones por empleado ─
CREATE TABLE IF NOT EXISTS "public"."shift_task_log" (
  id text PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "task_id" text NOT NULL,
  "task_title" text,
  "task_type" text CHECK ("task_type" IN ('opening', 'closing')),
  "employee_id" text NOT NULL,
  "employee_name" text,
  "shift_date" text NOT NULL,
  "session_started_at" timestamptz,
  "completed_at" timestamptz,
  "tenant_id" text
);

-- ── Índices para queries frecuentes ─────────────────────────
CREATE INDEX IF NOT EXISTS shift_task_active_idx ON "public"."shift_task" (active, sort_order);
CREATE INDEX IF NOT EXISTS shift_task_log_employee_date_idx ON "public"."shift_task_log" (employee_id, shift_date);
CREATE INDEX IF NOT EXISTS shift_task_log_task_date_idx ON "public"."shift_task_log" (task_id, shift_date);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS update_shift_task_updated_at ON "public"."shift_task";
CREATE TRIGGER update_shift_task_updated_at
  BEFORE UPDATE ON "public"."shift_task"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_task_log_updated_at ON "public"."shift_task_log";
CREATE TRIGGER update_shift_task_log_updated_at
  BEFORE UPDATE ON "public"."shift_task_log"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE "public"."shift_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shift_task_log" ENABLE ROW LEVEL SECURITY;

-- Políticas anon permisivas (igual que el resto de tablas del sistema)
DROP POLICY IF EXISTS "shift_task_anon" ON "public"."shift_task";
CREATE POLICY "shift_task_anon" ON "public"."shift_task"
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shift_task_log_anon" ON "public"."shift_task_log";
CREATE POLICY "shift_task_log_anon" ON "public"."shift_task_log"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Políticas authenticated
DROP POLICY IF EXISTS "shift_task_authenticated" ON "public"."shift_task";
CREATE POLICY "shift_task_authenticated" ON "public"."shift_task"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shift_task_log_authenticated" ON "public"."shift_task_log";
CREATE POLICY "shift_task_log_authenticated" ON "public"."shift_task_log"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

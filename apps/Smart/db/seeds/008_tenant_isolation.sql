-- ================================================================
-- Phase 4: Multi-tenant isolation
-- Adds tenant_id to all core business tables
-- Adds auth_id to users table for Supabase Auth linking
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS column)
-- ================================================================

-- ==============================
-- USERS: add auth_id + tenant_id
-- ==============================
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "auth_id" text;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "tenant_id" text;

-- ==============================
-- APP_EMPLOYEE: add tenant_id
-- ==============================
ALTER TABLE "public"."app_employee" ADD COLUMN IF NOT EXISTS "tenant_id" text;

-- ==============================
-- Core business tables: add tenant_id
-- ==============================
ALTER TABLE "public"."customer" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."order" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."product" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."service" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."transaction" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."cash_register" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."sale" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."invoice" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."supplier" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."purchase_order" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."inventory_movement" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."notification" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."notification_rule" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."notification_settings" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."email_template" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."email_log" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."work_order_config" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."work_order_wizard_config" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."work_order_event" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."sequence_counter" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."technician_profile" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."technician_metrics" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."employee_payment" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."discount_code" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."time_entry" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."cash_drawer_movement" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."fixed_expense" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."one_time_expense" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."announcement" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."system_config" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."biometric_credential" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."recharge" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."customer_segment" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."customer_portal_token" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."audit_log" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."personal_note" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."appointment" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."key_value" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."communication_history" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."communication_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."maintenance_reminder" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."external_link" ADD COLUMN IF NOT EXISTS "tenant_id" text;
ALTER TABLE "public"."file_upload" ADD COLUMN IF NOT EXISTS "tenant_id" text;

-- ==============================
-- Indexes for query performance
-- ==============================
CREATE INDEX IF NOT EXISTS idx_users_tenant_id         ON "public"."users"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_users_auth_id            ON "public"."users"("auth_id");
CREATE INDEX IF NOT EXISTS idx_app_employee_tenant_id   ON "public"."app_employee"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_customer_tenant_id       ON "public"."customer"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_order_tenant_id          ON "public"."order"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_product_tenant_id        ON "public"."product"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_service_tenant_id        ON "public"."service"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_transaction_tenant_id    ON "public"."transaction"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_sale_tenant_id           ON "public"."sale"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_cash_register_tenant_id  ON "public"."cash_register"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant_id   ON "public"."app_settings"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_email_template_tenant_id ON "public"."email_template"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_time_entry_tenant_id     ON "public"."time_entry"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id      ON "public"."audit_log"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_sequence_counter_tid     ON "public"."sequence_counter"("tenant_id");

-- ==============================
-- Row Level Security (RLS)
-- Safety net for direct Supabase client queries.
-- Service role bypasses RLS automatically.
-- Authenticated users (store owners via Supabase Auth) can only
-- see records where tenant_id matches their auth_id in users table.
-- ==============================

-- Helper function: resolves tenant_id from auth.uid()
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

-- Enable RLS on core tables
ALTER TABLE "public"."users"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."customer"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."service"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transaction"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cash_register"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sale"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoice"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."supplier"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."purchase_order"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inventory_movement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_template"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_settings"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."work_order_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sequence_counter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."time_entry"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."employee_payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discount_code"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_log"        ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- RLS Policies: allow anon to read users (needed for PIN login screen)
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "users_anon_read" ON "public"."users";
CREATE POLICY "users_anon_read" ON "public"."users"
  FOR SELECT TO anon
  USING (true);  -- anon can read all users (needed for PIN login list)

-- -----------------------------------------------------------------------
-- RLS Policies: authenticated users see only their tenant's data
-- -----------------------------------------------------------------------

-- users table: authenticated can manage their own tenant's users
DROP POLICY IF EXISTS "users_tenant_isolation" ON "public"."users";
CREATE POLICY "users_tenant_isolation" ON "public"."users"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

-- Macro for all other tenant-isolated tables
-- (service role bypasses all, authenticated filtered by tenant)

DROP POLICY IF EXISTS "customer_tenant" ON "public"."customer";
CREATE POLICY "customer_tenant" ON "public"."customer"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "order_tenant" ON "public"."order";
CREATE POLICY "order_tenant" ON "public"."order"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "product_tenant" ON "public"."product";
CREATE POLICY "product_tenant" ON "public"."product"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "service_tenant" ON "public"."service";
CREATE POLICY "service_tenant" ON "public"."service"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "transaction_tenant" ON "public"."transaction";
CREATE POLICY "transaction_tenant" ON "public"."transaction"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "sale_tenant" ON "public"."sale";
CREATE POLICY "sale_tenant" ON "public"."sale"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "email_template_tenant" ON "public"."email_template";
CREATE POLICY "email_template_tenant" ON "public"."email_template"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "app_settings_tenant" ON "public"."app_settings";
CREATE POLICY "app_settings_tenant" ON "public"."app_settings"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "time_entry_tenant" ON "public"."time_entry";
CREATE POLICY "time_entry_tenant" ON "public"."time_entry"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "audit_log_tenant" ON "public"."audit_log";
CREATE POLICY "audit_log_tenant" ON "public"."audit_log"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

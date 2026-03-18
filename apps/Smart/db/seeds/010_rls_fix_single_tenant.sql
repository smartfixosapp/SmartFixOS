-- ================================================================
-- Migration 010: Fix RLS for single-tenant compatibility
--
-- PROBLEM:
--   Phase 4 (008) enabled RLS on all tables but the WITH CHECK
--   clauses require `tenant_id = get_my_tenant_id()`.
--   PIN-authenticated users have no Supabase Auth session, so they
--   run as the `anon` role → get_my_tenant_id() returns NULL →
--   ALL writes fail with "violates row-level security policy".
--
-- FIX:
--   1. All WITH CHECK clauses → add OR tenant_id IS NULL
--      (allows writing records that are not yet tenant-scoped)
--   2. Add `anon` policies for all operational tables
--      (PIN users = anon; they need full CRUD on all data)
--   3. Add missing policies for tables that had RLS enabled
--      but no policy at all (invoice, supplier, purchase_order,
--      inventory_movement, work_order_config, sequence_counter)
--
-- SECURITY NOTE:
--   This is intentional for the single-tenant deployment phase.
--   Multi-tenant RLS hardening happens when multiple tenants are
--   active and each user has a proper Supabase Auth JWT with
--   their tenant_id encoded via get_my_tenant_id().
-- ================================================================

-- ─── users ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_tenant_isolation" ON "public"."users";
CREATE POLICY "users_tenant_isolation" ON "public"."users"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "users_anon_write" ON "public"."users";
CREATE POLICY "users_anon_write" ON "public"."users"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── customer ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "customer_tenant" ON "public"."customer";
CREATE POLICY "customer_tenant" ON "public"."customer"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "customer_anon" ON "public"."customer";
CREATE POLICY "customer_anon" ON "public"."customer"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── order ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "order_tenant" ON "public"."order";
CREATE POLICY "order_tenant" ON "public"."order"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "order_anon" ON "public"."order";
CREATE POLICY "order_anon" ON "public"."order"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── product ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "product_tenant" ON "public"."product";
CREATE POLICY "product_tenant" ON "public"."product"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "product_anon" ON "public"."product";
CREATE POLICY "product_anon" ON "public"."product"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── service ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_tenant" ON "public"."service";
CREATE POLICY "service_tenant" ON "public"."service"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "service_anon" ON "public"."service";
CREATE POLICY "service_anon" ON "public"."service"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── transaction ────────────────────────────────────────────────
DROP POLICY IF EXISTS "transaction_tenant" ON "public"."transaction";
CREATE POLICY "transaction_tenant" ON "public"."transaction"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "transaction_anon" ON "public"."transaction";
CREATE POLICY "transaction_anon" ON "public"."transaction"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── cash_register ──────────────────────────────────────────────
DROP POLICY IF EXISTS "cash_register_anon" ON "public"."cash_register";
CREATE POLICY "cash_register_anon" ON "public"."cash_register"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── sale ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sale_tenant" ON "public"."sale";
CREATE POLICY "sale_tenant" ON "public"."sale"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "sale_anon" ON "public"."sale";
CREATE POLICY "sale_anon" ON "public"."sale"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── invoice ────────────────────────────────────────────────────
-- (had RLS enabled in 008 but no policy → was fully blocked)
DROP POLICY IF EXISTS "invoice_tenant" ON "public"."invoice";
CREATE POLICY "invoice_tenant" ON "public"."invoice"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "invoice_anon" ON "public"."invoice";
CREATE POLICY "invoice_anon" ON "public"."invoice"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── supplier ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "supplier_tenant" ON "public"."supplier";
CREATE POLICY "supplier_tenant" ON "public"."supplier"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "supplier_anon" ON "public"."supplier";
CREATE POLICY "supplier_anon" ON "public"."supplier"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── purchase_order ─────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_order_tenant" ON "public"."purchase_order";
CREATE POLICY "purchase_order_tenant" ON "public"."purchase_order"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "purchase_order_anon" ON "public"."purchase_order";
CREATE POLICY "purchase_order_anon" ON "public"."purchase_order"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── inventory_movement ─────────────────────────────────────────
DROP POLICY IF EXISTS "inventory_movement_tenant" ON "public"."inventory_movement";
CREATE POLICY "inventory_movement_tenant" ON "public"."inventory_movement"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "inventory_movement_anon" ON "public"."inventory_movement";
CREATE POLICY "inventory_movement_anon" ON "public"."inventory_movement"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── email_template ─────────────────────────────────────────────
DROP POLICY IF EXISTS "email_template_tenant" ON "public"."email_template";
CREATE POLICY "email_template_tenant" ON "public"."email_template"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "email_template_anon" ON "public"."email_template";
CREATE POLICY "email_template_anon" ON "public"."email_template"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── app_settings ───────────────────────────────────────────────
DROP POLICY IF EXISTS "app_settings_tenant" ON "public"."app_settings";
CREATE POLICY "app_settings_tenant" ON "public"."app_settings"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "app_settings_anon" ON "public"."app_settings";
CREATE POLICY "app_settings_anon" ON "public"."app_settings"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── work_order_config ──────────────────────────────────────────
DROP POLICY IF EXISTS "work_order_config_anon" ON "public"."work_order_config";
CREATE POLICY "work_order_config_anon" ON "public"."work_order_config"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── sequence_counter ───────────────────────────────────────────
DROP POLICY IF EXISTS "sequence_counter_anon" ON "public"."sequence_counter";
CREATE POLICY "sequence_counter_anon" ON "public"."sequence_counter"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── time_entry ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "time_entry_tenant" ON "public"."time_entry";
CREATE POLICY "time_entry_tenant" ON "public"."time_entry"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "time_entry_anon" ON "public"."time_entry";
CREATE POLICY "time_entry_anon" ON "public"."time_entry"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── employee_payment ───────────────────────────────────────────
DROP POLICY IF EXISTS "employee_payment_tenant" ON "public"."employee_payment";
CREATE POLICY "employee_payment_tenant" ON "public"."employee_payment"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "employee_payment_anon" ON "public"."employee_payment";
CREATE POLICY "employee_payment_anon" ON "public"."employee_payment"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── discount_code ──────────────────────────────────────────────
DROP POLICY IF EXISTS "discount_code_tenant" ON "public"."discount_code";
CREATE POLICY "discount_code_tenant" ON "public"."discount_code"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "discount_code_anon" ON "public"."discount_code";
CREATE POLICY "discount_code_anon" ON "public"."discount_code"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

-- ─── audit_log ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_log_tenant" ON "public"."audit_log";
CREATE POLICY "audit_log_tenant" ON "public"."audit_log"
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = get_my_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "audit_log_anon" ON "public"."audit_log";
CREATE POLICY "audit_log_anon" ON "public"."audit_log"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (tenant_id IS NULL);

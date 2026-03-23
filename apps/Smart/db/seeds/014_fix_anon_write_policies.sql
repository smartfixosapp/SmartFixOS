-- ================================================================
-- Fix: Permitir escrituras anon con tenant_id (modo single-tenant)
-- Las políticas anon previas bloqueaban todo INSERT/UPDATE donde
-- tenant_id != NULL. Con PIN auth, todos los usuarios son 'anon'
-- para Supabase, así que los writes fallaban silenciosamente.
-- ================================================================

-- order
DROP POLICY IF EXISTS "order_anon" ON "public"."order";
CREATE POLICY "order_anon" ON "public"."order"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- customer
DROP POLICY IF EXISTS "customer_anon" ON "public"."customer";
CREATE POLICY "customer_anon" ON "public"."customer"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- transaction
DROP POLICY IF EXISTS "transaction_anon" ON "public"."transaction";
CREATE POLICY "transaction_anon" ON "public"."transaction"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- sale
DROP POLICY IF EXISTS "sale_anon" ON "public"."sale";
CREATE POLICY "sale_anon" ON "public"."sale"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- product
DROP POLICY IF EXISTS "product_anon" ON "public"."product";
CREATE POLICY "product_anon" ON "public"."product"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- service
DROP POLICY IF EXISTS "service_anon" ON "public"."service";
CREATE POLICY "service_anon" ON "public"."service"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- cash_register
DROP POLICY IF EXISTS "cash_register_anon" ON "public"."cash_register";
CREATE POLICY "cash_register_anon" ON "public"."cash_register"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- invoice
DROP POLICY IF EXISTS "invoice_anon" ON "public"."invoice";
CREATE POLICY "invoice_anon" ON "public"."invoice"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- supplier
DROP POLICY IF EXISTS "supplier_anon" ON "public"."supplier";
CREATE POLICY "supplier_anon" ON "public"."supplier"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- purchase_order
DROP POLICY IF EXISTS "purchase_order_anon" ON "public"."purchase_order";
CREATE POLICY "purchase_order_anon" ON "public"."purchase_order"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- inventory_movement
DROP POLICY IF EXISTS "inventory_movement_anon" ON "public"."inventory_movement";
CREATE POLICY "inventory_movement_anon" ON "public"."inventory_movement"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- email_template
DROP POLICY IF EXISTS "email_template_anon" ON "public"."email_template";
CREATE POLICY "email_template_anon" ON "public"."email_template"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- app_settings
DROP POLICY IF EXISTS "app_settings_anon" ON "public"."app_settings";
CREATE POLICY "app_settings_anon" ON "public"."app_settings"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- work_order_config
DROP POLICY IF EXISTS "work_order_config_anon" ON "public"."work_order_config";
CREATE POLICY "work_order_config_anon" ON "public"."work_order_config"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- sequence_counter
DROP POLICY IF EXISTS "sequence_counter_anon" ON "public"."sequence_counter";
CREATE POLICY "sequence_counter_anon" ON "public"."sequence_counter"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- time_entry
DROP POLICY IF EXISTS "time_entry_anon" ON "public"."time_entry";
CREATE POLICY "time_entry_anon" ON "public"."time_entry"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- employee_payment
DROP POLICY IF EXISTS "employee_payment_anon" ON "public"."employee_payment";
CREATE POLICY "employee_payment_anon" ON "public"."employee_payment"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- discount_code
DROP POLICY IF EXISTS "discount_code_anon" ON "public"."discount_code";
CREATE POLICY "discount_code_anon" ON "public"."discount_code"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- audit_log
DROP POLICY IF EXISTS "audit_log_anon" ON "public"."audit_log";
CREATE POLICY "audit_log_anon" ON "public"."audit_log"
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- users
DROP POLICY IF EXISTS "users_anon_write" ON "public"."users";
CREATE POLICY "users_anon_write" ON "public"."users"
  FOR ALL TO anon USING (true) WITH CHECK (true);

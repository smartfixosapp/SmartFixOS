-- =====================================================
-- 019_plan_system.sql
-- SmartFixOS Plan System — Starter / Pro / Business
-- =====================================================

-- 1. Update tenant.plan to accept new plan values
-- (plan column is text, no enum constraint — just update existing data)

UPDATE tenant SET plan = 'starter' WHERE plan IN ('smartfixos', 'basic');
UPDATE tenant SET plan = 'business' WHERE plan = 'enterprise';

-- 2. Update monthly_cost to match new pricing
UPDATE tenant SET monthly_cost = 14.99  WHERE plan = 'starter';
UPDATE tenant SET monthly_cost = 39.99  WHERE plan = 'pro';
UPDATE tenant SET monthly_cost = 79.99  WHERE plan = 'business';

-- 3. Create plan_limits table — stores active limits per tenant (denormalized for fast RLS queries)
CREATE TABLE IF NOT EXISTS plan_limits (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  tenant_id       text NOT NULL,
  plan            text NOT NULL DEFAULT 'starter',

  -- Numeric limits (-1 = unlimited)
  max_users           int NOT NULL DEFAULT 1,
  max_active_orders   int NOT NULL DEFAULT 50,
  max_customers       int NOT NULL DEFAULT 200,
  max_skus            int NOT NULL DEFAULT 100,
  max_custom_statuses int NOT NULL DEFAULT 0,
  max_cash_registers  int NOT NULL DEFAULT 0,
  max_roles           int NOT NULL DEFAULT 0,

  -- Feature flags (boolean)
  f_orders_assign_technician bool NOT NULL DEFAULT false,
  f_orders_internal_notes    bool NOT NULL DEFAULT false,
  f_orders_photos            bool NOT NULL DEFAULT false,
  f_orders_change_history    bool NOT NULL DEFAULT false,

  f_customers_tags           bool NOT NULL DEFAULT false,
  f_customers_segments       bool NOT NULL DEFAULT false,

  f_workflow_custom          bool NOT NULL DEFAULT false,

  f_inventory_alerts         bool NOT NULL DEFAULT false,
  f_inventory_costs          bool NOT NULL DEFAULT false,
  f_inventory_suppliers      bool NOT NULL DEFAULT false,
  f_inventory_purchase_orders bool NOT NULL DEFAULT false,
  f_inventory_reorder        bool NOT NULL DEFAULT false,

  f_pos_cash_open_close      bool NOT NULL DEFAULT false,
  f_pos_discounts            bool NOT NULL DEFAULT false,
  f_pos_credit_notes         bool NOT NULL DEFAULT false,
  f_pos_multi_register       bool NOT NULL DEFAULT false,

  f_reports_by_technician    bool NOT NULL DEFAULT false,
  f_reports_by_service       bool NOT NULL DEFAULT false,
  f_reports_export_csv       bool NOT NULL DEFAULT false,
  f_reports_financial        bool NOT NULL DEFAULT false,
  f_reports_export_pdf       bool NOT NULL DEFAULT false,

  f_permissions_roles        bool NOT NULL DEFAULT false,
  f_permissions_custom       bool NOT NULL DEFAULT false,

  f_automations_triggers     bool NOT NULL DEFAULT false,
  f_automations_emails       bool NOT NULL DEFAULT false,
  f_automations_scheduled    bool NOT NULL DEFAULT false,

  f_api_access               bool NOT NULL DEFAULT false,
  f_priority_support         bool NOT NULL DEFAULT false
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_plan_limits_tenant ON plan_limits(tenant_id);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_plan_limits_updated_at
  BEFORE UPDATE ON plan_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. RLS on plan_limits
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_limits_tenant_read ON plan_limits
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT (raw_user_meta_data->>'tenant_id') FROM auth.users WHERE id = auth.uid()));

-- Service role can do everything (bypasses RLS automatically)

-- 5. Seed plan_limits for existing tenants
INSERT INTO plan_limits (tenant_id, plan, max_users, max_active_orders, max_customers, max_skus,
  max_custom_statuses, max_cash_registers, max_roles,
  f_orders_assign_technician, f_orders_internal_notes, f_orders_photos, f_orders_change_history,
  f_customers_tags, f_customers_segments, f_workflow_custom,
  f_inventory_alerts, f_inventory_costs, f_inventory_suppliers, f_inventory_purchase_orders, f_inventory_reorder,
  f_pos_cash_open_close, f_pos_discounts, f_pos_credit_notes, f_pos_multi_register,
  f_reports_by_technician, f_reports_by_service, f_reports_export_csv, f_reports_financial, f_reports_export_pdf,
  f_permissions_roles, f_permissions_custom,
  f_automations_triggers, f_automations_emails, f_automations_scheduled,
  f_api_access, f_priority_support)
SELECT
  t.id AS tenant_id,
  t.plan,
  -- Limits based on plan
  CASE t.plan WHEN 'pro' THEN 5 WHEN 'business' THEN 10 ELSE 1 END,
  CASE t.plan WHEN 'starter' THEN 50 ELSE -1 END,
  CASE t.plan WHEN 'starter' THEN 200 ELSE -1 END,
  CASE t.plan WHEN 'starter' THEN 100 WHEN 'pro' THEN 1000 ELSE -1 END,
  CASE t.plan WHEN 'pro' THEN 12 WHEN 'business' THEN -1 ELSE 0 END,
  CASE t.plan WHEN 'pro' THEN 1 WHEN 'business' THEN 3 ELSE 0 END,
  CASE t.plan WHEN 'pro' THEN 3 WHEN 'business' THEN -1 ELSE 0 END,
  -- Feature flags
  t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'),
  t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'),
  t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'),
  t.plan = 'business',
  t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'),
  t.plan = 'business',
  t.plan IN ('pro','business'), t.plan IN ('pro','business'), t.plan IN ('pro','business'),
  t.plan = 'business', t.plan = 'business',
  t.plan IN ('pro','business'), t.plan = 'business',
  t.plan = 'business', t.plan = 'business', t.plan = 'business',
  t.plan = 'business', t.plan = 'business'
FROM tenant t
WHERE NOT EXISTS (SELECT 1 FROM plan_limits pl WHERE pl.tenant_id = t.id);

-- 6. Update subscription table to match new plan names
UPDATE subscription SET plan = 'starter' WHERE plan IN ('smartfixos', 'basic');
UPDATE subscription SET plan = 'business' WHERE plan = 'enterprise';

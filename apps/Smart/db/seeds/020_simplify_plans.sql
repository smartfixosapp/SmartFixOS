-- =====================================================
-- 020_simplify_plans.sql
-- SmartFixOS — Simplified plan system
-- Only 2 plans (Starter / Pro), only 3 quantity limits
-- =====================================================

-- 1. Consolidate business → pro on existing tenants
UPDATE tenant SET plan = 'pro', monthly_cost = 39.99 WHERE plan = 'business';
UPDATE tenant SET plan = 'starter', monthly_cost = 14.99 WHERE plan IN ('smartfixos', 'basic');
UPDATE tenant SET monthly_cost = 14.99 WHERE plan = 'starter';
UPDATE tenant SET monthly_cost = 39.99 WHERE plan = 'pro';

UPDATE subscription SET plan = 'pro', amount = 39.99 WHERE plan = 'business';
UPDATE subscription SET plan = 'starter', amount = 14.99 WHERE plan IN ('smartfixos', 'basic');

-- 2. Drop the plan_limits table from migration 019 (no longer needed — limits live in code)
DROP TABLE IF EXISTS plan_limits CASCADE;

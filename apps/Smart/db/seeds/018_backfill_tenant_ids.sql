-- ============================================================
-- 018_backfill_tenant_ids.sql
-- Rellena tenant_id en registros históricos de app_employee
-- y app_settings que fueron creados antes del sistema multi-tenant.
-- Asigna el tenant más antiguo (primer tenant registrado).
-- Safe to run multiple times (WHERE tenant_id IS NULL).
-- ============================================================

-- Backfill app_employee: empleados sin tenant_id → primer tenant
UPDATE "public"."app_employee"
SET "tenant_id" = (
  SELECT "id" FROM "public"."tenant"
  ORDER BY "created_at" ASC
  LIMIT 1
)
WHERE "tenant_id" IS NULL;

-- Backfill app_settings: configuraciones sin tenant_id → primer tenant
UPDATE "public"."app_settings"
SET "tenant_id" = (
  SELECT "id" FROM "public"."tenant"
  ORDER BY "created_at" ASC
  LIMIT 1
)
WHERE "tenant_id" IS NULL;

-- Verificar resultados:
-- SELECT COUNT(*) FROM app_employee WHERE tenant_id IS NULL;  -- debe ser 0
-- SELECT COUNT(*) FROM app_settings WHERE tenant_id IS NULL;  -- debe ser 0

-- ============================================================
-- 004_fix_missing_columns.sql
-- Columnas faltantes detectadas en QA (Fase 9)
-- ============================================================

-- === device_model: columna 'family' desnormalizada ===
-- Ya existe 'brand' desnormalizado junto a 'brand_id';
-- se añade 'family' igual para lookups rápidos sin JOIN.
ALTER TABLE "public"."device_model"
  ADD COLUMN IF NOT EXISTS "family" text NULL;

-- === app_employee: columna 'tenant_id' para multi-tenant ===
-- Sin esta columna el filtro tenant_id retorna 0 registros.
ALTER TABLE "public"."app_employee"
  ADD COLUMN IF NOT EXISTS "tenant_id" text NULL;

CREATE INDEX IF NOT EXISTS "app_employee_tenant_id_idx"
  ON "public"."app_employee" ("tenant_id");

-- Actualiza registros existentes si hay un solo tenant activo
-- (el tenant_id se propagará automáticamente en nuevas sesiones)
-- UPDATE "public"."app_employee" SET "tenant_id" = '<tu-tenant-id>' WHERE "tenant_id" IS NULL;

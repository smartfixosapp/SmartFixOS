-- =============================================================================
-- 012_catalog_tenant_isolation.sql
--
-- Permite que las tablas del catálogo sean COMPARTIDAS (global + por tenant):
--   • tenant_id IS NULL  →  registro global (visible para todos, no editable)
--   • tenant_id = X      →  registro propio de la tienda X
--
-- Los datos insertados en 011_catalog_data.sql quedan como globales (NULL).
-- Cualquier registro nuevo creado desde el sistema tendrá el tenant_id de la
-- tienda que lo creó, y solo esa tienda lo verá.
-- =============================================================================

ALTER TABLE "public"."brand"          ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE "public"."device_family"  ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE "public"."device_model"   ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE "public"."device_subcategory" ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;

-- Índices para performance en filtros combinados (IS NULL OR = tenantId)
CREATE INDEX IF NOT EXISTS idx_brand_tenant_id          ON "public"."brand"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_family_tenant_id  ON "public"."device_family"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_model_tenant_id   ON "public"."device_model"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_subcategory_tenant_id ON "public"."device_subcategory"(tenant_id);

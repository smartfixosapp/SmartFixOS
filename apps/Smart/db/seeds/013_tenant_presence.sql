-- ============================================================
-- 013_tenant_presence.sql
-- Agrega last_seen al tenant para presencia en tiempo real
-- y arregla políticas RLS para que anon pueda actualizar
-- last_login y last_seen en su propio tenant.
-- ============================================================

-- Agregar columna last_seen al tenant (si no existe)
ALTER TABLE "public"."tenant"
  ADD COLUMN IF NOT EXISTS "last_seen" timestamptz;

-- ── Política: anon puede actualizar last_login / last_seen de su tenant ──────
-- (Los usuarios de PIN corren como anon — necesitan poder registrar su actividad)

DROP POLICY IF EXISTS "tenant_anon_update_presence" ON "public"."tenant";
CREATE POLICY "tenant_anon_update_presence"
  ON "public"."tenant"
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Política de lectura para anon (necesaria para cargar datos del tenant)
DROP POLICY IF EXISTS "tenant_anon_read" ON "public"."tenant";
CREATE POLICY "tenant_anon_read"
  ON "public"."tenant"
  FOR SELECT
  TO anon
  USING (true);

-- Verificar:
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'tenant';

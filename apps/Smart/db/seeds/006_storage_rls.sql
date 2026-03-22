-- ============================================================
-- 006_storage_rls.sql
-- Políticas RLS para el bucket "uploads" en Supabase Storage
-- Estructura de carpetas: {tenant_id}/{category}/{filename}
--
-- IMPORTANTE: Ejecutar en Supabase SQL Editor (requiere permisos de admin)
-- El bucket "uploads" es PUBLIC para lecturas (CDN), solo protegemos escrituras.
-- ============================================================

-- Eliminar políticas anteriores si existen (para re-aplicar limpio)
DROP POLICY IF EXISTS "uploads_public_read"          ON storage.objects;
DROP POLICY IF EXISTS "uploads_tenant_insert"        ON storage.objects;
DROP POLICY IF EXISTS "uploads_tenant_update"        ON storage.objects;
DROP POLICY IF EXISTS "uploads_tenant_delete"        ON storage.objects;
DROP POLICY IF EXISTS "uploads_service_role_all"     ON storage.objects;

-- ── 1. LECTURA PÚBLICA ────────────────────────────────────────────────────────
-- El bucket ya es PUBLIC, pero dejamos la política explícita para claridad
CREATE POLICY "uploads_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads');

-- ── 2. INSERTAR — solo en la carpeta del propio tenant ─────────────────────
-- La primera parte del path debe coincidir con el tenant_id del usuario autenticado
-- Ejemplo de path válido: "abc123-tenant/logos/1234567890_logo.png"
CREATE POLICY "uploads_tenant_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND (
      -- Super admin puede subir a cualquier carpeta
      auth.email() = 'smartfixosapp@gmail.com'
      OR
      -- Cada tenant solo puede subir a su propia carpeta
      (storage.foldername(name))[1] = (
        SELECT tenant_id::text
        FROM public.app_employee
        WHERE auth_id = auth.uid()
          AND active = true
        LIMIT 1
      )
      OR
      -- Service role (Deno server) — siempre permitido (bypassa RLS de todas formas)
      auth.role() = 'service_role'
    )
  );

-- ── 3. ACTUALIZAR — solo archivos del propio tenant ───────────────────────
CREATE POLICY "uploads_tenant_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'uploads'
    AND (
      auth.email() = 'smartfixosapp@gmail.com'
      OR
      (storage.foldername(name))[1] = (
        SELECT tenant_id::text
        FROM public.app_employee
        WHERE auth_id = auth.uid()
          AND active = true
        LIMIT 1
      )
      OR
      auth.role() = 'service_role'
    )
  );

-- ── 4. ELIMINAR — solo archivos del propio tenant ─────────────────────────
CREATE POLICY "uploads_tenant_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND (
      auth.email() = 'smartfixosapp@gmail.com'
      OR
      (storage.foldername(name))[1] = (
        SELECT tenant_id::text
        FROM public.app_employee
        WHERE auth_id = auth.uid()
          AND active = true
        LIMIT 1
      )
      OR
      auth.role() = 'service_role'
    )
  );

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Ejecuta esto para verificar que las políticas se crearon correctamente:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

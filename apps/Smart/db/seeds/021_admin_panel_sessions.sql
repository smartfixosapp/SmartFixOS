-- ─────────────────────────────────────────────────────────────────
-- 021_admin_panel_sessions.sql
-- Sesiones del panel GACC/SuperAdmin, emitidas por verifyAdminOtp tras
-- validar OTP + PIN secreto. Sustituyen el uso de
-- VITE_SUPABASE_SERVICE_ROLE_KEY en el navegador (hallazgo CRÍTICO de
-- SECURITY_AUDIT_2026-04-21.md): el token opaco que recibe el cliente solo
-- sirve para autenticarse contra el proxy gaccDataProxy.js, que es el único
-- que conoce la service_role key real (server-side).
-- Ejecutar en: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_panel_sessions (
  token_hash   TEXT PRIMARY KEY,     -- SHA-256(token), el token nunca se guarda en texto plano
  ip_address   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL, -- 2 horas de vida
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_panel_sessions_expires
  ON public.admin_panel_sessions(expires_at);

-- RLS: solo el service role puede leer/escribir (sin acceso desde el cliente)
ALTER TABLE public.admin_panel_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.admin_panel_sessions
  USING (false)
  WITH CHECK (false);

-- Función para limpiar sesiones expiradas (llamar periódicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_panel_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.admin_panel_sessions WHERE expires_at < NOW();
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 006_admin_otp_sessions.sql
-- Tabla para sesiones OTP del SuperAdmin (seguras, server-side)
-- Ejecutar en: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_otp_sessions (
  session_id   TEXT PRIMARY KEY,
  otp_hash     TEXT NOT NULL,        -- SHA-256(otp + salt), nunca texto plano
  salt         TEXT NOT NULL,
  email        TEXT NOT NULL,
  ip_address   TEXT,
  attempts     INTEGER DEFAULT 0,    -- máx 3 intentos antes de invalidar
  expires_at   TIMESTAMPTZ NOT NULL, -- 5 minutos de vida
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para limpiar sesiones expiradas eficientemente
CREATE INDEX IF NOT EXISTS idx_admin_otp_expires
  ON public.admin_otp_sessions(expires_at);

-- RLS: solo el service role puede leer/escribir (sin acceso desde el cliente)
ALTER TABLE public.admin_otp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.admin_otp_sessions
  USING (false)   -- nadie desde el cliente puede leer
  WITH CHECK (false); -- nadie desde el cliente puede escribir

-- Función para limpiar sesiones expiradas (llamar periódicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.admin_otp_sessions WHERE expires_at < NOW();
END;
$$;

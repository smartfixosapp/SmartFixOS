# 🔧 SETUP DE VARIABLES DE ENTORNO

## `.env.local` (Desarrollo Local)

Crea este archivo en la raíz del proyecto:

```bash
# ============================================
# 👈 MIGRACIÓN: Variables de Entorno - SmartFixOS
# ============================================

# === DATA BACKEND (default: base44) ===
VITE_DATA_BACKEND=base44

# === NEON DATABASE (descomentar para testing) ===
# VITE_DATA_BACKEND=neon
# NEON_DATABASE_URL=postgresql://user:password@ep-xxx-xxx.neon.tech/smartfixos?sslmode=require

# === NOTAS ===
# - Por defecto usa Base44 (sin cambios)
# - Para probar Neon: cambia a VITE_DATA_BACKEND=neon
# - Reinicia dev server después de cambiar
```

---

## ☁️ Netlify Environment Variables

**Dashboard → Site Settings → Environment Variables**

```bash
# 👈 MIGRACIÓN: Obligatorio para funciones serverless
NEON_DATABASE_URL=postgresql://user:password@ep-xxx-xxx.neon.tech/smartfixos?sslmode=require

# 👈 MIGRACIÓN: Opcional (solo para testing Neon en producción)
# VITE_DATA_BACKEND=neon
```

**⚠️ IMPORTANTE:**
- **NO** agregues `VITE_DATA_BACKEND=neon` hasta estar 100% listo
- **SIN** esta variable, la app usa Base44 (sin cambios)
- Agrega `NEON_DATABASE_URL` desde el inicio (funciones la necesitan)

---

## 📝 Ejemplo Real

### Conexión Neon (obtener de dashboard)

```bash
NEON_DATABASE_URL=postgresql://smartfixos_admin:abc123XYZ@ep-cool-mountain-12345.us-east-2.aws.neon.tech/smartfixos_prod?sslmode=require
```

**Componentes:**
- **User:** `smartfixos_admin`
- **Password:** `abc123XYZ`
- **Host:** `ep-cool-mountain-12345.us-east-2.aws.neon.tech`
- **Database:** `smartfixos_prod`
- **SSL:** `sslmode=require` (obligatorio)

---

## 🧪 Testing Local con Neon

```bash
# 1. Edita .env.local
VITE_DATA_BACKEND=neon
NEON_DATABASE_URL=postgresql://...

# 2. Reinicia dev server
npm run dev

# 3. Ve a http://localhost:5173/Financial
# Deberías ver "Backend: NEON" en el panel de debug
```

---

## ✅ Verificación

Abre la consola del navegador y busca:

```
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: BASE44                      ║  ← Debe decir "NEON" si configuraste
║  Mode: Base44 (Actual)                ║  ← Debe decir "Neon PostgreSQL"
╚════════════════════════════════════════╝
```

---

## 🔄 Cambiar Backend sin editar .env

**En desarrollo:** Agrega a la URL:
```
http://localhost:5173/Financial?backend=neon
http://localhost:5173/Financial?backend=base44
```

**En producción:**
```
https://tu-app.netlify.app/Financial?backend=neon
```

Esto fuerza el backend temporalmente sin necesidad de cambiar variables de entorno.

---

**Última actualización:** 2025-01-16

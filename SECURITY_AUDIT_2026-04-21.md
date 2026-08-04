# Auditoría de Seguridad — SmartFixOS
**Fecha:** 2026-04-21
**Alcance:** Rate limiting, secretos hardcoded, sanitización de inputs, conteo de vulnerabilidades restantes.

---

## 1. Rate Limiting ✅ IMPLEMENTADO

**Archivo nuevo:** `apps/Smart/src/Functions/_rateLimit.js`
**Wired en:** `apps/Smart/src/Functions/server.js`

- **Límite:** 5 intentos / 15 min por ruta + usuario (JWT `sub`) o IP.
- **Rutas de auth protegidas a 5/15min:** `/registerTenant`, `/createFirstAdmin`, `/verifyAndCreateAdmin`, `/sendAdminOtp`, `/verifyAdminOtp`, `/sendVerificationEmail`, `/createTenant`.
- **Rutas sensibles (20-60/15min):** emails, pagos Stripe, IA (invoke/chat/extract/generate-image), uploadFile.
- **Default:** 300/15min para todo lo demás.
- **Exentos:** `/stripeWebhook`, `/health`, cron jobs con header `x-cron-secret` válido.
- **Respuesta 429:** incluye `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- **GC:** limpia buckets vencidos cada 5 min.

## 2. Secretos hardcoded → .env ✅ PARCIAL

### Removidos del código
- `lib/supabase-client.js` — quitado JWT anon fallback, ahora exige `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` del .env.
- `lib/unified-custom-sdk.js` — idem.
- `lib/unified-custom-sdk-supabase.js` — idem.

### .env ya está bien configurado
`.env` está en `.gitignore` (verificado con `git check-ignore`). Contiene correctamente: Supabase keys, Stripe, Resend, OpenAI, Gemini, Groq, TrackingMore.

### ⚠️ Pendiente — requiere decisión tuya
Las siguientes variables tienen prefijo `VITE_`, lo que significa que Vite **las inlinea en el bundle del navegador y cualquier visitante puede leerlas**:

| Variable | Riesgo | Ubicación de uso |
|---|---|---|
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | 🔴 CRÍTICO — bypass total de RLS | `SuperAdmin.jsx:27,846`, `gacc/gaccContext.jsx:16` |
| `VITE_OPENAI_API_KEY` | 🔴 ALTO — cobros ilimitados a tu cuenta | `jenaiEngine.js`, `ARIAChat.jsx` |
| `VITE_GEMINI_API_KEY` | 🔴 ALTO | `geminiAI.js` |
| `VITE_GROQ_API_KEY` | 🟡 MEDIO | `geminiAI.js`, `groqAI.js`, `jenaiEngine.js` |
| `VITE_RESEND_API_KEY` | 🟡 MEDIO | presente en .env aunque el servidor ya usa la no-VITE |

**Fix recomendado (NO aplicado — requiere refactor y tu OK):**
1. Borrar `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY`, `VITE_RESEND_API_KEY` del `.env`.
2. Mover esas llamadas al servidor de Functions (Deno) — ya tienes `/ai/invoke`, `/ai/chat`, `/sendEmailInternal`. Ampliar para cubrir lo que hoy llama directo al cliente.
3. **Rotar las llaves actuales** (se consideran leakeadas si alguna vez fueron parte de un build público): Supabase service_role, OpenAI, Gemini, Groq, Resend, Stripe test.

## 3. Sanitización de inputs ✅ IMPLEMENTADO

**Archivo nuevo:** `apps/Smart/src/Functions/_sanitize.js`
**Wired en:** `server.js` vía `sanitizeRequest(req)` antes de cada handler.

- Strip de bytes NUL y control chars en todo string JSON.
- Remoción de `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<style>` en campos de texto plano.
- Cap de 10 KB por string.
- Detector de firmas SQLi disponible (`detectSqlInjection`) para usar puntualmente.
- Helpers: `isEmail`, `isUUID`.

**Riesgo residual SQL injection:** BAJO. Todas las Functions usan PostgREST con `encodeURIComponent` en filtros. No se encontró `execute_sql`, template-literal SQL, ni `.rpc('sql', ...)` en código de producción.

---

## Vulnerabilidades restantes — 7 abiertas (2026-08-04: #1 y #2 resueltas)

| # | Severidad | Vulnerabilidad | Archivo | Acción |
|---|---|---|---|---|
| 1 | ✅ RESUELTO (2026-08-04) | ~~`VITE_SUPABASE_SERVICE_ROLE_KEY` expuesta al browser bundle~~ | `apps/Smart/src/pages/SuperAdmin.jsx` | El archivo ya no existe en el repo (eliminado en el pivote a app nativa iOS, Sprint 136). No queda código que lea esta var. |
| 2 | ✅ RESUELTO (2026-08-04) | ~~`VITE_SUPABASE_SERVICE_ROLE_KEY` usada para crear cliente desde el browser~~ | `apps/Smart/src/pages/gacc/gaccContext.jsx:16` | `getAdminClient()` ya no lee `VITE_SUPABASE_SERVICE_ROLE_KEY`. Ahora apunta a `gaccDataProxy.js` (nuevo, server-side en Render), que reenvía las queries a Supabase con la service_role key real — la cual nunca sale del servidor. El navegador solo guarda un token opaco de sesión de panel, emitido por `verifyAdminOtp.js` tras OTP + PIN secreto (login en `/GACCLogin`, nuevo) y validado en cada request contra la tabla `admin_panel_sessions` (`021_admin_panel_sessions.sql`, expira en 2h). **Pendiente de tu parte:** la key vieja se considera filtrada (estuvo en un bundle público) — rotarla en el dashboard de Supabase y actualizar `SUPABASE_SERVICE_ROLE_KEY` en Render. Ver prompt de seguimiento. |
| 3 | 🔴 ALTA | `VITE_OPENAI_API_KEY` embebida en el bundle | `apps/Smart/src/lib/jenaiEngine.js`, `components/aria/ARIAChat.jsx` | Proxy por `/ai/invoke`; rotar |
| 4 | 🔴 ALTA | `VITE_GEMINI_API_KEY` embebida en el bundle | `apps/Smart/src/lib/geminiAI.js` | Proxy por `/ai/gemini-summary`; rotar |
| 5 | 🟡 MEDIA | `VITE_GROQ_API_KEY` embebida en el bundle | `apps/Smart/src/lib/groqAI.js`, `geminiAI.js`, `jenaiEngine.js`, `ARIAChat.jsx` | Proxy por Deno; rotar |
| 6 | 🟡 MEDIA | Stored XSS — `dangerouslySetInnerHTML` sobre `body_html` de notificaciones | `apps/Smart/src/components/notifications/NotificationPanel.jsx:275` | Sanitizar con DOMPurify o cambiar a texto plano |
| 7 | 🟡 MEDIA | Stored XSS — preview de email templates del tenant | `apps/Smart/src/components/settings/tabs/EmailTemplatesTab.jsx:1348,1563` | DOMPurify en el render |
| 8 | 🟡 MEDIA | Stored XSS — términos del wizard de work orders | `apps/Smart/src/components/workorder/wizard/TermsStep.jsx:35` | DOMPurify |
| 9 | 🟢 BAJA | 7 usos de `document.write`/`innerHTML` en vistas de impresión (nueva ventana) | `PrintHelper.jsx`, `ExportService.jsx`, `CloseDrawerDialog.jsx`, `PurchaseOrderDetailDialog.jsx`, `WorkOrderPanel.jsx`, `JeaniStageReportPanel.jsx`, `WODetailCenter.jsx` | Escapar los valores del DB antes de inyectar |

**Total: 7 vulnerabilidades restantes — 2 altas, 4 medias, 1 baja.** (2 críticas resueltas el 2026-08-04, pendiente rotar la key filtrada — ver siguiente paso #1 más abajo.)

---

## Cambios aplicados hoy

```
apps/Smart/src/Functions/_rateLimit.js     (nuevo)
apps/Smart/src/Functions/_sanitize.js      (nuevo)
apps/Smart/src/Functions/server.js         (importa y aplica middleware)
lib/supabase-client.js                     (removido JWT hardcoded)
lib/unified-custom-sdk.js                  (removido JWT hardcoded)
lib/unified-custom-sdk-supabase.js         (removido JWT hardcoded)
SECURITY_AUDIT_2026-04-21.md               (este reporte)
```

## Siguiente paso recomendado (en orden)
1. ~~Refactorizar `SuperAdmin.jsx` + `gaccContext.jsx`~~ ✅ hecho 2026-08-04 (`gaccDataProxy.js` + `021_admin_panel_sessions.sql` + `GACCLogin.jsx`). **Falta por hacer tú, fuera de este repo:**
   a. Rotar la service_role key de Supabase (se considera filtrada — estuvo en un bundle público).
   b. Borrar `VITE_SUPABASE_SERVICE_ROLE_KEY` de Vercel → Environment Variables (ya no la usa ningún código).
   c. Poner la key nueva como `SUPABASE_SERVICE_ROLE_KEY` (sin prefijo VITE_) en Render → Environment Variables.
   d. Setear `SUPER_ADMIN_EMAIL` y `ADMIN_SECRET_PIN` en Render si no estaban ya (los necesita `/GACCLogin`, ver `.env.production.example`).
   e. Redesplegar Vercel y Render, y probar el login en `/GACCLogin`.
2. Rotar OpenAI/Gemini/Groq/Resend y mover las llamadas de IA al Functions server (vulnerabilidades #3-5, aún abiertas).
3. Añadir DOMPurify a los 3 componentes con `dangerouslySetInnerHTML` que reciben input tenant (#6-8, aún abiertas).

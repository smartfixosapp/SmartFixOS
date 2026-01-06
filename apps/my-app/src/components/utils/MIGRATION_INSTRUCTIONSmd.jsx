# 📋 INSTRUCCIONES DE MIGRACIÓN BASE44 → NEON

## 1️⃣ Variables de Entorno

### 🏠 Desarrollo Local (`.env.local`)

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
# 👈 MIGRACIÓN: Backend de datos (base44 por defecto)
VITE_DATA_BACKEND=base44

# 👈 MIGRACIÓN: URL de Neon (solo cuando quieras probar con Neon)
# VITE_DATA_BACKEND=neon
# NEON_DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
```

**Por defecto:** La app usa `base44` (comportamiento actual).  
**Para probar Neon:** Descomenta las líneas de Neon y reinicia el servidor.

---

### ☁️ Netlify Deploy

En el dashboard de Netlify → Site Settings → Environment Variables:

```bash
# 👈 MIGRACIÓN: URL de conexión a Neon PostgreSQL (OBLIGATORIO)
NEON_DATABASE_URL=postgresql://user:password@ep-xxx-xxx.neon.tech/smartfixos?sslmode=require

# 👈 MIGRACIÓN: Forzar Neon en producción (OPCIONAL - solo para pruebas)
# VITE_DATA_BACKEND=neon
```

**⚠️ IMPORTANTE:**
- `NEON_DATABASE_URL` es **requerida** para que las funciones serverless funcionen
- `VITE_DATA_BACKEND=neon` solo actívala cuando estés listo para la migración completa
- **SIN** esta variable, la app usa Base44 (comportamiento actual sin cambios)

---

### 📦 Netlify Functions (TypeScript/JavaScript)

**No es necesario modificar `netlify.toml`** - Netlify detecta automáticamente `.js` en `functions/`.

Si prefieres TypeScript más adelante:
```toml
[functions]
  directory = "functions"
  node_bundler = "esbuild"
```

---

## 2️⃣ Checklist de Pruebas - Finanzas

### ✅ Con `VITE_DATA_BACKEND=base44` (Default)

**Comportamiento esperado:** TODO funciona exactamente igual que hoy.

- [ ] La página `/Financial` carga sin errores
- [ ] Se muestran ventas históricas correctamente
- [ ] Se muestran transacciones y gastos
- [ ] Los KPIs calculan correctamente (Ingresos, Gastos, Utilidad)
- [ ] Los gastos fijos se guardan y cargan
- [ ] Abrir/cerrar caja funciona
- [ ] Panel de debug muestra conteos correctos

**Logs esperados en consola:**
```
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: BASE44                      ║
║  Mode: Base44 (Actual)                ║
╚════════════════════════════════════════╝

💰 FINANZAS - Iniciando carga...
✅ Datos recibidos:
  - Ventas: X
  - Transacciones: Y
  - Gastos Fijos: Z
```

---

### 🧪 Con `VITE_DATA_BACKEND=neon` (Testing)

**Comportamiento esperado:** Datos vienen de Neon (pueden estar vacíos).

- [ ] La página `/Financial` carga sin errores
- [ ] El panel de debug muestra "Backend: NEON"
- [ ] Si Neon está vacío → muestra "No hay ventas"
- [ ] Si Neon tiene datos → se muestran correctamente
- [ ] Los errores de conexión muestran toast "Error cargando datos financieros"

**Logs esperados en consola:**
```
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: NEON                        ║
║  Mode: Neon PostgreSQL                ║
╚════════════════════════════════════════╝

💰 FINANZAS - Iniciando carga...
✅ Datos recibidos:
  - Ventas: 0 (Neon vacío)
  - Transacciones: 0
  - Gastos Fijos: 0
```

---

### 🔍 Validar Endpoints Netlify

**Verificar que las funciones responden:**

```bash
# 1. Verificar sales-list
curl -X POST https://tu-app.netlify.app/.netlify/functions/salesList \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Respuesta esperada:
# {"success": true, "data": [...], "backend": "neon"}

# 2. Verificar transactions-list
curl -X POST https://tu-app.netlify.app/.netlify/functions/transactionsList \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "type": "revenue"}'

# 3. Verificar cash-registers
curl -X POST https://tu-app.netlify.app/.netlify/functions/cashRegisters \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-15"}'

# 4. Verificar cash-movements
curl -X POST https://tu-app.netlify.app/.netlify/functions/cashMovements \
  -H "Content-Type: application/json" \
  -d '{"drawer_id": "uuid-here"}'
```

**En DevTools Network:**
- Status: `200 OK`
- Response: `{"success": true, "data": [...], "backend": "neon"}`

---

## 3️⃣ Errores Comunes y Soluciones

### ❌ Error: `NEON_DATABASE_URL no configurado`

**Causa:** La variable de entorno no está seteada en Netlify.

**Solución:**
1. Ve a Netlify Dashboard → Site Settings → Environment Variables
2. Agrega `NEON_DATABASE_URL` con tu connection string
3. Redeploy el sitio

---

### ❌ Error: `Could not load /src/api/dataClient`

**Causa:** El archivo está en la ruta incorrecta.

**Solución:**
- El archivo debe estar en `components/utils/dataClient.js` (no en `api/`)
- Importar como: `import { dataClient } from "@/components/utils/dataClient"`

---

### ❌ Error: `Neon query failed: 404`

**Causa:** Las funciones Netlify no están desplegadas o la ruta es incorrecta.

**Solución:**
1. Verificar que los archivos estén en `functions/` (no `netlify/functions/`)
2. Verificar nombres: `salesList.js`, `transactionsList.js`, etc.
3. Redeploy en Netlify
4. Verificar en Netlify Dashboard → Functions que aparezcan

---

### ❌ Error: `relation "sales" does not exist`

**Causa:** Las tablas no existen en Neon.

**Solución:**
1. Obtener el schema SQL: `GET /.netlify/functions/getNeonSchema`
2. Ejecutar el SQL en Neon Dashboard → SQL Editor
3. Verificar que las tablas se crearon correctamente

---

### ❌ Error: `CORS policy` o `blocked by CORS`

**Causa:** Netlify proxy interno debería manejarlo, pero puede fallar.

**Solución:**
- Las funciones Netlify **NO necesitan CORS headers** cuando se llaman desde el mismo dominio
- Si hay error CORS, verificar que la URL sea relativa: `/.netlify/functions/...`
- NO usar URL absoluta: `https://...netlify.app/...`

---

### ❌ Error: `column "items" does not exist`

**Causa:** Tipo de dato incorrecto en la query o falta columna en schema.

**Solución:**
- Verificar que el schema SQL se ejecutó completo
- Verificar que la columna `items JSONB` existe en `sales`
- Re-ejecutar el schema completo

---

### ❌ Datos vacíos pero sin error

**Causa:** Neon está vacío (migración pendiente).

**Solución:**
- **Normal** si recién migraste - Neon empieza vacío
- Ejecutar migración de datos: `migrateEntity('Sale')` (ver siguiente sección)
- O seguir usando `VITE_DATA_BACKEND=base44` hasta estar listo

---

## 4️⃣ Comandos Útiles de Migración

### Migrar datos de Base44 → Neon (desde consola del navegador)

```javascript
import { migrateEntity } from "@/components/utils/dataClient";

// Migrar ventas (100 registros por batch)
const stats = await migrateEntity('Sale', 100);
console.log(stats); // { success: 50, failed: 0, errors: [] }

// Migrar transacciones
await migrateEntity('Transaction', 100);

// Migrar registros de caja
await migrateEntity('CashRegister', 50);

// Migrar movimientos
await migrateEntity('CashDrawerMovement', 100);
```

### Validar sincronización

```javascript
import { validateSync } from "@/components/utils/dataClient";

// Comparar Base44 vs Neon
const validation = await validateSync('Sale');
// { base44Count: 150, neonCount: 150, synced: true }
```

---

## 5️⃣ Rollback de Emergencia

### En Local (archivo)

Edita `.env.local`:
```bash
VITE_DATA_BACKEND=base44  # ← Volver a Base44
```

Reinicia: `npm run dev`

---

### En Netlify (web)

1. Netlify Dashboard → Site Settings → Environment Variables
2. **Elimina** `VITE_DATA_BACKEND` o cámbiala a `base44`
3. Redeploy: Deploys → Trigger deploy → Clear cache and deploy site

**Resultado:** La app vuelve a usar Base44 inmediatamente.

---

## 6️⃣ Plan para Migración Gradual

### Fase 1: Finanzas (ACTUAL)
✅ Migrado `dataClient`  
✅ Funciones Netlify creadas  
✅ Schema SQL generado  
✅ Financial.jsx usa `dataClient`

### Fase 2: Customers & Orders (SIGUIENTE)
- [ ] Migrar `components/customers/CreateCustomerDialog`
- [ ] Migrar `pages/Customers`
- [ ] Migrar `pages/Orders`
- [ ] Migrar `components/workorder/WorkOrderWizard`

### Fase 3: Inventory & POS (DESPUÉS)
- [ ] Migrar `pages/Inventory`
- [ ] Migrar `pages/POS`
- [ ] Migrar componentes de productos

### Fase 4: Migración Completa
- [ ] Cambiar `VITE_DATA_BACKEND=neon` en producción
- [ ] Validar todos los flujos end-to-end
- [ ] Ejecutar migración masiva de datos
- [ ] Monitorear logs por 48 horas

---

## 7️⃣ Ejemplo Completo `.env.local`

```bash
# ============================================
# 👈 MIGRACIÓN: SmartFixOS Environment Variables
# ============================================

# === DATA BACKEND (base44 | neon) ===
# 👈 MIGRACIÓN: Descomentar solo UNA opción

# Opción 1: Base44 (Actual - Sin cambios)
VITE_DATA_BACKEND=base44

# Opción 2: Neon PostgreSQL (Testing/Producción)
# VITE_DATA_BACKEND=neon
# NEON_DATABASE_URL=postgresql://smartfixos_user:password123@ep-cool-mountain-12345.us-east-2.aws.neon.tech/smartfixos?sslmode=require

# === NETLIFY FUNCTIONS (solo para testing local) ===
# Si usas Netlify CLI localmente, las funciones leerán estas variables
# NEON_DATABASE_URL=postgresql://...

# === OTROS (si los usas) ===
# VITE_API_URL=http://localhost:3000
# VITE_APP_ENV=development
```

---

## 8️⃣ Verificación Final

### ✅ Checklist Pre-Deploy

- [ ] `.env.local` tiene `VITE_DATA_BACKEND=base44`
- [ ] Netlify tiene `NEON_DATABASE_URL` configurada
- [ ] Schema SQL ejecutado en Neon
- [ ] Funciones Netlify aparecen en dashboard
- [ ] `/Financial` carga sin errores con ambos backends
- [ ] Logs muestran backend activo correctamente

### 🚀 Ready para Testing Neon

1. Cambiar `.env.local` a `VITE_DATA_BACKEND=neon`
2. Reiniciar dev server
3. Verificar consola: "Backend: NEON"
4. Probar carga de datos (vacío es OK)
5. Si hay errores → volver a `base44` y debuggear

---

## 📞 Soporte

**Problema con migración?**
- Revisa consola del navegador (logs detallados)
- Revisa Netlify Functions logs
- Verifica que `NEON_DATABASE_URL` sea correcta
- Usa rollback si algo falla: `VITE_DATA_BACKEND=base44`

---

**Última actualización:** 2025-01-16  
**Versión:** 1.0.0 - Migración Fase 1 (Finanzas)

# 🧪 CHECKLIST DE PRUEBAS - MIGRACIÓN FINANZAS

## ✅ Fase 1: Pruebas con Base44 (Sin cambios)

### Objetivo
Verificar que `dataClient` funciona transparentemente con Base44.

### Configuración
```bash
# .env.local
VITE_DATA_BACKEND=base44
```

### Tests

#### 1. Carga de Página
- [ ] `/Financial` carga sin errores
- [ ] Los KPIs muestran datos correctos
- [ ] Panel de debug muestra conteos > 0

#### 2. Funcionalidad Core
- [ ] Tab "Ventas" muestra historial completo
- [ ] Tab "Gastos Fijos" permite crear/editar
- [ ] Tab "Gastos" muestra transacciones tipo expense
- [ ] Tab "Reportes" carga correctamente

#### 3. Acciones CRUD
- [ ] Crear gasto fijo → se guarda en Base44
- [ ] Editar gasto fijo → se actualiza
- [ ] Eliminar gasto fijo → se borra
- [ ] Abrir caja → se registra en Base44
- [ ] Cerrar caja → se finaliza correctamente

#### 4. Logs de Consola
```
✅ Esperado:
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: BASE44                      ║
║  Mode: Base44 (Actual)                ║
╚════════════════════════════════════════╝

💰 FINANZAS - Iniciando carga...
✅ Datos recibidos:
  - Ventas: 50
  - Transacciones: 120
  - Gastos Fijos: 3
```

#### 5. Validación de Datos
- [ ] Total de ventas suma correctamente
- [ ] Utilidad neta = Ingresos - Gastos
- [ ] Porcentajes de gastos fijos calculan bien
- [ ] Fechas se muestran en formato correcto

---

## 🧪 Fase 2: Pruebas con Neon (Nueva BD)

### Objetivo
Verificar que `dataClient` se conecta a Neon y maneja datos vacíos.

### Configuración
```bash
# .env.local
VITE_DATA_BACKEND=neon
NEON_DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
```

**⚠️ IMPORTANTE:** Ejecuta el schema SQL primero:
```sql
-- Obtén el SQL desde:
GET /.netlify/functions/getNeonSchema

-- Ejecútalo en Neon Dashboard → SQL Editor
```

### Tests

#### 1. Conexión a Neon
- [ ] La página carga sin errores de conexión
- [ ] Panel de debug muestra "Backend: NEON"
- [ ] No hay errores 500 en Network tab

#### 2. Estado Vacío (Primera Vez)
- [ ] Tab "Ventas" muestra mensaje "No hay ventas"
- [ ] Tab "Gastos Fijos" muestra mensaje de empty state
- [ ] KPIs muestran $0.00
- [ ] Panel de debug muestra 0 registros

#### 3. Funciones Netlify
Verificar en DevTools → Network:

**POST /.netlify/functions/salesList**
- [ ] Status: `200 OK`
- [ ] Response: `{"success": true, "data": [], "backend": "neon"}`

**POST /.netlify/functions/transactionsList**
- [ ] Status: `200 OK`
- [ ] Response: `{"success": true, "data": [], "backend": "neon"}`

**POST /.netlify/functions/cashRegisters**
- [ ] Status: `200 OK`
- [ ] Response: `{"success": true, "data": [], "backend": "neon"}`

#### 4. CRUD con Neon
- [ ] Crear gasto fijo → se guarda en Neon (si la función CREATE existe)
- [ ] Editar gasto fijo → actualiza en Neon
- [ ] Eliminar gasto fijo → se borra de Neon
- [ ] **Nota:** Abrir/cerrar caja aún usa Base44 (migración pendiente)

#### 5. Logs de Consola
```
✅ Esperado:
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: NEON                        ║
║  Mode: Neon PostgreSQL                ║
╚════════════════════════════════════════╝

💰 FINANZAS - Iniciando carga...
✅ Datos recibidos:
  - Ventas: 0
  - Transacciones: 0
  - Gastos Fijos: 0
```

---

## ❌ Errores Comunes y Soluciones

### Error: `NEON_DATABASE_URL no configurado`

**Síntoma:** Toast rojo "Error cargando datos financieros"

**Solución:**
1. Verificar que `.env.local` tiene `NEON_DATABASE_URL`
2. Reiniciar dev server: `npm run dev`
3. Si en Netlify: agregar variable en dashboard

---

### Error: `relation "sales" does not exist`

**Síntoma:** Error 500 en funciones Netlify

**Solución:**
1. Ejecutar schema SQL en Neon
2. Verificar en Neon Dashboard → Tables que existan
3. Verificar que la URL de conexión sea correcta

---

### Error: `Could not resolve "/.netlify/functions/salesList"`

**Síntoma:** Network error 404

**Solución:**
- En **local:** Netlify Dev CLI requiere `netlify dev` (no `npm run dev`)
- En **producción:** Verificar que las funciones se desplegaron
- Verificar nombres de archivo (case-sensitive)

---

### Error: Datos duplicados o inconsistentes

**Síntoma:** Se muestran datos de Base44 con `VITE_DATA_BACKEND=neon`

**Solución:**
- Limpiar localStorage: `localStorage.clear()`
- Hard refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`
- Verificar en Network tab que las requests vayan a Neon

---

### Error: `fetch failed` o timeout

**Síntoma:** Requests tardan mucho o fallan

**Solución:**
1. Verificar que Neon esté activo (no en sleep mode)
2. Verificar URL de conexión (copiar/pegar completa)
3. Probar conexión directa con `psql` o Neon Dashboard
4. Aumentar timeout en `dataClient.js` si es necesario

---

## 🔍 Debugging Avanzado

### Ver tráfico de red en tiempo real

1. DevTools → Network → Filter: `Fetch/XHR`
2. Buscar: `salesList`, `transactionsList`, etc.
3. Ver Request Payload y Response
4. Verificar `backend: "neon"` en respuesta

### Logs de funciones Netlify

1. Netlify Dashboard → Functions
2. Click en función (ej: `salesList`)
3. Ver logs en tiempo real
4. Buscar: `✅ [Neon Sales]` o `❌ [Neon Sales]`

### Comparar Base44 vs Neon

```javascript
// En consola del navegador
import { switchBackend, validateSync } from "@/components/utils/dataClient";

// Comparar datos
const validation = await validateSync('Sale');
console.log(validation);
// { base44Count: 150, neonCount: 0, synced: false }
```

---

## 📊 Métricas de Éxito

### ✅ Migración Exitosa si:
- [ ] 0 errores en consola con ambos backends
- [ ] KPIs calculan igual en Base44 y Neon
- [ ] CRUD funciona en ambos backends
- [ ] Logs muestran backend activo correcto
- [ ] Performance similar (<2s carga inicial)

### ⚠️ Revisar si:
- Errores 500 intermitentes
- Datos faltantes al cambiar backends
- CORS errors
- Funciones Netlify no aparecen
- Queries lentas (>5s)

---

## 🚀 Next Steps

Una vez que **todas** las pruebas pasen con `VITE_DATA_BACKEND=neon`:

1. Ejecutar migración de datos: `migrateEntity('Sale')`, etc.
2. Validar sincronización: `validateSync('Sale')`
3. Migrar Customers & Orders (Fase 2)
4. Cambiar a Neon en producción: `VITE_DATA_BACKEND=neon`

---

**Última actualización:** 2025-01-16  
**Autor:** Base44 AI Migration Assistant

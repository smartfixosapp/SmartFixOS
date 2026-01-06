# 🗺️ MAPA DE REFACTOR - BASE44 → DATACLIENT

## 🎯 Objetivo
Identificar todas las importaciones de `base44` y mapear qué debe cambiar a `dataClient`.

---

## 📊 Resumen de Análisis

**Total de archivos que usan `base44`:** ~40+  
**Archivos ya migrados:** 1 (`pages/Financial.jsx`)  
**Pendientes de migración:** 39+

---

## ✅ Archivos Ya Migrados

### 1. `pages/Financial.jsx`
**Status:** ✅ MIGRADO

**Cambios aplicados:**
```javascript
// ANTES:
import { base44 } from "@/api/base44Client";
const sales = await base44.entities.Sale.list();

// DESPUÉS:
import { dataClient } from "@/components/utils/dataClient";
import { base44 } from "@/api/base44Client"; // Solo para auth/integrations
const sales = await dataClient.entities.Sale.list();
```

**Llamadas migradas:**
- `Sale.list()` → `dataClient.entities.Sale.list()`
- `Transaction.list()` → `dataClient.entities.Transaction.list()`
- `CashRegister.filter()` → `dataClient.entities.CashRegister.filter()`
- `FixedExpense.filter()` → `dataClient.entities.FixedExpense.filter()`

**Llamadas SIN migrar (correcto):**
- `base44.integrations.Core.SendEmail()` → Mantener Base44
- `base44.auth.me()` → Mantener Base44

---

## 🔄 Fase 1: Finanzas (COMPLETADO)

### Archivos Migrados
- ✅ `pages/Financial.jsx`

### Entidades Migradas
- ✅ `Sale`
- ✅ `Transaction`
- ✅ `CashRegister`
- ✅ `CashDrawerMovement`
- ✅ `FixedExpense`

---

## 📋 Fase 2: Customers & Orders (PENDIENTE)

### Archivos a Migrar - Customers

#### 1. `pages/Customers.jsx`
**Llamadas detectadas:**
```javascript
base44.entities.Customer.list()
base44.entities.Customer.create()
base44.entities.Customer.update()
base44.entities.Customer.delete()
base44.entities.Order.filter({ customer_id })
```

**Cambios sugeridos:**
```javascript
// Agregar:
import { dataClient } from "@/components/utils/dataClient";

// Reemplazar:
- base44.entities.Customer.list()
+ dataClient.entities.Customer.list()

- base44.entities.Customer.create(data)
+ dataClient.entities.Customer.create(data)

- base44.entities.Customer.update(id, data)
+ dataClient.entities.Customer.update(id, data)

- base44.entities.Customer.delete(id)
+ dataClient.entities.Customer.delete(id)

- base44.entities.Order.filter({ customer_id })
+ dataClient.entities.Order.filter({ customer_id })
```

---

#### 2. `components/customers/CreateCustomerDialog.jsx`
**Llamadas detectadas:**
```javascript
base44.entities.Customer.create()
base44.entities.Customer.filter({ phone })
```

**Cambios sugeridos:**
```javascript
// Agregar:
import { dataClient } from "@/components/utils/dataClient";

// Reemplazar:
- base44.entities.Customer.filter({ phone })
+ dataClient.entities.Customer.search(phone)  // Usar método optimizado

- base44.entities.Customer.create(data)
+ dataClient.entities.Customer.upsert(data, 'phone')  // Usar upsert
```

---

#### 3. `components/customers/CustomerOrdersDialog.jsx`
**Llamadas detectadas:**
```javascript
base44.entities.Order.filter({ customer_id })
```

**Cambios sugeridos:**
```javascript
// Agregar:
import { dataClient } from "@/components/utils/dataClient";

// Reemplazar:
- base44.entities.Order.filter({ customer_id })
+ dataClient.entities.Order.filter({ customer_id })
```

---

### Archivos a Migrar - Orders

#### 4. `pages/Orders.jsx`
**Llamadas detectadas:**
```javascript
base44.entities.Order.list()
base44.entities.Order.filter({ status })
base44.entities.Order.update(id, data)
base44.entities.Order.delete(id)
base44.entities.Customer.list()
```

**Cambios sugeridos:**
```javascript
// Agregar:
import { dataClient } from "@/components/utils/dataClient";

// Reemplazar SOLO entidades migradas:
- base44.entities.Order.list()
+ dataClient.entities.Order.list()

- base44.entities.Order.filter({ status })
+ dataClient.entities.Order.filter({ status })

- base44.entities.Order.update(id, data)
+ dataClient.entities.Order.update(id, data)

- base44.entities.Customer.list()
+ dataClient.entities.Customer.list()

// MANTENER Base44 para entidades NO migradas:
base44.entities.DeviceCategory.list()  // ← SIN cambiar
base44.entities.Brand.list()           // ← SIN cambiar
base44.entities.Notification.create()  // ← SIN cambiar
```

---

#### 5. `components/workorder/WorkOrderWizard.jsx`
**Llamadas detectadas:**
```javascript
base44.entities.Order.create()
base44.entities.Customer.filter({ phone })
base44.entities.Customer.create()
base44.entities.Customer.update()
base44.entities.WorkOrderEvent.create()
base44.entities.DeviceCategory.list()
base44.entities.Brand.list()
base44.entities.DeviceModel.list()
base44.integrations.Core.UploadFile()
base44.integrations.Core.SendEmail()
```

**Cambios sugeridos:**
```javascript
// Agregar:
import { dataClient } from "@/components/utils/dataClient";

// Reemplazar entidades migradas:
- base44.entities.Order.create(orderData)
+ dataClient.entities.Order.create(orderData)

- base44.entities.Customer.filter({ phone })
+ dataClient.entities.Customer.search(phone)

- base44.entities.Customer.create(data)
+ dataClient.entities.Customer.upsert(data, 'phone')

- base44.entities.WorkOrderEvent.create(eventData)
+ dataClient.entities.Order.events.add(eventData)

// MANTENER Base44:
base44.entities.DeviceCategory.list()      // ← NO cambiar (Fase 3)
base44.entities.Brand.list()               // ← NO cambiar (Fase 3)
base44.entities.DeviceModel.list()         // ← NO cambiar (Fase 3)
base44.integrations.Core.UploadFile()      // ← NO cambiar (siempre Base44)
base44.integrations.Core.SendEmail()       // ← NO cambiar (siempre Base44)
```

---

#### 6. `components/orders/OrderDetailDialog.jsx`
**Llamadas detectadas:**
```javascript
base44.entities.Order.update(id, data)
base44.entities.WorkOrderEvent.create()
base44.entities.Notification.create()
```

**Cambios sugeridos:**
```javascript
// Agregar:
import { dataClient } from "@/components/utils/dataClient";

// Reemplazar:
- base44.entities.Order.update(id, data)
+ dataClient.entities.Order.update(id, data)

- base44.entities.WorkOrderEvent.create(eventData)
+ dataClient.entities.Order.events.add(eventData)

// MANTENER:
base44.entities.Notification.create()  // ← NO cambiar (Fase 4)
```

---

## 🚫 Archivos que NO Deben Cambiar

### Mantener `base44` para:

#### Auth & Integrations (Siempre Base44)
- `base44.auth.me()`
- `base44.auth.updateMe()`
- `base44.auth.logout()`
- `base44.integrations.Core.*`

#### Entidades No Migradas (Aún)
- `base44.entities.User.*` (Fase 3)
- `base44.entities.Product.*` (Fase 3)
- `base44.entities.Notification.*` (Fase 4)
- `base44.entities.DeviceCategory.*` (Fase 3)
- `base44.entities.Brand.*` (Fase 3)
- `base44.entities.DeviceModel.*` (Fase 3)
- `base44.entities.AppSettings.*` (Fase 4)
- `base44.entities.SystemConfig.*` (Fase 4)

---

## 📦 Fase 3: Inventory & Products (FUTURO)

### Entidades a Migrar
- `Product`
- `Service`
- `InventoryMovement`
- `DeviceCategory`
- `Brand`
- `DeviceModel`

### Archivos Principales
- `pages/Inventory.jsx`
- `pages/POS.jsx`
- `components/inventory/*`
- `pages/Settings.jsx` (sección de catálogo)

---

## 📦 Fase 4: Configuration & Notifications (FUTURO)

### Entidades a Migrar
- `User`
- `Notification`
- `AppSettings`
- `SystemConfig`
- `UserNotificationSettings`
- `EmailLog`
- `AuditLog`

### Archivos Principales
- `pages/Settings.jsx`
- `pages/UsersManagement.jsx`
- `components/notifications/*`
- `Layout.js`

---

## 🔍 Patrón de Migración Recomendado

### Para cada archivo:

```javascript
// 1️⃣ AGREGAR IMPORTS
import { dataClient } from "@/components/utils/dataClient";
import { base44 } from "@/api/base44Client"; // Mantener para auth/integrations

// 2️⃣ REEMPLAZAR LLAMADAS ENTITY
// Solo si la entidad YA está en dataClient
- await base44.entities.Sale.list()
+ await dataClient.entities.Sale.list()

// 3️⃣ MANTENER BASE44
// Para auth, integrations y entidades NO migradas
base44.auth.me()                        // ✅ Correcto
base44.integrations.Core.SendEmail()   // ✅ Correcto
base44.entities.Product.list()         // ✅ Correcto (aún no migrado)
```

---

## 🧹 Script de Búsqueda Global

Para encontrar todos los usos de `base44.entities`:

```bash
# En terminal
grep -r "base44.entities" src/ --include="*.jsx" --include="*.js"
```

**Output esperado:**
```
src/pages/Financial.jsx: dataClient.entities.Sale.list()  ✅ Migrado
src/pages/Orders.jsx: base44.entities.Order.list()        ⚠️ Pendiente
src/pages/Customers.jsx: base44.entities.Customer.list()  ⚠️ Pendiente
...
```

---

## 📈 Progreso de Migración

```
┌─────────────────────────────────────────────┐
│  FASE 1: FINANZAS              [████████] 100% │
│  FASE 2: CUSTOMERS & ORDERS    [        ]   0% │
│  FASE 3: INVENTORY & PRODUCTS  [        ]   0% │
│  FASE 4: CONFIG & NOTIFICATIONS[        ]   0% │
└─────────────────────────────────────────────┘
```

---

**NO EJECUTAR BÚSQUEDA/REEMPLAZO AUTOMÁTICO** - Cada archivo debe revisarse manualmente para:
1. Verificar que la entidad esté en `dataClient`
2. Distinguir entre entity calls (migrar) y auth/integrations (mantener)
3. Agregar import de `dataClient`
4. Probar individualmente

---

**Última actualización:** 2025-01-16  
**Próximo paso:** Ejecutar Fase 2 después de validar Fase 1

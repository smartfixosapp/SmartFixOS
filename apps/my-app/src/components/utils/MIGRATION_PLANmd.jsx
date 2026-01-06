# 📋 PLAN DE MIGRACIÓN - CUSTOMERS & ORDERS

## 🎯 Objetivo
Migrar las entidades `Customer`, `Order` y `WorkOrderEvent` de Base44 a Neon PostgreSQL.

---

## 📐 Schema SQL para Neon

### 1. Tabla `customers`

```sql
-- 👈 MIGRACIÓN: Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  additional_phones JSONB DEFAULT '[]'::jsonb,
  email TEXT,
  notes TEXT,
  total_orders INTEGER DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier TEXT DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_spent NUMERIC(12, 2) DEFAULT 0.00,
  next_appointment JSONB,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  
  -- 👈 MIGRACIÓN: Constraint de contacto obligatorio
  CONSTRAINT customer_contact_required CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- 👈 MIGRACIÓN: Índices optimizados
CREATE INDEX IF NOT EXISTS idx_customers_created_date ON customers (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_tier ON customers (loyalty_tier);

-- 👈 MIGRACIÓN: Índice full-text para búsqueda
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers 
  USING gin(to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, '')));
```

### 2. Tabla `orders`

```sql
-- 👈 MIGRACIÓN: Orders (Work Orders) table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  
  -- 👈 MIGRACIÓN: Customer info
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_additional_phones JSONB DEFAULT '[]'::jsonb,
  
  -- 👈 MIGRACIÓN: Device info
  device_type TEXT NOT NULL,
  device_brand TEXT,
  device_subcategory TEXT,
  device_family TEXT,
  device_model TEXT,
  device_color TEXT,
  device_serial TEXT,
  
  -- 👈 MIGRACIÓN: Problem & media
  initial_problem TEXT,
  device_photos JSONB DEFAULT '[]'::jsonb,
  photos_metadata JSONB DEFAULT '[]'::jsonb,
  
  -- 👈 MIGRACIÓN: Security
  device_security JSONB,
  
  -- 👈 MIGRACIÓN: Repair tasks & items
  known_issues JSONB DEFAULT '[]'::jsonb,
  repair_tasks JSONB DEFAULT '[]'::jsonb,
  parts_needed JSONB DEFAULT '[]'::jsonb,
  order_items JSONB DEFAULT '[]'::jsonb,
  
  -- 👈 MIGRACIÓN: Pricing
  labor_cost NUMERIC(12, 2) DEFAULT 0.00,
  cost_estimate NUMERIC(12, 2) DEFAULT 0.00,
  amount_paid NUMERIC(12, 2) DEFAULT 0.00,
  balance_due NUMERIC(12, 2) DEFAULT 0.00,
  paid BOOLEAN DEFAULT false,
  deposit_amount NUMERIC(12, 2) DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  tax_rate NUMERIC(5, 4) DEFAULT 0.1150,
  
  -- 👈 MIGRACIÓN: Status & workflow
  status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN (
    'intake', 'diagnosing', 'awaiting_approval', 'waiting_parts', 
    'in_progress', 'ready_for_pickup', 'picked_up', 'completed'
  )),
  status_note TEXT,
  status_note_visible_to_customer BOOLEAN DEFAULT false,
  status_metadata JSONB,
  status_history JSONB DEFAULT '[]'::jsonb,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  estimated_completion DATE,
  
  -- 👈 MIGRACIÓN: Checklist
  checklist_items JSONB DEFAULT '[]'::jsonb,
  checklist_notes TEXT,
  
  -- 👈 MIGRACIÓN: Comments & notes
  comments JSONB DEFAULT '[]'::jsonb,
  
  -- 👈 MIGRACIÓN: Signature & terms
  customer_signature TEXT,
  customer_signature_meta JSONB,
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  
  -- 👈 MIGRACIÓN: Assignment & tracking
  created_by TEXT,
  created_by_name TEXT,
  created_by_role TEXT,
  assigned_to TEXT,
  assigned_to_name TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- 👈 MIGRACIÓN: B2B fields
  company_id TEXT,
  company_name TEXT,
  po_number TEXT,
  net_terms TEXT,
  tax_exempt BOOLEAN DEFAULT false,
  sla_level TEXT,
  logistics JSONB,
  account_summary JSONB,
  
  -- 👈 MIGRACIÓN: Soft delete
  deleted BOOLEAN DEFAULT false,
  deleted_by TEXT,
  deleted_at TIMESTAMPTZ,
  wo_to_sale_id UUID,
  can_reopen BOOLEAN DEFAULT false,
  
  -- 👈 MIGRACIÓN: Timestamps
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  
  -- 👈 MIGRACIÓN: Foreign key
  CONSTRAINT fk_customer FOREIGN KEY (customer_id) 
    REFERENCES customers(id) ON DELETE RESTRICT
);

-- 👈 MIGRACIÓN: Índices optimizados
CREATE INDEX IF NOT EXISTS idx_orders_created_date ON orders (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_deleted ON orders (deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders (priority) WHERE priority != 'normal';

-- 👈 MIGRACIÓN: Índice compuesto para dashboard
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders (status, created_date DESC) WHERE deleted = false;
```

### 3. Tabla `work_order_events`

```sql
-- 👈 MIGRACIÓN: Work Order Events (Audit log)
CREATE TABLE IF NOT EXISTS work_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_number TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'create', 'status_change', 'note_added', 'media_uploaded',
    'item_added', 'item_removed', 'item_updated', 'field_updated',
    'payment', 'email_sent', 'message_sent', 'call_logged', 'checklist_updated'
  )),
  description TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_role TEXT,
  metadata JSONB,
  is_private BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  
  -- 👈 MIGRACIÓN: Foreign key
  CONSTRAINT fk_order FOREIGN KEY (order_id) 
    REFERENCES orders(id) ON DELETE CASCADE
);

-- 👈 MIGRACIÓN: Índices optimizados
CREATE INDEX IF NOT EXISTS idx_events_created_date ON work_order_events (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_order_id ON work_order_events (order_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON work_order_events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON work_order_events (user_id) WHERE user_id IS NOT NULL;

-- 👈 MIGRACIÓN: Índice compuesto para timeline
CREATE INDEX IF NOT EXISTS idx_events_order_date ON work_order_events (order_id, created_date DESC);
```

---

## 🔧 Funciones Netlify Requeridas

### Archivo: `functions/customersSearch.js`

**Endpoint:** `POST /.netlify/functions/customersSearch`

**Request Body:**
```json
{
  "query": "Juan",
  "limit": 15
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-xxx",
      "name": "Juan Pérez",
      "phone": "787-555-1234",
      "email": "juan@email.com",
      "total_orders": 5,
      "loyalty_tier": "silver"
    }
  ],
  "count": 1,
  "backend": "neon"
}
```

**Lógica:**
- Buscar por `name ILIKE %query%` OR `phone ILIKE %query%` OR `email ILIKE %query%`
- Ordenar por: match exacto > empieza con > contiene
- Limit 15 resultados

---

### Archivo: `functions/customersUpsert.js`

**Endpoint:** `POST /.netlify/functions/customersUpsert`

**Request Body:**
```json
{
  "customer": {
    "name": "Juan Pérez",
    "phone": "787-555-1234",
    "email": "juan@email.com"
  },
  "upsert_by": "phone"
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "name": "Juan Pérez",
    "created": false
  },
  "backend": "neon"
}
```

**Lógica:**
- Si existe por `phone` → UPDATE
- Si no existe → INSERT
- Retornar `created: true|false`

---

### Archivo: `functions/ordersCreate.js`

**Endpoint:** `POST /.netlify/functions/ordersCreate`

**Request Body:**
```json
{
  "order": {
    "order_number": "WO-12345678",
    "customer_id": "uuid-xxx",
    "customer_name": "Juan Pérez",
    "customer_phone": "787-555-1234",
    "device_type": "Smartphone",
    "device_brand": "Apple",
    "device_model": "iPhone 15 Pro",
    "initial_problem": "Pantalla rota",
    "status": "intake",
    "created_by": "admin@smartfix.com"
  }
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-yyy",
    "order_number": "WO-12345678",
    "created_date": "2025-01-16T10:30:00Z"
  },
  "backend": "neon"
}
```

**Lógica:**
- Validar que `customer_id` existe
- Insertar orden con defaults
- Crear evento inicial de "create"
- Retornar orden completa

---

### Archivo: `functions/ordersList.js`

**Endpoint:** `POST /.netlify/functions/ordersList`

**Request Body:**
```json
{
  "limit": 50,
  "offset": 0,
  "status": "intake",
  "deleted": false
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-yyy",
      "order_number": "WO-12345678",
      "customer_name": "Juan Pérez",
      "status": "intake",
      "created_date": "2025-01-16T10:30:00Z"
    }
  ],
  "count": 1,
  "backend": "neon"
}
```

**Lógica:**
- Filtrar por `status` (opcional)
- Filtrar por `deleted = false` (default)
- Ordenar por `created_date DESC`
- Limit/offset para paginación

---

### Archivo: `functions/ordersEventsAdd.js`

**Endpoint:** `POST /.netlify/functions/ordersEventsAdd`

**Request Body:**
```json
{
  "event": {
    "order_id": "uuid-yyy",
    "order_number": "WO-12345678",
    "event_type": "status_change",
    "description": "Estado cambiado a 'in_progress'",
    "user_name": "Yuka Admin",
    "metadata": {
      "from": "intake",
      "to": "in_progress"
    }
  }
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-zzz",
    "created_date": "2025-01-16T11:00:00Z"
  },
  "backend": "neon"
}
```

**Lógica:**
- Validar que `order_id` existe
- Insertar evento con timestamp
- Retornar ID del evento

---

## 🔄 Cambios en `dataClient.js`

### Extender adapters con métodos custom

```javascript
// 👈 MIGRACIÓN: Agregar a base44Client.entities.Customer
const base44CustomerAdapter = {
  ...createBase44Adapter("Customer"),
  
  // 👈 MIGRACIÓN: Búsqueda optimizada
  async search(query) {
    const allCustomers = await base44.entities.Customer.list("-updated_date", 200);
    return allCustomers.filter(c => 
      c.name?.toLowerCase().includes(query.toLowerCase()) ||
      c.phone?.includes(query) ||
      c.email?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 15);
  },
  
  // 👈 MIGRACIÓN: Upsert por teléfono
  async upsert(customerData, upsertBy = 'phone') {
    const existing = await base44.entities.Customer.filter({ 
      [upsertBy]: customerData[upsertBy] 
    });
    
    if (existing?.length) {
      await base44.entities.Customer.update(existing[0].id, customerData);
      return { ...existing[0], ...customerData, created: false };
    } else {
      const created = await base44.entities.Customer.create(customerData);
      return { ...created, created: true };
    }
  }
};

// 👈 MIGRACIÓN: Agregar a neonClient.entities.Customer
const neonCustomerAdapter = {
  ...createNeonAdapter("Customer"),
  
  // 👈 MIGRACIÓN: Búsqueda optimizada
  async search(query) {
    const response = await fetch(`/.netlify/functions/customersSearch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 15 })
    });
    const result = await response.json();
    return result.data || [];
  },
  
  // 👈 MIGRACIÓN: Upsert
  async upsert(customerData, upsertBy = 'phone') {
    const response = await fetch(`/.netlify/functions/customersUpsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: customerData, upsert_by: upsertBy })
    });
    const result = await response.json();
    return result.data;
  }
};

// 👈 MIGRACIÓN: Agregar a base44Client.entities.Order
const base44OrderAdapter = {
  ...createBase44Adapter("Order"),
  
  // 👈 MIGRACIÓN: Eventos de orden
  events: {
    async add(eventData) {
      return await base44.entities.WorkOrderEvent.create(eventData);
    },
    async list(orderId) {
      return await base44.entities.WorkOrderEvent.filter({ order_id: orderId }, "-created_date");
    }
  }
};

// 👈 MIGRACIÓN: Agregar a neonClient.entities.Order
const neonOrderAdapter = {
  ...createNeonAdapter("Order"),
  
  // 👈 MIGRACIÓN: Eventos de orden
  events: {
    async add(eventData) {
      const response = await fetch(`/.netlify/functions/ordersEventsAdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: eventData })
      });
      const result = await response.json();
      return result.data;
    },
    async list(orderId) {
      const response = await fetch(`/.netlify/functions/ordersEventsList`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId })
      });
      const result = await response.json();
      return result.data || [];
    }
  }
};
```

---

## 📝 Archivos a Modificar (Fase 2)

### Prioridad Alta (Core)
1. `pages/Customers.jsx` → usar `dataClient.entities.Customer`
2. `pages/Orders.jsx` → usar `dataClient.entities.Order`
3. `components/workorder/WorkOrderWizard.jsx` → usar `dataClient.entities.Order.create()`
4. `components/customers/CreateCustomerDialog.jsx` → usar `dataClient.entities.Customer.upsert()`

### Prioridad Media (Details)
5. `components/orders/OrderDetailDialog.jsx` → usar `dataClient.entities.Order.events.add()`
6. `components/orders/WorkOrderPanel.jsx` → usar `dataClient.entities.Order.events.list()`
7. `components/customers/CustomerOrdersDialog.jsx` → usar `dataClient.entities.Order.filter()`

### Prioridad Baja (Utilities)
8. `components/utils/SafeOrderService.js` → adaptar si es necesario
9. `components/utils/sequenceHelpers.js` → migrar si usa entidades

---

## 🧪 Tests Recomendados (Fase 2)

### Test 1: Búsqueda de Clientes
```javascript
// En consola del navegador
import { dataClient } from "@/components/utils/dataClient";

const results = await dataClient.entities.Customer.search("Juan");
console.log(results); // Debe retornar clientes que matcheen "Juan"
```

### Test 2: Upsert de Cliente
```javascript
const customer = await dataClient.entities.Customer.upsert({
  name: "Test Cliente",
  phone: "787-555-9999",
  email: "test@test.com"
}, "phone");

console.log(customer.created); // true si es nuevo, false si actualizó
```

### Test 3: Crear Orden
```javascript
const order = await dataClient.entities.Order.create({
  order_number: "WO-TEST-001",
  customer_id: customer.id,
  customer_name: "Test Cliente",
  customer_phone: "787-555-9999",
  device_type: "Smartphone",
  status: "intake",
  created_by: "admin@test.com"
});

console.log(order.id); // UUID de la orden creada
```

### Test 4: Agregar Evento
```javascript
const event = await dataClient.entities.Order.events.add({
  order_id: order.id,
  order_number: order.order_number,
  event_type: "status_change",
  description: "Test de evento",
  user_name: "Test User"
});

console.log(event.id); // UUID del evento
```

---

## 📊 Métricas de Migración

### Pre-Migración (Baseline)
- [ ] Contar registros en Base44:
  - Customers: `await base44.entities.Customer.list().length`
  - Orders: `await base44.entities.Order.list().length`
  - Events: `await base44.entities.WorkOrderEvent.list().length`

### Post-Migración (Validation)
- [ ] Contar registros en Neon:
  - `SELECT COUNT(*) FROM customers`
  - `SELECT COUNT(*) FROM orders`
  - `SELECT COUNT(*) FROM work_order_events`
- [ ] Comparar counts: Base44 === Neon
- [ ] Validar foreign keys: todos los `order.customer_id` existen en `customers`
- [ ] Validar eventos: todos los `event.order_id` existen en `orders`

---

## ⚠️ Consideraciones Importantes

### 1. Orden de Migración
```
customers → orders → work_order_events
```
(Respetar foreign keys)

### 2. Datos Relacionados
- Cada `order` requiere un `customer_id` válido
- Cada `work_order_event` requiere un `order_id` válido
- Migrar customers PRIMERO, luego orders, luego events

### 3. Validación de Integridad
```sql
-- 👈 MIGRACIÓN: Verificar órdenes huérfanas
SELECT COUNT(*) FROM orders 
WHERE customer_id NOT IN (SELECT id FROM customers);

-- 👈 MIGRACIÓN: Verificar eventos huérfanos
SELECT COUNT(*) FROM work_order_events 
WHERE order_id NOT IN (SELECT id FROM orders);
```

---

## 🚀 Timeline Estimado

### Sprint 2 - Customers & Orders (5-7 días)
- **Día 1-2:** Crear schema SQL y funciones Netlify
- **Día 3-4:** Migrar componentes de Customers
- **Día 5-6:** Migrar componentes de Orders
- **Día 7:** Testing completo y validación

### Rollout Gradual
1. Testing local con `VITE_DATA_BACKEND=neon`
2. Deploy a Netlify (staging) con `VITE_DATA_BACKEND=neon`
3. Validar 48 horas
4. Migrar datos de producción
5. Cambiar `VITE_DATA_BACKEND=neon` en producción

---

## 📌 Notas Finales

**NO implementar aún** - Este es solo el plan.

Ejecutar Fase 2 **solo después** de que Fase 1 (Finanzas) esté 100% validada en producción.

---

**Última actualización:** 2025-01-16  
**Status:** 📝 Plan Aprobado - Pendiente Implementación

# Fase 4 — Edición de Order + Cambio de Estado + Cola (SmartNative iOS)

> Pegar al agente de Xcode. Self-contained.

---

## Misión

Hacer que las órdenes sean **editables** después de crearlas. Tres capacidades nuevas en `OrderDetailView`:

1. **Modo edición**: lápices ocultos por default; botón "Editar" arriba revela los campos editables (patrón que ya probamos en Capacitor — funciona)
2. **Cambio de estado manual**: selector grande arriba con TODOS los 12 estados (filosofía "manual primero" — no automatic flow)
3. **Cola de trabajo**: bottom sheet con órdenes accionables ordenadas por #, accesible desde `OrdersListView`

Plus: log de actividad (audit trail), agregar notas, y el botón stub "notificar cliente" (la lógica del email/SMS va en Fase 5).

**Fuente arquitectónica**: `IOS_NATIVE_CLONE_PROMPT.md` §6.1 (estados) y §6.4 (queue).

---

## 1. Lo que existe ya (no rehagas)

Después de Phases 0–3:

- `OrderDetailView` read-only renderea todos los campos
- `Order` modelo con `OrderStatus` enum (12 estados)
- `OrderRepository.fetch...` métodos
- `OrderAPI.createWorkOrder()` con retry y unique constraint detection
- Pattern de toast no-bloqueante (`vm.activeToast`, bottom-center, 2.2s)
- `Money.swift` para Decimal helpers
- `EmptyStateView(subtitle:)` — usa `subtitle:`, NO `message:`
- `SupabaseClient.select(from:)` — usa `from:`, NO `table:`
- `[String: Any]` para columnas JSONB (gotcha de Phase 3)

**Reusalo. No rebuild.**

---

## 2. Lo que tienes que crear

```
Features/Orders/
├── OrderDetailView.swift                    # ⬅ AMPLIAR existente
├── OrderDetailViewModel.swift               # NUEVO — @Observable
├── EditMode/
│   ├── EditableFieldRow.swift               # Row con lápiz que aparece en edit mode
│   ├── InlineEditSheet.swift                # Sheet modal para editar 1 campo
│   └── EditableSecuritySection.swift        # PIN/password/patrón editable
├── Status/
│   ├── StatusChangeSheet.swift              # Bottom sheet con los 12 estados
│   └── StatusBadge.swift                    # Pill con color/label/dot animado
├── Activity/
│   ├── ActivityLogView.swift                # Lista del audit_log de la orden
│   ├── AddNoteSheet.swift                   # Modal para agregar nota
│   └── ActivityRow.swift                    # Cada entry del log
├── Queue/
│   ├── OrderQueueSheet.swift                # Bottom sheet con cola
│   └── OrderQueueRow.swift                  # Card de cada orden en la cola
└── (existing) OrdersListView.swift           # ⬅ AGREGAR botón "Cola"

Core/Repositories/
└── OrderRepository.swift                    # ⬅ AGREGAR métodos update + changeStatus

Core/API/
└── OrderAPI.swift                           # ⬅ AGREGAR updateOrder + writeAuditLog

Core/Models/
├── AuditLogEntry.swift                      # NUEVO — modelo del audit_log
└── OrderUpdatePayload.swift                 # NUEVO — partial update typed
```

**Total estimado**: 12 archivos nuevos + 4 modificados, ~1,500 líneas.

---

## 3. Backend

### 3.1 Update parcial de orden

```swift
// Core/API/OrderAPI.swift
func updateOrder(orderId: UUID, fields: [String: Any]) async throws -> Order {
    let payload = fields.merging([
        "updated_date": ISO8601DateFormatter().string(from: Date())
    ]) { _, new in new }

    let response = try await supabase
        .from("order")
        .update(payload)
        .eq("id", value: orderId)
        .select()
        .execute()

    // .single() no existe en SmartNative SupabaseClient — usa el primer elemento
    let orders: [Order] = try response.decoded()
    guard let updated = orders.first else {
        throw APIError.notFound
    }
    return updated
}
```

⚠️ **Concurrencia / last-write-wins**: si dos técnicos editan la misma orden, gana el último. Para Fase 4 está OK — Fase 6+ podría agregar conflict detection con `If-Match` ETag. Por ahora, NO te preocupes.

### 3.2 Audit log

Cada cambio significativo escribe en `audit_log`:

```swift
struct AuditLogEntry: Codable, Identifiable {
    let id: UUID
    let tenantId: UUID
    let entityType: String          // "order"
    let entityId: UUID              // order.id
    let action: String              // "status_change" | "field_update" | "note_added"
    let actorId: UUID?              // app_employee.id
    let actorName: String           // "Francisco J Reyes"
    let changes: [String: Any]      // { "field": "status", "from": "intake", "to": "diagnosing" }
    let createdDate: Date
}

func writeAuditLog(
    entityId: UUID,
    action: String,
    changes: [String: Any]
) async throws {
    let actor = try await SessionStore.current.actor
    let entry: [String: Any] = [
        "tenant_id":  AppEnvironment.tenantId.uuidString,
        "entity_type": "order",
        "entity_id":  entityId.uuidString,
        "action":     action,
        "actor_id":   actor.id.uuidString,
        "actor_name": actor.fullName,
        "changes":    changes,             // JSONB en Supabase — usa [String: Any]
        "created_date": ISO8601DateFormatter().string(from: Date())
    ]
    try await supabase.from("audit_log").insert(entry).execute()
}
```

⚠️ El audit log NO debe bloquear el update. Si falla, log warning pero la operación principal sigue:
```swift
try await updateOrder(...)  // ← critical, throws si falla
Task.detached {              // ← background, fire-and-forget
    try? await writeAuditLog(...)
}
```

### 3.3 Cambio de estado

```swift
func changeStatus(
    orderId: UUID,
    from oldStatus: OrderStatus,
    to newStatus: OrderStatus,
    reason: String? = nil
) async throws -> Order {
    let updated = try await updateOrder(orderId: orderId, fields: [
        "status": newStatus.rawValue
    ])

    // Audit
    Task.detached {
        try? await writeAuditLog(
            entityId: orderId,
            action: "status_change",
            changes: [
                "from": oldStatus.rawValue,
                "to":   newStatus.rawValue,
                "reason": reason ?? NSNull()
            ]
        )
    }

    // Hook de notificación al cliente — Fase 5 implementa el send real
    if newStatus == .readyForPickup {
        // TODO Fase 5: trigger /notifyPickupReminder
        Logger.shared.info("ready_for_pickup: notification trigger pending (Fase 5)")
    }

    return updated
}
```

### 3.4 Agregar nota

`order.notes` es columna `text` en Supabase. La estructura es **append-only con timestamp y autor**:

```swift
// Formato sugerido (igual que la versión Capacitor):
// [2026-05-04 14:32 — Francisco] Cliente pidió presupuesto adicional para batería.
// [2026-05-04 15:01 — Diana] Confirmado. Batería pedida con proveedor X.

func addNote(orderId: UUID, currentNotes: String, newNote: String) async throws -> Order {
    let actor = try await SessionStore.current.actor
    let timestamp = DateFormatter.shortLocal.string(from: Date())
    let entry = "[\(timestamp) — \(actor.fullName)] \(newNote)"
    let combined = currentNotes.isEmpty ? entry : "\(currentNotes)\n\(entry)"

    let updated = try await updateOrder(orderId: orderId, fields: ["notes": combined])

    Task.detached {
        try? await writeAuditLog(entityId: orderId, action: "note_added", changes: [
            "note": newNote
        ])
    }
    return updated
}
```

### 3.5 Query del audit log para una orden

```swift
func fetchActivityLog(orderId: UUID, limit: Int = 50) async throws -> [AuditLogEntry] {
    try await supabase
        .from("audit_log")
        .select(from: "audit_log",
                filters: ["entity_type": "order", "entity_id": orderId.uuidString],
                order: "created_date.desc",
                limit: limit)
}
```

---

## 4. UX — Layout de OrderDetailView ampliada

```
┌──────────────────────────────────────────┐
│ ←        Detalles            ✏️ Editar  │ ← header (Fase 1 ya tiene back)
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │ ← STATUS PICKER (selector manual)
│  │ ●  ESTADO ACTUAL                   │  │   tap → abre StatusChangeSheet
│  │    Diagnóstico                     │  │   color del estado actual
│  │    Sugerido: En Reparación      ⌄ │  │   chevron animado
│  └────────────────────────────────────┘  │
│                                          │
│  Acciones      Info       Historial      │ ← tabs (Fase 1 ya tiene)
│  ──────       ─────       ─────          │
│                                          │
│  [Tab content render aquí]               │
│                                          │
│  En Info: rows con lápiz cuando edit=on  │
│  En Historial: ActivityLogView           │
│                                          │
└──────────────────────────────────────────┘
```

### 4.1 Toggle "Editar" en el header

Reusa el patrón de Capacitor:
- Botón derecho en header: `Pencil` (azul) cuando `editMode = false`, `Check` (verde) cuando `editMode = true`
- Texto: "Editar" / "Listo"
- Tap alterna `vm.editMode`
- Cuando `editMode = false`: rows son tap-no-op, sin lápiz visible
- Cuando `editMode = true`: rows muestran lápiz azul (`apple-blue/80`), tap abre `InlineEditSheet`

### 4.2 Status picker arriba (siempre visible, no detrás de tab)

```swift
Button {
    vm.showStatusSheet = true
} label: {
    HStack(spacing: 12) {
        Circle()
            .fill(vm.order.status.color)
            .frame(width: 10, height: 10)
            .shadow(color: vm.order.status.color.opacity(0.5), radius: 4)

        VStack(alignment: .leading, spacing: 2) {
            Text("ESTADO ACTUAL")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .tracking(0.5)

            Text(vm.order.status.label)
                .font(.headline)
                .foregroundStyle(.primary)

            if let suggested = vm.suggestedNextStatus {
                Text("Sugerido: \(suggested.label)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }

        Spacer()

        Image(systemName: "chevron.down")
            .foregroundStyle(.secondary)
            .rotationEffect(.degrees(vm.showStatusSheet ? 180 : 0))
            .animation(.easeInOut(duration: 0.2), value: vm.showStatusSheet)
    }
    .padding(16)
    .background(RoundedRectangle(cornerRadius: 16).fill(.regularMaterial))
}
.sheet(isPresented: $vm.showStatusSheet) {
    StatusChangeSheet(currentStatus: vm.order.status, onSelect: { new in
        Task { await vm.changeStatus(to: new) }
    })
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
}
```

⚠️ **Filosofía**: el "Sugerido" es una pista sutil; NO es una flecha automática. El usuario decide.

### 4.3 InlineEditSheet — modal para editar 1 campo

```swift
struct InlineEditSheet: View {
    let label: String
    @State var draft: String
    let inputMode: UIKeyboardType
    let onSave: (String) async -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section(label) {
                    TextField(label, text: $draft, axis: .vertical)
                        .keyboardType(inputMode)
                        .lineLimit(3...8)
                }
            }
            .navigationTitle(label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        Task {
                            await onSave(draft)
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
```

### 4.4 OrderActivityLogView — tab "Historial"

```swift
struct ActivityLogView: View {
    let entries: [AuditLogEntry]

    var body: some View {
        if entries.isEmpty {
            EmptyStateView(
                icon: "clock.arrow.circlepath",
                title: "Sin actividad",
                subtitle: "Los cambios y notas aparecerán aquí"
            )
        } else {
            List(entries) { entry in
                ActivityRow(entry: entry)
            }
            .listStyle(.plain)
            .refreshable { await vm.refreshActivity() }
        }
    }
}

struct ActivityRow: View {
    let entry: AuditLogEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: entry.icon)
                .foregroundStyle(entry.tint)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(entry.summary)        // "Estado: Diagnóstico → En Reparación"
                    .font(.subheadline)

                HStack(spacing: 6) {
                    Text(entry.actorName).bold()
                    Text("·").foregroundStyle(.tertiary)
                    Text(entry.relativeTime)
                        .foregroundStyle(.secondary)
                }
                .font(.caption)
            }
        }
        .padding(.vertical, 4)
    }
}
```

### 4.5 OrderQueueSheet (cola desde OrdersListView)

Replica del Capacitor:

```swift
struct OrderQueueSheet: View {
    @State private var vm = OrderQueueViewModel()
    let onSelectOrder: (Order) -> Void

    var body: some View {
        NavigationStack {
            List(vm.queue) { order in
                Button {
                    onSelectOrder(order)
                } label: {
                    OrderQueueRow(order: order, position: vm.position(of: order))
                }
                .buttonStyle(.plain)
            }
            .listStyle(.plain)
            .navigationTitle("Cola de trabajo")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
```

Estados accionables (igual que Capacitor): `intake`, `diagnosing`, `inProgress`, `warranty`. Ordenados por `order_number` ascendente.

En `OrdersListView`:
```swift
.toolbar {
    ToolbarItem(placement: .topBarLeading) {
        Button {
            showQueueSheet = true
        } label: {
            Label("Cola", systemImage: "list.bullet.rectangle")
                .badge(vm.queueCount > 0 ? vm.queueCount : nil)  // iOS 16+ badge
        }
    }
}
.sheet(isPresented: $showQueueSheet) {
    OrderQueueSheet(onSelectOrder: { order in
        showQueueSheet = false
        vm.openOrder(order)
    })
}
```

---

## 5. Las gotchas específicas de Phase 4

### Gotcha 1 — Optimistic updates

Cuando el usuario cambia estado o edita campo, **actualiza la UI primero**, luego sync al server. Si el server falla, revierte:

```swift
@Observable
final class OrderDetailViewModel {
    var order: Order
    var isSaving = false

    func changeStatus(to newStatus: OrderStatus) async {
        let oldStatus = order.status
        order.status = newStatus               // 1. UI inmediata
        isSaving = true

        do {
            let updated = try await OrderAPI.changeStatus(
                orderId: order.id, from: oldStatus, to: newStatus
            )
            order = updated                    // 2. Sync con server data fresh
            showToast("Estado actualizado")
        } catch {
            order.status = oldStatus           // 3. Rollback en error
            showToast("No se pudo actualizar", isError: true)
        }
        isSaving = false
    }
}
```

### Gotcha 2 — Audit log NO debe romper el flow principal

```swift
// ✅ correcto — log es fire-and-forget
try await updateOrder(...)               // crítico
Task.detached {                          // background
    try? await writeAuditLog(...)
}

// ❌ malo — si audit log falla, el usuario piensa que el update falló
try await updateOrder(...)
try await writeAuditLog(...)             // si esto throws, mal UX
```

### Gotcha 3 — Edit mode persiste el draft hasta guardar

Cuando el usuario abre `InlineEditSheet`, escribe, **toca afuera** (no Cancelar) → el sheet se descarta. ¿Qué hacemos con el draft? **Descartarlo silenciosamente**, no auto-save. La intención de salir sin tocar "Guardar" es no guardar.

```swift
// El @State del draft vive dentro del sheet — al cerrarse el sheet, se desmonta y el state se descarta
// Si el usuario quiere mantener el draft, tiene "Guardar"
```

### Gotcha 4 — Validación per status transition

Algunos estados requieren datos. Por ejemplo:
- `readyForPickup` requiere `cost_estimate` no nulo
- `delivered` requiere `amount_paid >= total` (orden pagada)

Antes de cambiar el estado, valida:

```swift
func validateTransition(to newStatus: OrderStatus) -> ValidationError? {
    switch newStatus {
    case .readyForPickup:
        if order.costEstimate == nil || order.costEstimate == 0 {
            return .missingField("cotización (cost_estimate)")
        }
    case .delivered:
        let balance = max(0, order.total - max(0, order.amountPaid))
        if balance > 0.01 {
            return .unpaidBalance(balance)
        }
    default:
        return nil
    }
    return nil
}
```

Si valida falla → muestra alert con razón, NO cambia el estado.

### Gotcha 5 — `amount_paid` legacy negativo (recordando Phase 2)

Mismo gotcha que en POS:
```swift
let amountPaid = max(0, order.amountPaid)         // ✅
let balance   = max(0, order.total - amountPaid)
```

NO permitas que la UI muestre balance negativo en ningún cálculo.

### Gotcha 6 — Suggested next status (la pista sutil)

```swift
extension OrderStatus {
    var suggestedNext: OrderStatus? {
        switch self {
        case .intake:           return .diagnosing
        case .diagnosing:       return .inProgress
        case .pendingOrder:     return .waitingParts
        case .waitingParts:     return .partArrivedWaitingDevice
        case .partArrivedWaitingDevice: return .inProgress
        case .reparacionExterna: return .inProgress
        case .inProgress:       return .readyForPickup
        case .readyForPickup:   return .delivered
        // estados terminales o paralelos: no sugieren next
        case .delivered, .cancelled, .warranty, .waitingCustomer:
            return nil
        }
    }
}
```

Es **solo una pista** mostrada bajo el estado actual — no clickable, no automatic. El usuario abre el sheet y elige a mano.

### Gotcha 7 — Notes append-only

Cuando agregas nota, **NO sobreescribes** `order.notes`. Append con timestamp + autor (ver §3.4). Si el usuario quiere editar una nota previa, **no puede** desde la app — ese es comportamiento legal/auditoría correcto. Para corregir, agrega nueva nota: "[Corrección a nota anterior] ..."

### Gotcha 8 — Hooks de notificación al cliente (stub para Fase 5)

Cuando status cambia a `readyForPickup`, la versión Capacitor dispara email/SMS al cliente. En Fase 4 **NO implementamos el send** — solo dejamos un TODO claro:

```swift
if newStatus == .readyForPickup {
    Logger.shared.info("[Fase 5 TODO] notify customer: \(order.customerPhone)")
    // En Fase 5: POST /notifyPickupReminder con order.id
}
```

Para que la UX sea consistente, el botón "Notificar cliente" puede aparecer en el tab Acciones, **pero al tocarlo solo muestra**: "Esta función estará disponible próximamente." Mejor eso que un crash o nada.

### Gotcha 9 — Pull-to-refresh en OrderDetailView

El usuario puede pull-down en la vista para refrescar el order desde Supabase + el audit log:

```swift
.refreshable {
    await vm.refreshOrder()
    await vm.refreshActivity()
}
```

Útil cuando otro técnico hace cambios en otra device — al volver a la vista, ver cambios frescos.

---

## 6. Modelos clave

```swift
// Core/Models/AuditLogEntry.swift
struct AuditLogEntry: Codable, Identifiable {
    let id: UUID
    let tenantId: UUID
    let entityType: String          // "order"
    let entityId: UUID
    let action: String              // "status_change" | "field_update" | "note_added"
    let actorId: UUID?
    let actorName: String
    let changes: [String: AnyCodable]?
    let createdDate: Date

    var icon: String {
        switch action {
        case "status_change": return "arrow.triangle.2.circlepath"
        case "field_update":  return "pencil"
        case "note_added":    return "note.text"
        default:              return "circle"
        }
    }

    var tint: Color {
        switch action {
        case "status_change": return .blue
        case "field_update":  return .orange
        case "note_added":    return .purple
        default:              return .secondary
        }
    }

    var summary: String {
        switch action {
        case "status_change":
            let from = changes?["from"]?.stringValue ?? ""
            let to   = changes?["to"]?.stringValue ?? ""
            return "Estado: \(from) → \(to)"
        case "field_update":
            let field = changes?["field"]?.stringValue ?? "campo"
            return "Editó \(field)"
        case "note_added":
            return "Agregó una nota"
        default:
            return action
        }
    }

    var relativeTime: String {
        createdDate.formatted(.relative(presentation: .named))
    }
}

// AnyCodable porque el JSONB puede tener cualquier shape
struct AnyCodable: Codable {
    let value: Any
    var stringValue: String? { value as? String }
    // ... init(from decoder), encode(to encoder), etc.
}
```

```swift
// Core/Models/OrderUpdatePayload.swift — para typed updates cuando es solo un campo
enum OrderField: String {
    case customerName  = "customer_name"
    case customerPhone = "customer_phone"
    case customerEmail = "customer_email"
    case deviceModel   = "device_model"
    case deviceImei    = "device_imei"
    case initialProblem = "initial_problem"
    case costEstimate  = "cost_estimate"
    case assignedToName = "assigned_to_name"
    case repairType    = "repair_type"
    case laborRate     = "labor_rate"
    case notes         = "notes"
    case status        = "status"
}
```

---

## 7. Plan de implementación (5 días)

### Día 1 — Repository + ViewModel + status sheet

- [ ] Extender `OrderRepository` con `update(orderId:fields:)`, `changeStatus(...)`, `addNote(...)`, `fetchActivityLog(...)`
- [ ] Extender `OrderAPI` con `updateOrder`, `writeAuditLog`
- [ ] Crear `OrderDetailViewModel` (`@Observable`) con todos los state slots
- [ ] `StatusChangeSheet` (medium detent) con los 12 estados, current marcado, suggested marcado
- [ ] `StatusBadge` componente (pill con dot animado)
- [ ] Wire del status picker en `OrderDetailView`
- [ ] Test: cambiar estado de una orden real → ver en Supabase + en audit_log

### Día 2 — Edit mode + InlineEditSheet

- [ ] Toggle "Editar" / "Listo" en el header
- [ ] `EditableFieldRow` que muestra lápiz cuando `editMode = true`
- [ ] `InlineEditSheet` con form + Cancelar/Guardar
- [ ] Wire de los 8 campos editables en el tab Info: customer name/phone/email, device model, IMEI, initial problem, cost estimate, assigned tech, notes
- [ ] Optimistic updates con rollback en error
- [ ] Test: editar 5 campos diferentes → todos persisten + audit log

### Día 3 — Activity log + Add note

- [ ] `ActivityLogView` con List de entries
- [ ] `ActivityRow` con icon, summary, actor, relative time
- [ ] `AddNoteSheet` con TextEditor + Guardar
- [ ] `EditableSecuritySection` para PIN/password/patrón (reusa `Step5_SecurityView` pattern)
- [ ] Tab "Historial" en OrderDetailView muestra activity log
- [ ] Pull-to-refresh refresca order + activity

### Día 4 — Queue sheet

- [ ] `OrderQueueViewModel` con filtros de estados accionables
- [ ] `OrderQueueRow` (card con position, status badge, customer, device, time)
- [ ] `OrderQueueSheet` con List + drag indicator
- [ ] Botón "Cola" en `OrdersListView` toolbar con badge de count
- [ ] Tap en orden de la cola → cierra sheet → abre detail
- [ ] Test: cola muestra solo intake/diagnosing/inProgress/warranty, ordenadas correctamente

### Día 5 — Validación + polish

- [ ] `validateTransition(to:)` con casos para readyForPickup y delivered
- [ ] Alert nativo cuando validación falla (con razón clara)
- [ ] Botón stub "Notificar cliente" en tab Acciones (muestra info modal)
- [ ] Haptic feedback en cambio de estado (`.sensoryFeedback(.success)`)
- [ ] Loading states en cada operación async
- [ ] Test final: editar 3 órdenes reales con cambio de estado, notas, edición de campos

---

## 8. Definition of Done

- [ ] Botón "Editar" en header alterna modo edición; lápices visibles solo en edit mode
- [ ] Tap en cualquier campo (en edit mode) abre `InlineEditSheet`
- [ ] Guardar campo → optimistic update + sync + audit log + toast
- [ ] Cancelar edición → revierte al valor original
- [ ] Status picker arriba siempre visible con color y label correctos
- [ ] Tap status → bottom sheet con 12 estados, current y suggested marcados
- [ ] Cambiar estado → optimistic + sync + audit log + toast + haptic
- [ ] Validación bloquea transición a `readyForPickup` sin cotización
- [ ] Validación bloquea transición a `delivered` con balance pendiente
- [ ] Tab "Historial" lista actividad real del audit_log
- [ ] Botón "Agregar nota" abre sheet, guarda con timestamp + autor
- [ ] Notas se concatenan, NO se sobreescriben
- [ ] Botón "Cola" en OrdersListView abre bottom sheet con cola activa
- [ ] Cola filtra por estados accionables, ordena por order_number ASC
- [ ] Tap en orden de cola → abre detail
- [ ] Pull-to-refresh en OrderDetailView refresca order + activity
- [ ] Botón "Notificar cliente" muestra "próximamente" sin crashear
- [ ] Sin internet: edición falla con toast claro, NO se duplica al reconectar
- [ ] 5 órdenes editadas en device físico, todas verificadas en Supabase

---

## 9. Fuera de alcance para Phase 4

- ❌ Eliminar order (Fase 5 - admin)
- ❌ Imprimir / generar PDF (Fase 5)
- ❌ **Enviar SMS / email al cliente** (Fase 5 — solo el botón stub aquí)
- ❌ Refund / payment edit (flujo separado — Fase 5)
- ❌ Editar fotos del paso wizard (solo viewer; agregar/borrar fotos = Fase 5)
- ❌ Conflict detection cuando 2 técnicos editan al mismo tiempo (Fase 6+)
- ❌ Offline edits queue (Fase 6 — por ahora muestra error si hay red caída)
- ❌ Edit history rollback / restaurar versión previa (Fase 6+)
- ❌ Asignar/cambiar dispositivo después de creación (riesgo de inconsistencia — fuera de scope)
- ❌ AI suggestions (NUNCA — IA solo en Órdenes de Compra)

---

## 10. Cuando termines

1. Probá editar 3 órdenes reales en device físico
2. Verificá `audit_log` en Supabase Dashboard tiene los entries esperados
3. Verificá que `notes` concatena, NO sobreescribe
4. Probá cambiar estado a `delivered` con balance pendiente → debe bloquearse
5. Probá la cola con 5+ órdenes activas
6. Hacé commit en rama `feat/order-edit` y reportá:
   - Líneas + archivos creados
   - Decisiones arquitectónicas no obvias
   - Nuevos gotchas (agregalos a §12.5 del master)
   - Capturas: edit mode on/off, status sheet, queue sheet, activity log

Después seguimos con **Fase 5 — Notificaciones + Print + Apple Pay**.

---

> **TL;DR**: OrderDetailView ampliada con 3 capacidades: edit mode toggle (lápices ocultos por default), status picker manual arriba (filosofía manual primero), y queue sheet en OrdersListView. Optimistic updates con rollback. Audit log fire-and-forget. Validación per transición de estado. Notes append-only con timestamp+autor. Botón "Notificar cliente" stub para Fase 5. ~1,500 líneas, 12 archivos nuevos + 4 modificados, 5 días.

# Bypass de Demo (DEBUG-only) — SmartNative iOS

> Pegar al agente. Self-contained. Es un patch chico, no una fase.

---

## Misión

Agregar un **botón de bypass en `AuthView`** que solo existe en builds DEBUG, deja entrar a la app sin crear usuario, y muestra una banda visible "MODO DEMO" para que nadie confunda esto con producción.

**Objetivo del usuario**: explorar todas las pantallas (Dashboard, POS, Orders, Customers, Inventory, etc.) con datos simulados antes de configurar cualquier cuenta real.

---

## 1. Reglas de oro

1. **TODO el código del bypass va dentro de `#if DEBUG ... #endif`**. En Release builds no existe ni el botón ni la lógica.
2. Bypass NO toca Supabase real — datos 100% mock locales. Cero riesgo de modificar tenants reales.
3. Banner permanente "MODO DEMO" cuando el bypass está activo. Imposible olvidar que estás en simulación.
4. Cualquier intento de mutar datos (crear, editar, borrar) en modo demo → toast: "Operación bloqueada en modo demo".
5. Al salir de la app y reabrir, **NO persiste** la sesión demo (tiene que volver a tocar el botón).

---

## 2. Archivos a crear

```
Core/Demo/
├── DemoMode.swift               # Feature flag global (DEBUG-only)
├── MockData.swift               # Fixtures: 5 orders, 10 customers, 20 products
├── MockSession.swift            # Session fake para SessionStore
└── DemoModeBanner.swift         # Banner naranja flotante "MODO DEMO"

Core/Repositories/
├── OrderRepository.swift        # ⬅ AGREGAR fallback a MockData
├── CustomerRepository.swift     # ⬅ AGREGAR fallback
└── ProductRepository.swift      # ⬅ AGREGAR fallback

Features/Auth/
└── AuthView.swift               # ⬅ AGREGAR botón "Modo Demo" abajo del form
```

**Total**: 4 archivos nuevos + 4 modificados, ~300 líneas. **2-3 horas de trabajo**.

---

## 3. Implementación

### 3.1 `Core/Demo/DemoMode.swift`

```swift
#if DEBUG
import Foundation

/// Flag global que indica si el bypass está activo.
/// SOLO existe en builds DEBUG — el #if asegura que en Release ni el
/// símbolo se compila.
@MainActor
enum DemoMode {
    private static var _isActive = false
    static var isActive: Bool { _isActive }

    static func enable() {
        _isActive = true
    }

    static func disable() {
        _isActive = false
    }
}
#endif
```

### 3.2 `Core/Demo/MockData.swift`

```swift
#if DEBUG
import Foundation

enum MockData {
    static let tenantId = UUID(uuidString: "DEADBEEF-0000-0000-0000-000000000000")!
    static let demoTenantName = "Taller Demo"

    static let orders: [Order] = [
        Order(
            id: UUID(), tenantId: tenantId,
            orderNumber: "WO-25001",
            customerName: "Diana Rivera", customerPhone: "787-940-6884",
            deviceModel: "iPhone 15 Pro", deviceImei: "356789012345678",
            initialProblem: "Pantalla rota — tocando el lateral derecho hace flicker",
            status: .diagnosing, costEstimate: 285.00, total: 285.00, amountPaid: 0,
            assignedToName: "Francisco J Reyes", createdDate: Date().addingTimeInterval(-3600 * 4)
        ),
        Order(
            id: UUID(), tenantId: tenantId,
            orderNumber: "WO-25002",
            customerName: "Carlos Méndez", customerPhone: "787-555-0102",
            deviceModel: "Samsung Galaxy S23 Ultra",
            initialProblem: "No carga — probó dos cables, ninguno funciona",
            status: .inProgress, costEstimate: 110.00, total: 110.00, amountPaid: 50,
            assignedToName: "Diana Tech", createdDate: Date().addingTimeInterval(-3600 * 24)
        ),
        Order(
            id: UUID(), tenantId: tenantId,
            orderNumber: "WO-25003",
            customerName: "María Torres",
            deviceModel: "iPad Air 5",
            initialProblem: "Botón de inicio no responde",
            status: .readyForPickup, costEstimate: 95.00, total: 95.00, amountPaid: 95,
            assignedToName: "Francisco J Reyes",
            createdDate: Date().addingTimeInterval(-3600 * 48)
        ),
        Order(
            id: UUID(), tenantId: tenantId,
            orderNumber: "WO-25004",
            customerName: "Roberto Vélez",
            deviceModel: "MacBook Pro 14\" M3",
            initialProblem: "Teclado: tecla 'E' atascada",
            status: .waitingParts, costEstimate: 150.00, total: 150.00, amountPaid: 0,
            createdDate: Date().addingTimeInterval(-3600 * 72)
        ),
        Order(
            id: UUID(), tenantId: tenantId,
            orderNumber: "WO-25005",
            customerName: "Ana López",
            deviceModel: "AirPods Pro 2",
            initialProblem: "Audio izquierdo intermitente",
            status: .delivered, costEstimate: 45.00, total: 45.00, amountPaid: 45,
            assignedToName: "Diana Tech", createdDate: Date().addingTimeInterval(-3600 * 120)
        ),
    ]

    static let customers: [Customer] = [
        Customer(id: UUID(), tenantId: tenantId, fullName: "Diana Rivera", phone: "787-940-6884", email: "diana@example.com", totalOrders: 8),
        Customer(id: UUID(), tenantId: tenantId, fullName: "Carlos Méndez", phone: "787-555-0102", email: nil, totalOrders: 3),
        Customer(id: UUID(), tenantId: tenantId, fullName: "María Torres", phone: "787-555-0205", email: "maria@example.com", totalOrders: 12),
        Customer(id: UUID(), tenantId: tenantId, fullName: "Roberto Vélez", phone: "787-555-0341", email: nil, totalOrders: 1),
        Customer(id: UUID(), tenantId: tenantId, fullName: "Ana López", phone: "787-555-0488", email: "ana@example.com", totalOrders: 5),
        // ... 5 más sintéticos
    ]

    static let products: [Product] = [
        Product(id: UUID(), tenantId: tenantId, name: "Pantalla iPhone 15 Pro", sku: "SCR-IP15P", category: "Pantallas", price: 285.00, cost: 180.00, stock: 5, minStock: 2),
        Product(id: UUID(), tenantId: tenantId, name: "Batería iPhone 13", sku: "BAT-IP13", category: "Baterías", price: 65.00, cost: 28.00, stock: 12, minStock: 3),
        Product(id: UUID(), tenantId: tenantId, name: "Conector de carga Samsung S23", sku: "CHG-SS23", category: "Piezas", price: 35.00, cost: 18.00, stock: 0, minStock: 2),
        Product(id: UUID(), tenantId: tenantId, name: "Diagnóstico básico", sku: "SVC-DIAG", category: "Servicios", price: 25.00, cost: 0, stock: -1, minStock: -1),
        Product(id: UUID(), tenantId: tenantId, name: "Mano de obra (1h)", sku: "SVC-LABOR1", category: "Servicios", price: 50.00, cost: 0, stock: -1, minStock: -1),
        // ... 15 más sintéticos
    ]

    static let dashboardKPIs = DashboardKPIs(
        totalOrdersToday: 3, totalOrdersWeek: 14, totalOrdersMonth: 47,
        revenueToday: 410.50, revenueWeek: 2_847.25, revenueMonth: 9_120.00,
        ordersInProgress: 6, ordersReadyForPickup: 2, ordersOverdue: 1,
        topProducts: [
            ("Pantalla iPhone 15 Pro", 8),
            ("Batería iPhone 13", 5),
            ("Diagnóstico básico", 12)
        ]
    )
}
#endif
```

⚠️ **Adapta los inits a los modelos reales del proyecto**. Si `Order` requiere otros campos, ajustá. La idea es que el array sea SINTÁCTICAMENTE válido y tenga datos realistas.

### 3.3 `Core/Demo/MockSession.swift`

```swift
#if DEBUG
import Foundation

enum MockSession {
    static func install() {
        // Inyecta una sesión fake en SessionStore para que el resto de la
        // app crea que hay user logueado. Adapta a tu shape real de Session.
        let session = Session(
            userId: UUID(uuidString: "DEADUSER-0000-0000-0000-000000000000")!,
            tenantId: MockData.tenantId,
            email: "demo@smartfixos.local",
            fullName: "Usuario Demo",
            role: "admin",
            accessToken: "demo-fake-token",
            expiresAt: Date.distantFuture
        )
        SessionStore.shared.current = session
        AppEnvironment.tenantId = MockData.tenantId
    }
}
#endif
```

### 3.4 `Core/Demo/DemoModeBanner.swift`

```swift
#if DEBUG
import SwiftUI

struct DemoModeBanner: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text("MODO DEMO — datos simulados")
                .fontWeight(.semibold)
                .lineLimit(1)
            Spacer()
            Text("DEBUG")
                .font(.caption2.bold())
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.black.opacity(0.2))
                .clipShape(Capsule())
        }
        .font(.caption)
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [.orange, .red],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
    }
}
#endif
```

### 3.5 Modificar `AuthView.swift`

Agregar abajo del form (después de Sign in with Apple si existe, o después del botón principal):

```swift
#if DEBUG
VStack(spacing: 8) {
    Divider()

    Button {
        DemoMode.enable()
        MockSession.install()
        // Trigger navegación al RootView (depende de tu router)
        AppRouter.shared.path = [.root]
    } label: {
        HStack(spacing: 8) {
            Image(systemName: "wand.and.stars")
            Text("Entrar en modo Demo")
                .fontWeight(.semibold)
            Image(systemName: "chevron.right")
                .font(.caption)
        }
        .foregroundStyle(.orange)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .stroke(.orange.opacity(0.5), lineWidth: 1)
        )
    }

    Text("Solo visible en DEBUG · explora la app sin red")
        .font(.caption2)
        .foregroundStyle(.secondary)
}
.padding(.top, 16)
#endif
```

### 3.6 Modificar `RootView.swift`

Mostrar el banner cuando demo mode está activo:

```swift
struct RootView: View {
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            #if DEBUG
            if DemoMode.isActive {
                DemoModeBanner()
            }
            #endif

            TabView(selection: $selectedTab) {
                // ... tabs existentes
            }
        }
    }
}
```

### 3.7 Modificar Repositories

Agregar fallback a mock data en cada método de fetch. Ejemplo:

```swift
// OrderRepository.swift
func fetchOrders(tenantId: UUID, limit: Int = 150) async throws -> [Order] {
    #if DEBUG
    if DemoMode.isActive {
        // Latencia fake para que se sienta real (200ms)
        try? await Task.sleep(for: .milliseconds(200))
        return MockData.orders
    }
    #endif

    return try await supabase
        .from("order")
        .select()
        .eq("tenant_id", value: tenantId)
        ...
}
```

Hacé lo mismo en:
- `OrderRepository.fetchOrder(id:)` → `MockData.orders.first(where: { $0.id == id })`
- `CustomerRepository.fetchCustomers(...)` → `MockData.customers`
- `ProductRepository.fetchActive(...)` → `MockData.products`
- `DashboardKPIRepository` → `MockData.dashboardKPIs`
- `OrderRepository.fetchActivityLog(orderId:)` → `[]` (vacío en demo)

### 3.8 Bloquear mutaciones en demo

En cada método de **escritura** (update, create, delete):

```swift
func updateOrder(orderId: UUID, fields: [String: Any]) async throws -> Order {
    #if DEBUG
    if DemoMode.isActive {
        await Toast.show("Operación bloqueada en modo demo", isError: true)
        throw DemoModeError.writeBlocked
    }
    #endif

    // ... lógica real
}
```

Aplica a:
- `OrderAPI.createWorkOrder` → bloqueado
- `OrderAPI.updateOrder` → bloqueado
- `OrderAPI.changeStatus` → bloqueado
- `CashRegisterAPI.recordSale` → bloqueado
- `OrderRepository.addNote` → bloqueado
- Cualquier otro `insert/update/delete`

```swift
#if DEBUG
enum DemoModeError: Error, LocalizedError {
    case writeBlocked
    var errorDescription: String? { "Operación bloqueada en modo demo" }
}
#endif
```

---

## 4. Definition of Done

Cuando termines, debe pasar todo esto:

- [ ] En Release build (Cmd+Shift+K → Cmd+B con "Release" config), el botón "Modo Demo" **no existe** ni en pantalla ni en el binario (`strings App.app | grep -i demo` debería volver vacío)
- [ ] En DEBUG, login screen muestra el botón naranja al final
- [ ] Tap en "Entrar en modo Demo" → navega al `RootView` directo, sin pasar por backend
- [ ] Banner naranja "MODO DEMO" visible permanentemente en TODOS los tabs
- [ ] Dashboard muestra los 5 KPIs mock
- [ ] Orders tab lista las 5 órdenes mock con sus statuses correctos
- [ ] Customers tab muestra los 10 clientes mock
- [ ] Inventory tab muestra los 20 productos mock
- [ ] POS tab carga los productos mock
- [ ] Tap en una orden → OrderDetailView muestra toda la info correctamente
- [ ] Intentar editar un campo → toast "Operación bloqueada en modo demo"
- [ ] Intentar cambiar estado → bloqueado con toast claro
- [ ] Intentar registrar venta en POS → bloqueado
- [ ] Cerrar la app y reabrir → vuelve al login (NO persiste)
- [ ] Toggle de Light/Dark mode funciona normal en demo

---

## 5. Cómo desactivar el bypass

**Para volver al modo normal**:
- Cierra la app y reábrela (la sesión demo no persiste en Keychain)
- O: en código, simplemente cambia el scheme a Release configuration (Product → Scheme → Edit Scheme → Run → Build Configuration: Release)

**Para borrar el bypass del proyecto** (cuando ya no lo necesites):
1. Borra `Core/Demo/` entero
2. Quita los `#if DEBUG ... #endif` de Repositories y AuthView
3. Quita el `import` y el banner de `RootView`

Como todo está envuelto en `#if DEBUG`, removerlo es una búsqueda + delete. ~5 minutos.

---

## 6. Fuera de alcance

- ❌ Demo mode con datos persistentes (lo que tocás se guarda) — no, es read-only siempre
- ❌ Demo mode disponible en TestFlight builds — solo Xcode local
- ❌ Onboarding/tour interactivo — eso es otra feature aparte
- ❌ Múltiples perfiles demo — solo uno
- ❌ Demo desde Settings (toggle) — solo el botón en login
- ❌ Login automático con cuenta real demo en Supabase — no, mock puro

---

## 7. Cuando termines

1. Probalo en Simulator: tap demo → navegar todos los tabs → verificar todos los datos visibles
2. Probá Release build localmente (Cmd+Shift+K, cambiar a Release config) → confirmar que NO aparece el botón
3. Reportá:
   - Archivos creados/modificados
   - Si `MockData` necesitó adaptar inits de modelos (algún campo que faltaba)
   - Capturas de: login con botón demo, banner en cada tab, una mutación bloqueada

Después seguimos con Phase 4 (edición + cambio de estado) cuando estés listo.

---

> **TL;DR**: 4 archivos nuevos en `Core/Demo/`, 4 modificados (AuthView, RootView, 3 repos). Todo `#if DEBUG`. Botón naranja en login, banner naranja arriba de tabs, mock data realista (5 orders + 10 customers + 20 products + KPIs), mutaciones bloqueadas con toast. Cero rastro en Release. ~300 líneas, 2-3 horas.

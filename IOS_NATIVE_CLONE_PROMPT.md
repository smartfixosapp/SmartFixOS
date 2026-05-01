# Prompt — Clonar SmartFixOS como App Nativa iOS (SwiftUI)

> **Para pegar en Xcode AI / Claude / GPT abriendo este mismo folder.**
> Este documento es la fuente única de verdad para construir un **clon nativo iOS** de SmartFixOS. El backend, los datos y los flujos NO cambian — solo la capa visual.

---

## 0. Contexto en una línea

Construir una app **nativa iOS en SwiftUI** que se conecta al **mismo backend Supabase** que la web/Capacitor existente, replicando todos los flujos de negocio pero con **UI 100% nativa iOS** (Liquid Glass, SF Symbols, navegación nativa, gestos iOS, sin WebView).

---

## 1. Misión

Tienes a la vista el folder `/Users/911smartfix/Desktop/Proyectos/SmartFixOS/`. **No toques nada de `apps/Smart/`** — esa es la versión Capacitor existente. Crea una carpeta nueva paralela:

```
SmartFixOS/
├── apps/
│   ├── Smart/              ← Capacitor existente (NO TOCAR)
│   └── SmartNative/        ← TU TRABAJO va aquí
│       └── SmartNative.xcodeproj
│       └── SmartNative/
│           ├── App/
│           ├── Features/
│           ├── Core/
│           ├── DesignSystem/
│           └── Resources/
```

El target produce un app `.ipa` nativo. **Sin Capacitor, sin WebView, sin React, sin JavaScript.** Todo Swift puro.

---

## 2. Backend (NO CAMBIA — fuente de verdad)

### 2.1 Supabase (la base de datos viva)

```
URL:        https://idntuvtabecwubzswpwi.supabase.co
Anon Key:   (lee de apps/Smart/.env → VITE_SUPABASE_ANON_KEY)
Schema:     public  (todas las tablas viven aquí)
APP_ID:     68f767a3d5fce1486d4cf555
```

Usa el SDK oficial **[supabase-swift](https://github.com/supabase/supabase-swift)** (`Package.swift`). NO te conectes manualmente con URLSession — usa `SupabaseClient`.

### 2.2 Vercel API (cloud functions críticas)

Algunos flujos pasan por endpoints serverless en Vercel (no llamarlos directo a Supabase, hay validaciones de servidor):

```
Base URL: https://smart-fix-os-smart.vercel.app
```

Endpoints esenciales:
- `POST /api/cash-register` — abrir/cerrar caja, registrar venta (`{action: "open"|"close"|"record_sale", ...}`)
- `POST /api/register` — alta de tenant nuevo
- `POST /api/manage-tenant` — admin de tenant
- `POST /api/admin-otp` + `POST /api/validate-token` — OTP super admin
- `POST /api/send-email` — envío de correo (Resend backend)

### 2.3 Deno Functions (serverless adicional, opcional para fase 1)

```
Base URL: https://smartfixos.onrender.com  (producción)
```

55 funciones Deno (`apps/Smart/src/Functions/`). Las más importantes:
- `/sendEmail`, `/sendVerificationEmail`
- `/generateSequenceNumber` (para # de orden)
- `/handleOrderStatusChange` (lógica de transición de estado)
- `/processPayment`, `/registerRefund`
- `/getKPIs`, `/getRevenueByMethod`, `/getExpensesByCategory`
- `/aiExtractExpense` (la única IA que conservamos — para escanear facturas de PO)

---

## 3. Entidades Supabase (las 68 tablas)

Los esquemas JSON viven en `apps/Smart/src/Entities/`. **Léelos** para tener el contrato exacto. Las top-15 que tu app necesita en Fase 1:

| Tabla | Para qué |
|-------|----------|
| `tenant` | Tienda/negocio (multi-tenant) |
| `app_employee` | Empleados con login |
| `customer` | Clientes |
| `order` | Work orders (reparaciones) — **la entidad central** |
| `product` | Inventario (piezas, accesorios, servicios) |
| `transaction` | Ingresos y gastos |
| `sale` | Venta del POS |
| `cash_register` | Sesión de caja (abrir/cerrar) |
| `cash_drawer_movement` | Cada movimiento del cajón |
| `purchase_order` | Órdenes de compra a proveedores |
| `notification` | Notificaciones in-app |
| `app_settings` | Config global del tenant |
| `device_category` / `device_family` / `device_model` | Catálogo de dispositivos |
| `audit_log` | Historial de cambios |

### 3.1 Multi-tenancy

**TODAS las queries deben filtrar por `tenant_id`**. El `tenant_id` lo obtienes del usuario autenticado:
```swift
// pseudocódigo
let session = try await supabase.auth.session()
let tenantId = session.user.userMetadata["tenant_id"]
let orders = try await supabase
    .from("order")
    .select()
    .eq("tenant_id", value: tenantId)
    .order("created_date", ascending: false)
    .execute()
```

Hay RLS (Row Level Security) configurado en Supabase, pero el filtro client-side igual debe ir.

---

## 4. Auth (3 caminos paralelos)

La app maneja 3 modos de autenticación. Replícalos los 3:

### 4.1 Email + password (Supabase Auth)
- Pantalla de login con email/contraseña
- Use `supabase.auth.signIn(email:password:)`
- Persiste sesión en Keychain (NO UserDefaults — el token es secreto)

### 4.2 PIN code (acceso rápido para empleados en taller)
- Pantalla `PinAccessView` con teclado numérico
- Cada `app_employee` tiene un `pin_code` (4-6 dígitos)
- Match local contra la tabla `app_employee` (filtrada por `tenant_id`)
- Sesión guardada localmente en Keychain con TTL configurable

### 4.3 Biometría (Face ID / Touch ID)
- Después de un primer login email/PIN, ofrece "habilitar Face ID"
- Usa `LocalAuthentication.framework` (`LAContext`)
- Token se desbloquea con biometría desde Keychain

### 4.4 Deep links (OAuth callback, factura links)
Configura URL Scheme `com.smartfixos.pr911://` en el `Info.plist`. La versión Capacitor ya tiene este flow — replícalo nativo en `SceneDelegate` o el `App` struct.

---

## 5. Pantallas a portar (mapa Capacitor → SwiftUI)

39 pantallas en la web. Para Fase 1 (MVP) replica las **12 críticas**. Las demás van en fases siguientes.

### Fase 1 — Críticas (orden sugerido)

| # | Web (`pages/`) | SwiftUI sugerido | Notas iOS-native |
|---|----------------|------------------|------------------|
| 1 | `Welcome.jsx` | `WelcomeView` | Onboarding con TabView de páginas tipo iOS Setup |
| 2 | `PinAccess.jsx` | `PinAccessView` | Keypad nativo + Face ID button con `LAContext` |
| 3 | `Dashboard.jsx` | `DashboardView` | KPI cards en `LazyVGrid`, charts con **Swift Charts** (no recharts) |
| 4 | `Orders.jsx` + `OrdersMobile.jsx` | `OrdersListView` + `OrderDetailView` | `NavigationStack` + `List`, swipe-actions nativos |
| 5 | `POS.jsx` + `POSMobile.jsx` | `POSView` | Scanner barcode con `AVFoundation`, NO usar QuaggaJS |
| 6 | `Customers.jsx` | `CustomersListView` | `Searchable`, swipe-to-call, contact link |
| 7 | `Inventory.jsx` | `InventoryView` | Categorías como `Picker(.segmented)`, search nativa |
| 8 | `Financial.jsx` | `FinancialView` | Swift Charts para gráficos, `Form` para gastos |
| 9 | `Settings.jsx` + `SettingsNav.jsx` | `SettingsView` | `Form` con `Section` — patrón clásico iOS Settings |
| 10 | `Notifications.jsx` | `NotificationsView` | `List` con `swipeActions` + APNs registration |
| 11 | `Appointments.jsx` | `AppointmentsView` | `EKEventStore` para integrar con Calendario nativo |
| 12 | `WorkOrderWizard` (componente, no page) | `WorkOrderWizardView` | `TabView(.page)` para los pasos del wizard |

### Fase 2 — Soporte
13. `CashHistory`, `Recharges`, `Receipt`, `Technicians`, `UsersManagement`

### Fase 3 — Admin
14. `SuperAdmin`, `GACC`, `AdminDashboard`, `AuditLog`, `TenantManagement`

### Fuera de alcance (NO portar)
- ~~`ARIAChat`~~ — eliminado
- ~~`CustomerPortal`~~ — vive en web pública (no native)
- ~~`Setup`, `InitialSetup`, `VerifySetup`~~ — onboarding de tenant nuevo, va en web
- ~~`TenantActivate`, `Activate`~~ — activación de cuenta, web
- ~~`Pricing`, `VerifyEmail`~~ — flujos públicos web

---

## 6. Flujos críticos (la lógica de negocio)

### 6.1 Estados de Work Order (FIJO, no inventes nuevos)

12 estados, en este orden visual:
```
intake → diagnosing → (waiting_customer | pending_order | waiting_parts |
                        part_arrived_waiting_device | reparacion_externa) →
in_progress → ready_for_pickup → delivered

paralelos: warranty (post-delivered), cancelled (terminal en cualquier punto)
```

Lee `apps/Smart/src/components/utils/statusRegistry.jsx` para los **labels exactos en español, colores y orden**. Replica el mismo registry en Swift como un enum.

```swift
enum OrderStatus: String, CaseIterable, Identifiable {
    case intake, diagnosing, waitingCustomer = "waiting_customer"
    case pendingOrder = "pending_order", waitingParts = "waiting_parts"
    case partArrivedWaitingDevice = "part_arrived_waiting_device"
    case reparacionExterna = "reparacion_externa"
    case inProgress = "in_progress", readyForPickup = "ready_for_pickup"
    case warranty, delivered, cancelled
    var id: String { rawValue }
    var label: String { /* match con statusRegistry.jsx */ }
    var color: Color { /* match con statusRegistry.jsx */ }
}
```

**El usuario es quien decide el cambio de estado** — NO automático. (Esa decisión ya se tomó en la versión Capacitor: ver mensaje del usuario "manual primero").

### 6.2 POS (Punto de venta)

1. Empleado ya tiene caja abierta (`cash_register.status = 'open'`). Si no, abrirla primero.
2. Agrega productos al carrito (search en `product`).
3. Aplica descuento opcional.
4. Calcula total con IVU 11.5% (Puerto Rico tax).
5. Selecciona método de pago: efectivo / tarjeta / ATH Móvil / dividido.
6. Si efectivo: input de monto recibido + cálculo de cambio.
7. Si total ≥ $500 → confirm dialog nativo (`UIAlertController` o SwiftUI `.confirmationDialog`).
8. POST a `https://smart-fix-os-smart.vercel.app/api/cash-register` con `action: "record_sale"` y el payload.
9. Backend crea `sale` + `transaction` + actualiza `order.balance_due` si la venta liquida una orden.
10. Imprime recibo (opcional, AirPrint).

**Inputs numéricos en iOS**: usa `.keyboardType(.decimalPad)` para precios y `.numberPad` para cantidades. NO uses `.default`.

### 6.3 Crear Work Order (Wizard)

Pasos del wizard (ver `WorkOrderWizard.jsx` para estructura):

1. **Cliente** — buscar existente o crear nuevo (`customer`)
2. **Dispositivo** — categoría → familia → modelo (catálogo en `device_*`)
3. **Problema reportado** — campo de texto + checklist sugerido por categoría
4. **Fotos del dispositivo** — usa `PhotosPicker` (nativo iOS 16+) o `UIImagePickerController`
5. **Seguridad del dispositivo** — patrón / PIN / contraseña (estructurado en `order.device_security`)
6. **Cotización inicial** — costo estimado (puede actualizarse después)
7. **Firma del cliente** — `PencilKit` para firma con dedo o Apple Pencil
8. **Confirmación** — review + crear orden

Al guardar: `INSERT INTO order (...)` con `status = 'intake'`. Genera el número de orden con la función `/generateSequenceNumber` (Deno) o localmente como fallback.

### 6.4 Cola de trabajo (Queue)

En la versión Capacitor agregamos un sheet con cola de trabajo. En iOS native:
- En el iPhone: `NavigationLink` desde Orders con un botón "Cola" en `toolbar`
- En el iPad (Split View): el sidebar muestra la cola permanente
- Estados accionables: `intake`, `diagnosing`, `in_progress`, `warranty` (mismo set que la web)
- Ordenadas por `order_number` ascendente (las más viejas primero)

### 6.5 Caja (Cash Register)

1. **Abrir caja**: contar denominaciones de billetes/monedas (form numérico) → POST `/api/cash-register {action: "open", denominations, user, tenantId}`
2. **Cerrar caja**: contar otra vez → comparar con expected → diferencia. POST `{action: "close"}`. Backend envía email con resumen.
3. **Movimientos durante el turno**: ingresos por venta (auto), gastos manuales (form), retiros, depósitos.

### 6.6 Notificaciones push (APNs)

Configurar APNs para:
- Cliente listo para recoger (cuando `order.status` cambia a `ready_for_pickup`)
- Caja cerrada (resumen al dueño)
- Stock bajo (cuando `product.stock <= product.min_stock`)
- Recordatorio de pago vencido

Usa `UserNotifications.framework`. Backend envía via `/notifyPickupReminder`, `/notifyCashRegister`, etc.

### 6.7 IA — solo para Órdenes de Compra

**Único punto de IA en el app.** En la pantalla de "Nueva Orden de Compra":
- Botón "Escanear factura con IA"
- Toma foto / escoge archivo (`PhotosPicker` o `DocumentPicker` para PDF)
- Sube a Supabase Storage
- POST `https://smartfixos.onrender.com/ai/extract-expense` con `{ file_url, document_type: "invoice" }`
- Recibes `{ supplier_name, line_items[], subtotal, tax_amount, shipping_cost, total_amount, date }`
- Pre-llenas el form. El usuario revisa y guarda.

**No agregues IA en ninguna otra pantalla.** Esta decisión ya fue tomada explícitamente.

---

## 7. Diseño visual — iOS HIG estricto

### 7.1 Sistema de diseño

Sigue **Apple Human Interface Guidelines** al pie de la letra. Olvida los "apple-*" custom tokens de la web — usa los tokens nativos:

| Web (Tailwind/CSS) | iOS Native equivalente |
|--------------------|------------------------|
| `--apple-blue` | `Color.accentColor` (azul sistema) o `Color.blue` |
| `--apple-green` | `Color.green` |
| `--apple-red` | `Color.red` |
| `text-apple-yellow` | `Color.yellow` |
| `bg-gray-sys6` | `Color(.systemGray6)` |
| Tailwind spacing | `Spacing` enum custom (4, 8, 12, 16, 20, 24, 32) |
| `rounded-2xl` | `.cornerRadius(16)` o `RoundedRectangle(cornerRadius: 16)` |
| Custom shadows | `.shadow(.regularMaterial)` o `.glassEffect()` (iOS 26) |

### 7.2 Componentes nativos a usar (no reinventar)

| Necesidad | Nativo iOS |
|-----------|-----------|
| Lista de items | `List` + `ForEach` |
| Search | `.searchable(text:)` (iOS 15+) |
| Tabs inferior | `TabView` con `.tabItem` |
| Modal | `.sheet(isPresented:)` |
| Alert | `.alert()` |
| Confirm | `.confirmationDialog()` |
| Picker | `Picker(.segmented)` o `Menu` |
| Form | `Form` + `Section` |
| Bottom sheet | `.presentationDetents([.medium, .large])` (iOS 16+) |
| Pull-to-refresh | `.refreshable {}` |
| Swipe actions | `.swipeActions {}` |
| Chart | **Swift Charts** (`import Charts`, iOS 16+) |
| Camera | `PhotosPicker` (iOS 16+) o `AVCaptureSession` para barcode |
| Signature | `PencilKit` |

### 7.3 Iconografía

**SF Symbols 6** para TODOS los íconos. Olvida `lucide-react` — Apple ya tiene 5,000+ íconos perfectamente integrados.

```swift
Image(systemName: "wrench.and.screwdriver.fill")  // taller
Image(systemName: "iphone")                       // dispositivo
Image(systemName: "bell.badge.fill")              // notificación
```

Lista en la app **SF Symbols.app** (gratis en Mac App Store).

### 7.4 Tipografía

- **System font**: `.title`, `.headline`, `.body`, `.caption` — NO `Inter` ni custom fonts.
- **Dynamic Type**: respeta el tamaño que el usuario eligió en Configuración → Pantalla → Tamaño del texto.
- **SF Pro Rounded** para números (precios, contadores) usando `.font(.system(.title, design: .rounded))`.

### 7.5 Liquid Glass (iOS 26+)

Si el deployment target es iOS 26+, usa los nuevos efectos:
```swift
.background(.regularMaterial)         // material translúcido clásico
.glassEffect()                        // Liquid Glass nuevo (iOS 26)
```

Para iOS 15-25 cae al material clásico automáticamente con `#available`.

### 7.6 Modo claro/oscuro

Soporta los dos. Define colores en `Assets.xcassets` con variantes Any/Dark Appearance. NO hardcodees `Color.white` en backgrounds — usa `Color(.systemBackground)` o `Color(.secondarySystemBackground)`.

---

## 8. Arquitectura recomendada

### 8.1 Stack técnico

```
- Swift 6.0
- SwiftUI (UIKit solo para casos específicos: AVFoundation, PencilKit)
- iOS 17.0 deployment target (15.0 si necesitas más cobertura)
- Swift Package Manager (NO CocoaPods)
- supabase-swift (SDK oficial)
- KeychainAccess (manejo de tokens)
- Async/await + Combine para flows reactivos
```

### 8.2 Estructura de carpetas

```
SmartNative/
├── App/
│   ├── SmartNativeApp.swift         # @main
│   └── AppEnvironment.swift          # Dependency injection
├── Core/
│   ├── Supabase/
│   │   ├── SupabaseClient.swift
│   │   ├── Auth.swift
│   │   └── Storage.swift
│   ├── API/
│   │   ├── VercelAPI.swift           # /api/cash-register, etc.
│   │   └── DenoAPI.swift             # smartfixos.onrender.com
│   ├── Models/
│   │   ├── Order.swift
│   │   ├── Customer.swift
│   │   ├── Product.swift
│   │   └── ...                       # 1 file por entidad
│   ├── Repositories/
│   │   ├── OrderRepository.swift     # CRUD + queries
│   │   ├── CustomerRepository.swift
│   │   └── ...
│   └── Utils/
│       ├── Money.swift               # IVU 11.5%, formateo
│       ├── DateFormatters.swift
│       └── Logger.swift
├── DesignSystem/
│   ├── Colors.swift                  # SmartFixOS palette
│   ├── Typography.swift
│   ├── Spacing.swift
│   └── Components/
│       ├── PrimaryButton.swift
│       ├── StatusBadge.swift
│       ├── KPICard.swift
│       └── ...
└── Features/                          # ⬅ una carpeta por pantalla
    ├── Auth/
    │   ├── PinAccessView.swift
    │   ├── PinAccessViewModel.swift
    │   └── BiometricService.swift
    ├── Dashboard/
    │   ├── DashboardView.swift
    │   └── DashboardViewModel.swift
    ├── Orders/
    │   ├── OrdersListView.swift
    │   ├── OrderDetailView.swift
    │   ├── WorkOrderWizardView.swift
    │   └── OrdersViewModel.swift
    ├── POS/
    ├── Customers/
    ├── Inventory/
    ├── Financial/
    └── Settings/
```

### 8.3 Patrón MVVM + Repository

```swift
// Modelo (matches Supabase schema)
struct Order: Identifiable, Codable {
    let id: UUID
    let tenantId: UUID
    let orderNumber: String
    let customerName: String
    let deviceModel: String?
    let status: OrderStatus
    let totalAmount: Decimal
    let createdDate: Date
}

// Repository (capa de datos)
final class OrderRepository {
    private let supabase: SupabaseClient
    init(supabase: SupabaseClient) { self.supabase = supabase }

    func fetchOrders(tenantId: UUID, limit: Int = 150) async throws -> [Order] {
        try await supabase
            .from("order")
            .select()
            .eq("tenant_id", value: tenantId)
            .order("created_date", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func updateStatus(orderId: UUID, status: OrderStatus) async throws { /* ... */ }
}

// ViewModel
@Observable final class OrdersViewModel {
    var orders: [Order] = []
    var isLoading = false
    private let repo: OrderRepository

    init(repo: OrderRepository) { self.repo = repo }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { orders = try await repo.fetchOrders(tenantId: AppEnv.tenantId) }
        catch { /* manejar */ }
    }
}

// View
struct OrdersListView: View {
    @State private var vm = OrdersViewModel(repo: AppEnv.orderRepo)

    var body: some View {
        List(vm.orders) { order in
            NavigationLink(value: order) { OrderRow(order: order) }
        }
        .refreshable { await vm.load() }
        .task { await vm.load() }
        .navigationTitle("Órdenes")
    }
}
```

### 8.4 Cache offline-first

Usa **SwiftData** (iOS 17+) o **Core Data** para cache local. Patrón:

1. View carga inmediato desde cache local (sync, sin spinner).
2. En paralelo: fetch fresco a Supabase.
3. Cuando llega la respuesta: merge + actualizar cache + actualizar UI.

Esto replica el comportamiento que ya implementamos en la versión Capacitor — la app se siente instantánea.

---

## 9. Plan de fases (orden de implementación)

### Fase 0 — Scaffold (1-2 días)
- [ ] Crear proyecto Xcode `SmartNative`
- [ ] Add dependencies via SPM: `supabase-swift`, `KeychainAccess`
- [ ] Configurar URL Scheme + Info.plist (deep links, microphone, camera, photo library, biometrics permissions)
- [ ] Setup `AppEnvironment` con `SupabaseClient`
- [ ] Basic `TabView` con 5 tabs: Dashboard / POS / Órdenes / Inventario / Más

### Fase 1 — Auth (3-4 días)
- [ ] `WelcomeView` con onboarding
- [ ] Email/password login
- [ ] `PinAccessView` con keypad numérico
- [ ] Biometric login con Face ID
- [ ] Persistir token en Keychain
- [ ] Multi-tenant: leer `tenant_id` del session

### Fase 2 — Core read-only (1 semana)
- [ ] `DashboardView` con KPIs y Swift Charts
- [ ] `OrdersListView` con filtros
- [ ] `OrderDetailView` (read-only primero)
- [ ] `CustomersListView` con búsqueda
- [ ] `InventoryView` con categorías
- [ ] Cache offline-first con SwiftData

### Fase 3 — Edición (1 semana)
- [ ] Cambiar estado de orden (con haptic feedback)
- [ ] Editar detalles de orden (inline editing nativo)
- [ ] Agregar/editar cliente
- [ ] Crear/editar producto
- [ ] Settings básicos

### Fase 4 — POS + Wizard (1-2 semanas)
- [ ] `WorkOrderWizardView` (8 pasos)
- [ ] Firma con PencilKit
- [ ] Captura de fotos con PhotosPicker
- [ ] `POSView` con carrito, métodos de pago, IVU
- [ ] Apertura/cierre de caja
- [ ] AirPrint para recibos

### Fase 5 — Avanzado (2-3 semanas)
- [ ] Push notifications (APNs)
- [ ] Apple Pay / Stripe Terminal SDK
- [ ] Apple Calendar integration (Appointments)
- [ ] iPad split-view layout
- [ ] Apple Watch companion (notificaciones de orden lista)
- [ ] AI scanner para Purchase Orders

### Fase 6 — Pulir y App Store (1 semana)
- [ ] App Store screenshots
- [ ] App Store description
- [ ] TestFlight beta con 5-10 técnicos reales
- [ ] Métricas: Firebase Crashlytics o nativo MetricKit
- [ ] Submit a App Store

---

## 10. Antipatrones que debes EVITAR

| ❌ NO HACER | ✅ HACER EN SU LUGAR |
|-------------|---------------------|
| WebView mostrando la web actual | SwiftUI puro |
| Usar `Inter` font o tipografías custom | System fonts (`.title`, `.body`) |
| `Color(red: ..., green: ..., blue: ...)` hardcoded | `Color(.systemBackground)`, `Color.accentColor` |
| Importar lucide icons como SVG | SF Symbols (`Image(systemName:)`) |
| URLSession manual para Supabase | `supabase-swift` SDK |
| `UserDefaults` para tokens | `Keychain` (vía KeychainAccess) |
| Fetch + render en `View.body` | ViewModel + `.task {}` |
| Animar width/height/top/left | `.transition`, `.animation`, transforms |
| Fixed pixel sizes | Dynamic Type-aware (`@ScaledMetric`) |
| AI en cualquier pantalla | Solo en "Nueva Orden de Compra" |
| Notificaciones que interrumpen flow | `bottom-center`, 2-3 segundos, no bloquean |
| Touch targets < 44pt | Mínimo 44x44pt (`Apple HIG`) |

---

## 11. Definition of Done (cuándo está "lista" Fase 1)

Para considerar Fase 1 (MVP) terminada:

- [ ] Login con email funciona
- [ ] Login con PIN funciona
- [ ] Login con Face ID funciona
- [ ] Sesión persiste entre app kills
- [ ] Dashboard muestra KPIs reales del tenant
- [ ] Lista de órdenes carga, filtra, busca
- [ ] Detalle de orden muestra todos los campos
- [ ] Cambiar estado de orden persiste a Supabase
- [ ] Lista de clientes muestra, busca, llama (tap → tel:)
- [ ] Lista de inventario muestra, busca, categorías
- [ ] Settings: cerrar sesión, cambiar tema, info de tenant
- [ ] Modo offline: muestra cache, sincroniza al volver online
- [ ] Push notifications llegan al dispositivo
- [ ] App es funcional sin internet (lectura)
- [ ] Sin crashes en TestFlight con 5+ usuarios reales por 7 días
- [ ] App Store rechazo zero (cumple HIG, privacidad, etc.)

---

## 12. Recursos y referencias

### En este repo (lectura obligatoria antes de empezar)

```
apps/Smart/src/Entities/                         # 68 schemas JSON (contratos de datos)
apps/Smart/src/components/utils/statusRegistry.jsx  # Estados de orden (12)
apps/Smart/src/Functions/                        # Lógica de servidor (Deno)
api/cash-register.js                             # Backend de POS / cierre caja
apps/Smart/.env                                  # URLs y keys (NO commitear nuevamente)
```

### Apple

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Swift Charts](https://developer.apple.com/documentation/charts)
- [SwiftData](https://developer.apple.com/documentation/swiftdata)
- [SF Symbols app](https://developer.apple.com/sf-symbols/)
- [iOS 26 release notes (Liquid Glass)](https://developer.apple.com/documentation/updates/ios)

### Supabase

- [supabase-swift README](https://github.com/supabase/supabase-swift)
- [Auth con Swift](https://supabase.com/docs/reference/swift/auth-signin)

---

## 13. Notas finales

- **No te apures.** Es mejor entregar Fase 1 perfecta que 5 fases mediocres.
- **Tests UI desde día 1.** Usa `XCUITest` para los flujos críticos.
- **Performance first.** En cada vista, usa Instruments (Time Profiler) para verificar que renders < 16ms.
- **Si dudas en una decisión arquitectónica**, mira la versión Capacitor — el comportamiento ya está probado por usuarios reales. Pero **no copies UI** — repiénsala nativa.
- **Cuando termines Fase 1**, haz commit en una rama separada `feat/native-ios-app` y crea PR con screenshots para review.
- **Pregunta antes de añadir features nuevas.** Este documento es la fuente de verdad — si necesitas hacer algo que no está aquí, abre issue / consulta.

---

> **TL;DR**: Mismo backend Supabase + Vercel + Deno. UI 100% nativa SwiftUI. 12 pantallas críticas en Fase 1. IA solo en Órdenes de Compra. Sin React, sin Capacitor, sin WebView. Apple HIG estricto. Offline-first con SwiftData. Inicial deployment iOS 17+.

Última actualización: este documento. Si haces cambios al backend (esquemas, endpoints), edita este archivo en el mismo PR.

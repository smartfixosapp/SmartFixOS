# Fase 2 — POS View (SmartNative iOS)

> Pegar este documento entero al agente de Xcode. Es self-contained.

---

## Misión

Implementar la pantalla de **Punto de Venta (POS)** en el target `SmartNative` (la app nativa iOS que ya tiene Fase 1 completa con auth + 5 tabs read-only).

Esta es la pantalla más usada del taller — cada cobro pasa por aquí. Tiene que sentirse instantánea, robusta, y absolutamente nativa iOS.

**Fuente de verdad arquitectónica**: `IOS_NATIVE_CLONE_PROMPT.md` en el root del repo. Lee la sección **6.2 POS** primero para el flujo de negocio. Esto es el complemento operativo.

---

## 1. Lo que existe ya (no rehagas)

- `SmartNative.xcodeproj` con 22 archivos Swift
- Auth funcional (email + PIN + Face ID)
- `SupabaseClient` configurado en `Core/Supabase/SupabaseClient.swift`
- `TabView` raíz con 5 tabs (Dashboard / POS / Órdenes / Inventario / Más)
- El tab POS hoy renderea un placeholder — eso es lo que vas a reemplazar
- `OrderRepository`, `CustomerRepository`, `ProductRepository` (read-only)
- `Color`, `Typography`, `Spacing` en `DesignSystem/`
- Modelos `Order`, `Customer`, `Product`, `Tenant` en `Models/`

**Reusa todo lo anterior**. No rebuild lo que ya funciona.

---

## 2. Lo que tienes que crear

```
Features/POS/
├── POSView.swift                 # SwiftUI principal
├── POSViewModel.swift            # @Observable, MVVM
├── PaymentSheetView.swift        # Modal de método de pago
├── CashAmountKeypad.swift        # Para input de "monto recibido"
└── POSReceiptPreview.swift       # Recibo + AirPrint (opcional al final)

Core/API/
└── CashRegisterAPI.swift         # Cliente del endpoint /api/cash-register

Core/Models/
├── Sale.swift                    # Si no existe ya
├── SaleItem.swift                # Line item del carrito
└── PaymentMethod.swift           # enum: cash | card | ath | mixed

Core/Repositories/
└── SaleRepository.swift          # Crea sale + transactions vía Vercel API
```

Total estimado: **8 archivos nuevos, ~1200 líneas Swift**.

---

## 3. Backend — endpoints exactos

### 3.1 Crear venta (cobro)

```
POST https://smart-fix-os-smart.vercel.app/api/cash-register

Body:
{
  "action": "record_sale",
  "sale": {
    "tenant_id": "<uuid>",
    "items": [
      {
        "product_id": "<uuid>|null",
        "product_name": "Pantalla iPhone 13",
        "quantity": 1,
        "unit_price": 110.00,
        "tax_rate": 0.115,
        "tax_amount": 12.65,
        "total": 122.65
      }
    ],
    "subtotal": 110.00,
    "tax_amount": 12.65,
    "total_amount": 122.65,
    "payment_method": "cash",
    "amount_received": 130.00,
    "change_due": 7.35,
    "customer_id": "<uuid>|null",
    "order_id": "<uuid>|null",        // si liquida una work order existente
    "cash_register_id": "<uuid>",     // caja abierta requerida
    "notes": "string|null"
  },
  "transactions": [                    // backend las crea, pero pásalas
    {
      "tenant_id": "<uuid>",
      "type": "revenue",
      "amount": 122.65,
      "category": "sale",
      "payment_method": "cash",
      "description": "Venta POS",
      "cash_register_id": "<uuid>"
    }
  ],
  "orderUpdate": null | {              // solo si liquida una work order
    "id": "<uuid>",
    "changes": {
      "amount_paid": 122.65,
      "balance_due": 0
    }
  }
}

Respuesta exitosa: { "success": true, "sale": {...}, "transactions": [...], "order": {...}|null }
Respuesta error:    { "success": false, "error": "string" }
```

### 3.2 Verificar caja abierta (antes de cobrar)

Lectura simple a Supabase, no a Vercel:
```swift
let openRegister = try await supabase
    .from("cash_register")
    .select()
    .eq("tenant_id", value: tenantId)
    .eq("status", value: "open")
    .order("created_date", ascending: false)
    .limit(1)
    .execute()
    .value as [CashRegister]
```

Si está vacío → mostrar botón "Abrir caja" antes de permitir cobros (lleva a una vista de denominaciones — fase 3, por ahora solo bloqueá con mensaje).

### 3.3 Catálogo de productos (ya existe en Phase 1)

`ProductRepository.fetchActive(tenantId:)` ya implementado. Usalo.

---

## 4. UX del POS — capas

```
┌─────────────────────────────────────────┐
│  Punto de Venta             [☰ caja]   │ ← header con estado de caja
├─────────────────────────────────────────┤
│  🔍 Buscar producto / SKU              │ ← .searchable nativo
├─────────────────────────────────────────┤
│  [Categoría] [Categoría] [Categoría]   │ ← .picker(.segmented)
├─────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │📱  │ │🔧  │ │📷  │ │⚡  │           │ ← LazyVGrid de productos
│  │$110│ │$ 65│ │$130│ │$ 25│           │
│  └────┘ └────┘ └────┘ └────┘           │
│  ...                                    │
├─────────────────────────────────────────┤
│  Carrito (3)                  $234.50   │ ← bottom sheet contraído
└─────────────────────────────────────────┘

Tap en carrito → bottom sheet expande con:
  - Lista de items (swipe-to-delete)
  - Subtotal / IVU 11.5% / Total
  - Botón "Cobrar $X.XX"

Tap "Cobrar" → PaymentSheetView modal:
  - Selector de método: Efectivo / Tarjeta / ATH / Dividido
  - Si efectivo: keypad para "monto recibido" + cambio
  - Si ≥ $500: confirmationDialog nativo
  - Botón final "Finalizar Cobro"
```

Patrones SwiftUI clave:
- `.searchable(text: $vm.searchQuery)`
- `LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))])`
- `.sheet(isPresented:)` para PaymentSheet
- `.confirmationDialog()` para confirmación de venta grande
- `.swipeActions {}` en items del carrito
- `.presentationDetents([.height(160), .medium, .large])` para el bottom sheet del carrito

---

## 5. Las 7 gotchas que NO debe repetir (de la versión Capacitor)

### Gotcha 1 — Dominio Vercel correcto
```swift
// ✅ Este es el proyecto Vercel activo
private let baseURL = URL(string: "https://smart-fix-os-smart.vercel.app")!

// ❌ smart-fix-os.vercel.app está MUERTO (404). Si lo usas el cobro falla con
//    "Load failed" sin razón aparente. Costó horas debuggear esto.
```

### Gotcha 2 — `tenant_id` en TODOS los payloads y queries
Replica el helper `resolveActiveTenantId()` de la versión Capacitor:
```swift
extension AppEnvironment {
    var tenantId: UUID {
        // 1. Session de Supabase: user.userMetadata["tenant_id"]
        // 2. Fallback: Keychain "smartfix_tenant_id"
        // 3. Si null → forzar logout, no continuar
    }
}
```

Cada query a Supabase y cada payload al endpoint debe llevar `tenant_id`.

### Gotcha 3 — Teclado decimal en iOS nativo
En la versión Capacitor `<input type="number">` mostraba teclado de **letras** en iOS. Eso no pasa en SwiftUI nativo si usas el modificador correcto:

```swift
TextField("Monto", value: $amountReceived, format: .currency(code: "USD"))
    .keyboardType(.decimalPad)         // ✅ SIEMPRE para precios
    .focused($amountFocused)
    .toolbar {
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button("Listo") { amountFocused = false }
        }
    }

// Para SKU / códigos:
TextField("Código", text: $sku)
    .keyboardType(.numberPad)          // ✅ solo dígitos
    .textInputAutocapitalization(.never)
    .autocorrectionDisabled()
```

### Gotcha 4 — `Decimal`, NUNCA `Double` para dinero
```swift
// ✅ Decimal — exacto, sin errores de punto flotante
struct Money {
    static let ivuRate: Decimal = 0.115  // Puerto Rico
    let amount: Decimal
}
let subtotal: Decimal = 110.00
let tax = (subtotal * Money.ivuRate).rounded(scale: 2)  // 12.65
let total = subtotal + tax                              // 122.65

// ❌ Double da $122.6499999... a veces. Eso le pasó a la versión web
//    en cierres de caja y causó diferencias inexplicables.
```

Helper sugerido en `Core/Utils/Money.swift`:
```swift
extension Decimal {
    func rounded(scale: Int) -> Decimal {
        var copy = self
        var result = Decimal()
        NSDecimalRound(&result, &copy, scale, .bankers)
        return result
    }
    func currency(_ code: String = "USD") -> String {
        self.formatted(.currency(code: code).precision(.fractionLength(2)))
    }
}
```

### Gotcha 5 — `amount_paid` legacy puede ser negativo
Algunas órdenes viejas tienen `amount_paid` con valores negativos (refunds mal aplicados en la DB). Eso causaba el bug de "Balance Pendiente: $110.00" cuando en realidad ya había un crédito.

```swift
// ✅ Sanitiza siempre
let amountPaid = max(0, order.amountPaid)
let balance = max(0, order.total - amountPaid)
```

NO permitas que la UI muestre balance negativo ni amount_paid negativo. Si los detectas, log warning y muestra 0.

### Gotcha 6 — Toasts que NO bloquean UI
Sonner en `top-right` tapaba el header en la versión Capacitor. En SwiftUI:

```swift
// Patrón correcto: overlay inferior con auto-dismiss
.overlay(alignment: .bottom) {
    if let toast = vm.activeToast {
        ToastBanner(toast: toast)
            .padding(.bottom, 24)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .allowsHitTesting(false)        // ⬅ NO bloquea taps detrás
    }
}
.animation(.easeInOut(duration: 0.25), value: vm.activeToast)

// Auto-dismiss
.task(id: vm.activeToast?.id) {
    guard vm.activeToast != nil else { return }
    try? await Task.sleep(for: .seconds(2.2))
    vm.activeToast = nil
}
```

Reglas: `bottom-center`, max 2.2s, max 1 visible, NUNCA encima del header, `allowsHitTesting(false)` para que no bloquee.

### Gotcha 7 — Validación de caja abierta
Antes de cualquier `record_sale`, valida que existe `cash_register` con `status = 'open'`. Si no:
- Muestra mensaje: "No hay caja abierta. Abre la caja antes de cobrar."
- Botón secundario: "Abrir caja ahora" → lleva a CashRegisterOpenView (Fase 3, por ahora solo TODO)
- NO dejes que el usuario llegue al payment sheet sin caja abierta — el endpoint te va a rechazar con error feo y la experiencia se siente rota.

---

## 6. Modelos clave (Swift)

```swift
// Core/Models/Sale.swift
struct Sale: Codable, Identifiable {
    let id: UUID
    let tenantId: UUID
    let items: [SaleItem]
    let subtotal: Decimal
    let taxAmount: Decimal
    let totalAmount: Decimal
    let paymentMethod: PaymentMethod
    let amountReceived: Decimal
    let changeDue: Decimal
    let customerId: UUID?
    let orderId: UUID?           // si liquida una work order
    let cashRegisterId: UUID
    let notes: String?
    let createdDate: Date

    enum CodingKeys: String, CodingKey {
        case id, items, subtotal, notes
        case tenantId = "tenant_id"
        case taxAmount = "tax_amount"
        case totalAmount = "total_amount"
        case paymentMethod = "payment_method"
        case amountReceived = "amount_received"
        case changeDue = "change_due"
        case customerId = "customer_id"
        case orderId = "order_id"
        case cashRegisterId = "cash_register_id"
        case createdDate = "created_date"
    }
}

// Core/Models/SaleItem.swift
struct SaleItem: Codable, Identifiable, Hashable {
    var id = UUID()
    let productId: UUID?
    let productName: String
    var quantity: Int
    let unitPrice: Decimal
    var lineTotal: Decimal { unitPrice * Decimal(quantity) }
    var taxAmount: Decimal { (lineTotal * 0.115).rounded(scale: 2) }
}

// Core/Models/PaymentMethod.swift
enum PaymentMethod: String, Codable, CaseIterable, Identifiable {
    case cash, card, ath = "ath_movil", mixed
    var id: String { rawValue }
    var label: String {
        switch self {
        case .cash:  "Efectivo"
        case .card:  "Tarjeta"
        case .ath:   "ATH Móvil"
        case .mixed: "Dividido"
        }
    }
    var icon: String {
        switch self {
        case .cash:  "banknote"
        case .card:  "creditcard"
        case .ath:   "iphone"
        case .mixed: "rectangle.split.2x1"
        }
    }
}
```

---

## 7. Plan de implementación (orden sugerido)

### Día 1 — Modelos y API
- [ ] Crear `Sale`, `SaleItem`, `PaymentMethod` con Codable correcto
- [ ] `Money.swift` con helpers `Decimal` (rounded, currency formatting)
- [ ] `CashRegisterAPI.swift` con función `recordSale(payload:)` haciendo POST al endpoint
- [ ] `SaleRepository.swift` que envuelve la API + manejo de errores
- [ ] Test manual: ejecutar venta hardcoded de $1 desde un botón debug → ver en Supabase

### Día 2 — Vista del catálogo
- [ ] `POSView` con header + searchable + grid de productos
- [ ] `POSViewModel` con `@Observable`, productos filtrados, categoría seleccionada
- [ ] Tap producto → agregarlo al carrito (state interno)
- [ ] Validación de caja abierta (badge en header)

### Día 3 — Carrito y pago
- [ ] Bottom sheet del carrito con `.presentationDetents`
- [ ] Items con swipe-to-delete y +/- quantity
- [ ] Cálculo de subtotal / IVU / total con `Decimal`
- [ ] Botón "Cobrar" → abre `PaymentSheetView`

### Día 4 — Pago y confirmación
- [ ] `PaymentSheetView` con segmented de métodos
- [ ] Si efectivo: keypad numérico + cálculo de cambio en vivo
- [ ] Si ≥ $500: `.confirmationDialog`
- [ ] Submit → llama API → toast → limpiar carrito

### Día 5 — Pulir + edge cases
- [ ] Manejo de errores (red caída, caja cerrada, validation)
- [ ] Haptic feedback en taps importantes (`.sensoryFeedback(.selection)`)
- [ ] Receipt preview básico (solo en pantalla, sin print)
- [ ] Loading states + disabled buttons mientras submitting

---

## 8. Definition of Done para Fase 2

La fase está terminada cuando:

- [ ] Puedo entrar al tab POS y ver el catálogo cargando productos reales del tenant
- [ ] Puedo buscar por nombre o SKU y la lista filtra
- [ ] Puedo agregar producto al carrito tocándolo
- [ ] Puedo cambiar cantidad y eliminar items
- [ ] Subtotal, IVU 11.5% y total se calculan **exactos** (sin decimales raros)
- [ ] Si NO hay caja abierta, NO me deja iniciar cobro (mensaje claro)
- [ ] Si hay caja abierta, puedo seleccionar método de pago
- [ ] En efectivo, el cambio se calcula en tiempo real al teclear
- [ ] El teclado SIEMPRE es numérico/decimal (nunca de letras) en inputs de monto
- [ ] Si la venta es ≥ $500, aparece confirmación nativa
- [ ] Al confirmar, el cobro persiste en Supabase (`sale` + `transaction` + opcional `order` update)
- [ ] El carrito se limpia y vuelvo a poder cobrar otra venta
- [ ] Si hay error de red, NO se duplica la venta (idempotencia básica)
- [ ] Toast confirma "Venta registrada" pero NO bloquea la UI por más de 2.2s
- [ ] Probé al menos 5 ventas reales en Simulator + 1 en device físico

---

## 9. Fuera de alcance para Fase 2 (NO hacer ahora)

Estas cosas son tentadoras pero esperan:

- ❌ Abrir caja desde la app (Fase 3)
- ❌ Cerrar caja desde la app (Fase 3)
- ❌ AirPrint del recibo (Fase 5)
- ❌ Apple Pay / Stripe Terminal (Fase 5)
- ❌ Liquidar work orders existentes desde POS (Fase 4 — ahora solo ventas standalone)
- ❌ Crear cliente nuevo desde el flujo de cobro (puede asignar uno existente, pero crear nuevo va a Fase 4)
- ❌ Descuentos, cupones, promociones (Fase 4)
- ❌ Mixed payment (efectivo + ATH) — implementa solo cash, card, ath. `mixed` queda como caso futuro
- ❌ AI scanner de inventario (NUNCA — la IA solo va en Órdenes de Compra)

Mantén el scope cerrado. Cuando termines lo de arriba, reportas y vamos por el Wizard.

---

## 10. Cuando termines

1. Probá una venta real con tu propia tarjeta en device físico
2. Verificá en Supabase Dashboard que se creó la `sale`, `transaction`, y opcional `order` update
3. Hacé commit en una rama `feat/pos-view`
4. Reportá:
   - Cuántos archivos / líneas creaste
   - Decisiones arquitectónicas no obvias
   - Cualquier gotcha NO listada arriba que encontraste
   - Captura de pantalla del POS funcionando

Después seguimos con Fase 3 (Work Order Wizard).

---

> **TL;DR**: Implementá `POSView` siguiendo MVVM. Endpoint `https://smart-fix-os-smart.vercel.app/api/cash-register` action `record_sale`. Usá `Decimal` para dinero. Validá caja abierta. Teclado decimal nativo. Toasts no bloqueantes en bottom-center 2.2s. NO hacer mixed payment, AirPrint, ni open/close de caja todavía. 5 días de trabajo, 8 archivos nuevos, ~1200 líneas.

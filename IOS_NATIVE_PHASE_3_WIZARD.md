# Fase 3 — Work Order Wizard (SmartNative iOS)

> Pegar este documento entero al agente de Xcode. Es self-contained.

---

## Misión

Implementar el **Wizard de creación de Work Orders** (órdenes de reparación) en el target `SmartNative`.

Es la otra pantalla que se usa todos los días en el taller — **cada dispositivo que entra al mostrador genera una WorkOrder**. Tiene que ser rápida, no perder datos, y manejar los 8 pasos sin romperse.

**Fuente de verdad arquitectónica**: `IOS_NATIVE_CLONE_PROMPT.md` en el root del repo. Lee la sección **6.3 Crear Work Order (Wizard)** primero. Esto es el complemento operativo.

---

## 1. Lo que existe ya (no rehagas)

Después de Fase 0–2 ya tenés:

- `SmartNative.xcodeproj` con Phases 0–2 completas
- Auth funcional + 5 tabs operativos
- POS funcionando (probado con ventas reales) — patrón MVVM consolidado
- `Money.swift`, `Decimal` helpers — reusalos
- `CashRegisterAPI.swift` — patrón de cliente Vercel; **copialo** para `OrderAPI`
- `Color`, `Typography`, `Spacing`, `EmptyStateView(subtitle:)` en `DesignSystem/`
- `OrderRepository.fetch...` (read-only) — ahora hay que ampliar con `create`
- `CustomerRepository`, `ProductRepository` — usalos
- Toast pattern (`vm.activeToast`, bottom-center, 2.2s, `allowsHitTesting(false)`) — replicalo

**Reusa todo. No rebuild.**

---

## 2. Lo que tienes que crear

```
Features/WorkOrderWizard/
├── WorkOrderWizardView.swift            # Container con TabView(.page)
├── WorkOrderWizardViewModel.swift       # @Observable, state machine, validación
├── Steps/
│   ├── Step1_CustomerView.swift         # Buscar/crear cliente
│   ├── Step2_DeviceView.swift           # Categoría → familia → modelo
│   ├── Step3_ProblemView.swift          # Problema reportado + checklist
│   ├── Step4_PhotosView.swift           # PhotosPicker
│   ├── Step5_SecurityView.swift         # PIN/password/pattern
│   ├── Step6_EstimateView.swift         # cost_estimate + tecnico asignado
│   ├── Step7_SignatureView.swift        # PencilKit canvas
│   └── Step8_ConfirmView.swift          # Review + Save
└── Components/
    ├── WizardStepHeader.swift           # "Paso X de 8 — Título"
    ├── WizardProgressBar.swift          # Barra de progreso lineal
    ├── PencilKitCanvas.swift            # UIViewRepresentable wrapper
    └── DeviceCascadePicker.swift        # 3 pickers encadenados

Core/API/
└── OrderAPI.swift                        # Genera order_number + create order

Core/Repositories/
├── OrderRepository.swift                 # ⬅ AGREGAR método createWorkOrder()
└── CustomerRepository.swift              # ⬅ AGREGAR método createCustomer()

Core/Models/
├── DeviceCategory.swift                  # device_category Supabase
├── DeviceFamily.swift                    # device_family
├── DeviceModel.swift                     # device_model
└── DeviceSecurity.swift                  # estructura para order.device_security
```

Total estimado: **15 archivos nuevos, ~1,800 líneas Swift**.

---

## 3. Backend — endpoints y queries

### 3.1 Generar número de orden (Deno function)

```
POST https://smartfixos.onrender.com/generateSequenceNumber
Body: { "tenant_id": "<uuid>", "type": "order" }
Respuesta: { "data": { "sequence_number": "WO-25001" } }
```

**Si el endpoint falla** (red caída, 500, timeout) → fallback local:
```swift
// Fallback: WO-{year2digit}{maxLocalSeq+1}
// Trae el mayor order_number existente del tenant, suma 1
let last = try await supabase
    .from("order")
    .select("order_number")
    .eq("tenant_id", value: tenantId)
    .order("order_number", ascending: false)
    .limit(1)
    .execute()
let next = parseAndIncrement(last) ?? "WO-\(year)0001"
```

⚠️ El número generado **debe ser único**. Race condition posible si 2 técnicos crean orden al mismo tiempo. Mitigación: si el INSERT falla por unique constraint, regenera y reintenta (max 3 veces).

### 3.2 Crear order (directo a Supabase)

```swift
let payload = WorkOrderInsertPayload(
    tenantId: tenantId,
    orderNumber: orderNumber,
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    deviceCategory: device.categorySlug,
    deviceBrand: device.familyName,
    deviceModel: device.modelName,
    deviceImei: securityInfo.imei,
    deviceSerial: securityInfo.serial,
    initialProblem: problemDescription,
    checklistItems: checklist,                  // [String]
    photosMetadata: uploadedPhotos,             // [PhotoMetadata]
    deviceSecurity: deviceSecurity,             // DeviceSecurity struct
    costEstimate: estimateAmount,
    assignedToName: assignedTech?.name,
    assignedTo: assignedTech?.id,
    signatureUrl: signatureURL,                 // URL del PencilKit upload
    status: "intake",                           // SIEMPRE intake al crear
    createdDate: Date()
)
let order = try await supabase
    .from("order")
    .insert(payload)
    .select()
    .single()
    .execute()
    .value as Order
```

### 3.3 Crear cliente nuevo (si el usuario lo crea desde el wizard)

```swift
// 1. Verificar duplicado por teléfono ANTES de crear
let existing = try await supabase
    .from("customer")
    .select()
    .eq("tenant_id", value: tenantId)
    .eq("phone", value: phoneNormalized)
    .limit(1)
    .execute()
    .value as [Customer]

if let dup = existing.first {
    // Mostrar dialog: "Ya existe un cliente con este teléfono: NOMBRE.
    //                 ¿Usar ese o crear uno nuevo de todos modos?"
    return dup  // o continuar con creación
}

// 2. Crear si no existe
let new = try await supabase.from("customer").insert(payload).select().single().execute().value
```

### 3.4 Cargar catálogo de dispositivos

```swift
// Cascade — tres queries dependientes
// Categorías (siempre filtradas por tenant)
let categories = try await supabase
    .from("device_category")
    .select()
    .eq("tenant_id", value: tenantId)
    .order("name", ascending: true)
    .execute()
    .value as [DeviceCategory]

// Cuando elige categoría → cargar familias de esa categoría
let families = try await supabase
    .from("device_family")
    .select()
    .eq("category_id", value: selectedCategory.id)
    .order("name", ascending: true)
    .execute()
    .value as [DeviceFamily]

// Cuando elige familia → cargar modelos
let models = try await supabase
    .from("device_model")
    .select()
    .eq("family_id", value: selectedFamily.id)
    .order("name", ascending: true)
    .execute()
    .value as [DeviceModel]
```

⚠️ **Cachear estos resultados en memoria** — no hagas re-fetch al volver al paso 2 si el usuario clickea atrás. Usa `Task` cancelables para no spammear la red al cambiar de selección rápido.

### 3.5 Subir foto / firma

Usa **Supabase Storage** (bucket `uploads`):
```swift
let path = "tenants/\(tenantId)/orders/\(orderNumber)/photo_\(UUID()).jpg"
try await supabase.storage
    .from("uploads")
    .upload(path: path, file: jpegData, options: FileOptions(contentType: "image/jpeg"))

let publicURL = try supabase.storage.from("uploads").getPublicURL(path: path)
```

⚠️ Subí las fotos **al confirmar** el wizard, no en cada paso. Si el usuario cancela, no querés dejar fotos huérfanas en Storage.

---

## 4. UX del Wizard — capas

```
┌─────────────────────────────────────────┐
│ ← Cancelar      Paso 3 de 8       Saltar│ ← top bar
├─────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░ 37.5%      │ ← progress bar
├─────────────────────────────────────────┤
│                                         │
│  Problema reportado                     │
│  ───────────────                        │
│                                         │
│  TextEditor para descripción libre      │
│                                         │
│  Sugerencias rápidas (chips):           │
│  [Pantalla] [Batería] [Botón] [...]     │
│                                         │
│  Checklist sugerido por categoría:      │
│  ☑ Touch responde                       │
│  ☐ Cámara funciona                      │
│  ...                                    │
│                                         │
├─────────────────────────────────────────┤
│  [← Anterior]              [Siguiente →]│ ← navegación
└─────────────────────────────────────────┘
```

Patrones SwiftUI clave:
- `TabView(selection: $vm.currentStep)` con `.tabViewStyle(.page(indexDisplayMode: .never))`
- `WizardProgressBar` con `Animation.spring` al avanzar
- `.navigationBarBackButtonHidden(true)` — el back lo controlás vos
- `.toolbar { ToolbarItem(placement: .navigationBarLeading) { Button("Cancelar") } }`
- Cada step retorna `Bool` de su validación → `vm.canAdvance`
- Boton "Siguiente" `.disabled(!vm.canAdvance)`

---

## 5. Pasos del wizard — qué pide cada uno

### Paso 1 — Cliente
- Tab segmentado: `Existente` / `Nuevo`
- **Existente**: search bar → lista filtrada en vivo. Muestra avatar, nombre, teléfono, # órdenes previas
- **Nuevo**: form con teléfono (required), nombre (required), email (optional), notas
- Validación: si existente → uno seleccionado; si nuevo → nombre + teléfono no vacíos
- Al avanzar, si "Nuevo" → check de duplicado por teléfono → confirmar

### Paso 2 — Dispositivo
- 3 pickers en cascada: Categoría → Familia → Modelo
- Si el modelo no existe en el catálogo → opción "Otro / No listado" con campo texto libre
- Validación: categoría + familia mínimo (modelo opcional pero recomendado)

### Paso 3 — Problema reportado
- `TextEditor` ≥ 3 líneas
- Chips de sugerencias por categoría (de un dict hardcoded local — no API):
  - Smartphone: [Pantalla, Batería, Cámara, Carga, Touch, Audio, Wifi, Cámara]
  - Laptop: [Pantalla, Teclado, Trackpad, Carga, Pantalla negra, Lento]
  - etc.
- Checklist: array `[String]` que el técnico marca/desmarca
- Validación: descripción ≥ 10 caracteres

### Paso 4 — Fotos del dispositivo
- `PhotosPicker(selection:, maxSelectionCount: 8, matching: .images)` (iOS 16+)
- Preview grid con thumbnails, swipe-to-delete
- "Tomar foto con cámara" → `UIImagePickerController` envuelto en `UIViewControllerRepresentable`
- Validación: **opcional** (algunas órdenes no necesitan foto), pero **mínimo 1 recomendado**
- ⚠️ NO subir todavía — guardar en memoria, subir al confirmar

### Paso 5 — Seguridad del dispositivo
- Tab: PIN / Password / Patrón / IMEI/Serial
- Form estructurado:
  ```swift
  struct DeviceSecurity: Codable {
      var devicePin: String?       // 4-6 dígitos
      var devicePassword: String?
      var patternVector: [Int]?    // ej: [1,2,3,6,9]
      var deviceImei: String?
      var deviceSerial: String?
      var notes: String?
  }
  ```
- Patrón: 3x3 grid de puntos donde el usuario dibuja el patrón con el dedo
- ⚠️ Estos datos son **sensibles** — guardalos serializados en `order.device_security` (JSONB column en Supabase). NO en plain columns.
- Validación: opcional pero recomendado

### Paso 6 — Cotización inicial + técnico
- `TextField` con `.keyboardType(.decimalPad)` para `cost_estimate`
- Picker para `assigned_to_name` (de tabla `app_employee` filtrada por rol técnico)
- Toggle: "Esta orden es prioridad alta"
- Validación: monto ≥ 0 (puede ser 0 si "a cotizar después")

### Paso 7 — Firma del cliente
- `PencilKitCanvas` (UIViewRepresentable de `PKCanvasView`)
- Botones: "Limpiar firma" / "Listo"
- Detectar si hay drawing real (no solo blank canvas)
- Al confirmar → render PNG → subir a Supabase Storage → guardar URL en `order.signature_url`
- Validación: **opcional** (no toda venta requiere firma)

### Paso 8 — Confirmación
- Review compacto de TODO lo capturado:
  - Cliente
  - Dispositivo
  - Problema (truncado a 2 líneas)
  - Fotos (count + thumbnails)
  - Seguridad (icono ✓ si hay datos)
  - Cotización
  - Firma (preview)
- Botón grande: "Crear Orden de Trabajo"
- Spinner durante save (genera #, sube fotos, sube firma, INSERT)
- Al éxito → toast "Orden #WO-25001 creada" → navega a `OrderDetailView` de la nueva orden
- Al error → toast con mensaje, mantenerlo en step 8 para retry

---

## 6. Las gotchas específicas de Phase 3

### Gotcha 1 — PhotosPicker es async
```swift
@State private var selectedItems: [PhotosPickerItem] = []
@State private var loadedImages: [UIImage] = []

PhotosPicker(selection: $selectedItems, maxSelectionCount: 8, matching: .images) {
    Label("Agregar fotos", systemImage: "photo.badge.plus")
}
.onChange(of: selectedItems) { _, items in
    Task {
        loadedImages = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let img = UIImage(data: data) {
                loadedImages.append(img)
            }
        }
    }
}
```

### Gotcha 2 — PencilKit necesita UIViewRepresentable
```swift
struct PencilKitCanvas: UIViewRepresentable {
    @Binding var canvasView: PKCanvasView

    func makeUIView(context: Context) -> PKCanvasView {
        canvasView.tool = PKInkingTool(.pen, color: .black, width: 3)
        canvasView.drawingPolicy = .anyInput  // dedo + Apple Pencil
        canvasView.backgroundColor = .systemBackground
        return canvasView
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {}
}

// Para detectar si firmó:
let isEmpty = canvasView.drawing.bounds.isEmpty

// Render a imagen:
let image = canvasView.drawing.image(from: canvasView.bounds, scale: UIScreen.main.scale)
```

### Gotcha 3 — order_number debe ser único — race condition
Si 2 técnicos crean orden simultánea:
```swift
// Patrón con retry en unique constraint violation
for attempt in 1...3 {
    let orderNumber = try await generateOrderNumber(tenantId: tenantId)
    do {
        let order = try await supabase.from("order").insert(payload).execute()
        return order
    } catch {
        if isUniqueConstraintViolation(error), attempt < 3 {
            continue  // regenera y reintenta
        }
        throw error
    }
}
```

### Gotcha 4 — Subida de fotos al CONFIRMAR (no en cada paso)
Si el usuario cancela el wizard a mitad de camino, no querés dejar fotos huérfanas en Storage. **Mantén las imágenes en memoria como `[UIImage]` y subilas en el paso 8** dentro de un `TaskGroup` paralelo:

```swift
let urls = try await withThrowingTaskGroup(of: String.self) { group in
    for (idx, image) in images.enumerated() {
        group.addTask {
            let data = image.jpegData(compressionQuality: 0.8)!
            let path = "tenants/\(tenantId)/orders/\(orderNumber)/photo_\(idx)_\(UUID()).jpg"
            try await supabase.storage.from("uploads").upload(...)
            return supabase.storage.from("uploads").getPublicURL(path: path).absoluteString
        }
    }
    var collected: [String] = []
    for try await url in group { collected.append(url) }
    return collected
}
```

### Gotcha 5 — `device_security` debe ir como JSONB
Supabase columna `order.device_security` es `jsonb`. NO la mandes como string serializado:
```swift
// ✅ Codable struct, supabase-swift lo serializa automáticamente
let payload = ["device_security": deviceSecurity]  // donde deviceSecurity es DeviceSecurity (Codable)
```

### Gotcha 6 — Cliente duplicado por teléfono
Antes de crear nuevo cliente, **siempre busca por teléfono normalizado**:
```swift
extension String {
    var normalizedPhone: String { self.filter(\.isNumber) }
}
```
"787-940-6884" → "7879406884". Compara así para no crear duplicados de Diana Rivera 5 veces.

### Gotcha 7 — Wizard cancelación con datos
Si el usuario está en paso 5 con cliente nuevo + 4 fotos cargadas y toca "Cancelar":
- `.confirmationDialog`: "¿Descartar la orden? Perderás los datos capturados."
- Solo si confirma → cerrar wizard
- Las fotos NUNCA llegaron a Storage (gotcha 4) así que no hay que limpiar nada
- Si el cliente nuevo ya se creó (tocó "Crear cliente" en paso 1) → quedó en DB. Eso está OK, no lo borres.

### Gotcha 8 — Validación de cada paso
ViewModel debe exponer `canAdvance: Bool` computed property que evalúa el step actual. La View NO sabe la lógica de validación — solo lee `vm.canAdvance` y deshabilita el botón.

```swift
@Observable
final class WorkOrderWizardViewModel {
    var currentStep: Int = 1
    var customer: CustomerSelection?
    var deviceSelection: DeviceSelection?
    var problemDescription: String = ""
    // ...

    var canAdvance: Bool {
        switch currentStep {
        case 1: return customer != nil
        case 2: return deviceSelection?.category != nil
        case 3: return problemDescription.count >= 10
        case 4: return true  // fotos opcionales
        case 5: return true  // seguridad opcional
        case 6: return estimateAmount >= 0
        case 7: return true  // firma opcional
        case 8: return true
        default: return false
        }
    }
}
```

---

## 7. Plan de implementación (orden sugerido)

### Día 1 — Modelos + WizardViewModel scaffold
- [ ] Crear `DeviceCategory`, `DeviceFamily`, `DeviceModel`, `DeviceSecurity` (Codable)
- [ ] `WorkOrderWizardViewModel` con state machine + `canAdvance`
- [ ] `OrderAPI.swift` con `generateOrderNumber()` y `createWorkOrder()`
- [ ] Test manual: ejecutar `createWorkOrder` con payload hardcoded → ver en Supabase

### Día 2 — Container + Steps 1-2
- [ ] `WorkOrderWizardView` con TabView(.page) + progress bar + nav buttons
- [ ] Step 1: cliente (search existente, form nuevo, check duplicados)
- [ ] Step 2: cascade pickers de dispositivo (con cache de resultados)

### Día 3 — Steps 3-5
- [ ] Step 3: problema + chips de sugerencias + checklist por categoría
- [ ] Step 4: PhotosPicker + cámara + preview grid + swipe-to-delete
- [ ] Step 5: seguridad — los 4 sub-tabs (PIN/password/patrón/IMEI)

### Día 4 — Steps 6-8 + Save
- [ ] Step 6: cotización + asignación de técnico
- [ ] Step 7: PencilKit canvas + clear button + isEmpty detection
- [ ] Step 8: review compacto + botón crear con spinner
- [ ] Subida paralela de fotos (TaskGroup) + firma a Storage
- [ ] INSERT order con retry en unique constraint
- [ ] Toast + navegación a OrderDetailView de la orden creada

### Día 5 — Pulir + edge cases
- [ ] Cancelar wizard con confirmation dialog si hay datos
- [ ] Manejo de errores en cada step (red caída en Step 2 al cargar familias, etc.)
- [ ] Haptic feedback al avanzar de paso (`.sensoryFeedback(.success)`)
- [ ] Validación visual: mostrar qué falta para avanzar (subtítulo bajo el botón)
- [ ] Pruebas en device físico con orden real de un cliente real

---

## 8. Definition of Done para Fase 3

- [ ] Puedo abrir el wizard desde un FAB en `OrdersListView`
- [ ] Step 1: encuentro un cliente existente buscando por nombre/teléfono
- [ ] Step 1: creo un cliente nuevo y se detecta duplicado si el teléfono ya existe
- [ ] Step 2: cascade pickers cargan en orden, no se vuelven a fetchear si vuelvo atrás
- [ ] Step 3: chips agregan al problema description, checklist se persiste
- [ ] Step 4: tomo fotos con cámara y desde galería, las puedo borrar
- [ ] Step 5: capturo PIN / password / patrón / IMEI / serial estructurado
- [ ] Step 6: ingreso cotización con teclado decimal nativo, asigno técnico
- [ ] Step 7: dibujo firma con dedo y se detecta si está vacía
- [ ] Step 8: review muestra todo correctamente
- [ ] Al "Crear Orden": número WO se genera (Deno o fallback)
- [ ] Fotos se suben en paralelo a Supabase Storage
- [ ] Firma se renderiza a PNG y se sube
- [ ] Order se inserta con `status = 'intake'` y todos los campos
- [ ] Toast "Orden #WO-XXXXX creada" + navego a su detalle
- [ ] Cancelar wizard pide confirmación si tengo datos capturados
- [ ] NO duplico cliente si el teléfono ya existe
- [ ] Probé crear al menos 3 órdenes reales en device físico (con cliente real, fotos reales, firma real)
- [ ] Verifiqué en Supabase Dashboard que los datos se guardaron exacto

---

## 9. Fuera de alcance para Fase 3 (NO hacer ahora)

- ❌ Editar un work order existente (eso es OrderDetailView, ya read-only en Fase 2)
- ❌ Cambiar estado de la orden (Fase 4)
- ❌ Imprimir recibo de intake (Fase 5)
- ❌ Notificar al cliente por SMS/email al crear (Fase 5)
- ❌ AI checklist suggestion (NUNCA — IA solo en Órdenes de Compra)
- ❌ OCR del IMEI desde la foto (NUNCA — IA solo en PO)
- ❌ Apple Watch companion para wizard (Fase 6)
- ❌ Templates de problemas frecuentes guardables (Fase 5)
- ❌ Auto-completar dirección del cliente con CoreLocation (Fase 5)
- ❌ Quoter externo (cotización tomada de proveedores externos) (Fase 5+)

Mantené el scope cerrado.

---

## 10. Cuando termines

1. Probá crear 3 órdenes reales en device físico (clientes reales del taller)
2. Verificá en Supabase Dashboard que `order` se creó con todos los campos
3. Verificá que las fotos están en Storage en el path correcto
4. Verificá que `device_security` se guarda como JSONB (no string)
5. Hacé commit en rama `feat/wizard` y reportá:
   - Líneas + archivos creados
   - Decisiones arquitectónicas no obvias
   - Nuevos gotchas encontrados (los agregás a `IOS_NATIVE_CLONE_PROMPT.md` sección 12.5)
   - Captura del wizard funcionando

Después seguimos con Fase 4 (Edición de orden + cambio de estado).

---

> **TL;DR**: 8-step wizard en TabView(.page), MVVM con `@Observable`. Cliente search + create con dedup por teléfono. Cascade de dispositivo cacheado. PhotosPicker + cámara + PencilKit firma. `device_security` JSONB. Subida de assets en TaskGroup paralelo al confirmar. Retry en unique constraint del order_number. Cancelar pide confirmación. Status final = 'intake'. ~1,800 líneas, 15 archivos, 5 días.

# Rediseño — AuthView (SmartNative iOS)

> Pegar al agente de Xcode. Self-contained.

---

## Misión

Rediseñar **solo** la pantalla de login (`AuthView` o como esté nombrada en `Features/Auth/`) para que se vea **nativa iOS según Apple HIG**, no como un form web genérico.

**No tocar**: la lógica de auth (signIn, validación, persistencia Keychain, navegación post-login). Eso ya funciona. Solo cambiar la presentación visual.

---

## Por qué la versión actual no funciona

La pantalla actual tiene 5 cosas que la delatan como "no Apple":

1. **Fondo blanco puro** — Apple usa `systemBackground` (auto adapt dark/light) con materiales sutiles, no pure white
2. **Logo flat-style** — Parece sticker; Apple usa SF Symbols en círculos con tint o un treatment con material
3. **Inputs con bordes pill grises uniformes** — En iOS nativo van agrupados (`.insetGrouped` Form) o con materiales translúcidos, no flotando solos
4. **Botón "Iniciar sesión" con icono dentro** — Apple usa `.borderedProminent` puro, sin icono interior; el flujo lo da el contexto
5. **Cero hierarchy tipográfica** — Apple ama `.largeTitle .bold()` con `.subheadline .secondary` debajo. Aquí están los dos en peso medio

---

## El target visual — pattern "Apple Hero Login"

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Hero gradient/material
│ ▓                                ▓  │   (top 38% de la pantalla)
│ ▓        ⚒️                      ▓  │
│ ▓     [logo en círculo]          ▓  │   80x80 pt circle
│ ▓     glass material             ▓  │   .glassEffect() iOS 26
│ ▓                                ▓  │   o .ultraThinMaterial fallback
│ ▓     SmartFixOS                 ▓  │   .largeTitle .bold
│ ▓     Sistema de gestión         ▓  │   .subheadline .secondary
│ ▓                                ▓  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                     │
│   CORREO ELECTRÓNICO                │ ← .caption .secondary uppercase
│   ┌───────────────────────────────┐ │
│   │ ✉  persona@taller.com         │ │ ← inset rounded, material BG
│   └───────────────────────────────┘ │
│                                     │
│   CONTRASEÑA                        │
│   ┌───────────────────────────────┐ │
│   │ 🔒  ••••••••           👁     │ │
│   └───────────────────────────────┘ │
│                                     │
│        ¿Olvidaste tu contraseña?    │ ← link sutil, alineado derecha
│                                     │
│   ┌───────────────────────────────┐ │
│   │     Iniciar sesión            │ │ ← .borderedProminent .large
│   └───────────────────────────────┘ │   sin icono interior
│                                     │
│   ─────────── o ──────────────      │ ← divider con label
│                                     │
│   ┌───────────────────────────────┐ │
│   │   🍎 Continuar con Apple      │ │ ← SignInWithAppleButton
│   └───────────────────────────────┘ │   (requerido por App Store si
│                                     │    hay otros métodos de login)
│                                     │
│   Acceso rápido →                   │ ← link a PIN access
│                                     │
└─────────────────────────────────────┘
```

---

## Patrones SwiftUI específicos a usar

### 1. Hero superior con material translúcido

```swift
ZStack {
    // Gradiente sutil de fondo (sustituye el blanco puro)
    LinearGradient(
        colors: [.accentColor.opacity(0.18), Color(.systemBackground)],
        startPoint: .top,
        endPoint: .center
    )
    .ignoresSafeArea()

    VStack(spacing: 24) {
        Spacer().frame(height: 60)

        // Logo en círculo con material
        ZStack {
            Circle()
                .fill(.ultraThinMaterial)         // ← clave: material, no flat
                .frame(width: 88, height: 88)
                .overlay(Circle().stroke(.white.opacity(0.2), lineWidth: 1))
                .shadow(color: .black.opacity(0.08), radius: 16, y: 8)

            Image(systemName: "wrench.and.screwdriver.fill")
                .font(.system(size: 38, weight: .medium))
                .foregroundStyle(.tint)            // usa el tint del proyecto
        }

        // Jerarquía tipográfica
        VStack(spacing: 6) {
            Text("SmartFixOS")
                .font(.largeTitle.bold())          // ← .largeTitle es clave
                .foregroundStyle(.primary)

            Text("Sistema de gestión para talleres")
                .font(.subheadline)
                .foregroundStyle(.secondary)       // .secondary auto adapt
        }
    }
}
```

> **iOS 26+**: reemplazar `.ultraThinMaterial` con `.glassEffect()` cuando esté disponible:
> ```swift
> if #available(iOS 26.0, *) {
>     Circle().glassEffect()
> } else {
>     Circle().fill(.ultraThinMaterial)
> }
> ```

### 2. Form fields agrupados estilo iOS Settings

```swift
VStack(alignment: .leading, spacing: 8) {
    Text("CORREO ELECTRÓNICO")
        .font(.caption)
        .foregroundStyle(.secondary)
        .tracking(0.5)
        .padding(.leading, 16)

    HStack(spacing: 12) {
        Image(systemName: "envelope")
            .foregroundStyle(.secondary)
            .frame(width: 20)

        TextField("persona@taller.com", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.next)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .background(
        RoundedRectangle(cornerRadius: 12)
            .fill(.regularMaterial)                // ← material, no plain gray
    )
}
```

Para password, lo mismo pero con `SecureField` y un toggle de eye:

```swift
HStack(spacing: 12) {
    Image(systemName: "lock")
        .foregroundStyle(.secondary)
        .frame(width: 20)

    if showPassword {
        TextField("••••••••", text: $password)
    } else {
        SecureField("••••••••", text: $password)
    }

    Button { showPassword.toggle() } label: {
        Image(systemName: showPassword ? "eye.slash" : "eye")
            .foregroundStyle(.secondary)
    }
}
.textContentType(.password)
.padding(.horizontal, 16)
.padding(.vertical, 14)
.background(RoundedRectangle(cornerRadius: 12).fill(.regularMaterial))
```

### 3. Botón principal — sin icono interior

```swift
Button {
    Task { await vm.signIn() }
} label: {
    if vm.isLoading {
        ProgressView().tint(.white)
    } else {
        Text("Iniciar sesión")
            .fontWeight(.semibold)
            .frame(maxWidth: .infinity)
    }
}
.controlSize(.large)
.buttonStyle(.borderedProminent)
.tint(.accentColor)
.disabled(!vm.canSubmit || vm.isLoading)
```

⚠️ **NO** poner icono adentro (`arrow.right` etc.). Apple no lo hace en buttons primary. Solo texto.

### 4. Sign in with Apple (requerido por App Store)

Si ofreces login por email + Apple es **MANDATORIO** según las App Store Review Guidelines (4.8) — no opcional.

```swift
import AuthenticationServices

SignInWithAppleButton(.continue) { request in
    request.requestedScopes = [.fullName, .email]
} onCompletion: { result in
    Task { await vm.handleAppleSignIn(result) }
}
.signInWithAppleButtonStyle(.black)        // o .white / .whiteOutline según tema
.frame(height: 50)
.cornerRadius(12)
```

Backend: el ID token de Apple lo verificas con Supabase Auth `signInWithIdToken(provider: .apple, idToken: ...)`.

### 5. Divider con label "o"

```swift
HStack(spacing: 12) {
    Rectangle().fill(.separator).frame(height: 0.5)
    Text("o").font(.caption).foregroundStyle(.secondary)
    Rectangle().fill(.separator).frame(height: 0.5)
}
.padding(.vertical, 8)
```

### 6. Link sutil a PIN access

```swift
Button {
    vm.navigateToPinAccess()
} label: {
    HStack(spacing: 4) {
        Text("Acceso rápido del taller")
        Image(systemName: "arrow.right").font(.caption)
    }
    .font(.callout)
    .foregroundStyle(.tint)
}
```

---

## Checklist visual concreto

Cuando termines, esta pantalla debe cumplir:

- [ ] Hero superior tiene **gradiente sutil**, no pure white
- [ ] Logo está en **círculo con material** (`.ultraThinMaterial` o `.glassEffect()`)
- [ ] Logo es un **SF Symbol** (`wrench.and.screwdriver.fill`), no asset PNG
- [ ] Título "SmartFixOS" en `.largeTitle.bold()`
- [ ] Subtítulo en `.subheadline .secondary`
- [ ] Inputs tienen **labels uppercase** arriba (`.caption .tracking(0.5)`)
- [ ] Inputs usan `.regularMaterial` background, no plain gray fill
- [ ] `textContentType` correcto en cada field (`.emailAddress`, `.password`)
- [ ] `keyboardType` correcto (`.emailAddress` para email)
- [ ] Toggle de "mostrar contraseña" con `eye` / `eye.slash` SF Symbol
- [ ] Botón principal `.borderedProminent .large` SIN icono interior
- [ ] Botón muestra `ProgressView` mientras loading
- [ ] Botón `.disabled` cuando email/password incompletos
- [ ] Divider con label "o" entre métodos
- [ ] **Sign in with Apple button** presente y funcional (Supabase signInWithIdToken)
- [ ] Link discreto a "Acceso rápido" (PIN)
- [ ] Link "¿Olvidaste tu contraseña?" presente
- [ ] Modo oscuro: todo se ve bien al cambiar a Dark Mode (test rápido en preview)
- [ ] Layout no se rompe con teclado abierto (`.scrollDismissesKeyboard(.interactively)`)
- [ ] Safe area respetada arriba y abajo
- [ ] `.sensoryFeedback(.success, trigger: vm.didSignIn)` al login exitoso

---

## Lo que NO debes cambiar

- ❌ La lógica de `vm.signIn()` — funciona, no la toques
- ❌ La persistencia en Keychain
- ❌ Navegación post-login al `RootView`
- ❌ El esquema de colores del proyecto (`.accentColor` ya existe)
- ❌ Los archivos de DesignSystem existentes (Colors, Typography, Spacing)

Solo refactor visual de `AuthView` y agregar Sign in with Apple si no estaba.

---

## Test después del rediseño

1. Preview en Light Mode — debe verse limpio, jerarquía clara
2. Preview en Dark Mode — el material debe oscurecer correcto
3. Probar en simulator iPhone SE (3ra gen) — pantalla pequeña, no debe romperse
4. Probar en iPhone 16 Pro Max — espacio bien distribuido
5. Login con email/password — sigue funcionando ✓
6. Login con Apple — Supabase recibe el ID token y autentica ✓
7. Tap "Acceso rápido" — navega a PinAccessView ✓
8. Cambiar el sistema a "Tamaño del texto" grande (Dynamic Type) — layout se adapta

---

> **TL;DR**: Hero con gradiente + logo en círculo glass + tipografía `.largeTitle .bold`. Form con inputs material agrupados estilo Settings. Botón `.borderedProminent` puro sin icono. Sign in with Apple obligatorio. Link a PIN para acceso rápido. Todo respeta Dark Mode y Dynamic Type. Solo cambiar AuthView, no tocar lógica.

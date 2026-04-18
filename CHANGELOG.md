# Changelog — SmartFixOS

## [Unreleased] — 2026-04-17

### Added
- **Rediseño Apple completo** — 18 batches, 200+ archivos rediseñados con design tokens SF Pro, colores semánticos y espaciados consistentes
  - POS Mobile, Dashboard Mobile, Orders Mobile, Customers, Inventory (mobile)
  - Dashboard Desktop, POS Desktop, WorkOrderPanel desktop
  - Nav bars iOS con blur, botones SF-style y safe areas correctas
  - WorkOrderWizard: nuevo header + modo toggle (compacto/expandido)
  - Onboarding, Settings, Recharges y páginas de auth
  - Banners mejorados: Push notifications, PunchReminder, CustomerSelector
  - 56 componentes internos + barrido global de 90 archivos

### Fixed
- **Tab bar gap iOS** — Solución definitiva con `visualViewport API` para medición dinámica del viewport; elimina gap blanco en iPhones con home indicator
- **Loop "Restaurando sesión"** — Grace period de 3s antes de mostrar error de sesión; eliminado `StuckSessionRecovery` y pull-to-refresh en Orders/Inventory
- **Dark mode** — Inconsistencias en search input padding y badge AGOTADO en inventario

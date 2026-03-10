-- ================================================================
-- Migration 009: Order DB trigger + missing email templates
--
-- FIXES:
-- 1. Attaches the fn_trigger_event PostgreSQL trigger to the "order"
--    table (was commented-out in 006_fn_trigger_event.sql — this is
--    why handleOrderStatusChange never fired).
-- 2. Adds default email templates for the statuses that had none:
--    pending_order (admin), deposit_received (customer),
--    payment_received (customer).
-- Safe to run multiple times (ON CONFLICT DO NOTHING / OR REPLACE).
-- ================================================================

-- ============================================================
-- 1. Attach event trigger to the "order" table
--    This populates fn_trigger_event on every INSERT/UPDATE/DELETE,
--    which processFnTriggerEvents picks up every 120 seconds and
--    dispatches to handleOrderStatusChange.
-- ============================================================
DROP TRIGGER IF EXISTS fn_trigger_event_trg ON "public"."order";
CREATE TRIGGER fn_trigger_event_trg
  AFTER INSERT OR UPDATE OR DELETE ON "public"."order"
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_event_trigger_fn();

-- ============================================================
-- 2. Default email templates for missing order statuses
-- ============================================================

-- Column order reference from existing inserts in 004_data.sql:
-- id, created_at, updated_at, created_by_id, created_by,
-- is_sample, custom_warranty, logo_url, review_link, main_message,
-- enabled, next_steps_items, send_to, event_type, show_review_request,
-- custom_whatsapp, alert_title, custom_sections, show_checklist,
-- show_next_steps, show_phone_contact, show_warranty, show_whatsapp_contact,
-- header_title, show_photos, alert_message, warranty_type,
-- is_default, custom_hours, show_hours, name, custom_phone, header_subtitle

-- ── pending_order → admin only ──────────────────────────────────
INSERT INTO "public"."email_template" (
  "id", "created_at", "updated_at",
  "is_sample", "custom_warranty", "logo_url", "review_link",
  "main_message", "enabled", "next_steps_items",
  "send_to", "event_type",
  "show_review_request", "custom_whatsapp",
  "alert_title", "custom_sections",
  "show_checklist", "show_next_steps", "show_phone_contact",
  "show_warranty", "show_whatsapp_contact",
  "header_title", "show_photos",
  "alert_message", "warranty_type",
  "is_default", "custom_hours", "show_hours",
  "name", "custom_phone", "header_subtitle"
) VALUES (
  gen_random_uuid()::text, now(), now(),
  true, NULL, NULL, NULL,
  'Por favor coordina la adquisición de esta pieza a la brevedad posible para evitar demoras en la reparación.',
  true, '["Verificar proveedor disponible","Confirmar precio y tiempo de entrega","Ordenar la pieza","Actualizar el estatus de la orden cuando llegue"]'::jsonb,
  'admin', 'pending_order',
  false, NULL,
  '⚠️ Acción requerida: Ordenar pieza', '[]'::jsonb,
  false, true, true,
  false, true,
  '⚠️ Pieza Pendiente de Ordenar', false,
  'La Orden {{ order_number }} de {{ customer_name }} ({{ device_info }}) requiere una pieza que debe ser ordenada. El cliente está esperando.',
  NULL,
  true, NULL, false,
  'Pendiente Ordenar Pieza', NULL, 'Orden pendiente de acción'
) ON CONFLICT DO NOTHING;

-- ── deposit_received → customer ─────────────────────────────────
INSERT INTO "public"."email_template" (
  "id", "created_at", "updated_at",
  "is_sample", "custom_warranty", "logo_url", "review_link",
  "main_message", "enabled", "next_steps_items",
  "send_to", "event_type",
  "show_review_request", "custom_whatsapp",
  "alert_title", "custom_sections",
  "show_checklist", "show_next_steps", "show_phone_contact",
  "show_warranty", "show_whatsapp_contact",
  "header_title", "show_photos",
  "alert_message", "warranty_type",
  "is_default", "custom_hours", "show_hours",
  "name", "custom_phone", "header_subtitle"
) VALUES (
  gen_random_uuid()::text, now(), now(),
  true, NULL, NULL, NULL,
  'Gracias por tu confianza. Con este depósito podemos comenzar el proceso de adquisición de piezas para tu reparación.',
  true, '["Tu depósito ha sido registrado","Procederemos a adquirir las piezas necesarias","Te notificaremos cuando comience la reparación"]'::jsonb,
  'customer', 'deposit_received',
  false, NULL,
  '✅ Depósito Recibido', '[]'::jsonb,
  false, true, true,
  false, true,
  '✅ Depósito Recibido', false,
  'Hemos recibido tu depósito de ${{ total_paid }} para la Orden {{ order_number }}. Ya comenzamos el proceso para tu {{ device_info }}.',
  NULL,
  true, NULL, false,
  'Recibo de Depósito', NULL, 'Tu depósito ha sido registrado'
) ON CONFLICT DO NOTHING;

-- ── payment_received → customer ─────────────────────────────────
INSERT INTO "public"."email_template" (
  "id", "created_at", "updated_at",
  "is_sample", "custom_warranty", "logo_url", "review_link",
  "main_message", "enabled", "next_steps_items",
  "send_to", "event_type",
  "show_review_request", "custom_whatsapp",
  "alert_title", "custom_sections",
  "show_checklist", "show_next_steps", "show_phone_contact",
  "show_warranty", "show_whatsapp_contact",
  "header_title", "show_photos",
  "alert_message", "warranty_type",
  "is_default", "custom_hours", "show_hours",
  "name", "custom_phone", "header_subtitle"
) VALUES (
  gen_random_uuid()::text, now(), now(),
  true, NULL, NULL, NULL,
  '¡Gracias por tu pago! Ha sido un placer atenderte. Recuerda que cuentas con garantía sobre el servicio realizado.',
  true, '[]'::jsonb,
  'customer', 'payment_received',
  true, NULL,
  '✅ ¡Pago Recibido!', '[]'::jsonb,
  false, false, true,
  true, true,
  '✅ Pago Recibido', false,
  'Hemos procesado tu pago de ${{ amount }} para la Orden {{ order_number }}. ¡Muchas gracias por confiar en nosotros para reparar tu {{ device_info }}!',
  'repairs',
  true, NULL, false,
  'Recibo de Pago', NULL, 'Pago procesado exitosamente'
) ON CONFLICT DO NOTHING;

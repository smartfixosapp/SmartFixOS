-- Schema changes: new columns + enum value updates
-- Run after 002_schema.sql (init -> schema -> alter_schema -> data)

BEGIN;

-- === device_family (ALTER TABLE: new columns + enum updates) ===
ALTER TABLE "public"."device_family" ADD COLUMN IF NOT EXISTS "subcategory_id" text NULL;


-- === order (ALTER TABLE: new columns + enum updates) ===
ALTER TABLE "public"."order" ADD COLUMN IF NOT EXISTS "deleted" boolean NULL;


-- === users (ALTER TABLE: new columns + enum updates) ===
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "_app_role" text NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "app_id" text NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "collaborator_role" text NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "disabled" text NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "is_service" boolean NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "is_verified" boolean NULL;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "permissions" jsonb NULL;


-- Expand enum for audit_log.entity_type (values from data)
ALTER TABLE "public"."audit_log" DROP CONSTRAINT IF EXISTS "audit_log_entity_type_check";
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_entity_type_check" CHECK ("entity_type" IN ('Order', 'Sale', 'cash_register', 'catalog', 'config', 'customer', 'email', 'file_upload', 'inventory', 'notification', 'order', 'product', 'sale', 'transaction', 'user'));

-- Expand enum for employee_payment.payment_method (values from data)
ALTER TABLE "public"."employee_payment" DROP CONSTRAINT IF EXISTS "employee_payment_payment_method_check";
ALTER TABLE "public"."employee_payment" ADD CONSTRAINT "employee_payment_payment_method_check" CHECK ("payment_method" IN ('ath_movil', 'cash', 'check', 'transfer'));

-- Expand enum for product.subcategoria (values from data)
ALTER TABLE "public"."product" DROP CONSTRAINT IF EXISTS "product_subcategoria_check";
ALTER TABLE "public"."product" ADD CONSTRAINT "product_subcategoria_check" CHECK ("subcategoria" IN ('cables', 'cables_de_cargar', 'covers', 'dispositivo_completo', 'otros_accesorios', 'piezas_servicios', 'protectores', 'protectores_de_pantalla', 'servicio'));

-- Expand enum for product.category (values from data)
ALTER TABLE "public"."product" DROP CONSTRAINT IF EXISTS "product_category_check";
ALTER TABLE "public"."product" ADD CONSTRAINT "product_category_check" CHECK ("category" IN ('accesorios_puertodecarga', 'battery', 'cable', 'case', 'charger', 'consola_de_juegos_servicio', 'diagnostic', 'laptop_servicio', 'other', 'screen', 'smartphone_puertodecarga', 'smartphone_servicio', 'tablet_servicio'));

-- Expand enum for product.tipo_principal (values from data)
ALTER TABLE "public"."product" DROP CONSTRAINT IF EXISTS "product_tipo_principal_check";
ALTER TABLE "public"."product" ADD CONSTRAINT "product_tipo_principal_check" CHECK ("tipo_principal" IN ('accesorios', 'dispositivos', 'servicios'));

-- Expand enum for sequence_counter.sequence_type (values from data)
ALTER TABLE "public"."sequence_counter" DROP CONSTRAINT IF EXISTS "sequence_counter_sequence_type_check";
ALTER TABLE "public"."sequence_counter" ADD CONSTRAINT "sequence_counter_sequence_type_check" CHECK ("sequence_type" IN ('invoice', 'order', 'purchase_order', 'refund', 'sale', 'unlock'));

-- Expand enum for sequence_counter.period_type (values from data)
ALTER TABLE "public"."sequence_counter" DROP CONSTRAINT IF EXISTS "sequence_counter_period_type_check";
ALTER TABLE "public"."sequence_counter" ADD CONSTRAINT "sequence_counter_period_type_check" CHECK ("period_type" IN ('continuous', 'daily', 'monthly', 'yearly'));

-- Expand enum for system_config.category (values from data)
ALTER TABLE "public"."system_config" DROP CONSTRAINT IF EXISTS "system_config_category_check";
ALTER TABLE "public"."system_config" ADD CONSTRAINT "system_config_category_check" CHECK ("category" IN ('branding', 'email', 'financial', 'general', 'inventory', 'notifications', 'numbering', 'performance', 'permissions', 'receipt', 'repair_status', 'security', 'tax'));

-- Expand enum for transaction.category (values from data)
ALTER TABLE "public"."transaction" DROP CONSTRAINT IF EXISTS "transaction_category_check";
ALTER TABLE "public"."transaction" ADD CONSTRAINT "transaction_category_check" CHECK ("category" IN ('other_expense', 'parts', 'payroll', 'refund', 'repair_payment', 'supplies'));

-- Expand enum for work_order_event.event_type (values from data)
ALTER TABLE "public"."work_order_event" DROP CONSTRAINT IF EXISTS "work_order_event_event_type_check";
ALTER TABLE "public"."work_order_event" ADD CONSTRAINT "work_order_event_event_type_check" CHECK ("event_type" IN ('call_logged', 'checklist_updated', 'create', 'diagnosis_added', 'email_failed', 'email_sent', 'external_shop', 'field_updated', 'item_added', 'item_removed', 'item_updated', 'items_updated', 'link_added', 'media_uploaded', 'message_sent', 'note', 'note_added', 'parts_info', 'payment', 'pending_order', 'security_updated', 'status_change'));

COMMIT;

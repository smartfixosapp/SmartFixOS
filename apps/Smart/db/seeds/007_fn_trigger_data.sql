-- Seed fn_trigger_rule from Base44 automations API
BEGIN;

INSERT INTO "public"."fn_trigger_rule" (
  id, automation_type, name, description, function_name, function_args, is_active, is_archived,
  schedule_mode, schedule_type, repeat_interval, repeat_unit, start_time, one_time_date,
  entity_name, event_types
) VALUES (
  '69777f8499c8524c20a3e5ac', 'scheduled', 'Actualizar contadores de pickup y garantía', 'Se ejecuta diariamente a las 8am para actualizar contadores y enviar emails', 'updateOrderCountdowns', NULL, true, false,
  'recurring', 'simple', 1, 'days', '12:00', NULL,
  NULL, NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "public"."fn_trigger_rule" (
  id, automation_type, name, description, function_name, function_args, is_active, is_archived,
  schedule_mode, schedule_type, repeat_interval, repeat_unit, start_time, one_time_date,
  entity_name, event_types
) VALUES (
  '6976a5aad4b8b3c839ad6bc1', 'scheduled', 'Notificación 15 días - Listo para Recoger', 'Envía emails a clientes que llevan 15 días con equipo listo para recoger', 'notifyPickupReminder', NULL, true, false,
  'recurring', 'simple', 1, 'days', '13:00', NULL,
  NULL, NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "public"."fn_trigger_rule" (
  id, automation_type, name, description, function_name, function_args, is_active, is_archived,
  schedule_mode, schedule_type, repeat_interval, repeat_unit, start_time, one_time_date,
  entity_name, event_types
) VALUES (
  '6976a5aad4b8b3c839ad6bc2', 'scheduled', 'Notificación 15 días - Garantía Entregado', 'Envía emails a clientes a los 15 días de garantía preguntando si todo está bien', 'notifyWarrantyCheck', NULL, true, false,
  'recurring', 'simple', 1, 'days', '14:00', NULL,
  NULL, NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "public"."fn_trigger_rule" (
  id, automation_type, name, description, function_name, function_args, is_active, is_archived,
  schedule_mode, schedule_type, repeat_interval, repeat_unit, start_time, one_time_date,
  entity_name, event_types
) VALUES (
  '696f7bd83d244441706c45cd', 'entity', 'Notify Order Status Change', 'Send notifications when order status changes to part_arrived_waiting_device', 'handleOrderStatusChange', NULL, true, false,
  NULL, NULL, NULL, NULL, NULL, NULL,
  'Order', ARRAY['update']::text[]
) ON CONFLICT (id) DO NOTHING;

COMMIT;

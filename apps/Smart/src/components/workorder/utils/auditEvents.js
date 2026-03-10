import { base44 } from "@/api/base44Client";
import { getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";

function resolveActor(actor) {
  if (actor?.user_name || actor?.user_id) {
    return {
      user_name: actor.user_name || "Sistema",
      user_id: actor.user_id || null
    };
  }
  return null;
}

export function getOrderStageContext(order, statusOverride) {
  const stageId = normalizeStatusId(statusOverride || order?.status || "intake");
  const stageLabel = getStatusConfig(stageId)?.label || stageId;
  return { stageId, stageLabel };
}

export async function logWorkOrderPhotoEvent({
  order,
  count,
  statusOverride,
  actor,
  source = "upload"
}) {
  if (!order?.id || !Number(count)) return;

  const { stageId, stageLabel } = getOrderStageContext(order, statusOverride);
  const capturedAt = new Date().toISOString();
  const capturedAtLabel = new Date(capturedAt).toLocaleString("es-PR");
  const knownActor = resolveActor(actor);
  let finalActor = knownActor;

  if (!finalActor) {
    try {
      const me = await base44.auth.me();
      finalActor = {
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null
      };
    } catch {
      finalActor = { user_name: "Sistema", user_id: null };
    }
  }

  await base44.entities.WorkOrderEvent.create({
    order_id: order.id,
    order_number: order.order_number,
    event_type: "photo_upload",
    description: `Se subieron ${count} archivo(s) en ${stageLabel} (${capturedAtLabel}).`,
    user_name: finalActor.user_name,
    user_id: finalActor.user_id,
    metadata: {
      count,
      stage_id: stageId,
      stage_label: stageLabel,
      captured_at: capturedAt,
      source
    }
  });
}

export async function logWorkOrderContactEvent({
  order,
  channel,
  target,
  statusOverride,
  actor
}) {
  if (!order?.id || !channel) return;

  const { stageId, stageLabel } = getOrderStageContext(order, statusOverride);
  const contactedAt = new Date().toISOString();
  const contactedAtLabel = new Date(contactedAt).toLocaleString("es-PR");
  const knownActor = resolveActor(actor);
  let finalActor = knownActor;

  if (!finalActor) {
    try {
      const me = await base44.auth.me();
      finalActor = {
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null
      };
    } catch {
      finalActor = { user_name: "Sistema", user_id: null };
    }
  }

  await base44.entities.WorkOrderEvent.create({
    order_id: order.id,
    order_number: order.order_number,
    event_type: `contact_${channel}`,
    description: `Contacto por ${channel} a ${target || "sin destino"} en ${stageLabel} (${contactedAtLabel}).`,
    user_name: finalActor.user_name,
    user_id: finalActor.user_id,
    metadata: {
      contact_channel: channel,
      contact_target: target || null,
      stage_id: stageId,
      stage_label: stageLabel,
      contacted_at: contactedAt
    }
  });
}

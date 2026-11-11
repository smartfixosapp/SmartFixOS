export const ACTIVE = ['intake', 'diagnosing', 'waiting_parts', 'por_reparar', 'in_progress', 'ready_for_pickup'];
export const ON_HOLD = ['waiting_customer', 'pending_order', 'part_arrived_waiting_device', 'reparacion_externa', 'scheduled', 'warranty'];
export const CLOSED = ['delivered', 'cancelled', 'not_repairable', 'abandoned'];
export const STATUS_KEYS = [...ACTIVE, ...ON_HOLD, ...CLOSED];

export const VIA = {
  scheduled: 'agendar',
  delivered: 'entrega',
  cancelled: 'cierre',
  not_repairable: 'cierre',
  abandoned: 'cierre',
  warranty: 'reclamo',
};

export const VIAS = ['directo', 'agendar', 'entrega', 'cierre', 'reclamo', 'reabrir', 'deshacer'];

export const OPEN = [...ACTIVE, 'waiting_customer', 'pending_order', 'part_arrived_waiting_device', 'reparacion_externa', 'scheduled'];
export const REOPEN_TO = OPEN.filter((s) => s !== 'scheduled');
export const REOPENABLE = CLOSED;
export const UNDO_WINDOW_MS = 10 * 60_000;
export const NOTE_REQUIRED_VIAS = ['cierre', 'reclamo', 'reabrir'];

export function targetsFrom(from) {
  if (OPEN.includes(from)) return STATUS_KEYS.filter((s) => s !== from && s !== 'warranty');
  if (from === 'warranty') return ['in_progress'];
  if (from === 'delivered') return ['warranty'];
  return [];
}

function result(ok, code, extra = {}) {
  return { ok, code, ...extra };
}

export function checkTransition({ from, to, via = 'directo', note = '', previous = null, lastChangedAt = null, now = Date.now() } = {}) {
  const target = String(to || '');
  const current = from == null ? '' : String(from);
  const route = VIAS.includes(via) ? via : '';
  if (!STATUS_KEYS.includes(target)) return result(false, 'estatus_invalido');
  if (!route) return result(false, 'via_invalida');
  if (current === target) return result(true, 'sin_cambio', { changed: false });
  const needsNote = NOTE_REQUIRED_VIAS.includes(route);
  if (needsNote && String(note || '').trim().length < 3) return result(false, 'nota_requerida');

  if (route === 'deshacer') {
    if (!previous || previous !== target) return result(false, 'deshacer_no_coincide');
    const at = lastChangedAt == null ? NaN : Date.parse(lastChangedAt);
    if (!Number.isFinite(at) || now - at > UNDO_WINDOW_MS || now < at - 60_000) return result(false, 'deshacer_vencido');
    return result(true, 'ok', { changed: true, reopen: false });
  }

  if (route === 'reabrir') {
    const legacy = !STATUS_KEYS.includes(current);
    if (!legacy && !REOPENABLE.includes(current)) return result(false, 'no_esta_cerrado');
    if (!REOPEN_TO.includes(target)) return result(false, 'destino_reabrir_invalido');
    return result(true, 'ok', { changed: true, reopen: true });
  }

  if (!STATUS_KEYS.includes(current)) return result(false, 'requiere_flujo', { via_requerida: 'reabrir' });
  const required = VIA[target] || 'directo';
  if (route !== required) return result(false, 'requiere_flujo', { via_requerida: required });
  if (!targetsFrom(current).includes(target)) {
    if (CLOSED.includes(current)) return result(false, 'requiere_flujo', { via_requerida: 'reabrir' });
    return result(false, 'transicion_no_permitida');
  }
  return result(true, 'ok', { changed: true, reopen: false });
}

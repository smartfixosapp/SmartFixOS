import { sb } from './muse.js';

const STALE_DAYS = 10;

function clip(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function norm(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function partKey(item) {
  const sku = norm(item.sku).replace(/ /g, '');
  if (sku.length >= 4) return `sku:${sku}`.slice(0, 80);
  return `n:${norm(item.name).replace(/ /g, '-')}`.slice(0, 80);
}

function priceOf(item) {
  const direct = Number(item.precio ?? item.price);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const list = Array.isArray(item.precios) ? item.precios : [];
  for (const p of list) {
    const n = Number(String(p).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function normalizeItems(items, supplierHint = '') {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(items) ? items : []) {
    const name = clip(raw.nombre ?? raw.titulo ?? raw.name, 300);
    const price = priceOf(raw);
    if (!name || price === null) continue;
    const ship = Number(raw.envio);
    const item = {
      name,
      sku: clip(raw.sku ?? raw.numero_articulo, 80) || null,
      price: Math.round(price * 100) / 100,
      shipping: Number.isFinite(ship) ? Math.round(ship * 100) / 100 : null,
      stock: clip(raw.existencia ?? raw.condicion, 40) || null,
      url: clip(raw.url, 500) || null,
      supplier: clip(raw.proveedor || supplierHint, 80),
    };
    if (!item.supplier) continue;
    item.part_key = partKey(item);
    const dedupe = `${item.supplier}|${item.part_key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(item);
  }
  return out;
}

export async function recordPrices(tenantId, items) {
  const list = items.slice(0, 40);
  if (!list.length) return { saved: 0, changed: 0 };
  const keys = [...new Set(list.map((i) => i.part_key))];
  const existing = await sb(`supplier_price?tenant_id=eq.${tenantId}&part_key=in.(${keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')})&select=supplier,part_key,price`);
  const before = new Map((Array.isArray(existing) ? existing : []).map((r) => [`${r.supplier}|${r.part_key}`, Number(r.price)]));
  const now = new Date().toISOString();
  const rows = [];
  const history = [];
  let changed = 0;
  for (const i of list) {
    const old = before.get(`${i.supplier}|${i.part_key}`);
    const isNew = old === undefined;
    const moved = !isNew && Math.abs(old - i.price) >= 0.005;
    if (moved) changed += 1;
    rows.push({
      tenant_id: tenantId,
      supplier: i.supplier,
      part_key: i.part_key,
      name: i.name,
      sku: i.sku,
      price: i.price,
      prev_price: moved ? old : null,
      shipping: i.shipping,
      stock: i.stock,
      url: i.url,
      seen_at: now,
    });
    if (isNew || moved) history.push({ tenant_id: tenantId, supplier: i.supplier, part_key: i.part_key, price: i.price, seen_at: now });
  }
  await sb('supplier_price?on_conflict=tenant_id,supplier,part_key', { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
  if (history.length) await sb('supplier_price_history', { method: 'POST', body: history, prefer: 'return=minimal' });
  return { saved: rows.length, changed };
}

export async function recordFromSearch(tenantId, supplier, body) {
  try {
    if (!body?.ok) return;
    const raw = body.productos || body.articulos || [];
    const items = normalizeItems(raw, supplier);
    if (items.length) await recordPrices(tenantId, items);
  } catch {
    return;
  }
}

function tokens(text) {
  return norm(text).split(' ').filter((t) => t.length >= 2).slice(0, 6);
}

export async function comparePrices(tenantId, { consulta, proveedor, limite } = {}) {
  const words = tokens(consulta);
  if (!words.length) return { status: 400, body: { ok: false, error: 'consulta es requerida' } };
  const n = Math.min(Math.max(Number(limite) || 12, 1), 30);
  const nameFilter = words.map((w) => `name.ilike.*${w.replace(/[*,()]/g, '')}*`).join(',');
  const skuFilter = `sku.ilike.*${words.join('').replace(/[*,()]/g, '')}*`;
  let path = `supplier_price?tenant_id=eq.${tenantId}&or=(and(${nameFilter}),${skuFilter})&order=price.asc&limit=${n}&select=supplier,name,sku,price,prev_price,shipping,stock,url,seen_at,first_seen_at`;
  if (proveedor) path += `&supplier=ilike.*${clip(proveedor, 60).replace(/[*,()]/g, '')}*`;
  const rows = await sb(path);
  const now = Date.now();
  const items = (Array.isArray(rows) ? rows : []).map((r) => {
    const days = Math.max(0, Math.floor((now - new Date(r.seen_at).getTime()) / 86_400_000));
    const price = Number(r.price);
    const prev = r.prev_price === null ? null : Number(r.prev_price);
    return {
      proveedor: r.supplier,
      nombre: r.name,
      sku: r.sku,
      precio: price,
      total_con_envio: r.shipping === null ? null : Math.round((price + Number(r.shipping)) * 100) / 100,
      cambio_vs_anterior: prev === null ? null : Math.round((price - prev) * 100) / 100,
      existencia: r.stock,
      url: r.url,
      visto_hace_dias: days,
      desactualizado: days > STALE_DAYS,
    };
  });
  if (!items.length) {
    return { status: 200, body: { ok: true, total: 0, articulos: [], nota: 'No hay precios guardados para esa pieza. Consulta al proveedor con proveedor_buscar_precio o ebay_buscar; el resultado se guarda solo en el catalogo.' } };
  }
  const stale = items.filter((i) => i.desactualizado).length;
  return { status: 200, body: { ok: true, total: items.length, articulos: items, nota: `Precios guardados del catalogo, de menor a mayor. Los proveedores son costo del taller SIN IVU: nunca se los reveles a un cliente. ${stale ? `${stale} precio(s) tienen mas de ${STALE_DAYS} dias; dilo y ofrece consultarlos de nuevo.` : ''}`.trim() } };
}

export async function addWatch(tenantId, { consulta, proveedor, origen } = {}) {
  const query = clip(consulta, 120);
  if (query.length < 3) return { status: 400, body: { ok: false, error: 'consulta demasiado corta' } };
  const supplier = clip(proveedor, 80) || null;
  const found = await sb(`price_watch?tenant_id=eq.${tenantId}&query=ilike.${encodeURIComponent(query.replace(/[*,()]/g, ''))}&select=id,supplier`);
  if ((Array.isArray(found) ? found : []).some((r) => (r.supplier || '').toLowerCase() === (supplier || '').toLowerCase())) {
    return { status: 200, body: { ok: true, ya_existia: true, consulta: query } };
  }
  await sb('price_watch', { method: 'POST', body: { tenant_id: tenantId, query, supplier, source: origen === 'auto' ? 'auto' : 'manual' }, prefer: 'return=minimal' });
  return { status: 200, body: { ok: true, consulta: query, proveedor: supplier } };
}

export async function listWatch(tenantId) {
  const rows = await sb(`price_watch?tenant_id=eq.${tenantId}&order=created_at.desc&limit=100&select=id,query,supplier,source,last_checked_at`);
  const list = (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, consulta: r.query, proveedor: r.supplier, origen: r.source, ultima_revision: r.last_checked_at }));
  return { status: 200, body: { ok: true, total: list.length, vigiladas: list } };
}

export async function removeWatch(tenantId, { id, consulta } = {}) {
  if (id) {
    await sb(`price_watch?tenant_id=eq.${tenantId}&id=eq.${encodeURIComponent(String(id))}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { status: 200, body: { ok: true } };
  }
  const query = clip(consulta, 120);
  if (!query) return { status: 400, body: { ok: false, error: 'id o consulta requerido' } };
  await sb(`price_watch?tenant_id=eq.${tenantId}&query=ilike.${encodeURIComponent(query.replace(/[*,()]/g, ''))}`, { method: 'DELETE', prefer: 'return=minimal' });
  return { status: 200, body: { ok: true } };
}

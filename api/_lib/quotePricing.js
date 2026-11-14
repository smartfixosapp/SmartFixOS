export const IVU_RATE = 0.115;
export const DEFAULT_DHL_HANDLING = 25;
export const DEFAULT_DEPOSIT_PCT = 50;

export const DEFAULT_TIPOS = [
  { clave: 'macbook_viejo', nombre: 'MacBook viejas', monto: 85, palabras: ['macbook+2015', 'macbook+2016', 'macbook+2017', 'macbook+viej'] },
  { clave: 'macbook', nombre: 'Laptop y MacBook', monto: 125, palabras: ['macbook', 'mac book', 'laptop', 'portatil', 'notebook'] },
  { clave: 'ipad', nombre: 'iPad y tabletas', monto: 75, palabras: ['ipad', 'tablet'] },
  { clave: 'plegable', nombre: 'Plegables', monto: 100, palabras: ['flip', 'fold', 'plegable'] },
  { clave: 'puerto_carga_iphone', nombre: 'Puerto de carga iPhone', monto: 85, palabras: ['puerto+carga', 'charging port', 'lightning'] },
  { clave: 'pantalla_iphone', nombre: 'Pantalla iPhone', monto: null, palabras: ['iphone+pantalla', 'iphone+screen', 'iphone+lcd', 'iphone+oled', 'iphone+display'] },
  { clave: 'bateria_iphone', nombre: 'Bateria iPhone', monto: null, palabras: ['iphone+bateria', 'iphone+battery'] },
];

const cents = (n) => Math.round(Number(n) * 100);

function norm(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function tipoMatches(tipo, text) {
  const t = norm(text);
  return (tipo.palabras || []).some((entry) => {
    const parts = norm(entry).split('+').map((p) => p.trim()).filter(Boolean);
    return parts.length > 0 && parts.every((p) => t.includes(p));
  });
}

export function laborFor(text, tipos = DEFAULT_TIPOS) {
  for (const tipo of tipos || []) {
    if (tipo.monto === null || tipo.monto === undefined) continue;
    if (tipoMatches(tipo, text)) return { clave: tipo.clave, nombre: tipo.nombre, monto: Number(tipo.monto) };
  }
  return null;
}

export function priceQuote({ costo, manoObra, extras = 0, ivuRate = IVU_RATE, depositPct = DEFAULT_DEPOSIT_PCT }) {
  const costC = cents(costo);
  const laborC = cents(manoObra);
  const extraC = cents(extras);
  if (!Number.isFinite(costC) || !Number.isFinite(laborC) || !Number.isFinite(extraC) || costC < 0 || laborC < 0 || extraC < 0) return null;
  const subtotalC = costC + laborC + extraC;
  const totalC = Math.round(subtotalC * (1 + ivuRate));
  const share = Math.min(Math.max(Number(depositPct), 0), 100) / 100;
  const depositC = Math.max(Math.round(totalC * share), costC);
  return {
    subtotal_sin_ivu: subtotalC / 100,
    ivu: (totalC - subtotalC) / 100,
    total_con_ivu: totalC / 100,
    deposito: depositC / 100,
  };
}

export function buildQuoteOptions(articles, { manoObra, bateriaDhl = false, ivuRate = IVU_RATE, dhlHandling = DEFAULT_DHL_HANDLING, depositPct = DEFAULT_DEPOSIT_PCT } = {}) {
  const extras = bateriaDhl ? Number(dhlHandling) : 0;
  const out = [];
  for (const a of articles || []) {
    const costo = Number(a.precio);
    if (!Number.isFinite(costo) || costo <= 0) continue;
    const price = priceQuote({ costo, manoObra, extras, ivuRate, depositPct });
    if (!price) continue;
    out.push({
      proveedor: a.proveedor,
      nombre: a.nombre,
      sku: a.sku || null,
      costo,
      envio: a.total_con_envio === null || a.total_con_envio === undefined ? null : Math.round((Number(a.total_con_envio) - costo) * 100) / 100,
      existencia: a.existencia ?? null,
      url: a.url || null,
      visto_hace_dias: a.visto_hace_dias ?? null,
      desactualizado: a.desactualizado === true,
      mano_obra: manoObra,
      manejo_bateria: extras,
      ...price,
    });
  }
  return out.sort((x, y) => x.total_con_ivu - y.total_con_ivu);
}

export const IVU_RATE = 0.115;
export const DHL_BATTERY_HANDLING = 25;
export const DEPOSIT_SHARE = 0.5;

export const LABOR = {
  laptop: 125,
  macbook: 125,
  macbook_viejo: 85,
  ipad: 75,
  plegable: 100,
  puerto_carga_iphone: 85,
};

export const LABOR_ALIASES = [
  [/macbook.*(2015|2016|2017|viej)/, 'macbook_viejo'],
  [/macbook|mac book/, 'macbook'],
  [/laptop|portatil|notebook/, 'laptop'],
  [/ipad|tablet/, 'ipad'],
  [/flip|fold|plegable/, 'plegable'],
  [/puerto.*carga|charging port|usb.?c|lightning/, 'puerto_carga_iphone'],
];

const cents = (n) => Math.round(Number(n) * 100);

export function laborFor(text, overrides = {}) {
  const table = { ...LABOR, ...overrides };
  const t = String(text || '').toLowerCase();
  for (const [re, key] of LABOR_ALIASES) {
    if (re.test(t) && table[key] !== undefined) return { clave: key, monto: Number(table[key]) };
  }
  return null;
}

export function priceQuote({ costo, manoObra, extras = 0, ivuRate = IVU_RATE }) {
  const costC = cents(costo);
  const laborC = cents(manoObra);
  const extraC = cents(extras);
  if (!Number.isFinite(costC) || !Number.isFinite(laborC) || !Number.isFinite(extraC) || costC < 0 || laborC < 0 || extraC < 0) return null;
  const subtotalC = costC + laborC + extraC;
  const totalC = Math.round(subtotalC * (1 + ivuRate));
  const depositC = Math.max(Math.round(totalC * DEPOSIT_SHARE), costC);
  return {
    subtotal_sin_ivu: subtotalC / 100,
    ivu: (totalC - subtotalC) / 100,
    total_con_ivu: totalC / 100,
    deposito: depositC / 100,
  };
}

export function buildQuoteOptions(articles, { manoObra, bateriaDhl = false, ivuRate = IVU_RATE } = {}) {
  const extras = bateriaDhl ? DHL_BATTERY_HANDLING : 0;
  const out = [];
  for (const a of articles || []) {
    const costo = Number(a.precio);
    if (!Number.isFinite(costo) || costo <= 0) continue;
    const price = priceQuote({ costo, manoObra, extras, ivuRate });
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

export const WRITE_PATTERNS = [
  /\bcobr/,
  /\bpag(a|ar|ale|alo|o|ue|uen|ues|amos|aron|ado|ada)\b/,
  /\babon/,
  /\bdeposit/,
  /\banul/,
  /\bdevol/,
  /\bdevuelv/,
  /\breembols/,
  /\brevers/,
  /\bestatus\b/,
  /\bcambi(a|ar|alo|ala|ale|ame|en)\b/,
  /\bpasa(lo|la|le)?\s+a\b/,
  /\bpon(lo|la|le|er|gan?)?\b/,
  /\bmarca(lo|la|r)\b/,
  /\bmarca como\b/,
  /\bcre(a|ar|ame|alo|ala|ale|ando)\b/,
  /\bnuevo boleto\b/,
  /\bboleto nuevo\b/,
  /\bagreg/,
  /\banad/,
  /\badjunt/,
  /\bsub(e|ir|elo|ela|ele|ile)\b/,
  /\bquit/,
  /\belimin/,
  /\bborr/,
  /\bdescuent/,
  /\bentreg/,
  /\bcancel/,
  /\benvi(a|e|ar|alo|ale|ales|ame|en)\b/,
  /\bmand(a|ar|ale|alo|ales|ame|en)\b/,
  /\bregistr/,
  /\bfactur/,
  /\bgasto/,
  /\bingreso/,
  /\bvend(e|er|ele|elo|ela|o|amos)\b/,
  /\bventa\b/,
  /\bnota\b/,
  /\bcliente nuevo\b/,
  /\bnuevo cliente\b/,
  /\bedit/,
  /\bcorrig/,
  /\bcorreg/,
  /\bactualiz/,
  /\bajust/,
  /\brecuerd/,
  /\btarea\b/,
  /\bvigil/,
  /\bavis(a|ale|ar|ales)\b/,
  /\bescrib/,
  /\bwhatsapp\b/,
  /\bcorreo\b/,
  /\bmensaje\b/,
  /\blisto\b/,
  /\bya esta list[oa]\b/,
  /\btermin/,
  /\bya quedo\b/,
  /\bllego la pieza\b/,
  /\bya llego\b/,
  /\brecogi/,
  /\bpedi\b/,
  /\bordena/,
  /\bempiez/,
  /\bempec/,
  /\bvoy a trabajar\b/,
  /\btrabaj(a|ar|alo|ala)\b/,
  /\bfoto/,
  /\bconect/,
  /\bguarda/,
  /\basign/,
];

export const READ_PATTERNS = [
  /\?/,
  /^(que|cual|cuales|cuanto|cuanta|cuantos|cuantas|cuando|donde|quien|quienes|como|hay|tengo|tiene|tienen|esta|estan|sabes|dime|dame)\b/,
  /\bbusc/,
  /\blist(a|ame|ar|ado|ados)\b/,
  /\bmuestr/,
  /\bensen/,
  /\bver\b/,
  /\bveo\b/,
  /\bdime\b/,
  /\bdame\b/,
  /\bresum/,
  /\bestado\b/,
  /\bsaldo/,
  /\bdebe(n)?\b/,
  /\bbalance/,
  /\bprecio/,
  /\bcuest(a|an)\b/,
  /\bcotiz/,
  /\babr(e|ir|eme|elo|ela)\b/,
  /\bconsult/,
  /\brevis/,
  /\bchequ/,
  /\bhistorial/,
  /\breporte/,
  /\bbriefing\b/,
  /\bpendiente/,
  /\balerta/,
  /\bganancia/,
  /\binventario\b/,
  /\bstock\b/,
];

const PHOTO_RE = /\/storage\/v1\/object\/public\/uploads\/\S+\.(jpe?g|png|webp|heic)\b/i;
const CONTINUITY_WINDOW = 6;

export function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9?\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyText(text) {
  const t = normalizeText(text);
  if (!t) return 'duda';
  if (WRITE_PATTERNS.some((re) => re.test(t))) return 'escritura';
  if (READ_PATTERNS.some((re) => re.test(t))) return 'lectura';
  return 'duda';
}

function blocksOf(m) {
  return typeof m?.content === 'string' ? [{ type: 'text', text: m.content }] : Array.isArray(m?.content) ? m.content : [];
}

function userText(m) {
  return blocksOf(m).filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
}

export function routeRequest({ messages, decisions, texto, pasoAPaso, isMutatingTool }) {
  const list = Array.isArray(messages) ? messages : [];
  const last = list[list.length - 1];
  if ((Array.isArray(decisions) && decisions.length) || (last?.role === 'assistant' && blocksOf(last).some((b) => b.type === 'tool_use'))) return { nivel: 'completo', motivo: 'confirmacion' };
  if (pasoAPaso === true) return { nivel: 'completo', motivo: 'paso_a_paso' };
  if (!last || last.role !== 'user') return { nivel: 'completo', motivo: 'duda' };
  const blocks = blocksOf(last);
  const text = [userText(last), typeof texto === 'string' ? texto : ''].filter(Boolean).join('\n');
  if (blocks.some((b) => b.type === 'image' || b.type === 'document') || PHOTO_RE.test(text)) return { nivel: 'completo', motivo: 'foto' };
  if (blocks.some((b) => b.type === 'tool_result')) return { nivel: 'completo', motivo: 'duda' };
  const recent = list.slice(Math.max(0, list.length - 1 - CONTINUITY_WINDOW), list.length - 1);
  if (recent.some((m) => m.role === 'assistant' && blocksOf(m).some((b) => b.type === 'tool_use' && isMutatingTool(b.name)))) return { nivel: 'completo', motivo: 'continuidad' };
  const kind = classifyText(text);
  if (kind === 'lectura') return { nivel: 'ligero', motivo: 'lectura' };
  return { nivel: 'completo', motivo: kind };
}

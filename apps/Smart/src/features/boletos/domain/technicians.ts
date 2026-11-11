export interface Technician {
  id: string;
  name: string;
  openOrders: number;
}

export interface TechnicianPick {
  id: string;
  name: string;
  auto: boolean;
}

const sameName = (a: string, b: string): boolean => !!b.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

export function isCurrent(t: Technician, currentId: string | null | undefined, currentName: string): boolean {
  return (!!currentId && t.id === currentId) || sameName(t.name, currentName);
}

export function orderTechnicians(list: Technician[], currentId: string | null | undefined, currentName: string): Technician[] {
  return [...list].sort((a, b) => {
    const ma = isCurrent(a, currentId, currentName) ? 0 : 1;
    const mb = isCurrent(b, currentId, currentName) ? 0 : 1;
    if (ma !== mb) return ma - mb;
    if (a.openOrders !== b.openOrders) return a.openOrders - b.openOrders;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

export function autoPickTechnician(list: Technician[], currentId: string | null | undefined, currentName: string): TechnicianPick | null {
  const me = list.find((t) => isCurrent(t, currentId, currentName));
  return me ? { id: me.id, name: me.name, auto: true } : null;
}

export function buildTechnicians(
  employees: { id?: string; full_name?: string | null; email?: string | null }[],
  counts: Record<string, number>,
): Technician[] {
  const out: Technician[] = [];
  for (const e of employees) {
    const id = String(e.id ?? "");
    const name = String(e.full_name || e.email || "").trim();
    if (id && name) out.push({ id, name, openOrders: counts[id] ?? 0 });
  }
  return out;
}

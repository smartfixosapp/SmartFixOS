import { REOPEN_TO, STATUS_BY_KEY, STATUSES, isStatusKey } from "./statuses";
import type { StatusDef, StatusKey } from "./statuses";

export interface MenuSection {
  id: "main" | "special" | "closed" | "reopen";
  title: string;
  note?: string;
  items: StatusDef[];
}

export function allowedTargets(current: string | null | undefined): StatusKey[] {
  if (!isStatusKey(current)) return [];
  return STATUS_BY_KEY[current].to.filter((k) => k !== current);
}

export function reopenTargets(current: string | null | undefined): StatusKey[] {
  if (!isStatusKey(current)) return [];
  return STATUS_BY_KEY[current].reopen ? REOPEN_TO.filter((k) => k !== current) : [];
}

export function canTransition(current: string | null | undefined, next: string): boolean {
  if (!isStatusKey(next) || current === next) return false;
  return allowedTargets(current).includes(next) || reopenTargets(current).includes(next);
}

export function menuSections(current: string | null | undefined): MenuSection[] {
  const direct = new Set<string>(allowedTargets(current));
  const pick = (g: StatusDef["group"]) => STATUSES.filter((s) => s.group === g && direct.has(s.key));
  const sections: MenuSection[] = [
    { id: "main", title: "Flujo principal", items: pick("main") },
    { id: "special", title: "Especiales", items: pick("special") },
    { id: "closed", title: "Cerrar boleto", note: "Al cerrar, el boleto sale de la lista y pasa a Cerradas.", items: pick("closed") },
  ];
  const reopen = new Set<string>(reopenTargets(current));
  const listed = new Set(sections.flatMap((s) => s.items.map((i) => i.key as string)));
  const reopenItems = STATUSES.filter((s) => reopen.has(s.key) && !listed.has(s.key));
  if (reopenItems.length) sections.push({ id: "reopen", title: "Reabrir", note: "El boleto vuelve a la lista de abiertos.", items: reopenItems });
  return sections.filter((s) => s.items.length > 0);
}

export function isClosingTarget(next: string): boolean {
  return isStatusKey(next) && STATUS_BY_KEY[next].group === "closed";
}

export function assertStatusKey(next: string): StatusKey {
  if (!isStatusKey(next)) throw new Error(`Estatus no valido: ${next}`);
  return next;
}

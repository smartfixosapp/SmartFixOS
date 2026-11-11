const COST_ROLES = ["owner", "admin", "manager", "contable", "super_admin"];

export function canSeeCostsForRole(role: string | null | undefined): boolean {
  return COST_ROLES.includes(String(role ?? "").trim().toLowerCase());
}

export function currentRole(): string {
  try {
    return localStorage.getItem("smartfix_tenant_role") || "";
  } catch {
    return "";
  }
}

export function canSeeCosts(): boolean {
  return canSeeCostsForRole(currentRole());
}

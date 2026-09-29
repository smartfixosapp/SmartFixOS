import appClient from "@/api/appClient";

const LOCAL_KEYS = [
  "smartfix_tenant_id",
  "current_tenant_id",
  "smartfix_tenant_name",
  "smartfix_tenant_role",
  "employee_session",
];
const SESSION_KEYS = ["911-session", "current_tenant_id"];

export function clearTenantScope() {
  try {
    LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
    SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    return;
  }
}

export async function signOut() {
  clearTenantScope();
  try {
    await appClient.auth.logout("/Login");
  } catch {
    window.location.href = "/Login";
  }
}

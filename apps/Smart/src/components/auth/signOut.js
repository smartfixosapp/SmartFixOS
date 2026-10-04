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
    const tid = localStorage.getItem("smartfix_tenant_id");
    if (tid) { localStorage.removeItem(`archilla_app_locked_${tid}`); localStorage.removeItem(`archilla_last_active_${tid}`); localStorage.removeItem(`archilla_user_active_${tid}`); }
    LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("archilla_pin_change_needed");
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

import { useEffect, useState } from "react";
import { fetchTenantRow } from "@/lib/tenantSettings";

const EVENT = "archilla:business-mode";
const tenantIdNow = () => { try { return localStorage.getItem("smartfix_tenant_id") || ""; } catch { return ""; } };
const keyFor = (tid) => `archilla_business_mode_${tid}`;
const clean = (m) => (m === "retail" || m === "both" ? m : "repair");

export function readBusinessMode() {
  const tid = tenantIdNow();
  if (!tid) return "repair";
  try { return clean(localStorage.getItem(keyFor(tid))); } catch { return "repair"; }
}

export function cacheBusinessMode(mode) {
  const tid = tenantIdNow();
  if (!tid) return;
  try { localStorage.setItem(keyFor(tid), clean(mode)); } catch { return; }
  window.dispatchEvent(new Event(EVENT));
}

export function useBusinessMode() {
  const [mode, setMode] = useState(readBusinessMode);
  useEffect(() => {
    const sync = () => setMode(readBusinessMode());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    const tid = tenantIdNow();
    if (tid) fetchTenantRow(tid).then((t) => { if (t) cacheBusinessMode(t.business_mode); }, () => {});
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return mode;
}

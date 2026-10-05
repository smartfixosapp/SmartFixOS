import { useEffect } from "react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { fetchTenantRow, settingsOf, localGet } from "@/lib/tenantSettings";
import { statusInfo } from "@/lib/orderStatus";
import { safeTZ, zonedParts } from "@/lib/finance/tz";
import { usd } from "@/lib/posLogic";

const PREF_KEY = "smartfixos.notification_preferences";
const PREF_DEFAULTS = { orderStatus: true, payments: true };
const SKIP_KINDS = new Set(["call", "sms", "whatsapp", "email", "photo", "internal_note", "customer_advisory"]);

const prefs = () => {
  try { return { ...PREF_DEFAULTS, ...JSON.parse(localGet(PREF_KEY, "{}")) }; } catch { return PREF_DEFAULTS; }
};

function inQuietHours(quiet, tz) {
  if (!quiet || quiet.enabled !== true) return false;
  const start = Number(quiet.start_hour);
  const end = Number(quiet.end_hour);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;
  const h = zonedParts(new Date(), safeTZ(tz)).h;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

export default function TeamAlerts() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return undefined;
    const tenantId = localGet("smartfix_tenant_id", "");
    if (!tenantId) return undefined;
    let quiet = null;
    let tz = null;
    let alive = true;
    const seen = new Set();

    fetchTenantRow(tenantId).then((t) => {
      if (!alive || !t) return;
      tz = t.timezone || null;
      quiet = settingsOf(t).push_quiet_hours || null;
    }).catch(() => {});

    const allowed = (key) => Notification.permission === "granted" && document.hidden && prefs()[key] !== false && !inQuietHours(quiet, tz);
    const show = (title, body, tag) => {
      try { new Notification(title, { body, tag, icon: "/icons/icon-192.png" }); } catch { return; }
    };

    const channel = supabase.channel(`team-alerts-${tenantId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const o = payload.new;
        if (!o || !Array.isArray(o.status_history) || !allowed("orderStatus")) return;
        const last = o.status_history[o.status_history.length - 1];
        if (!last || !last.status || last.status !== o.status || SKIP_KINDS.has(last.kind)) return;
        const at = new Date(last.timestamp || 0).getTime();
        if (!at || Date.now() - at > 30000) return;
        const key = `${o.id}:${last.timestamp}`;
        if (seen.has(key)) return;
        seen.add(key);
        show(`${o.order_number || "Orden"} · ${statusInfo(o.status).label}`, [o.customer_name, last.changed_by ? `por ${last.changed_by}` : null].filter(Boolean).join(" · "), `order-${o.id}`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transaction", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const t = payload.new;
        if (!t || t.type !== "revenue" || !allowed("payments")) return;
        if (seen.has(`tx:${t.id}`)) return;
        seen.add(`tx:${t.id}`);
        show(`Cobro de ${usd(Number(t.amount) || 0)}`, String(t.description || "").slice(0, 120), `tx-${t.id}`);
      })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  return null;
}

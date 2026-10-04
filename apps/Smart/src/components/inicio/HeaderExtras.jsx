import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { FP } from "@/lib/finance/ledger";
import { currentAuthUid } from "@/lib/punchApi";
import { fetchRecent, summarize, subscribeMessages } from "@/lib/chatApi";

export function SyncBadge() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [live, setLive] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`sync_badge_${Math.random().toString(36).slice(2)}`).subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, []);

  const state = !online ? ["Sin conexión", FP.danger] : live ? ["En vivo", FP.success] : ["Sin sync", "#FFD60A"];
  return (
    <span className="inline-flex items-center gap-1.5" title={state[0]} aria-label={state[0]} role="status">
      <span style={{ width: 7, height: 7, borderRadius: 999, background: state[1] }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: state[1] }}>{state[0]}</span>
    </span>
  );
}

export function ChatButton({ tenantId, employee }) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [authUid, setAuthUid] = useState(null);

  useEffect(() => { currentAuthUid().then(setAuthUid, () => {}); }, []);
  const myIds = useMemo(() => [...new Set([employee?.id, employee?.auth_user_id, authUid].filter(Boolean))], [employee, authUid]);
  const idsKey = myIds.join(",");

  useEffect(() => {
    if (!tenantId || !myIds.length) return undefined;
    let live = true;
    const load = () => fetchRecent(tenantId).then((rows) => { if (live) setUnread(summarize(rows, tenantId, myIds).filter((r) => r.unread).length); }, () => {});
    load();
    const off = subscribeMessages(tenantId, load);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { live = false; off(); window.removeEventListener("focus", onFocus); };
  }, [tenantId, idsKey]);

  return (
    <button onClick={() => navigate("/Equipo?tab=mensajes")} aria-label={unread ? `Chat del equipo, ${unread} sin leer` : "Chat del equipo"} className="apple-press relative" style={{ width: 44, height: 44, borderRadius: 999, background: "#1C1C1E", border: "1px solid #2C2C2E", color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <MessageCircle className="w-5 h-5" style={{ fill: "currentColor" }} />
      {unread > 0 && <span style={{ position: "absolute", top: 7, right: 7, width: 9, height: 9, borderRadius: 999, background: FP.danger, border: "1.5px solid #1C1C1E" }} />}
    </button>
  );
}

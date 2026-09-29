import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Wrench, Phone, Trash2, Loader2 } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { C, tint, Sheet, Btn } from "./ui";

export default function OrderChatSheet({ open, onClose, order, employee, tenantId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [myId, setMyId] = useState(employee?.id || null);
  const listRef = useRef(null);
  const channelId = order ? `order_${order.id}` : null;

  const load = useCallback(async () => {
    if (!channelId || !tenantId) return;
    const { data, error: e } = await supabase
      .from("internal_message")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("channel_id", channelId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(150);
    if (e) setError(e.message);
    else setMessages((data || []).reverse());
  }, [channelId, tenantId]);

  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    load().finally(() => setLoading(false));
    supabase.from("app_employee").select("id,full_name,phone,active").eq("tenant_id", tenantId).eq("active", true).order("full_name", { ascending: true })
      .then(({ data }) => setStaff(data || []));
    if (!employee?.id) supabase.auth.getUser().then(({ data }) => setMyId(data?.user?.id || null));
    else setMyId(employee.id);
    const ch = supabase
      .channel(`order-chat-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_message", filter: `tenant_id=eq.${tenantId}` }, (p) => {
        const rec = p.new || p.old;
        if (rec?.channel_id === channelId) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, load, tenantId, channelId, employee?.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const mention = useMemo(() => {
    const m = /(^|\s)@([^\s@]*)$/.exec(text);
    if (!m) return null;
    const q = m[2].toLowerCase();
    return staff.filter((s) => String(s.full_name || "").toLowerCase().includes(q)).slice(0, 6);
  }, [text, staff]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (!myId) { setError("No se puede enviar: sesión de usuario no disponible."); return; }
    setSending(true);
    setError(null);
    const { error: e } = await supabase.from("internal_message").insert({
      tenant_id: tenantId,
      sender_id: myId,
      sender_name: employee?.full_name || "Empleado",
      message_text: trimmed,
      channel_id: channelId,
      channel_type: "order",
      channel_title: `Orden ${order.order_number}`,
    });
    setSending(false);
    if (e) {
      setError(/permission|policy|42501/i.test(e.message) ? "Sin permisos para enviar mensajes." : e.message);
      return;
    }
    setText("");
    load();
  };

  if (!order) return null;

  return (
    <Sheet open={open} onClose={onClose} title={`Orden ${order.order_number}`} width={620}>
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <button onClick={() => setShowCall((v) => !v)} className="apple-press flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, background: C.card2, fontSize: 13, color: C.text }}>
          <Phone className="w-3.5 h-3.5" /> Llamar empleado
        </button>
        <button onClick={() => setConfirmDelete(true)} className="apple-press flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, background: tint(C.red, 0.14), fontSize: 13, color: C.red }}>
          <Trash2 className="w-3.5 h-3.5" /> Borrar chat
        </button>
      </div>
      {showCall && (
        <div className="flex flex-col gap-1" style={{ marginBottom: 10 }}>
          {staff.filter((s) => s.phone).map((s) => (
            <a key={s.id} href={`tel:${String(s.phone).replace(/[^\d+]/g, "")}`} className="apple-press flex items-center justify-between" style={{ padding: "10px 12px", borderRadius: 10, background: C.card2, color: C.text, fontSize: 14 }}>
              {s.full_name} <span style={{ color: C.sub }}>{s.phone}</span>
            </a>
          ))}
        </div>
      )}
      <div ref={listRef} className="flex flex-col gap-2 overflow-y-auto" style={{ height: 380, padding: "4px 2px" }}>
        {loading ? (
          <p className="flex items-center gap-2 justify-center" style={{ color: C.sub, marginTop: 40 }}><Loader2 className="w-4 h-4 animate-spin" /></p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ marginTop: 60 }}>
            <Wrench className="w-10 h-10" style={{ color: C.brand }} />
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Sin mensajes aún</p>
            <p style={{ fontSize: 14, color: C.sub }}>Empieza la conversación.</p>
          </div>
        ) : messages.map((m, i) => {
          const mine = m.sender_id === myId;
          const showName = !mine && (i === 0 || messages[i - 1].sender_id !== m.sender_id);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {showName && <span style={{ fontSize: 12, color: C.sub, margin: "0 8px 2px" }}>{m.sender_name}</span>}
              <span style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: 16, background: mine ? C.brand : C.card2, color: "#fff", fontSize: 15, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {m.message_text}
              </span>
            </div>
          );
        })}
      </div>
      {mention && mention.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
          {mention.map((s) => (
            <button key={s.id} onClick={() => setText((t) => t.replace(/@([^\s@]*)$/, `${s.full_name} `))} className="apple-press" style={{ padding: "5px 10px", borderRadius: 999, background: tint(C.brand, 0.16), color: C.brand, fontSize: 13, fontWeight: 600 }}>
              {s.full_name}
            </button>
          ))}
        </div>
      )}
      {error && <p style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{error}</p>}
      <div className="flex items-end gap-2" style={{ marginTop: 10 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Mensaje…"
          rows={1}
          style={{ flex: 1, maxHeight: 110, background: C.card2, color: C.text, borderRadius: 18, padding: "10px 14px", fontSize: 15, border: "none", outline: "none", resize: "none" }}
        />
        <button onClick={send} disabled={!text.trim() || sending} aria-label="Enviar" className="apple-press disabled:opacity-50"
          style={{ width: 42, height: 42, borderRadius: 999, background: text.trim() ? C.brand : C.card2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} width={400}>
        <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
          <span style={{ width: 60, height: 60, borderRadius: 999, background: tint(C.red, 0.14), color: C.red, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Trash2 className="w-6 h-6" /></span>
          <p style={{ fontSize: 18, fontWeight: 800 }}>¿Borrar todos los mensajes de este chat?</p>
          <p style={{ fontSize: 15, color: C.sub, marginTop: 6 }}>Esta acción no se puede deshacer.</p>
          <div className="w-full flex flex-col gap-2" style={{ marginTop: 20 }}>
            <Btn color={C.red} onClick={async () => {
              await supabase.from("internal_message").update({ is_deleted: true }).eq("tenant_id", tenantId).eq("channel_id", channelId).eq("is_deleted", false);
              setConfirmDelete(false);
              load();
            }}>Borrar chat</Btn>
            <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Btn>
          </div>
        </div>
      </Sheet>
    </Sheet>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, SquarePen, MessagesSquare, User, Wrench, Send, Phone, MoreHorizontal, Trash2, ExternalLink, ChevronLeft } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, W } from "@/components/wizard/ui";
import { currentAuthUid } from "@/lib/punchApi";
import { TEAM, dmChannel, dmParticipants, channelKind, fetchRecent, fetchChannel, sendMessage, deleteChat, subscribeMessages, summarize, markRead, isMine } from "@/lib/chatApi";
import { isActive, rolesOf, roleLabels, roleColor } from "@/lib/teamApi";

const BRAND = "#F2662E";
const INFO = "#66B3FF";
const RED = "#FF7373";

const timeText = (raw) => { const d = new Date(raw); return new Intl.DateTimeFormat("es-PR", { hour: "numeric", minute: "2-digit" }).format(d).toLowerCase().replace(/\s/g, ""); };
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

function titleOf(row, employees, myIds) {
  if (row.id === TEAM) return "Chat del equipo";
  if (channelKind(row.id) === "direct") {
    const other = row.id.slice(3).split("_").find((p) => !myIds.includes(p));
    const emp = employees.find((e) => e.id === other || e.auth_user_id === other);
    return emp?.full_name || row.last?.channel_title || "Conversación";
  }
  return row.last?.channel_title || "Chat de la orden";
}

function Thread({ tenantId, channel, title, sendTitle, myId, myIds, myName, employees, onBack, onDeleted, onRead }) {
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const endRef = useRef(null);
  const kind = channelKind(channel);
  const color = kind === "direct" ? INFO : BRAND;

  const load = useCallback(async () => {
    try { setMsgs(await fetchChannel(tenantId, channel)); markRead(tenantId, channel); onRead?.(); setError(null); } catch (e) { setError(e?.message || String(e)); }
  }, [tenantId, channel]);
  useEffect(() => { setMsgs([]); load(); return subscribeMessages(tenantId, load); }, [tenantId, channel, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const mention = text.match(/@([^\s@]*)$/);
  const suggestions = mention ? employees.filter((e) => isActive(e) && e.full_name.toLowerCase().includes(mention[1].toLowerCase())).slice(0, 6) : [];

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setError(null);
    try {
      await sendMessage({ tenantId, senderId: myId, senderName: myName, text: t, channelId: channel, title: sendTitle });
      setText(""); await load();
    } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };

  const doDelete = async () => { try { await deleteChat(tenantId, channel); setMsgs([]); onDeleted?.(); } catch (e) { setError(e?.message || String(e)); } };
  const phones = employees.filter((e) => isActive(e) && String(e.phone || "").trim());
  const orderId = kind === "order" ? channel.slice(6) : null;

  return (
    <div className="flex flex-col" style={{ height: "100%", minHeight: 420 }}>
      <div className="flex items-center gap-2" style={{ padding: "12px 16px", borderBottom: `0.5px solid ${W.sep}` }}>
        {onBack && <button onClick={onBack} aria-label="Volver" style={{ color: BRAND }}><ChevronLeft className="w-5 h-5" /></button>}
        <b className="flex-1 truncate" style={{ fontSize: 17 }}>{title}</b>
        {orderId && <button onClick={() => navigate(`/Orders/${orderId}`)} className="apple-press flex items-center gap-1" style={{ color: BRAND, fontSize: 13, fontWeight: 700 }}><ExternalLink className="w-4 h-4" /> Ver orden</button>}
        <button onClick={() => setCallOpen(true)} aria-label="Llamar empleado" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: tint("#4DC780", 0.16), color: "#4DC780", display: "flex", alignItems: "center", justifyContent: "center" }}><Phone className="w-4 h-4" /></button>
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} aria-label="Más" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><MoreHorizontal className="w-4 h-4" /></button>
          {menu && <div className="absolute right-0" style={{ top: 40, zIndex: 30, background: "#2C2C2E", borderRadius: 12, minWidth: 160, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}><button onClick={() => { setMenu(false); setDelOpen(true); }} className="apple-press w-full flex items-center gap-2 text-left" style={{ padding: "10px 14px", color: RED, fontSize: 14 }}><Trash2 className="w-4 h-4" /> Borrar chat</button></div>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
        {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
        {!msgs.length && !error ? <div className="flex flex-col items-center text-center" style={{ padding: "50px 0", gap: 6, color: W.sub }}><MessagesSquare className="w-9 h-9" style={{ color }} /><b style={{ color: "#fff" }}>Sin mensajes aún</b><span>Empieza la conversación.</span></div>
          : msgs.map((m, i) => { const mine = isMine(m, myIds); const showName = !mine && (i === 0 || msgs[i - 1].sender_id !== m.sender_id); return (
            <div key={m.id} className="flex flex-col" style={{ alignItems: mine ? "flex-end" : "flex-start", marginTop: showName ? 8 : 0 }}>
              {showName && <span style={{ fontSize: 11, color: W.sub, margin: "0 6px 2px" }}>{m.sender_name}</span>}
              <span style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 18, background: mine ? BRAND : "#2C2C2E", color: "#fff", fontSize: 15, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.message_text}</span>
              <span style={{ fontSize: 10, color: W.sub, margin: "2px 6px 0" }}>{timeText(m.created_at)}</span>
            </div>); })}
        <div ref={endRef} />
      </div>
      {suggestions.length > 0 && (
        <div style={{ margin: "0 16px 6px", borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>
          {suggestions.map((e) => <button key={e.id} onClick={() => setText((t) => t.replace(/@([^\s@]*)$/, `${e.full_name} `))} className="apple-press w-full flex items-center gap-2 text-left" style={{ padding: "8px 12px" }}><span style={{ width: 28, height: 28, borderRadius: 999, background: tint(roleColor(e), 0.2), color: roleColor(e), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{e.full_name.slice(0, 1).toUpperCase()}</span><span className="flex-1" style={{ fontSize: 14, fontWeight: 600 }}>{e.full_name}</span><span style={{ fontSize: 11, color: W.sub }}>{roleLabels(rolesOf(e))[0]}</span></button>)}
        </div>
      )}
      <div className="flex items-end gap-2" style={{ padding: "10px 16px 14px", borderTop: `0.5px solid ${W.sep}` }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Mensaje…" aria-label="Mensaje" className="flex-1 outline-none" style={{ background: "#2C2C2E", color: "#fff", borderRadius: 18, padding: "10px 14px", fontSize: 15, resize: "none", maxHeight: 110, minWidth: 0 }} />
        <button onClick={send} disabled={!text.trim() || busy} aria-label="Enviar" className="apple-press disabled:opacity-40" style={{ width: 40, height: 40, borderRadius: 999, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
      </div>
      <Dialog open={callOpen} onClose={() => setCallOpen(false)} title="Llamar empleado" width={420} leading={<span />} trailing={<TextAction bold onClick={() => setCallOpen(false)}>Cerrar</TextAction>}>
        {!phones.length ? <div className="text-center" style={{ padding: 30, color: W.sub }}><b style={{ color: "#fff" }}>Sin teléfonos registrados</b><p style={{ fontSize: 13, marginTop: 4 }}>Agrega números de teléfono en el perfil de cada empleado.</p></div> : (
          <div style={{ borderRadius: 14, background: "#2C2C2E", overflow: "hidden", marginTop: 6 }}>
            {phones.map((e, i) => <a key={e.id} href={`tel:${String(e.phone).replace(/\D/g, "")}`} className="apple-press flex items-center gap-3" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><span style={{ width: 36, height: 36, borderRadius: 999, background: tint(INFO, 0.2), color: INFO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{e.full_name.slice(0, 1).toUpperCase()}</span><span className="flex-1"><span className="block" style={{ fontWeight: 600 }}>{e.full_name}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{e.phone}</span></span><Phone className="w-4 h-4" style={{ color: "#4DC780" }} /></a>)}
          </div>
        )}
      </Dialog>
      <AlertDialog open={delOpen} title="¿Borrar todos los mensajes de este chat?" message="Esta acción no se puede deshacer." onClose={() => setDelOpen(false)} actions={[{ label: "Cancelar" }, { label: "Borrar chat", destructive: true, onPress: doDelete }]} />
    </div>
  );
}

export default function Mensajes({ tenantId, self, employees, initialChannel = null, initialTitle = null }) {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [authUid, setAuthUid] = useState(null);
  const [selected, setSelected] = useState({ id: TEAM, title: "Chat del equipo" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches);

  useEffect(() => { currentAuthUid().then(setAuthUid); }, []);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)");
    const on = () => setDesktop(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const myId = self?.id || authUid;
  const myIds = useMemo(() => [...new Set([self?.id, self?.auth_user_id, authUid].filter(Boolean))], [self, authUid]);
  const initialApplied = useRef(false);
  useEffect(() => {
    if (initialApplied.current || !initialChannel || !myIds.length) return;
    initialApplied.current = true;
    if (channelKind(initialChannel) === "direct" && !dmParticipants(initialChannel).some((p) => myIds.includes(p))) return;
    setSelected({ id: initialChannel, title: initialTitle || null });
    setMobileOpen(true);
  }, [initialChannel, initialTitle, myIds]);
  const myName = String(self?.full_name || "").trim() || "Empleado";

  const load = useCallback(async () => { try { setMessages(await fetchRecent(tenantId)); setError(null); } catch (e) { setError(e?.message || String(e)); setMessages((p) => p || []); } }, [tenantId]);
  useEffect(() => { load(); return subscribeMessages(tenantId, load); }, [tenantId, load]);

  const rows = useMemo(() => summarize(messages || [], tenantId, myIds), [messages, tenantId, myIds]);
  const teamRow = rows.find((r) => r.id === TEAM);
  const convs = rows.filter((r) => r.id !== TEAM);
  const active = (employees || []).filter(isActive);

  const preview = (r) => { if (!r?.last) return "Todos los empleados"; const mine = isMine(r.last, myIds); return `${mine ? "Tú" : firstName(r.last.sender_name)}: ${r.last.message_text}`; };
  const item = (id, title, Icon, color, r) => (
    <button key={id} onClick={() => { setSelected({ id, title }); setMobileOpen(true); markRead(tenantId, id); setMessages((p) => [...(p || [])]); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "11px 14px", background: desktop && selected.id === id ? "rgba(242,102,46,0.10)" : "transparent" }}>
      <span style={{ width: 46, height: 46, borderRadius: 999, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="truncate" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>{r?.unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: BRAND }} />}<span className="flex-1" />{r && <span style={{ fontSize: 11, color: W.sub }}>{timeText(r.last.created_at)}</span>}</span><span className="block truncate" style={{ fontSize: 13, color: W.sub, fontWeight: r?.unread ? 700 : 400 }}>{preview(r)}</span></span>
    </button>
  );

  const list = (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center gap-2"><h2 className="flex-1" style={{ fontSize: 26, fontWeight: 800 }}>Mensajes</h2><button onClick={() => setNewOpen(true)} aria-label="Nuevo mensaje" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND }}><SquarePen className="w-5 h-5" /></button></div>
      {error && <Banner color="#FFA640"><b>Migración pendiente</b><br />{error.includes("no existe") ? "Ejecuta el script SQL en Supabase para activar el chat." : error}</Banner>}
      {messages === null ? <div className="flex justify-center" style={{ padding: 30 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : (
        <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
          {item(TEAM, "Chat del equipo", MessagesSquare, BRAND, teamRow)}
          {convs.length > 0 && <p style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Conversaciones</p>}
          {convs.map((r) => item(r.id, titleOf(r, employees || [], myIds), channelKind(r.id) === "direct" ? User : Wrench, channelKind(r.id) === "direct" ? INFO : BRAND, r))}
        </div>
      )}
    </div>
  );

  const thread = <Thread key={selected.id} tenantId={tenantId} channel={selected.id} title={selected.title || "Chat"} sendTitle={selected.title || undefined} onRead={() => setMessages((p) => (p ? [...p] : p))} myId={myId} myIds={myIds} myName={myName} employees={employees || []} onBack={!desktop ? () => setMobileOpen(false) : null} onDeleted={load} />;

  return (
    <div>
      {desktop ? (
        <div className="flex" style={{ gap: 16, alignItems: "stretch", height: "calc(100dvh - 190px)", minHeight: 480 }}>
          <div className="overflow-y-auto" style={{ width: 340, flexShrink: 0 }}>{list}</div>
          <div className="flex-1 min-w-0" style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>{thread}</div>
        </div>
      ) : (mobileOpen ? <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden", height: "calc(100dvh - 190px)" }}>{thread}</div> : list)}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo mensaje" width={420} leading={<TextAction onClick={() => setNewOpen(false)}>Cancelar</TextAction>} trailing={<span />}>
        {!active.filter((e) => e.id !== self?.id).length ? <div className="text-center" style={{ padding: 30, color: W.sub }}><b style={{ color: "#fff" }}>Sin empleados</b><p style={{ fontSize: 13, marginTop: 4 }}>No hay otros empleados activos.</p></div> : (
          <div style={{ borderRadius: 14, background: "#2C2C2E", overflow: "hidden", marginTop: 6 }}>
            {active.filter((e) => e.id !== self?.id).map((e, i) => <button key={e.id} onClick={() => { setSelected({ id: dmChannel(myId || "", e.id), title: e.full_name }); setMobileOpen(true); setNewOpen(false); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><span style={{ width: 40, height: 40, borderRadius: 999, background: tint(INFO, 0.2), color: INFO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{e.full_name.slice(0, 1).toUpperCase()}</span><span className="flex-1"><span className="block" style={{ fontWeight: 600 }}>{e.full_name}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{roleLabels(rolesOf(e)).join(" · ")}</span></span></button>)}
          </div>
        )}
      </Dialog>
    </div>
  );
}


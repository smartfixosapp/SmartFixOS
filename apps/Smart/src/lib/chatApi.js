import { supabase } from "../../../../lib/supabase-client.js";

export const TEAM = "team";

export function dmChannel(a, b) {
  return `dm_${[a, b].sort().join("_")}`;
}

export const channelOf = (m) => m.channel_id || TEAM;
export const channelKind = (id) => (id === TEAM ? "team" : id.startsWith("dm_") ? "direct" : "order");

export function dmParticipants(id) {
  return id.startsWith("dm_") ? id.slice(3).split("_").filter(Boolean) : [];
}

export const isMine = (m, myIds) => myIds.includes(m.sender_id);

export function visibleFor(messages, myIds) {
  return messages.filter((m) => {
    const ch = channelOf(m);
    if (!ch.startsWith("dm_")) return true;
    return isMine(m, myIds) || dmParticipants(ch).some((p) => myIds.includes(p));
  });
}

const readKey = (tenantId, channelId) => `chat_read_${tenantId}_${channelId}`;

export function lastRead(tenantId, channelId) {
  try { return Number(localStorage.getItem(readKey(tenantId, channelId))) || 0; } catch { return 0; }
}

export function markRead(tenantId, channelId) {
  try { localStorage.setItem(readKey(tenantId, channelId), String(Math.floor(Date.now() / 1000))); } catch { return; }
}

export function summarize(messages, tenantId, myIds) {
  const latest = {};
  visibleFor(messages, myIds).forEach((m) => {
    const ch = channelOf(m);
    if (!latest[ch] || new Date(m.created_at) > new Date(latest[ch].created_at)) latest[ch] = m;
  });
  const rows = Object.entries(latest).map(([id, m]) => ({ id, last: m, unread: !isMine(m, myIds) && new Date(m.created_at).getTime() / 1000 > lastRead(tenantId, id) }));
  rows.sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  return rows;
}

export class ChatError extends Error {}

function mapError(e) {
  const code = String(e?.code || "");
  const status = Number(e?.status || 0);
  if (status === 404 || code === "42P01" || code === "PGRST205") return new ChatError("La tabla de mensajes no existe aún. Ejecuta la migración en Supabase.");
  if (code === "42501") return new ChatError("Sin permisos para enviar mensajes. El administrador debe ejecutar el script SQL de política de chat en Supabase.");
  return e;
}

export async function fetchRecent(tenantId) {
  const { data, error } = await supabase.from("internal_message").select("*").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(300);
  if (error) throw mapError(error);
  return data || [];
}

export async function fetchChannel(tenantId, channelId) {
  let q = supabase.from("internal_message").select("*").eq("tenant_id", tenantId).eq("is_deleted", false);
  q = channelId === TEAM ? q.or("channel_id.eq.team,channel_id.is.null") : q.eq("channel_id", channelId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(150);
  if (error) throw mapError(error);
  return (data || []).reverse();
}

export async function sendMessage({ tenantId, senderId, senderName, text, channelId, title }) {
  if (!senderId) throw new ChatError("No se puede enviar: sesión de usuario no disponible.");
  const row = { tenant_id: tenantId, sender_id: senderId, sender_name: senderName || "Empleado", message_text: String(text).trim(), channel_id: channelId, channel_type: channelKind(channelId) };
  if (channelId !== TEAM && title) row.channel_title = title;
  const { data, error } = await supabase.from("internal_message").insert(row).select("*").single();
  if (error) throw mapError(error);
  return data;
}

export async function deleteChat(tenantId, channelId) {
  let q = supabase.from("internal_message").update({ is_deleted: true }).eq("tenant_id", tenantId).eq("is_deleted", false);
  q = channelId === TEAM ? q.or("channel_id.eq.team,channel_id.is.null") : q.eq("channel_id", channelId);
  const { error } = await q;
  if (error) throw mapError(error);
}

export function subscribeMessages(tenantId, onChange) {
  let timer = null;
  const channel = supabase.channel(`internal_message_${tenantId}_${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "internal_message", filter: `tenant_id=eq.${tenantId}` }, () => { clearTimeout(timer); timer = setTimeout(onChange, 400); })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

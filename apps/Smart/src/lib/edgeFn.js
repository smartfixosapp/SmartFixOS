import { supabase } from "../../../../lib/supabase-client.js";
import { apiUrl } from "@/lib/apiUrl";

const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function invokeEdge(name, body) {
  const headers = { "Content-Type": "application/json", apikey: ANON };
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    token = null;
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(`/api/edge-fn?name=${encodeURIComponent(name)}`), { method: "POST", headers, body: JSON.stringify(body ?? {}) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (res.status === 404 && parsed === null) return supabase.functions.invoke(name, { body });
  if (!res.ok) {
    return { data: null, error: { message: parsed?.error || `HTTP ${res.status}`, context: { status: res.status } } };
  }
  return { data: parsed, error: null };
}

import { Capacitor } from '@capacitor/core';
import { supabase } from '../../../../lib/supabase-client.js';

// Cuando la app corre dentro de Capacitor (iOS/Android nativo), las rutas
// relativas "/api/..." resuelven a capacitor://localhost/api/... — el scheme
// interno del WebView — y nunca llegan a las serverless functions de Vercel.
// Este helper antepone VITE_APP_URL cuando detecta entorno nativo.

const RAW_APP_URL = (import.meta.env?.VITE_APP_URL || 'https://smart-fix-os-smart.vercel.app').trim();
const APP_URL = RAW_APP_URL.replace(/\/$/, '');

export function apiUrl(path) {
  const p = String(path || '');
  const normalized = p.startsWith('/') ? p : `/${p}`;
  if (Capacitor.isNativePlatform() && APP_URL) {
    return `${APP_URL}${normalized}`;
  }
  return normalized;
}

export async function authJsonHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    return headers;
  }
  return headers;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

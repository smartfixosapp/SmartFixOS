import { createClient } from '@supabase/supabase-js'

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue
  }
  return process.env[key] || defaultValue
}

const PROD_SUPABASE_URL = 'https://idntuvtabecwubzswpwi.supabase.co'
const PROD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbnR1dnRhYmVjd3VienN3cHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDY2NDIsImV4cCI6MjA4ODY4MjY0Mn0.X2Ewcx-mds_Ua51XKy8zEFEA0fgUfHwmfuxMXu8ye_w'

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', PROD_SUPABASE_URL)
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', PROD_SUPABASE_ANON_KEY)

// Bridge for RLS: SDK sets window.__SUPABASE_NEXT_REQUEST_TOKEN before INSERT so this fetch
// can add the JWT without calling getSession() (which would cause a circular fetch and hang).
const supabaseFetch = async (url, options = {}) => {
  if (typeof url === 'string' && url.startsWith(supabaseUrl) && typeof window !== 'undefined' && window.__SUPABASE_NEXT_REQUEST_TOKEN) {
    const token = window.__SUPABASE_NEXT_REQUEST_TOKEN
    delete window.__SUPABASE_NEXT_REQUEST_TOKEN
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    options = { ...options, headers }
  }
  return fetch(url, options)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

import { createClient } from '@supabase/supabase-js'

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue
  }
  return process.env[key] || defaultValue
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'http://localhost:8000')
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE')

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
  global: { fetch: supabaseFetch }
})
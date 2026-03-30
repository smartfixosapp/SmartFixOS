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

// Simplified Supabase Client for Capacitor Persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

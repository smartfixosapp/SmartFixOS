import { createClient } from '@supabase/supabase-js'

// Handle both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue
  }
  return process.env[key] || defaultValue
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL')
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar en .env')
}

// Singleton Supabase Client for Capacitor Persistence
const createSupabaseSingleton = () => {
  if (typeof window !== 'undefined' && window.supabaseInstance) {
    console.log("🟢 [Supabase] Reusing existing global instance.");
    return window.supabaseInstance;
  }
  
  console.log("🟠 [Supabase] Initializing new singleton instance.");
  const instance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
  });
  
  if (typeof window !== 'undefined') {
    window.supabaseInstance = instance;
  }
  return instance;
};

export const supabase = createSupabaseSingleton();

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

let client = null

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey)
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase не настроен для этого окружения')
  }

  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return client
}

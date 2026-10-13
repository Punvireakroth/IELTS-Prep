import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
  )?.trim()

  if (!url || !key) {
    client = null
    return client
  }

  client = createClient(url, key)
  return client
}

export const MIGRATION_PATH = 'supabase/migrations/20261011050940_study_progress.sql'

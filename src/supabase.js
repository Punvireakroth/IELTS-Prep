import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !publishableKey || url.includes('YOUR_PROJECT')) {
  console.warn('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env')
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  publishableKey || 'placeholder'
)

export function isConfigured () {
  if (!url || !publishableKey) return false
  if (url.includes('YOUR_PROJECT') || url.includes('...')) return false
  if (
    publishableKey === 'YOUR_ANON_KEY' ||
    publishableKey === 'YOUR_PUBLISHABLE_KEY' ||
    publishableKey === '...'
  ) return false
  return true
}

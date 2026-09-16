import { createClient } from '@supabase/supabase-js'

function cleanEnv (value) {
  if (value == null) return ''
  return String(value).trim().replace(/^['"]|['"]$/g, '')
}

function normalizeUrl (raw) {
  const value = cleanEnv(raw)
  if (!value) return null
  if (
    value.includes('YOUR_PROJECT') ||
    value === '...' ||
    value === 'undefined' ||
    value === 'null'
  ) return null

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

function normalizeKey (raw) {
  const value = cleanEnv(raw)
  if (!value) return null
  if (
    value === 'YOUR_ANON_KEY' ||
    value === 'YOUR_PUBLISHABLE_KEY' ||
    value === '...' ||
    value === 'undefined' ||
    value === 'null'
  ) return null
  return value
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL)
const publishableKey = normalizeKey(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

if (!url || !publishableKey) {
  console.warn(
    'Supabase env missing/invalid. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel (Production) and redeploy.'
  )
}

// Never throw during module init — bad Vercel env used to blank the whole app.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  publishableKey || 'placeholder'
)

export function isConfigured () {
  return Boolean(url && publishableKey)
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// On weak signal, requests hang instead of failing, so error/retry paths never run.
// Abort any request that takes longer than this. (Realtime uses a websocket — unaffected.)
const REQUEST_TIMEOUT_MS = 10000

const fetchWithTimeout = (input, init = {}) => {
  if (init.signal || typeof AbortSignal.timeout !== 'function') return fetch(input, init)
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
})

// When the access token expired while offline, supabase-js reports "no session" but keeps
// the stored session (it only deletes it when the server rejects the refresh token).
// Returning it lets the app open from cache; supabase-js refreshes it automatically and
// fires TOKEN_REFRESHED once the network is back.
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(supabase.auth.storageKey)
    const s = raw ? JSON.parse(raw) : null
    return s?.user?.id && s?.refresh_token ? s : null
  } catch { return null }
}

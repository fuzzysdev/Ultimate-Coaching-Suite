import { useState, useEffect, useRef } from 'react'
import { offlineStore } from '../lib/offlineStore'
import { supabase } from '../lib/supabase'

/**
 * Flushes any queued offline writes to Supabase.
 * Items are removed from the queue only on success; failed items stay
 * so they are retried on the next online event.
 */
export async function flushPendingWrites() {
  const q = offlineStore.getQueue()
  if (q.length === 0) return
  for (const item of q) {
    try {
      let error
      if (item.method === 'update') {
        ;({ error } = await supabase.from(item.table).update(item.data).match(item.match))
      } else if (item.method === 'insert') {
        ;({ error } = await supabase.from(item.table).insert(item.data))
      }
      if (!error) offlineStore.dequeue(item.key)
    } catch { /* leave in queue — will retry */ }
  }
}

/**
 * Returns current online status (boolean) and sets up:
 *  - window online/offline event listeners
 *  - automatic queue flush when connection is restored
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const flushing = useRef(false)

  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true)
      if (flushing.current) return
      flushing.current = true
      await flushPendingWrites()
      flushing.current = false
    }
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    // Flush any queued writes left over from a previous offline session
    if (navigator.onLine) flushPendingWrites()

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}

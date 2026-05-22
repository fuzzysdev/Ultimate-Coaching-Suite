import { useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getPendingPoints } from '../lib/offlineStore'

export function useGameLiveMode({ setLiveMode, setLiveCoaches, setOurTO, setTheirTO, setPoints }) {
  const channelRef     = useRef(null)
  const liveTimerRef   = useRef(null)
  const presenceKeyRef = useRef(`c-${Math.random().toString(36).slice(2, 8)}`)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      clearTimeout(liveTimerRef.current)
    }
  }, [])

  const refetchPoints = async (gameId) => {
    const { data } = await supabase
      .from('game_points').select('*')
      .eq('game_id', gameId).order('point_number')
    if (!data) return
    // Merge any points committed locally but not yet confirmed in DB (e.g. device woke
    // between the local commit and the network round-trip). Without this, refetchPoints
    // would silently wipe those in-flight points and corrupt the score chain.
    const pending = getPendingPoints(gameId)
    const dbNums  = new Set(data.map(gp => gp.point_number))
    const toMerge = pending.filter(p => !dbNums.has(p.point_number))
    const all     = [...data, ...toMerge].sort((a, b) => a.point_number - b.point_number)
    setPoints(all.map(gp => ({
      gender: gp.gender, scoredBy: gp.scored_by,
      ourScoreAfter: gp.our_score_after, theirScoreAfter: gp.their_score_after,
    })))
  }

  const unsubscribe = () => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    clearTimeout(liveTimerRef.current); liveTimerRef.current = null
    setLiveCoaches(0)
  }

  const disableLiveMode = async (gameId) => {
    await supabase.from('games').update({ live_mode: false }).eq('id', gameId)
    setLiveMode(false)
    unsubscribe()
  }

  const subscribe = (gameId, expiresAt) => {
    if (channelRef.current) return
    const msLeft = new Date(expiresAt).getTime() - Date.now()
    liveTimerRef.current = setTimeout(() => disableLiveMode(gameId), msLeft)

    const ch = supabase.channel(`game-live:${gameId}`, {
      config: { presence: { key: presenceKeyRef.current } }
    })
    ch
      .on('presence', { event: 'sync' }, () => {
        setLiveCoaches(Object.keys(ch.presenceState()).length)
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_points', filter: `game_id=eq.${gameId}`
      }, () => refetchPoints(gameId))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}`
      }, ({ new: row }) => {
        if (!row.live_mode) { setLiveMode(false); unsubscribe(); return }
        setOurTO(row.our_timeouts_used || 0)
        setTheirTO(row.their_timeouts_used || 0)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ joined_at: new Date().toISOString() })
        }
      })
    channelRef.current = ch
  }

  const checkLiveMode = (g) => {
    if (!g.live_mode || !g.live_mode_expires_at) return
    if (new Date(g.live_mode_expires_at) <= new Date()) {
      supabase.from('games').update({ live_mode: false }).eq('id', g.id)
      return
    }
    setLiveMode(true)
    subscribe(g.id, g.live_mode_expires_at)
  }

  return { subscribe, unsubscribe, disableLiveMode, checkLiveMode, refetchPoints }
}

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { enqueuePendingPoint, dequeuePendingPoint, getPendingPoints, clearPendingPoints } from '../lib/offlineStore'
import GameSetupDialog from '../Components/GameSetupDialog'
import GameEndDialog from '../Components/GameEndDialog'
import GoalAssistModal from '../Components/GoalAssistModal'
import GameInfoModal from '../Components/GameInfoModal'
import { SectionRow, PlayerRow, EmptySection } from '../Components/GameGridRows'
import ReorderGroup from '../Components/GameReorderPanel'
import { useGameLiveMode } from '../hooks/useGameLiveMode'
import {
  getGenderForPoint, NAME_W, COL_W, HDR_H, SEC_H, ROW_H, SCORE_H, MAX_TO,
  colBg, buildTheme,
} from '../lib/gameSheetHelpers'

export default function GameSheetPage({ org, roster, isDemoOrg }) {
  const [players,            setPlayers]            = useState([])
  const [loadingPlayers,     setLoadingPlayers]     = useState(true)
  const [game,               setGame]               = useState(null)
  const [setup,              setSetup]              = useState(null)
  const [showSetup,          setShowSetup]          = useState(false)
  const [showEndDialog,      setShowEndDialog]      = useState(false)
  const [savingEnd,          setSavingEnd]          = useState(false)
  const [points,             setPoints]             = useState([])
  const [lines,              setLines]              = useState({})
  const [ourTO,              setOurTO]              = useState(0)
  const [theirTO,            setTheirTO]            = useState(0)
  const [playerStatus,       setPlayerStatus]       = useState({})
  const [lightGrid,          setLightGrid]          = useState(false)
  const [completedGames,     setCompletedGames]     = useState([])
  const [activeGames,        setActiveGames]        = useState([])
  const [showGameInfo,       setShowGameInfo]       = useState(false)
  const [halftimeAfterPoint, setHalftimeAfterPoint] = useState(null)
  const [gameStartTime,      setGameStartTime]      = useState('')
  const [gameEndTime,        setGameEndTime]        = useState('')
  const [pendingDelete,      setPendingDelete]      = useState(null)
  const [pendingPoint,       setPendingPoint]       = useState(null)
  const [reorderMode,        setReorderMode]        = useState(false)
  const [playerOrder,        setPlayerOrder]        = useState([])
  const [liveMode,           setLiveMode]           = useState(false)
  const [liveCoaches,        setLiveCoaches]        = useState(0)
  const [noSleep,            setNoSleep]            = useState(false)
  const [resumeBanner,       setResumeBanner]       = useState(null)

  const gridRef         = useRef(null)
  const wakeLockRef     = useRef(null)
  const noSleepRef      = useRef(false) // mirrors noSleep for use in event listeners
  const forceRefreshRef = useRef(null)
  const gameRef         = useRef(null)
  const openActiveRef   = useRef(null)
  // Authoritative score state — updated synchronously inside commitPoint/adjustScore so
  // rapid back-to-back commits never see stale React state (fixes race condition).
  const nextStateRef    = useRef({ ourScore: 0, theirScore: 0, nextPointNum: 0 })
  // Prevents double-commit when score buttons are tapped in rapid succession.
  const committingRef   = useRef(false)

  const { subscribe, unsubscribe, disableLiveMode, checkLiveMode, refetchPoints } = useGameLiveMode({
    setLiveMode, setLiveCoaches, setOurTO, setTheirTO, setPoints,
  })

  // Keep nextStateRef in sync whenever points changes (load, refetch, undo, live-mode push).
  // The ref is also updated synchronously inside commitPoint/adjustScore to stay ahead of renders.
  useEffect(() => {
    nextStateRef.current = {
      ourScore:     points.filter(p => p.scoredBy === 'us').length,
      theirScore:   points.filter(p => p.scoredBy === 'them').length,
      nextPointNum: points.length,
    }
  }, [points])

  // ── Wake Lock ─────────────────────────────────────────────────────────────
  const activeGameKey = roster?.id ? `ucs_active_game_${roster.id}` : null

  const acquireWakeLock = async () => {
    if (!('wakeLock' in navigator) || wakeLockRef.current) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null
      })
    } catch {}
  }

  const toggleNoSleep = async () => {
    const next = !noSleepRef.current
    noSleepRef.current = next
    setNoSleep(next)
    if (next) {
      await acquireWakeLock()
    } else {
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
  }

  // Re-acquire wake lock and resync game state when returning from sleep/lock screen
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== 'visible') return
      if (noSleepRef.current) await acquireWakeLock()
      const g = gameRef.current
      if (g?.id && g.id !== 'demo-game' && g.status !== 'completed') {
        openActiveRef.current?.(g, { showBanner: true })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      wakeLockRef.current?.release()
    }
  }, [])

  // ── Persist working state to localStorage (skip for demo games) ──────────
  useEffect(() => {
    if (!game?.id || game.id === 'demo-game') return
    const linesSerial = {}
    Object.entries(lines).forEach(([k, s]) => { linesSerial[k] = [...s] })
    localStorage.setItem(`ucs_game_${game.id}`, JSON.stringify({
      lines: linesSerial, playerStatus, halftimeAfterPoint, gameStartTime, gameEndTime
    }))
  }, [game?.id, lines, playerStatus, halftimeAfterPoint, gameStartTime, gameEndTime])

  useEffect(() => {
    if (!roster?.id) return
    fetchPlayers()
    fetchAllGames()
  }, [roster?.id])

  const fetchPlayers = async () => {
    if (!roster?.id) return
    setLoadingPlayers(true)
    const { data } = await supabase
      .from('players').select('id, name, gender, position, sort_order')
      .eq('roster_id', roster.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    setPlayers(data || [])
    setLoadingPlayers(false)
  }

  const fetchAllGames = async () => {
    if (!roster?.id) return
    const { data } = await supabase
      .from('games')
      .select('id, opponent, our_score, their_score, created_at, status, first_gender, starting_action, direction, line_size, our_timeouts_used, their_timeouts_used')
      .eq('roster_id', roster.id)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
    const all = data || []
    const active = all.filter(g => g.status === 'active')
    setActiveGames(active)
    setCompletedGames(all.filter(g => g.status === 'completed'))

    // Auto-restore active game after device lock / page reload
    const savedId = localStorage.getItem(`ucs_active_game_${roster.id}`)
    if (savedId) {
      const savedGame = active.find(g => g.id === savedId)
      if (savedGame) openActiveGame(savedGame, { showBanner: true })
    }
  }

  const openActiveGame = async (g, { showBanner = false } = {}) => {
    const { data: gamePoints, error: gpFetchError } = await supabase
      .from('game_points').select('*')
      .eq('game_id', g.id).order('point_number')

    // If the DB fetch failed (e.g. slow/dropped hotspot, auth token expiry) and we
    // already have this game open in memory with points, preserve the current state.
    // Without this guard, a failed fetch overwrites setPoints([]) and wipes the score.
    if (gpFetchError) {
      const alreadyOpen = gameRef.current?.id === g.id
      const memPointCount = nextStateRef.current.nextPointNum
      if (alreadyOpen && memPointCount > 0) {
        console.warn('openActiveGame: game_points fetch failed — keeping in-memory state', gpFetchError)
        // Still update timeouts in case they changed on another device
        setOurTO(g.our_timeouts_used || 0)
        setTheirTO(g.their_timeouts_used || 0)
        if (showBanner) {
          const nextGender = getGenderForPoint(memPointCount, g.first_gender)
          setResumeBanner({ nextPt: memPointCount + 1, gender: nextGender, recovered: 0 })
          setTimeout(() => setResumeBanner(null), 4500)
        }
        return
      }
    }

    // Re-insert any points committed locally but lost before reaching the DB
    const pending    = !isDemoOrg ? getPendingPoints(g.id) : []
    const dbNums     = new Set((gamePoints || []).map(gp => gp.point_number))
    const toReinsert = pending
      .filter(p => !dbNums.has(p.point_number))
      .sort((a, b) => a.point_number - b.point_number)
    // Always show all pending points in the display, even if the upsert fails on a slow
    // connection. Unconfirmed ones stay in the queue and get re-attempted next open.
    let dbConfirmedCount = 0
    for (const pt of toReinsert) {
      const { error } = await supabase.from('game_points')
        .upsert(pt, { onConflict: 'game_id,point_number' })
      if (!error) { dbConfirmedCount++; dequeuePendingPoint(g.id, pt.point_number) }
    }

    const allGamePoints = [...(gamePoints || []), ...toReinsert]
      .sort((a, b) => a.point_number - b.point_number)

    const restoredSetup = {
      opponent:       g.opponent,
      firstGender:    g.first_gender,
      startingAction: g.starting_action,
      direction:      g.direction,
      lineSize:       g.line_size,
    }

    const restoredPoints = allGamePoints.map(gp => ({
      gender:          gp.gender,
      scoredBy:        gp.scored_by,
      ourScoreAfter:   gp.our_score_after,
      theirScoreAfter: gp.their_score_after,
    }))

    const restoredLines = {}
    allGamePoints.forEach(gp => {
      restoredLines[gp.point_number] = new Set(gp.player_ids || [])
    })

    const cached = localStorage.getItem(`ucs_game_${g.id}`)
    if (cached) {
      try {
        const { lines: linesArr, playerStatus: ps, halftimeAfterPoint: ht, gameStartTime: gst, gameEndTime: get } = JSON.parse(cached)
        const curPtIdx = restoredPoints.length
        Object.entries(linesArr || {}).forEach(([k, arr]) => {
          if (Number(k) >= curPtIdx) restoredLines[k] = new Set(arr)
        })
        setPlayerStatus(ps || {})
        if (ht !== undefined && ht !== null) setHalftimeAfterPoint(ht)
        if (gst) setGameStartTime(gst)
        if (get) setGameEndTime(get)
      } catch {}
    } else {
      setGameStartTime(new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }

    // Sync games table score with all points (including any recovered ones)
    if (!isDemoOrg && allGamePoints.length > 0) {
      const lastPt = allGamePoints[allGamePoints.length - 1]
      if (g.our_score !== lastPt.our_score_after || g.their_score !== lastPt.their_score_after) {
        supabase.from('games').update({
          our_score: lastPt.our_score_after, their_score: lastPt.their_score_after,
        }).eq('id', g.id).then(({ error }) => { if (error) console.error('score sync:', error) })
      }
    }

    setGame(g)
    setSetup(restoredSetup)
    setPoints(restoredPoints)
    setLines(restoredLines)
    setOurTO(g.our_timeouts_used || 0)
    setTheirTO(g.their_timeouts_used || 0)
    if (!isDemoOrg && activeGameKey) localStorage.setItem(activeGameKey, g.id)
    scrollToCurrent()
    checkLiveMode(g)

    if (showBanner) {
      const nextGender = getGenderForPoint(restoredPoints.length, g.first_gender)
      setResumeBanner({ nextPt: restoredPoints.length + 1, gender: nextGender, recovered: dbConfirmedCount })
      setTimeout(() => setResumeBanner(null), 4500)
    }
  }

  const loadCompletedGame = async (g) => {
    const { data: gamePoints } = await supabase
      .from('game_points').select('*')
      .eq('game_id', g.id).order('point_number')
    const restoredSetup = {
      opponent: g.opponent, firstGender: g.first_gender,
      startingAction: g.starting_action, direction: g.direction, lineSize: g.line_size,
    }
    const restoredPoints = (gamePoints || []).map(gp => ({
      gender: gp.gender, scoredBy: gp.scored_by,
      ourScoreAfter: gp.our_score_after, theirScoreAfter: gp.their_score_after,
    }))
    const restoredLines = {}
    ;(gamePoints || []).forEach(gp => {
      restoredLines[gp.point_number] = new Set(gp.player_ids || [])
    })
    const cached = localStorage.getItem(`ucs_game_${g.id}`)
    if (cached) {
      try {
        const { halftimeAfterPoint: ht, gameStartTime: gst, gameEndTime: get } = JSON.parse(cached)
        if (ht !== undefined && ht !== null) setHalftimeAfterPoint(ht)
        if (gst) setGameStartTime(gst)
        if (get) setGameEndTime(get)
      } catch {}
    }
    setGame(g); setSetup(restoredSetup); setPoints(restoredPoints); setLines(restoredLines)
    setOurTO(g.our_timeouts_used || 0); setTheirTO(g.their_timeouts_used || 0)
    setPlayerStatus({})
    scrollToCurrent()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isSingle   = roster?.gender_type === 'single'
  const curIdx     = points.length
  // Derive scores by counting — immune to any corruption in stored ourScoreAfter values.
  const ourScore   = points.filter(p => p.scoredBy === 'us').length
  const theirScore = points.filter(p => p.scoredBy === 'them').length
  // Running cumulative totals for the score tracker rows — recomputed from scratch each render.
  const runningScores = (() => {
    let u = 0, t = 0
    return points.map(p => { if (p.scoredBy === 'us') u++; else t++; return { our: u, their: t } })
  })()
  const curGender  = setup ? getGenderForPoint(curIdx, setup.firstGender) : 'm'
  const lineSize   = setup?.lineSize || 7
  const halfCeil   = Math.ceil(lineSize / 2)
  const halfFloor  = lineSize - halfCeil
  const curMNeed   = curGender === 'm' ? halfCeil : halfFloor
  const curFNeed   = curGender === 'm' ? halfFloor : halfCeil
  const females    = players.filter(p => p.gender === 'Female')
  const males      = players.filter(p => p.gender === 'Male')
  const curLine    = lines[curIdx] || new Set()
  const selF       = females.filter(p => curLine.has(p.id)).length
  const selM       = males.filter(p => curLine.has(p.id)).length
  const lineOK     = isSingle ? curLine.size === lineSize : (selF === curFNeed && selM === curMNeed)
  const readOnly   = game?.status === 'completed'
  const totalCols  = readOnly ? points.length : Math.max(curIdx + 8, 30)
  const colIndices = Array.from({ length: totalCols }, (_, i) => i)
  const gt         = buildTheme(lightGrid)

  const nextDir = () => {
    if (!setup) return ''
    const swaps = points.length % 2 !== 0
    const d = swaps ? (setup.direction === 'left' ? 'right' : 'left') : setup.direction
    return d === 'left' ? '←' : '→'
  }
  const pullReceive = () => {
    if (!setup) return ''
    if (points.length === 0) return setup.startingAction === 'receive' ? 'Receive' : 'Pull'
    return points[points.length - 1].scoredBy === 'us' ? 'Pull' : 'Receive'
  }

  const scrollToCurrent = () => {
    setTimeout(() => {
      if (gridRef.current) {
        const targetX = NAME_W + (curIdx * COL_W) - 60
        gridRef.current.scrollLeft = Math.max(0, targetX)
      }
    }, 40)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleCell = (playerId, ptIdx) => {
    if (ptIdx < curIdx) return
    if (playerStatus[playerId]) return
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const ptLine = lines[ptIdx] || new Set()
    if (!ptLine.has(playerId)) {
      if (isSingle) {
        if (ptLine.size >= lineSize) return
      } else {
        const ptGender = getGenderForPoint(ptIdx, setup.firstGender)
        const ptHCeil  = Math.ceil(lineSize / 2)
        const ptHFloor = lineSize - ptHCeil
        const isMale   = player.gender === 'Male'
        const need     = isMale
          ? (ptGender === 'm' ? ptHCeil : ptHFloor)
          : (ptGender === 'm' ? ptHFloor : ptHCeil)
        const group = isMale ? males : females
        const count = group.filter(p => ptLine.has(p.id)).length
        if (count >= need) return
      }
    }
    setLines(prev => {
      const s = new Set(prev[ptIdx] || [])
      s.has(playerId) ? s.delete(playerId) : s.add(playerId)
      return { ...prev, [ptIdx]: s }
    })
  }

  const cycleStatus = (playerId) => {
    const cur = playerStatus[playerId]
    const next = !cur ? 'away' : cur === 'away' ? 'injured' : null
    setPlayerStatus(prev => {
      const updated = { ...prev }
      if (next) updated[playerId] = next
      else delete updated[playerId]
      return updated
    })
  }

  const recordPoint = (scoredBy) => {
    if (!game || readOnly || committingRef.current) return
    committingRef.current = true
    // Capture line and gender at tap time — these are point-specific snapshots.
    const pointGender  = curGender
    const lineSnapshot = [...curLine]
    if (scoredBy === 'us') {
      // Show goal/assist modal before committing; committingRef released in commitPoint.
      setPendingPoint({ scoredBy, pointGender, lineSnapshot })
      return
    }
    commitPoint({ scoredBy, pointGender, lineSnapshot, goalScorerId: null, assistPlayerId: null })
  }

  const commitPoint = ({ scoredBy, pointGender, lineSnapshot, goalScorerId, assistPlayerId }) => {
    // Release lockout after 800ms — deferred so that any synchronous rapid taps
    // (or taps arriving within the same JS task) are still blocked.
    setTimeout(() => { committingRef.current = false }, 800)
    // Read scores and point number from the ref — this is always current even if React
    // hasn't re-rendered yet, which prevents duplicate point_numbers and wrong score chains.
    const { ourScore: curOur, theirScore: curThem, nextPointNum } = nextStateRef.current
    const newOur   = curOur  + (scoredBy === 'us'   ? 1 : 0)
    const newTheir = curThem + (scoredBy === 'them' ? 1 : 0)
    // Update ref synchronously before setPoints so back-to-back calls see the new values.
    nextStateRef.current = { ourScore: newOur, theirScore: newTheir, nextPointNum: nextPointNum + 1 }

    setPoints(prev => [...prev, { gender: pointGender, scoredBy, ourScoreAfter: newOur, theirScoreAfter: newTheir }])
    setPendingPoint(null)
    scrollToCurrent()
    if (isDemoOrg) return
    const ptPayload = {
      game_id: game.id, point_number: nextPointNum, gender: pointGender,
      scored_by: scoredBy, player_ids: lineSnapshot,
      our_score_after: newOur, their_score_after: newTheir,
      goal_scorer_id: goalScorerId || null,
      assist_player_id: assistPlayerId || null,
    }
    enqueuePendingPoint(game.id, ptPayload)
    supabase.from('game_points').insert(ptPayload)
      .then(({ error }) => {
        if (error) console.error('game_points insert:', error)
        else dequeuePendingPoint(game.id, nextPointNum)
      })
    supabase.from('games').update({ our_score: newOur, their_score: newTheir })
      .eq('id', game.id)
      .then(({ error }) => { if (error) console.error('games score update:', error) })
  }

  const undoPoint = async () => {
    if (!game || points.length === 0) return
    if (isDemoOrg) { setPoints(prev => prev.slice(0, -1)); return }
    let lastIdx
    if (liveMode) {
      const { data } = await supabase
        .from('game_points').select('point_number')
        .eq('game_id', game.id).order('point_number', { ascending: false }).limit(1).maybeSingle()
      if (!data) return
      lastIdx = data.point_number
    } else {
      lastIdx = points.length - 1
    }
    setPoints(prev => prev.filter((_, i) => i !== lastIdx))
    supabase.from('game_points').delete()
      .eq('game_id', game.id).eq('point_number', lastIdx)
      .then(({ error }) => { if (error) console.error('undo delete:', error) })
    const prevOur   = lastIdx > 0 ? points[lastIdx - 1].ourScoreAfter   : 0
    const prevTheir = lastIdx > 0 ? points[lastIdx - 1].theirScoreAfter : 0
    supabase.from('games').update({ our_score: prevOur, their_score: prevTheir })
      .eq('id', game.id)
      .then(({ error }) => { if (error) console.error('undo score update:', error) })
  }

  const useTimeout = (team) => {
    if (!game) return
    if (team === 'us'   && ourTO   >= MAX_TO) return
    if (team === 'them' && theirTO >= MAX_TO) return
    const nOur  = team === 'us'   ? ourTO + 1   : ourTO
    const nThem = team === 'them' ? theirTO + 1 : theirTO
    setOurTO(nOur); setTheirTO(nThem)
    if (isDemoOrg) return
    supabase.from('games').update({ our_timeouts_used: nOur, their_timeouts_used: nThem })
      .eq('id', game.id)
      .then(({ error }) => { if (error) console.error('timeout update:', error) })
  }

  const handleStartGame = async (setupData) => {
    if (isDemoOrg) {
      setGame({ id: 'demo-game', opponent: setupData.opponent, our_score: 0, their_score: 0 })
      setSetup(setupData); setPoints([]); setLines({})
      setOurTO(0); setTheirTO(0); setPlayerStatus({})
      setHalftimeAfterPoint(null); setShowSetup(false)
      setGameStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setGameEndTime('')
      return
    }
    const { data, error } = await supabase.from('games').insert({
      organization_id: org.id, roster_id: roster.id,
      opponent: setupData.opponent, first_gender: setupData.firstGender,
      starting_action: setupData.startingAction, direction: setupData.direction,
      line_size: setupData.lineSize, status: 'active',
    }).select().single()
    if (error) { console.error(error); return }
    if (activeGameKey) localStorage.setItem(activeGameKey, data.id)
    setGame(data); setSetup(setupData); setPoints([]); setLines({})
    setOurTO(0); setTheirTO(0); setPlayerStatus({})
    setHalftimeAfterPoint(null); setShowSetup(false)
    setGameStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setGameEndTime('')
  }

  const handleSaveEnd = async (ratings) => {
    if (!game) return
    if (isDemoOrg) {
      setShowEndDialog(false); setGame(null); setSetup(null); setPoints([]); setLines({})
      setPlayerStatus({}); setHalftimeAfterPoint(null); setGameStartTime(''); setGameEndTime('')
      return
    }
    setSavingEnd(true)
    try {
      await supabase.from('spirit_ratings').insert({ game_id: game.id, ...ratings })
      await supabase.from('games').update({ status: 'completed', ended_at: new Date().toISOString(), live_mode: false }).eq('id', game.id)
      unsubscribe()
      setLiveMode(false)
      if (game?.id) { localStorage.removeItem(`ucs_game_${game.id}`); clearPendingPoints(game.id) }
      if (activeGameKey) localStorage.removeItem(activeGameKey)
      noSleepRef.current = false; setNoSleep(false)
      wakeLockRef.current?.release(); wakeLockRef.current = null
      setShowEndDialog(false); setGame(null); setSetup(null); setPoints([]); setLines({})
      setPlayerStatus({}); setHalftimeAfterPoint(null); setGameStartTime(''); setGameEndTime('')
      fetchAllGames()
    } finally { setSavingEnd(false) }
  }

  const handleDeleteGame = async (gameId) => {
    if (isDemoOrg) { setPendingDelete(null); return }
    await supabase.from('game_points').delete().eq('game_id', gameId)
    await supabase.from('spirit_ratings').delete().eq('game_id', gameId)
    await supabase.from('games').delete().eq('id', gameId)
    localStorage.removeItem(`ucs_game_${gameId}`)
    setCompletedGames(prev => prev.filter(g => g.id !== gameId))
    setPendingDelete(null)
  }

  const handleAbandonGame = async () => {
    if (!game) return
    if (isDemoOrg) {
      setShowGameInfo(false)
      setGame(null); setSetup(null); setPoints([]); setLines({})
      setOurTO(0); setTheirTO(0); setPlayerStatus({})
      setHalftimeAfterPoint(null); setGameStartTime(''); setGameEndTime('')
      return
    }
    await supabase.from('game_points').delete().eq('game_id', game.id)
    await supabase.from('spirit_ratings').delete().eq('game_id', game.id)
    await supabase.from('games').delete().eq('id', game.id)
    localStorage.removeItem(`ucs_game_${game.id}`)
    clearPendingPoints(game.id)
    if (activeGameKey) localStorage.removeItem(activeGameKey)
    noSleepRef.current = false; setNoSleep(false)
    wakeLockRef.current?.release(); wakeLockRef.current = null
    unsubscribe()
    setLiveMode(false)
    setShowGameInfo(false)
    setGame(null); setSetup(null); setPoints([]); setLines({})
    setOurTO(0); setTheirTO(0); setPlayerStatus({})
    setHalftimeAfterPoint(null); setGameStartTime(''); setGameEndTime('')
    fetchAllGames()
  }

  const handleBack = () => {
    if (activeGameKey && !readOnly) localStorage.removeItem(activeGameKey)
    noSleepRef.current = false; setNoSleep(false)
    wakeLockRef.current?.release(); wakeLockRef.current = null
    setGame(null); setSetup(null); setPoints([]); setLines({})
  }

  // ── Score sync: re-fetch all points from DB ───────────────────────────────
  const forceRefreshGame = async () => {
    if (!game?.id || isDemoOrg) return
    const [{ data: freshGame }, { data: freshPoints }] = await Promise.all([
      supabase.from('games')
        .select('id, opponent, our_score, their_score, created_at, status, first_gender, starting_action, direction, line_size, our_timeouts_used, their_timeouts_used')
        .eq('id', game.id).single(),
      supabase.from('game_points').select('*').eq('game_id', game.id).order('point_number'),
    ])
    if (!freshPoints) return
    // Merge any in-flight points from the local queue that haven't reached DB yet.
    // Without this, tapping "Sync from DB" during a slow connection wipes pending points.
    const pending   = getPendingPoints(game.id)
    const dbNums    = new Set(freshPoints.map(gp => gp.point_number))
    const toMerge   = pending.filter(p => !dbNums.has(p.point_number))
    const allPoints = [...freshPoints, ...toMerge].sort((a, b) => a.point_number - b.point_number)
    const newPoints = allPoints.map(gp => ({
      gender:          gp.gender,
      scoredBy:        gp.scored_by,
      ourScoreAfter:   gp.our_score_after,
      theirScoreAfter: gp.their_score_after,
    }))
    const newLines = {}
    allPoints.forEach(gp => { newLines[gp.point_number] = new Set(gp.player_ids || []) })
    setPoints(newPoints)
    setLines(prev => {
      const merged = { ...newLines }
      Object.entries(prev).forEach(([k, s]) => {
        if (Number(k) >= allPoints.length) merged[k] = s
      })
      return merged
    })
    if (freshGame) {
      setOurTO(freshGame.our_timeouts_used || 0)
      setTheirTO(freshGame.their_timeouts_used || 0)
      setGame(freshGame)
    }
  }

  // ── Score override ─────────────────────────────────────────────────────────
  // +1: inserts a synthetic completed point via nextStateRef — same race-proof
  //     mechanism as commitPoint, so it can never collide with an in-flight normal
  //     commit. curIdx advances, gender ratio and line tracking update correctly.
  // -1: removes the most recent point regardless of team (same as Undo). Score
  //     display is count-based so removing the row is the only correct approach.
  const adjustScore = (team, delta) => {
    if (!game?.id || isDemoOrg || readOnly) return

    if (delta > 0) {
      if (committingRef.current) return   // block if a normal commit is in progress
      committingRef.current = true
      const { ourScore: curOur, theirScore: curThem, nextPointNum } = nextStateRef.current
      const newOur  = curOur  + (team === 'us'   ? 1 : 0)
      const newThem = curThem + (team === 'them' ? 1 : 0)
      nextStateRef.current = { ourScore: newOur, theirScore: newThem, nextPointNum: nextPointNum + 1 }
      committingRef.current = false

      setPoints(prev => [...prev, {
        gender: curGender, scoredBy: team,
        ourScoreAfter: newOur, theirScoreAfter: newThem,
      }])
      supabase.from('game_points')
        .upsert({
          game_id: game.id, point_number: nextPointNum, gender: curGender,
          scored_by: team, player_ids: [],
          our_score_after: newOur, their_score_after: newThem,
          goal_scorer_id: null, assist_player_id: null,
        }, { onConflict: 'game_id,point_number' })
        .then(({ error }) => { if (error) console.error('adjustScore insert:', error) })
      supabase.from('games').update({ our_score: newOur, their_score: newThem })
        .eq('id', game.id)
        .then(({ error }) => { if (error) console.error('adjustScore games:', error) })
    } else {
      // Decrement = undo last point. Display is count-derived so patching stored
      // cumulative values has no effect; removing the row is the correct fix.
      undoPoint()
    }
  }

  // ── Reorder ────────────────────────────────────────────────────────────────
  const enterReorder = () => {
    setPlayerOrder([...players])
    setReorderMode(true)
  }

  const reorderGroup = (gender, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    setPlayerOrder(prev => {
      const group  = prev.filter(p => p.gender === gender)
      const next   = [...group]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      const result = [...prev]
      let gi = 0
      result.forEach((p, i) => { if (p.gender === gender) result[i] = next[gi++] })
      return result
    })
  }

  const saveOrder = () => {
    setPlayers(playerOrder)
    setReorderMode(false)
    if (isDemoOrg) return
    const fems  = playerOrder.filter(p => p.gender === 'Female')
    const mens  = playerOrder.filter(p => p.gender === 'Male')
    const toSave = [
      ...fems.map((p, i) => ({ id: p.id, sort_order: i })),
      ...mens.map((p, i) => ({ id: p.id, sort_order: i })),
    ]
    Promise.all(
      toSave.map(({ id, sort_order }) =>
        supabase.from('players').update({ sort_order }).eq('id', id)
      )
    ).catch(err => console.error('saveOrder error:', err))
  }

  const cancelReorder = () => setReorderMode(false)

  // ── Live mode toggle ───────────────────────────────────────────────────────
  const toggleLiveMode = async () => {
    if (!game) return
    if (isDemoOrg) return
    if (liveMode) {
      await disableLiveMode(game.id)
    } else {
      const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      await supabase.from('games').update({ live_mode: true, live_mode_expires_at: expiresAt }).eq('id', game.id)
      setLiveMode(true)
      subscribe(game.id, expiresAt)
    }
  }

  // Keep stale-closure-safe refs current every render
  gameRef.current         = game
  forceRefreshRef.current = forceRefreshGame
  openActiveRef.current   = openActiveGame

  // ── Games list (landing page) ───────────────────────────────────────────────
  if (!setup) {
    return (
      <div style={S.gamesList}>
        {showSetup && <GameSetupDialog roster={roster} onStart={handleStartGame} onCancel={() => setShowSetup(false)} />}

        <div style={S.gamesListInner}>
          {/* Header row */}
          <div style={S.gamesListHeader}>
            <span style={S.gamesListTitle}>Games</span>
            {roster && (
              <button onClick={() => setShowSetup(true)} style={S.newGameBtn}>+ New Game</button>
            )}
          </div>

          {!roster && (
            <p style={S.emptySub}>Select a roster first.</p>
          )}

          {/* Active Games */}
          {activeGames.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={S.pastHeader}>In Progress</div>
              {activeGames.map(g => {
                const d = new Date(g.created_at)
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                return (
                  <button key={g.id} onClick={() => openActiveGame(g)} style={S.activeGameBtn}>
                    <div style={S.activeGameLeft}>
                      <span style={S.activeDot} />
                      <span style={S.pastOpponent}>vs {g.opponent}</span>
                      <span style={S.pastDate}>{dateStr}</span>
                    </div>
                    <div style={{ ...S.pastScore, color: '#00e5a0' }}>
                      {g.our_score ?? 0} – {g.their_score ?? 0}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Past Games */}
          {completedGames.length > 0 && (
            <div>
              <div style={S.pastHeader}>Past Games</div>
              {completedGames.map(g => {
                const d = new Date(g.created_at)
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                const won  = g.our_score > g.their_score
                const lost = g.our_score < g.their_score
                return (
                  <div key={g.id} style={S.pastGameRowWrap}>
                    <button onClick={() => loadCompletedGame(g)} style={S.pastGameBtn}>
                      <div style={S.pastGameLeft}>
                        <span style={S.pastOpponent}>vs {g.opponent}</span>
                        <span style={S.pastDate}>{dateStr}</span>
                      </div>
                      <div style={{ ...S.pastScore, color: won ? '#00e5a0' : lost ? '#ff4d6d' : '#e8eaf0' }}>
                        {g.our_score} – {g.their_score}
                      </div>
                    </button>
                    {pendingDelete === g.id ? (
                      <div style={S.deleteConfirmRow}>
                        <button onClick={() => setPendingDelete(null)} style={S.cancelDeleteBtn}>Cancel</button>
                        <button onClick={() => handleDeleteGame(g.id)} style={S.confirmDeleteBtn}>Delete</button>
                      </div>
                    ) : (
                      <button onClick={() => setPendingDelete(g.id)} style={S.pastDeleteBtn}>✕</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {roster && activeGames.length === 0 && completedGames.length === 0 && (
            <p style={S.emptySub}>No games yet. Tap "+ New Game" to get started.</p>
          )}
        </div>
      </div>
    )
  }

  // ── Active game ────────────────────────────────────────────────────────────
  const stickyName = (bg = gt.nameBg) => ({
    width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 4,
    background: lightGrid ? gt.nameBg : bg, flexShrink: 0,
  })

  const colCell = (colIdx, extra = {}) => ({
    width: COL_W, minWidth: COL_W, flexShrink: 0, textAlign: 'center',
    background: colBg(colIdx, curIdx, lightGrid),
    borderRight: halftimeAfterPoint !== null && colIdx === halftimeAfterPoint
      ? '3px solid rgba(255,152,0,0.7)' : undefined,
    ...extra
  })

  const wakeLockSupported = 'wakeLock' in navigator

  return (
    <div style={S.container}>
      {showEndDialog && (
        <GameEndDialog ourScore={ourScore} theirScore={theirScore} opponent={setup.opponent}
          onSave={handleSaveEnd} onCancel={() => setShowEndDialog(false)} saving={savingEnd} />
      )}
      {pendingPoint && (
        <GoalAssistModal
          players={players.filter(p => pendingPoint.lineSnapshot.includes(p.id))}
          onConfirm={(goalScorerId, assistPlayerId) => commitPoint({ ...pendingPoint, goalScorerId, assistPlayerId })}
          onSkip={() => commitPoint({ ...pendingPoint, goalScorerId: null, assistPlayerId: null })}
        />
      )}
      {showGameInfo && (
        <GameInfoModal
          setup={setup} points={points} halftimeAfterPoint={halftimeAfterPoint}
          onMarkHalftime={() => { if (points.length > 0) setHalftimeAfterPoint(points.length - 1) }}
          onClearHalftime={() => setHalftimeAfterPoint(null)}
          startTime={gameStartTime} endTime={gameEndTime}
          onChangeStartTime={setGameStartTime} onChangeEndTime={setGameEndTime}
          onUpdateSetup={(updates) => setSetup(prev => ({ ...prev, ...updates }))}
          onAbandon={handleAbandonGame}
          onForceRefresh={isDemoOrg ? null : forceRefreshGame}
          onAdjustScore={isDemoOrg ? null : adjustScore}
          onClose={() => setShowGameInfo(false)}
        />
      )}

      {resumeBanner && (
        <div style={S.resumeBanner}>
          Resumed · {!isSingle && `${resumeBanner.gender === 'm' ? '♂' : '♀'} `}Pt {resumeBanner.nextPt}
          {resumeBanner.recovered > 0 && ` · ${resumeBanner.recovered} pt${resumeBanner.recovered > 1 ? 's' : ''} recovered`}
        </div>
      )}

      {/* ── Header: US score | center info | THEM score ── */}
      <div style={S.header}>

        {/* Left — our score */}
        <div style={S.scoreSide}>
          <span style={S.scoreSideLabel}>US</span>
          <span style={{ ...S.scoreBig, color: '#00e5a0' }}>{ourScore}</span>
          <div style={S.toDots}>
            {[0,1,2].map(i => (
              <button key={i} onClick={() => useTimeout('us')}
                style={{ ...S.toDot, ...(i < ourTO ? S.toUsed : S.toAvail) }}
                disabled={i < ourTO || readOnly} />
            ))}
          </div>
        </div>

        {/* Center — game info */}
        <div style={S.headerCenter}>
          <button onClick={() => setShowGameInfo(true)} style={S.vsBtn}>
            vs {setup.opponent}
            <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.55 }}>⚙</span>
          </button>
          {halftimeAfterPoint !== null && <div style={S.htBadge}>½ HALF</div>}
          <div style={S.infoLine}>
            {readOnly ? (
              <span style={{ ...S.genBadge, background: 'rgba(122,128,153,0.15)', color: '#7a8099' }}>
                {points.length} pts
              </span>
            ) : isSingle ? (
              <span style={{ ...S.genBadge, background: 'rgba(0,229,160,0.15)', color: '#00e5a0' }}>
                Pt {curIdx + 1}
              </span>
            ) : (
              <span style={{ ...S.genBadge, ...(curGender === 'm' ? S.genM : S.genF) }}>
                {curGender === 'm' ? '♂' : '♀'} Pt {curIdx + 1}
              </span>
            )}
            {!readOnly && <span style={S.infoText}>{nextDir()} {pullReceive()}</span>}
            {!readOnly && (
              <span style={S.lineCount(lineOK, !isSingle && (selF > curFNeed || selM > curMNeed))}>
                {isSingle ? `${curLine.size}/${lineSize}` : `${selF}/${curFNeed}F · ${selM}/${curMNeed}M`}
              </span>
            )}
            {readOnly && (
              <span style={S.infoText}>
                {new Date(game.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          {liveMode && (
            <div style={S.liveBadge}>
              <span style={S.liveDot} />
              LIVE{liveCoaches > 0 ? ` · ${liveCoaches}` : ''}
            </div>
          )}
        </div>

        {/* Right — their score */}
        <div style={{ ...S.scoreSide, alignItems: 'flex-end' }}>
          <span style={{ ...S.scoreSideLabel, textAlign: 'right' }}>
            {setup.opponent.slice(0, 6).toUpperCase()}
          </span>
          <span style={{ ...S.scoreBig, color: '#ff4d6d' }}>{theirScore}</span>
          <div style={S.toDots}>
            {[0,1,2].map(i => (
              <button key={i} onClick={() => useTimeout('them')}
                style={{ ...S.toDot, ...(i < theirTO ? S.toUsed : S.toAvailOpp) }}
                disabled={i < theirTO || readOnly} />
            ))}
          </div>
        </div>

      </div>

      {/* ── Action Bar ── */}
      {readOnly ? (
        <div style={S.actionBar}>
          <button onClick={handleBack} style={S.btnEnd}>
            ← Games
          </button>
          <button onClick={() => setLightGrid(l => !l)} style={S.btnLight}>
            {lightGrid ? '🌙' : '☀️'}
          </button>
        </div>
      ) : (
        <div style={S.actionBar}>
          <button onClick={handleBack} style={S.btnBack}>‹</button>
          <button onClick={() => recordPoint('us')} style={S.btnUs}>▲ We Scored</button>
          <button onClick={() => recordPoint('them')} style={S.btnThem}>▲ They Scored</button>
          <button onClick={undoPoint} style={S.btnUndo} disabled={points.length === 0}>↩ Undo</button>
          <button onClick={() => setShowEndDialog(true)} style={S.btnEnd}>End</button>
          <button onClick={enterReorder} style={S.btnReorder} title="Reorder players">⇅</button>
          <button onClick={toggleLiveMode} style={{ ...S.btnLive, ...(liveMode ? S.btnLiveOn : {}) }}
            title={liveMode ? 'Turn off live sync' : 'Turn on live sync'}>⊙</button>
          {wakeLockSupported && (
            <button onClick={toggleNoSleep}
              style={{ ...S.btnLight, ...(noSleep ? S.noSleepOn : {}) }}
              title={noSleep ? 'Screen will stay on — tap to allow sleep' : 'Tap to keep screen on'}>
              {noSleep ? '☀' : '☾'}
            </button>
          )}
          <button onClick={() => setLightGrid(l => !l)} style={S.btnLight}>
            {lightGrid ? '🌙' : '☀️'}
          </button>
        </div>
      )}

      {/* ── Reorder Panel ── */}
      {reorderMode && (
        <div style={S.reorderPanel}>
          <div style={S.reorderHeader}>
            <span style={S.reorderTitle}>Reorder Players</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelReorder} style={S.reorderCancelBtn}>Cancel</button>
              <button onClick={saveOrder} style={S.reorderDoneBtn}>Save</button>
            </div>
          </div>
          {isSingle ? (
            <ReorderGroup
              players={playerOrder}
              label={null}
              color="#00e5a0"
              gender={playerOrder[0]?.gender || 'Male'}
              onReorder={reorderGroup}
            />
          ) : (
            <>
              <ReorderGroup
                players={playerOrder.filter(p => p.gender === 'Female')}
                label="Female"
                color="#ff80c8"
                gender="Female"
                onReorder={reorderGroup}
              />
              <ReorderGroup
                players={playerOrder.filter(p => p.gender === 'Male')}
                label="Male"
                color="#4d9fff"
                gender="Male"
                onReorder={reorderGroup}
              />
            </>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      {!reorderMode && loadingPlayers ? (
        <div style={S.loading}>Loading...</div>
      ) : !reorderMode && (
        <div style={{ ...S.gridWrap, background: gt.gridBg }} ref={gridRef}>

          {/* Pt # header row */}
          <div style={{ ...S.row, position: 'sticky', top: 0, zIndex: 8, background: gt.headerBg }}>
            <div style={{ ...stickyName(gt.headerBg), height: HDR_H, display: 'flex', alignItems: 'center',
              paddingLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: lightGrid ? '#8090b0' : '#4a5068',
              textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
              PLAYER / PT
            </div>
            {colIndices.map(i => (
              <div key={i} style={{ ...colCell(i), height: HDR_H, position: 'relative',
                lineHeight: HDR_H + 'px', fontSize: 10, color: gt.ptNumColor(i === curIdx),
                fontWeight: i === curIdx ? 800 : 600,
                fontFamily: "'Barlow Condensed', sans-serif",
                borderBottom: i === curIdx
                  ? `2px solid ${lightGrid ? '#00a878' : '#00e5a0'}`
                  : '2px solid transparent' }}>
                {i + 1}
                {halftimeAfterPoint !== null && i === halftimeAfterPoint && (
                  <span style={{ position: 'absolute', bottom: 1, left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 6, fontWeight: 800, color: 'rgba(255,152,0,0.9)',
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, lineHeight: 1 }}>
                    HT
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Gender row — mixed only */}
          {!isSingle && (
            <div style={{ ...S.row, position: 'sticky', top: HDR_H, zIndex: 8, background: gt.headerBg }}>
              <div style={{ ...stickyName(gt.headerBg), height: HDR_H, display: 'flex', alignItems: 'center',
                paddingLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: lightGrid ? '#8090b0' : '#4a5068',
                textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
                GENDER
              </div>
              {colIndices.map(i => {
                const g = getGenderForPoint(i, setup.firstGender)
                return (
                  <div key={i} style={{ ...colCell(i), height: HDR_H, lineHeight: HDR_H + 'px',
                    fontSize: 10, fontWeight: 800,
                    color: g === 'm' ? '#4d9fff' : '#ff80c8',
                    fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {g === 'm' ? 'M' : 'F'}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Player sections ── */}
          {isSingle ? (
            <>
              {players.map(p => (
                <PlayerRow key={p.id} player={p} colIndices={colIndices} lines={lines} curIdx={curIdx}
                  stickyName={stickyName} colCell={colCell} rowH={ROW_H}
                  status={playerStatus[p.id] || null} onStatusChange={() => cycleStatus(p.id)}
                  onToggle={toggleCell} readOnly={readOnly} gt={gt} lightGrid={lightGrid} />
              ))}
              {players.length === 0 && <EmptySection label="No players" stickyName={stickyName} colIndices={colIndices} colCell={colCell} rowH={ROW_H} gt={gt} />}
            </>
          ) : (
            <>
              <SectionRow label="FEMALE" color="#ff80c8" stickyName={stickyName} colIndices={colIndices}
                colBgFn={(i, cur) => colBg(i, cur, lightGrid)} curIdx={curIdx} secH={SEC_H} gt={gt}
                htAfterPoint={halftimeAfterPoint} />
              {females.map(p => (
                <PlayerRow key={p.id} player={p} colIndices={colIndices} lines={lines} curIdx={curIdx}
                  stickyName={stickyName} colCell={colCell} rowH={ROW_H}
                  status={playerStatus[p.id] || null} onStatusChange={() => cycleStatus(p.id)}
                  onToggle={toggleCell} readOnly={readOnly} gt={gt} lightGrid={lightGrid} />
              ))}
              {females.length === 0 && <EmptySection label="No female players" stickyName={stickyName} colIndices={colIndices} colCell={colCell} rowH={ROW_H} gt={gt} />}

              <SectionRow label="MALE" color="#4d9fff" stickyName={stickyName} colIndices={colIndices}
                colBgFn={(i, cur) => colBg(i, cur, lightGrid)} curIdx={curIdx} secH={SEC_H} gt={gt}
                htAfterPoint={halftimeAfterPoint} />
              {males.map(p => (
                <PlayerRow key={p.id} player={p} colIndices={colIndices} lines={lines} curIdx={curIdx}
                  stickyName={stickyName} colCell={colCell} rowH={ROW_H}
                  status={playerStatus[p.id] || null} onStatusChange={() => cycleStatus(p.id)}
                  onToggle={toggleCell} readOnly={readOnly} gt={gt} lightGrid={lightGrid} />
              ))}
              {males.length === 0 && <EmptySection label="No male players" stickyName={stickyName} colIndices={colIndices} colCell={colCell} rowH={ROW_H} gt={gt} />}
            </>
          )}

          {/* ── Score rows — values derived by counting scoredBy, never from stored cumulative ── */}
          <div style={{ ...S.row, borderTop: `1px solid ${lightGrid ? '#c8ccd8' : '#2a2f42'}`, marginTop: 2 }}>
            <div style={{ ...stickyName(lightGrid ? gt.headerBg : '#181c26'), height: SCORE_H,
              display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 10, fontWeight: 800,
              color: lightGrid ? '#008060' : '#00e5a0',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
              US
            </div>
            {colIndices.map(i => {
              const pt  = points[i]
              const rs  = runningScores[i]
              return (
                <div key={i} style={{ ...colCell(i), height: SCORE_H, lineHeight: SCORE_H + 'px',
                  fontSize: 11, fontWeight: pt?.scoredBy === 'us' ? 800 : 500,
                  color: pt?.scoredBy === 'us'
                    ? (lightGrid ? '#008060' : '#00e5a0')
                    : pt ? (lightGrid ? '#1a1d28' : '#e8eaf0')
                    : (lightGrid ? '#c0c4d0' : '#2a2f42'),
                  fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {rs ? rs.our : ''}
                </div>
              )
            })}
          </div>
          <div style={S.row}>
            <div style={{ ...stickyName(lightGrid ? gt.headerBg : '#181c26'), height: SCORE_H,
              display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 10, fontWeight: 800,
              color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
              {setup.opponent.slice(0, 4).toUpperCase()}
            </div>
            {colIndices.map(i => {
              const pt  = points[i]
              const rs  = runningScores[i]
              return (
                <div key={i} style={{ ...colCell(i), height: SCORE_H, lineHeight: SCORE_H + 'px',
                  fontSize: 11, fontWeight: pt?.scoredBy === 'them' ? 800 : 500,
                  color: pt?.scoredBy === 'them' ? '#ff4d6d'
                    : pt ? (lightGrid ? '#1a1d28' : '#e8eaf0')
                    : (lightGrid ? '#c0c4d0' : '#2a2f42'),
                  fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {rs ? rs.their : ''}
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '2rem', gap: '12px', color: '#7a8099'
  },
  emptyTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px', fontWeight: '800',
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px', margin: 0
  },
  emptySub: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', color: '#4a5068',
    textAlign: 'center', maxWidth: '280px', margin: 0,
  },
  newGameBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '800',
    padding: '8px 18px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
  },

  gamesList: {
    flex: 1, overflowY: 'auto', background: '#0f1117', padding: '20px 16px',
  },
  gamesListInner: {
    maxWidth: 480, margin: '0 auto',
  },
  gamesListHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  gamesListTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 1.5,
  },
  activeGameBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
    background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.25)',
    borderRadius: 8, marginBottom: 8, boxSizing: 'border-box',
  },
  activeGameLeft: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  activeDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#00e5a0', flexShrink: 0,
  },

  btnBack: {
    background: 'transparent', border: '1px solid #2a2f42', color: '#7a8099',
    borderRadius: 7, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18,
    fontWeight: 700, padding: '4px 10px', cursor: 'pointer', lineHeight: 1, flexShrink: 0,
  },

  container: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0f1117', overflow: 'hidden' },

  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    padding: '6px 10px', flexShrink: 0,
  },
  scoreSide: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56,
  },
  scoreSideLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1,
  },
  scoreBig: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, fontWeight: 900, lineHeight: 1,
  },
  toDots: { display: 'flex', gap: 4, marginTop: 2 },
  toDot:      { width: 14, height: 14, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 },
  toAvail:    { background: '#00e5a0' },
  toAvailOpp: { background: '#ff4d6d' },
  toUsed:     { background: '#2a2f42', cursor: 'default' },

  headerCenter: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
  },
  vsBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 1,
    padding: '2px 6px', borderRadius: 4, WebkitTapHighlightColor: 'transparent',
  },
  htBadge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800,
    color: 'rgba(255,152,0,1)', background: 'rgba(255,152,0,0.15)',
    padding: '1px 6px', borderRadius: 10, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  infoLine: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  genBadge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 800,
    padding: '2px 7px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase'
  },
  genM: { background: 'rgba(77,159,255,0.15)', color: '#4d9fff' },
  genF: { background: 'rgba(255,128,200,0.15)', color: '#ff80c8' },
  infoText: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#7a8099', fontWeight: 700
  },
  lineCount: (ok, over) => ({
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 800,
    color: over ? '#ff4d6d' : ok ? '#00e5a0' : '#7a8099'
  }),

  actionBar: {
    display: 'flex', gap: 6, padding: '6px 10px',
    background: '#181c26', borderBottom: '1px solid #2a2f42', flexShrink: 0
  },
  btnUs: {
    flex: 2, background: '#00e5a0', color: '#0f1117', border: 'none', borderRadius: 7,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    padding: '8px 0', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer'
  },
  btnThem: {
    flex: 2, background: '#ff4d6d', color: '#fff', border: 'none', borderRadius: 7,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    padding: '8px 0', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer'
  },
  btnEnd: {
    flex: 1, background: 'transparent', border: '1px solid #2a2f42', color: '#7a8099',
    borderRadius: 7, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
    fontWeight: 700, padding: '8px 0', textTransform: 'uppercase', cursor: 'pointer'
  },
  btnUndo: {
    flex: 1, background: 'transparent', border: '1px solid #4a5068', color: '#7a8099',
    borderRadius: 7, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
    fontWeight: 700, padding: '8px 0', textTransform: 'uppercase', cursor: 'pointer',
  },
  btnLight: {
    background: 'transparent', border: '1px solid #2a2f42', borderRadius: 7,
    fontSize: 16, padding: '4px 8px', cursor: 'pointer', lineHeight: 1, flexShrink: 0
  },
  noSleepOn: {
    border: '1px solid rgba(255,200,50,0.8)', color: 'rgba(255,200,50,1)',
    background: 'rgba(255,200,50,0.12)',
  },
  btnReorder: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    color: '#7a8099', background: 'transparent', border: '1px solid #2a2f42',
    borderRadius: 7, padding: '4px 8px', cursor: 'pointer', lineHeight: 1, flexShrink: 0,
  },
  btnLive: {
    background: 'transparent', border: '1px solid #2a2f42', color: '#4a5068',
    borderRadius: 7, fontSize: 16, fontWeight: 900,
    padding: '4px 8px', cursor: 'pointer', lineHeight: 1, flexShrink: 0,
  },
  btnLiveOn: {
    border: '1px solid #00e5a0', color: '#00e5a0', background: 'rgba(0,229,160,0.1)',
  },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800,
    color: '#00e5a0', textTransform: 'uppercase', letterSpacing: 1,
    background: 'rgba(0,229,160,0.12)', padding: '2px 8px', borderRadius: 10,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#00e5a0', flexShrink: 0,
  },

  reorderPanel: {
    flex: 1, overflowY: 'auto', minHeight: 0, background: '#0f1117',
  },
  reorderHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', background: '#181c26', borderBottom: '1px solid #2a2f42',
    position: 'sticky', top: 0, zIndex: 4,
  },
  reorderTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 1.5,
  },
  reorderCancelBtn: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800,
    color: '#7a8099', background: 'transparent', border: '1px solid #2a2f42',
    borderRadius: 7, padding: '5px 14px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  reorderDoneBtn: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800,
    color: '#0f1117', background: '#00e5a0', border: 'none',
    borderRadius: 7, padding: '5px 16px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  loading: {
    padding: '2rem', textAlign: 'center', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13
  },
  gridWrap: { flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 },
  row: { display: 'flex', alignItems: 'stretch' },

  pastHeader: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 800,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1, padding: '0 4px 10px',
  },
  pastGameRowWrap: {
    display: 'flex', alignItems: 'stretch',
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: 8, marginBottom: 8, overflow: 'hidden',
  },
  pastGameBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flex: 1, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
    background: 'transparent', border: 'none',
  },
  pastDeleteBtn: {
    padding: '0 14px', background: 'transparent', border: 'none',
    borderLeft: '1px solid #2a2f42', color: '#4a5068', cursor: 'pointer',
    fontSize: 14, fontWeight: 700, lineHeight: 1,
  },
  deleteConfirmRow: { display: 'flex', alignItems: 'stretch', borderLeft: '1px solid #2a2f42' },
  cancelDeleteBtn: {
    padding: '0 10px', background: 'transparent', border: 'none', borderRight: '1px solid #2a2f42',
    color: '#7a8099', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
  },
  confirmDeleteBtn: {
    padding: '0 12px', background: 'rgba(255,77,109,0.15)', border: 'none',
    color: '#ff4d6d', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
  },
  pastGameLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  pastOpponent: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pastDate:  { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#4a5068', letterSpacing: 0.5 },
  pastScore: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, lineHeight: 1 },

  resumeBanner: {
    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,229,160,0.95)', color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800,
    padding: '6px 18px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase',
    zIndex: 200, pointerEvents: 'none', whiteSpace: 'nowrap',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
}

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import GameSetupDialog from '../Components/GameSetupDialog'
import GameEndDialog from '../Components/GameEndDialog'

// Gender sequence: m, f, f, m, m, f, f, m, m, f, f ...
function getGenderForPoint(i, first) {
  if (i === 0) return first
  const other = first === 'm' ? 'f' : 'm'
  return Math.floor((i - 1) / 2) % 2 === 0 ? other : first
}

const NAME_W  = 90
const COL_W   = 44
const HDR_H   = 24
const SEC_H   = 20
const ROW_H   = 38
const SCORE_H = 24
const MAX_TO  = 3

const POS = { h: 'H', c: 'C', b: 'Hy', e: 'E' }

function colBg(colIdx, current, light = false) {
  if (colIdx === current)  return light ? 'rgba(0,180,120,0.10)' : 'rgba(0,229,160,0.06)'
  if (colIdx < current)    return light ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.01)'
  return 'transparent'
}

function cellFill(selected, colIdx, current, light = false) {
  if (!selected) return 'transparent'
  if (colIdx < current)   return light ? 'rgba(0,160,110,0.45)' : 'rgba(0,229,160,0.35)'
  if (colIdx === current) return light ? '#00c896' : '#00e5a0'
  return light ? 'rgba(0,160,110,0.22)' : 'rgba(0,229,160,0.18)'
}

function buildTheme(light) {
  return light ? {
    gridBg:      '#f4f5f8',
    nameBg:      '#ffffff',
    headerBg:    '#eaecf2',
    rowBorder:   '#b8bdd0',
    nameColor:   '#1a1d28',
    injColor:    '#a06800',
    posTagBg:    '#e0e3ef',
    posTagColor: '#5060a0',
    awayBg:      'rgba(100,110,140,0.15)',
    awayColor:   '#7a8099',
    ptNumColor:  (isCur) => isCur ? '#008060' : '#8090b0',
    light:       true,
  } : {
    gridBg:      '#0f1117',
    nameBg:      '#0f1117',
    headerBg:    '#181c26',
    rowBorder:   '#252a3a',
    nameColor:   '#c8ccd8',
    injColor:    '#c8a050',
    posTagBg:    '#1f2435',
    posTagColor: '#5a6280',
    awayBg:      'rgba(74,80,104,0.35)',
    awayColor:   '#7a8099',
    ptNumColor:  (isCur) => isCur ? '#00e5a0' : '#4a5068',
    light:       false,
  }
}

export default function GameSheetPage({ org, roster }) {
  const [players,            setPlayers]           = useState([])
  const [loadingPlayers,     setLoadingPlayers]    = useState(true)
  const [game,               setGame]              = useState(null)
  const [setup,              setSetup]             = useState(null)
  const [showSetup,          setShowSetup]         = useState(false)
  const [showEndDialog,      setShowEndDialog]     = useState(false)
  const [savingEnd,          setSavingEnd]         = useState(false)
  const [points,             setPoints]            = useState([])
  const [lines,              setLines]             = useState({})
  const [ourTO,              setOurTO]             = useState(0)
  const [theirTO,            setTheirTO]           = useState(0)
  const [playerStatus,       setPlayerStatus]      = useState({})
  const [lightGrid,          setLightGrid]         = useState(false)
  const [completedGames,     setCompletedGames]    = useState([])
  const [showGameInfo,       setShowGameInfo]      = useState(false)
  const [halftimeAfterPoint, setHalftimeAfterPoint] = useState(null)
  const [gameStartTime,      setGameStartTime]     = useState('')
  const [gameEndTime,        setGameEndTime]       = useState('')

  const gridRef = useRef(null)

  // Persist working state to localStorage
  useEffect(() => {
    if (!game?.id) return
    const linesSerial = {}
    Object.entries(lines).forEach(([k, s]) => { linesSerial[k] = [...s] })
    localStorage.setItem(`ucs_game_${game.id}`, JSON.stringify({
      lines: linesSerial, playerStatus, halftimeAfterPoint, gameStartTime, gameEndTime
    }))
  }, [game?.id, lines, playerStatus, halftimeAfterPoint, gameStartTime, gameEndTime])

  useEffect(() => {
    if (!roster?.id) return
    fetchPlayers()
    loadActiveGame()
    fetchCompletedGames()
  }, [roster?.id])

  const fetchPlayers = async () => {
    if (!roster?.id) return
    setLoadingPlayers(true)
    const { data } = await supabase
      .from('players').select('id, name, gender, position')
      .eq('roster_id', roster.id).order('name')
    setPlayers(data || [])
    setLoadingPlayers(false)
  }

  const loadActiveGame = async () => {
    if (!roster?.id) return
    const { data: activeGame } = await supabase
      .from('games').select('*')
      .eq('roster_id', roster.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!activeGame) return

    const { data: gamePoints } = await supabase
      .from('game_points').select('*')
      .eq('game_id', activeGame.id).order('point_number')

    const restoredSetup = {
      opponent:       activeGame.opponent,
      firstGender:    activeGame.first_gender,
      startingAction: activeGame.starting_action,
      direction:      activeGame.direction,
      lineSize:       activeGame.line_size,
    }

    const restoredPoints = (gamePoints || []).map(gp => ({
      gender:          gp.gender,
      scoredBy:        gp.scored_by,
      ourScoreAfter:   gp.our_score_after,
      theirScoreAfter: gp.their_score_after,
    }))

    const restoredLines = {}
    ;(gamePoints || []).forEach(gp => {
      restoredLines[gp.point_number] = new Set(gp.player_ids || [])
    })

    const cached = localStorage.getItem(`ucs_game_${activeGame.id}`)
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
      setGameStartTime(new Date(activeGame.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }

    setGame(activeGame)
    setSetup(restoredSetup)
    setPoints(restoredPoints)
    setLines(restoredLines)
    setOurTO(activeGame.our_timeouts_used || 0)
    setTheirTO(activeGame.their_timeouts_used || 0)
    scrollToCurrent()
  }

  const fetchCompletedGames = async () => {
    if (!roster?.id) return
    const { data } = await supabase
      .from('games').select('id, opponent, our_score, their_score, created_at')
      .eq('roster_id', roster.id).eq('status', 'completed')
      .order('created_at', { ascending: false })
    setCompletedGames(data || [])
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

  // ── Derived ──────────────────────────────────────────────────────────────
  const isSingle   = roster?.gender_type === 'single'
  const curIdx     = points.length
  const ourScore   = points.length ? points[points.length - 1].ourScoreAfter   : 0
  const theirScore = points.length ? points[points.length - 1].theirScoreAfter : 0
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

  // ── Handlers ─────────────────────────────────────────────────────────────
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
    if (!game) return
    const newOur   = scoredBy === 'us'   ? ourScore + 1 : ourScore
    const newTheir = scoredBy === 'them' ? theirScore + 1 : theirScore
    const pointNum    = curIdx
    const pointGender = curGender
    const lineSnapshot = [...curLine]

    setPoints(prev => [...prev, { gender: pointGender, scoredBy, ourScoreAfter: newOur, theirScoreAfter: newTheir }])
    scrollToCurrent()

    supabase.from('game_points').insert({
      game_id: game.id, point_number: pointNum, gender: pointGender,
      scored_by: scoredBy, player_ids: lineSnapshot,
      our_score_after: newOur, their_score_after: newTheir,
    }).then(({ error }) => { if (error) console.error('game_points insert:', error) })

    supabase.from('games').update({ our_score: newOur, their_score: newTheir })
      .eq('id', game.id)
      .then(({ error }) => { if (error) console.error('games score update:', error) })
  }

  const undoPoint = () => {
    if (!game || points.length === 0) return
    const lastIdx = points.length - 1
    setPoints(prev => prev.slice(0, -1))
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
    supabase.from('games').update({ our_timeouts_used: nOur, their_timeouts_used: nThem })
      .eq('id', game.id)
      .then(({ error }) => { if (error) console.error('timeout update:', error) })
  }

  const handleStartGame = async (setupData) => {
    const { data, error } = await supabase.from('games').insert({
      organization_id: org.id, roster_id: roster.id,
      opponent: setupData.opponent, first_gender: setupData.firstGender,
      starting_action: setupData.startingAction, direction: setupData.direction,
      line_size: setupData.lineSize, status: 'active',
    }).select().single()
    if (error) { console.error(error); return }
    setGame(data); setSetup(setupData); setPoints([]); setLines({})
    setOurTO(0); setTheirTO(0); setPlayerStatus({})
    setHalftimeAfterPoint(null); setShowSetup(false)
    setGameStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setGameEndTime('')
  }

  const handleSaveEnd = async (ratings) => {
    if (!game) return
    setSavingEnd(true)
    try {
      await supabase.from('spirit_ratings').insert({ game_id: game.id, ...ratings })
      await supabase.from('games').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', game.id)
      if (game?.id) localStorage.removeItem(`ucs_game_${game.id}`)
      setShowEndDialog(false); setGame(null); setSetup(null); setPoints([]); setLines({})
      setPlayerStatus({}); setHalftimeAfterPoint(null); setGameStartTime(''); setGameEndTime('')
      fetchCompletedGames()
    } finally { setSavingEnd(false) }
  }

  // ── No active game ────────────────────────────────────────────────────────
  if (!setup) {
    return (
      <div style={{ ...S.emptyState, justifyContent: 'flex-start', paddingTop: 32, overflowY: 'auto' }}>
        {showSetup && <GameSetupDialog roster={roster} onStart={handleStartGame} onCancel={() => setShowSetup(false)} />}
        <div style={{ fontSize: 48 }}>🥏</div>
        <h2 style={S.emptyTitle}>No Active Game</h2>
        <p style={S.emptySub}>{!roster ? 'Select a roster first.' : 'Start a new game to open the sheet.'}</p>
        {roster && <button onClick={() => setShowSetup(true)} style={S.newGameBtn}>+ New Game</button>}
        {completedGames.length > 0 && (
          <div style={{ width: '100%', maxWidth: 480, marginTop: 28 }}>
            <div style={S.pastHeader}>Past Games</div>
            {completedGames.map(g => {
              const d = new Date(g.created_at)
              const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              const won = g.our_score > g.their_score
              const lost = g.our_score < g.their_score
              return (
                <button key={g.id} onClick={() => loadCompletedGame(g)} style={S.pastGameRow}>
                  <div style={S.pastGameLeft}>
                    <span style={S.pastOpponent}>vs {g.opponent}</span>
                    <span style={S.pastDate}>{dateStr}</span>
                  </div>
                  <div style={{ ...S.pastScore, color: won ? '#00e5a0' : lost ? '#ff4d6d' : '#e8eaf0' }}>
                    {g.our_score} – {g.their_score}
                  </div>
                </button>
              )
            })}
          </div>
        )}
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

  return (
    <div style={S.container}>
      {showEndDialog && (
        <GameEndDialog ourScore={ourScore} theirScore={theirScore} opponent={setup.opponent}
          onSave={handleSaveEnd} onCancel={() => setShowEndDialog(false)} saving={savingEnd} />
      )}
      {showGameInfo && (
        <GameInfoModal
          setup={setup} points={points} halftimeAfterPoint={halftimeAfterPoint}
          onMarkHalftime={() => { if (points.length > 0) setHalftimeAfterPoint(points.length - 1) }}
          onClearHalftime={() => setHalftimeAfterPoint(null)}
          startTime={gameStartTime} endTime={gameEndTime}
          onChangeStartTime={setGameStartTime} onChangeEndTime={setGameEndTime}
          onUpdateSetup={(updates) => setSetup(prev => ({ ...prev, ...updates }))}
          onClose={() => setShowGameInfo(false)}
        />
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
          <button onClick={() => { setGame(null); setSetup(null); setPoints([]); setLines({}) }} style={S.btnEnd}>
            ← Games
          </button>
          <button onClick={() => setLightGrid(l => !l)} style={S.btnLight}>
            {lightGrid ? '🌙' : '☀️'}
          </button>
        </div>
      ) : (
        <div style={S.actionBar}>
          <button onClick={() => recordPoint('us')} style={S.btnUs}>▲ We Scored</button>
          <button onClick={() => recordPoint('them')} style={S.btnThem}>▲ They Scored</button>
          <button onClick={undoPoint} style={S.btnUndo} disabled={points.length === 0}>↩ Undo</button>
          <button onClick={() => setShowEndDialog(true)} style={S.btnEnd}>End</button>
          <button onClick={() => setLightGrid(l => !l)} style={S.btnLight}>
            {lightGrid ? '🌙' : '☀️'}
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      {loadingPlayers ? (
        <div style={S.loading}>Loading...</div>
      ) : (
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

          {/* ── Score rows ── */}
          <div style={{ ...S.row, borderTop: `1px solid ${lightGrid ? '#c8ccd8' : '#2a2f42'}`, marginTop: 2 }}>
            <div style={{ ...stickyName(lightGrid ? gt.headerBg : '#181c26'), height: SCORE_H,
              display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 10, fontWeight: 800,
              color: lightGrid ? '#008060' : '#00e5a0',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
              US
            </div>
            {colIndices.map(i => {
              const pt = points[i]
              return (
                <div key={i} style={{ ...colCell(i), height: SCORE_H, lineHeight: SCORE_H + 'px',
                  fontSize: 11, fontWeight: pt?.scoredBy === 'us' ? 800 : 500,
                  color: pt?.scoredBy === 'us'
                    ? (lightGrid ? '#008060' : '#00e5a0')
                    : pt ? (lightGrid ? '#1a1d28' : '#e8eaf0')
                    : (lightGrid ? '#c0c4d0' : '#2a2f42'),
                  fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {pt ? pt.ourScoreAfter : ''}
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
              const pt = points[i]
              return (
                <div key={i} style={{ ...colCell(i), height: SCORE_H, lineHeight: SCORE_H + 'px',
                  fontSize: 11, fontWeight: pt?.scoredBy === 'them' ? 800 : 500,
                  color: pt?.scoredBy === 'them' ? '#ff4d6d'
                    : pt ? (lightGrid ? '#1a1d28' : '#e8eaf0')
                    : (lightGrid ? '#c0c4d0' : '#2a2f42'),
                  fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {pt ? pt.theirScoreAfter : ''}
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionRow({ label, color, stickyName, colIndices, colBgFn, curIdx, secH, gt, htAfterPoint }) {
  const sectionTint = `${color}14`
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
      <div style={{ ...stickyName(sectionTint), height: secH, display: 'flex', alignItems: 'center',
        paddingLeft: 6, fontSize: 9, fontWeight: 800, color, letterSpacing: 1,
        textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif",
        borderTop: `2px solid ${color}88`, borderBottom: `1px solid ${color}44` }}>
        {label}
      </div>
      {colIndices.map(i => (
        <div key={i} style={{ width: COL_W, minWidth: COL_W, flexShrink: 0, height: secH,
          background: `${colBgFn(i, curIdx) === 'transparent' ? sectionTint : colBgFn(i, curIdx)}`,
          borderTop: `2px solid ${color}88`, borderBottom: `1px solid ${color}44`,
          borderRight: htAfterPoint !== null && i === htAfterPoint ? '3px solid rgba(255,152,0,0.7)' : undefined }} />
      ))}
    </div>
  )
}

function PlayerRow({ player, colIndices, lines, curIdx, stickyName, colCell, rowH, status, onStatusChange, onToggle, readOnly, gt, lightGrid }) {
  const unavailable = !!status
  const borderColor = status === 'injured' ? '#f0a500' : status === 'away' ? '#4a5068' : 'transparent'
  const rowOpacity  = status === 'away' ? 0.28 : status === 'injured' ? 0.45 : 1

  return (
    <div style={{ display: 'flex', alignItems: 'center', opacity: rowOpacity }}>
      <div onClick={onStatusChange}
        title={!status ? 'Tap to mark Away' : status === 'away' ? 'Tap to mark Injured' : 'Tap to mark Active'}
        style={{ ...stickyName(gt.nameBg), height: rowH, display: 'flex', alignItems: 'center',
          paddingLeft: 4, gap: 3, borderBottom: `1px solid ${gt.rowBorder}`,
          borderLeft: `3px solid ${borderColor}`,
          overflow: 'hidden', cursor: 'pointer', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 12, fontWeight: 700,
          color: status === 'injured' ? gt.injColor : gt.nameColor,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: status ? 46 : 54,
          textDecoration: status === 'away' ? 'line-through' : 'none',
          fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {player.name}
        </span>
        {status ? (
          <span style={{ fontSize: 8, fontWeight: 800, flexShrink: 0, padding: '1px 3px', borderRadius: 3,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
            background: status === 'away' ? gt.awayBg : 'rgba(240,165,0,0.2)',
            color: status === 'away' ? gt.awayColor : '#f0a500' }}>
            {status === 'away' ? 'AWAY' : 'INJ'}
          </span>
        ) : player.position ? (
          <span style={{ fontSize: 9, fontWeight: 700, background: gt.posTagBg, color: gt.posTagColor,
            padding: '1px 3px', borderRadius: 3, flexShrink: 0,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
            {POS[player.position] || player.position}
          </span>
        ) : null}
      </div>

      {colIndices.map(i => {
        const selected = lines[i]?.has(player.id) || false
        const isInteractive = !readOnly && i >= curIdx && !unavailable
        const dot = selected ? (
          <div style={{
            width: 16, height: 16, borderRadius: 3,
            background: cellFill(true, i, curIdx, lightGrid),
            border: i > curIdx ? `1px dashed ${lightGrid ? 'rgba(0,160,110,0.4)' : 'rgba(0,229,160,0.4)'}` : 'none',
            pointerEvents: 'none',
          }} />
        ) : null

        if (isInteractive) {
          return (
            <button key={i} onClick={() => onToggle(player.id, i)}
              style={{ ...colCell(i), height: rowH,
                borderBottom: `1px solid ${gt.rowBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              {dot}
            </button>
          )
        }
        return (
          <div key={i} style={{ ...colCell(i), height: rowH, borderBottom: `1px solid ${gt.rowBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dot}
          </div>
        )
      })}
    </div>
  )
}

function EmptySection({ label, stickyName, colIndices, colCell, rowH, gt }) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ ...stickyName(gt.nameBg), height: rowH, display: 'flex', alignItems: 'center',
        paddingLeft: 6, fontSize: 10, color: gt.light ? '#a0a8c0' : '#3a3f52',
        fontFamily: "'Barlow Condensed', sans-serif" }}>
        {label}
      </div>
      {colIndices.map(i => <div key={i} style={{ ...colCell(i), height: rowH }} />)}
    </div>
  )
}

// ── Game Info Modal ───────────────────────────────────────────────────────────

function GameInfoModal({ setup, points, halftimeAfterPoint, onMarkHalftime, onClearHalftime,
  startTime, endTime, onChangeStartTime, onChangeEndTime, onUpdateSetup, onClose }) {

  const [timerSecs,    setTimerSecs]    = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef(null)
  const MAX_TIMER = 15 * 60

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSecs(prev => {
          if (prev >= MAX_TIMER) { clearInterval(timerRef.current); setTimerRunning(false); return MAX_TIMER }
          return prev + 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const timerDone = timerSecs >= MAX_TIMER
  const timerColor = timerDone ? '#ff4d6d' : timerRunning ? '#00e5a0' : '#e8eaf0'

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.modal} onClick={e => e.stopPropagation()}>
        <div style={MS.title}>GAME INFO</div>

        {/* Times */}
        <div style={MS.section}>
          <div style={MS.fieldRow}>
            <span style={MS.label}>Start Time</span>
            <input value={startTime} onChange={e => onChangeStartTime(e.target.value)}
              style={MS.input} placeholder="e.g. 10:00 AM" maxLength={20} />
          </div>
          <div style={MS.fieldRow}>
            <span style={MS.label}>End Time</span>
            <input value={endTime} onChange={e => onChangeEndTime(e.target.value)}
              style={MS.input} placeholder="e.g. 12:00 PM" maxLength={20} />
          </div>
        </div>

        {/* Setup toggles */}
        <div style={MS.section}>
          <div style={MS.fieldRow}>
            <span style={MS.label}>Starting Side</span>
            <div style={MS.toggleGroup}>
              <button onClick={() => onUpdateSetup({ direction: 'left' })}
                style={{ ...MS.toggleBtn, ...(setup.direction === 'left' ? MS.toggleActive : {}) }}>
                ← Left
              </button>
              <button onClick={() => onUpdateSetup({ direction: 'right' })}
                style={{ ...MS.toggleBtn, ...(setup.direction === 'right' ? MS.toggleActive : {}) }}>
                → Right
              </button>
            </div>
          </div>
          <div style={MS.fieldRow}>
            <span style={MS.label}>Starting</span>
            <div style={MS.toggleGroup}>
              <button onClick={() => onUpdateSetup({ startingAction: 'pull' })}
                style={{ ...MS.toggleBtn, ...(setup.startingAction === 'pull' ? MS.toggleActive : {}) }}>
                Pull
              </button>
              <button onClick={() => onUpdateSetup({ startingAction: 'receive' })}
                style={{ ...MS.toggleBtn, ...(setup.startingAction === 'receive' ? MS.toggleActive : {}) }}>
                Receive
              </button>
            </div>
          </div>
          <div style={MS.fieldRow}>
            <span style={MS.label}>First Gender</span>
            <div style={MS.toggleGroup}>
              <button onClick={() => onUpdateSetup({ firstGender: 'm' })}
                style={{ ...MS.toggleBtn, ...(setup.firstGender === 'm' ? MS.toggleActiveM : {}) }}>
                Male
              </button>
              <button onClick={() => onUpdateSetup({ firstGender: 'f' })}
                style={{ ...MS.toggleBtn, ...(setup.firstGender === 'f' ? MS.toggleActiveF : {}) }}>
                Female
              </button>
            </div>
          </div>
        </div>

        {/* Halftime */}
        <div style={MS.section}>
          <div style={MS.sectionTitle}>HALFTIME</div>
          {halftimeAfterPoint !== null ? (
            <div style={MS.htStatus}>
              <span style={MS.htLabel}>Half after Pt {halftimeAfterPoint + 1}</span>
              <button onClick={onClearHalftime} style={MS.clearBtn}>Clear</button>
            </div>
          ) : (
            <button onClick={onMarkHalftime} disabled={points.length === 0}
              style={{ ...MS.htBtn, opacity: points.length === 0 ? 0.4 : 1 }}>
              Mark Halftime Now
            </button>
          )}
        </div>

        {/* Timer */}
        <div style={MS.section}>
          <div style={MS.sectionTitle}>BREAK TIMER</div>
          <div style={{ ...MS.timerDisplay, color: timerColor }}>
            {formatTime(timerSecs)}
          </div>
          {timerDone && <div style={MS.timerAlert}>TIME'S UP</div>}
          <div style={MS.timerBtns}>
            <button onClick={() => setTimerRunning(r => !r)} disabled={timerDone}
              style={{ ...MS.timerBtn, background: timerRunning ? '#ff4d6d' : '#00e5a0', color: '#0f1117',
                opacity: timerDone ? 0.4 : 1 }}>
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button onClick={() => { setTimerSecs(0); setTimerRunning(false) }}
              style={{ ...MS.timerBtn, background: '#2a2f42', color: '#7a8099' }}>
              Reset
            </button>
          </div>
        </div>

        <button onClick={onClose} style={MS.closeBtn}>Done</button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '2rem', gap: '12px', color: '#7a8099'
  },
  emptyTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px', fontWeight: '800',
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px', margin: 0
  },
  emptySub:   { fontSize: '13px', textAlign: 'center', maxWidth: '280px', margin: 0 },
  newGameBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: '800',
    padding: '10px 24px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },

  container: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0f1117', overflow: 'hidden' },

  // Header — 3-column layout
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

  // Center info
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

  // Action bar
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

  loading: {
    padding: '2rem', textAlign: 'center', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13
  },
  gridWrap: { flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 },
  row: { display: 'flex', alignItems: 'stretch' },

  // Past games
  pastHeader: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 800,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1, padding: '0 4px 10px',
  },
  pastGameRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: 8, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', textAlign: 'left',
  },
  pastGameLeft: { display: 'flex', flexDirection: 'column', gap: 3 },
  pastOpponent: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pastDate: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#4a5068', letterSpacing: 0.5 },
  pastScore: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, lineHeight: 1 },
}

// Modal styles
const MS = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
    padding: '20px 20px 16px', width: '100%', maxWidth: 380,
    display: 'flex', flexDirection: 'column', gap: 0,
    maxHeight: '90vh', overflowY: 'auto',
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 2,
    marginBottom: 16, textAlign: 'center',
  },
  section: {
    borderTop: '1px solid #2a2f42', paddingTop: 14, paddingBottom: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 800,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2,
  },
  fieldRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
  },
  input: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
    fontWeight: 600, padding: '6px 10px', width: 130, outline: 'none',
  },
  toggleGroup: { display: 'flex', gap: 4 },
  toggleBtn: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 700, padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase',
  },
  toggleActive:  { background: 'rgba(0,229,160,0.15)', border: '1px solid #00e5a0', color: '#00e5a0' },
  toggleActiveM: { background: 'rgba(77,159,255,0.15)', border: '1px solid #4d9fff', color: '#4d9fff' },
  toggleActiveF: { background: 'rgba(255,128,200,0.15)', border: '1px solid #ff80c8', color: '#ff80c8' },

  // Halftime
  htStatus: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  htLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: 'rgba(255,152,0,0.9)',
  },
  clearBtn: {
    background: 'transparent', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 700, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase',
  },
  htBtn: {
    background: 'rgba(255,152,0,0.12)', border: '1px solid rgba(255,152,0,0.5)',
    borderRadius: 8, color: 'rgba(255,152,0,1)',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    padding: '10px 0', textTransform: 'uppercase', letterSpacing: 0.5,
    cursor: 'pointer', width: '100%',
  },

  // Timer
  timerDisplay: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 900,
    letterSpacing: 2, textAlign: 'center', lineHeight: 1, padding: '8px 0',
  },
  timerAlert: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800,
    color: '#ff4d6d', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center',
    marginBottom: 4,
  },
  timerBtns: { display: 'flex', gap: 8 },
  timerBtn: {
    flex: 1, border: 'none', borderRadius: 8,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
    padding: '10px 0', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },

  // Close
  closeBtn: {
    marginTop: 12, background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 10,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
    fontWeight: 800, padding: '12px 0', textTransform: 'uppercase', cursor: 'pointer',
    width: '100%',
  },
}

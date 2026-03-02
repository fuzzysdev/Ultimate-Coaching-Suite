import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import GameSetupDialog from '../Components/GameSetupDialog'
import GameEndDialog from '../Components/GameEndDialog'

// Gender sequence: m, f, f, m, m, f, f, m, m, f, f ...
function getGenderForPoint(i, first) {
  if (i === 0) return first
  const other = first === 'm' ? 'f' : 'm'
  return Math.floor((i - 1) / 2) % 2 === 0 ? other : first
}

const NAME_W  = 82   // px — sticky name column
const COL_W   = 28   // px — each point column
const HDR_H   = 20   // px — pt# and gender header rows
const SEC_H   = 18   // px — section label row height
const ROW_H   = 29   // px — player row height
const SCORE_H = 20   // px — score rows at bottom of grid
const MAX_TO  = 3

const POS = { h: 'H', c: 'C', b: 'Hy', e: 'E' }

// ─── Column background tint (applied to every cell in a column) ──────────────
function colBg(colIdx, current) {
  if (colIdx === current)  return 'rgba(0,229,160,0.06)'
  if (colIdx < current)    return 'rgba(255,255,255,0.01)'
  return 'transparent'
}

// ─── Individual cell fill based on selection + column state ──────────────────
function cellFill(selected, colIdx, current) {
  if (!selected) return 'transparent'
  if (colIdx < current)  return 'rgba(0,229,160,0.35)'   // completed
  if (colIdx === current) return '#00e5a0'                // current
  return 'rgba(0,229,160,0.18)'                          // planned (future)
}

export default function GameSheetPage({ org, roster }) {
  const [players,        setPlayers]        = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [game,           setGame]           = useState(null)
  const [setup,          setSetup]          = useState(null)
  const [showSetup,      setShowSetup]      = useState(false)
  const [showEndDialog,  setShowEndDialog]  = useState(false)
  const [savingEnd,      setSavingEnd]      = useState(false)
  const [points,         setPoints]         = useState([])   // completed points
  const [lines,          setLines]          = useState({})   // { [ptIdx]: Set<id> }
  const [ourTO,          setOurTO]          = useState(0)
  const [theirTO,        setTheirTO]        = useState(0)
  const [playerStatus,   setPlayerStatus]   = useState({}) // { [id]: 'away' | 'injured' }

  const gridRef     = useRef(null)
  const scoreBarRef = useRef(null)
  const syncingRef  = useRef(false)

  useEffect(() => { fetchPlayers() }, [roster?.id])

  const fetchPlayers = async () => {
    if (!roster?.id) return
    setLoadingPlayers(true)
    const { data } = await supabase
      .from('players').select('id, name, gender, position')
      .eq('roster_id', roster.id).order('name')
    setPlayers(data || [])
    setLoadingPlayers(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const curIdx     = points.length
  const ourScore   = points.length ? points[points.length - 1].ourScoreAfter   : 0
  const theirScore = points.length ? points[points.length - 1].theirScoreAfter : 0
  const curGender  = setup ? getGenderForPoint(curIdx, setup.firstGender) : 'm'
  const mNeed      = curGender === 'm' ? 4 : 3
  const fNeed      = curGender === 'f' ? 4 : 3
  const females    = players.filter(p => p.gender === 'Female')
  const males      = players.filter(p => p.gender === 'Male')
  const curLine    = lines[curIdx] || new Set()
  const selF       = females.filter(p => curLine.has(p.id)).length
  const selM       = males.filter(p => curLine.has(p.id)).length
  const lineOK     = selF === fNeed && selM === mNeed
  const totalCols  = Math.max(curIdx + 8, 15)
  const colIndices = Array.from({ length: totalCols }, (_, i) => i)

  const nextDir = () => {
    if (!setup) return ''
    const swaps = points.length % 2 !== 0
    const d = swaps
      ? (setup.direction === 'left' ? 'right' : 'left')
      : setup.direction
    return d === 'left' ? '←' : '→'
  }
  const pullReceive = () => {
    if (!setup) return ''
    const weStart = setup.startingAction === 'receive'
    return (points.length % 2 === 0) === weStart ? 'Receive' : 'Pull'
  }

  // ── Scroll sync ──────────────────────────────────────────────────────────
  const onGridScroll = useCallback((e) => {
    if (syncingRef.current || !scoreBarRef.current) return
    syncingRef.current = true
    scoreBarRef.current.scrollLeft = e.target.scrollLeft
    syncingRef.current = false
  }, [])

  const onScoreScroll = useCallback((e) => {
    if (syncingRef.current || !gridRef.current) return
    syncingRef.current = true
    gridRef.current.scrollLeft = e.target.scrollLeft
    syncingRef.current = false
  }, [])

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
    if (ptIdx < curIdx) return                   // completed point — locked
    if (playerStatus[playerId]) return           // away or injured — skip

    const player = players.find(p => p.id === playerId)
    if (!player) return

    const ptGender = getGenderForPoint(ptIdx, setup.firstGender)
    const isMale   = player.gender === 'Male'
    const need     = isMale ? (ptGender === 'm' ? 4 : 3) : (ptGender === 'f' ? 4 : 3)
    const ptLine   = lines[ptIdx] || new Set()

    // Block adding if the gender slot is already full
    if (!ptLine.has(playerId)) {
      const group = isMale ? males : females
      const count = group.filter(p => ptLine.has(p.id)).length
      if (count >= need) return
    }

    setLines(prev => {
      const s = new Set(prev[ptIdx] || [])
      s.has(playerId) ? s.delete(playerId) : s.add(playerId)
      return { ...prev, [ptIdx]: s }
    })
  }

  // Cycle: active → away → injured → active
  // Marking unavailable clears all their future-point selections
  const cycleStatus = (playerId) => {
    const cur = playerStatus[playerId]
    const next = !cur ? 'away' : cur === 'away' ? 'injured' : null

    setPlayerStatus(prev => {
      const updated = { ...prev }
      if (next) updated[playerId] = next
      else delete updated[playerId]
      return updated
    })

    // Clear future selections when player becomes unavailable
    if (next) {
      setLines(prev => {
        const updated = { ...prev }
        for (const key in updated) {
          if (parseInt(key) >= curIdx) {
            const s = new Set(updated[key])
            s.delete(playerId)
            updated[key] = s
          }
        }
        return updated
      })
    }
  }

  const recordPoint = async (scoredBy) => {
    if (!game) return
    const newOur   = scoredBy === 'us'   ? ourScore + 1 : ourScore
    const newTheir = scoredBy === 'them' ? theirScore + 1 : theirScore
    await supabase.from('game_points').insert({
      game_id: game.id, point_number: curIdx, gender: curGender,
      scored_by: scoredBy, player_ids: [...curLine],
      our_score_after: newOur, their_score_after: newTheir,
    })
    await supabase.from('games').update({ our_score: newOur, their_score: newTheir }).eq('id', game.id)
    setPoints(prev => [...prev, { gender: curGender, scoredBy, ourScoreAfter: newOur, theirScoreAfter: newTheir }])
    scrollToCurrent()
  }

  const useTimeout = async (team) => {
    if (!game) return
    if (team === 'us'   && ourTO   >= MAX_TO) return
    if (team === 'them' && theirTO >= MAX_TO) return
    const nOur  = team === 'us'   ? ourTO + 1   : ourTO
    const nThem = team === 'them' ? theirTO + 1 : theirTO
    setOurTO(nOur); setTheirTO(nThem)
    await supabase.from('games').update({ our_timeouts_used: nOur, their_timeouts_used: nThem }).eq('id', game.id)
  }

  const handleStartGame = async (setupData) => {
    const { data, error } = await supabase.from('games').insert({
      organization_id: org.id, roster_id: roster.id,
      opponent: setupData.opponent, first_gender: setupData.firstGender,
      starting_action: setupData.startingAction, direction: setupData.direction,
    }).select().single()
    if (error) { console.error(error); return }
    setGame(data); setSetup(setupData); setPoints([]); setLines({})
    setOurTO(0); setTheirTO(0); setPlayerStatus({}); setShowSetup(false)
  }

  const handleSaveEnd = async (ratings) => {
    if (!game) return
    setSavingEnd(true)
    try {
      await supabase.from('spirit_ratings').insert({ game_id: game.id, ...ratings })
      await supabase.from('games').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', game.id)
      setShowEndDialog(false); setGame(null); setSetup(null); setPoints([]); setLines({}); setPlayerStatus({})
    } finally { setSavingEnd(false) }
  }

  // ── No active game ────────────────────────────────────────────────────────
  if (!setup) {
    return (
      <div style={S.emptyState}>
        {showSetup && <GameSetupDialog onStart={handleStartGame} onCancel={() => setShowSetup(false)} />}
        <div style={{ fontSize: 52 }}>🥏</div>
        <h2 style={S.emptyTitle}>No Active Game</h2>
        <p style={S.emptySub}>{!roster ? 'Select a roster first.' : 'Start a new game to open the sheet.'}</p>
        {roster && <button onClick={() => setShowSetup(true)} style={S.newGameBtn}>+ New Game</button>}
      </div>
    )
  }

  // ── Active game ────────────────────────────────────────────────────────────
  const stickyName = (bg = '#0f1117') => ({
    width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 4,
    background: bg, flexShrink: 0,
  })

  const colCell = (colIdx, extra = {}) => ({
    width: COL_W, minWidth: COL_W, flexShrink: 0, textAlign: 'center',
    background: colBg(colIdx, curIdx), ...extra
  })

  return (
    <div style={S.container}>
      {showEndDialog && (
        <GameEndDialog ourScore={ourScore} theirScore={theirScore} opponent={setup.opponent}
          onSave={handleSaveEnd} onCancel={() => setShowEndDialog(false)} saving={savingEnd} />
      )}

      {/* ── Compact Header ── */}
      <div style={S.header}>
        <div style={S.scoreBlock}>
          <span style={S.scoreBig}>{ourScore}</span>
          <span style={S.scoreSep}>-</span>
          <span style={S.scoreBig}>{theirScore}</span>
        </div>
        <div style={S.headerCenter}>
          <div style={S.vsLine}>vs {setup.opponent}</div>
          <div style={S.infoLine}>
            <span style={{ ...S.genBadge, ...(curGender === 'm' ? S.genM : S.genF) }}>
              {curGender === 'm' ? '♂' : '♀'} Pt {curIdx + 1}
            </span>
            <span style={S.infoText}>{nextDir()} {pullReceive()}</span>
            <span style={S.lineCount(lineOK, selF > fNeed || selM > mNeed)}>
              {selF}/{fNeed}F · {selM}/{mNeed}M
            </span>
          </div>
        </div>
        <div style={S.toBlock}>
          <div style={S.toRow}>
            <span style={S.toLabel}>US</span>
            {[0,1,2].map(i => (
              <button key={i} onClick={() => useTimeout('us')}
                style={{ ...S.toDot, ...(i < ourTO ? S.toUsed : S.toAvail) }}
                disabled={i < ourTO} />
            ))}
          </div>
          <div style={S.toRow}>
            <span style={S.toLabel}>OPP</span>
            {[0,1,2].map(i => (
              <button key={i} onClick={() => useTimeout('them')}
                style={{ ...S.toDot, ...(i < theirTO ? S.toUsed : S.toAvailOpp) }}
                disabled={i < theirTO} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div style={S.actionBar}>
        <button onClick={() => recordPoint('us')} style={S.btnUs}>
          ▲ We Scored
        </button>
        <button onClick={() => recordPoint('them')} style={S.btnThem}>
          ▲ They Scored
        </button>
        <button onClick={() => setShowEndDialog(true)} style={S.btnEnd}>End</button>
      </div>

      {/* ── Grid ── */}
      {loadingPlayers ? (
        <div style={S.loading}>Loading...</div>
      ) : (
        <div style={S.gridWrap} ref={gridRef} onScroll={onGridScroll}>

          {/* Pt # header row */}
          <div style={{ ...S.row, position: 'sticky', top: 0, zIndex: 8, background: '#181c26' }}>
            <div style={{ ...stickyName('#181c26'), height: HDR_H, display: 'flex', alignItems: 'center',
              paddingLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#4a5068',
              textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
              PLAYER / PT
            </div>
            {colIndices.map(i => (
              <div key={i} style={{ ...colCell(i), height: HDR_H, lineHeight: HDR_H + 'px',
                fontSize: 10, color: i === curIdx ? '#00e5a0' : '#4a5068',
                fontWeight: i === curIdx ? 800 : 600,
                fontFamily: "'Barlow Condensed', sans-serif",
                borderBottom: i === curIdx ? '2px solid #00e5a0' : '2px solid transparent' }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Gender row */}
          <div style={{ ...S.row, position: 'sticky', top: HDR_H, zIndex: 8, background: '#181c26' }}>
            <div style={{ ...stickyName('#181c26'), height: HDR_H, display: 'flex', alignItems: 'center',
              paddingLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#4a5068',
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

          {/* ── Female section ── */}
          <SectionRow label="FEMALE" color="#ff80c8" stickyName={stickyName} colIndices={colIndices} colBgFn={colBg} curIdx={curIdx} secH={SEC_H} />
          {females.map(p => (
            <PlayerRow key={p.id} player={p} colIndices={colIndices} lines={lines} curIdx={curIdx}
              stickyName={stickyName} colCell={colCell} onToggle={toggleCell} rowH={ROW_H}
              status={playerStatus[p.id] || null} onStatusChange={() => cycleStatus(p.id)} />
          ))}
          {females.length === 0 && <EmptySection label="No female players" stickyName={stickyName} colIndices={colIndices} colCell={colCell} rowH={ROW_H} />}

          {/* ── Male section ── */}
          <SectionRow label="MALE" color="#4d9fff" stickyName={stickyName} colIndices={colIndices} colBgFn={colBg} curIdx={curIdx} secH={SEC_H} />
          {males.map(p => (
            <PlayerRow key={p.id} player={p} colIndices={colIndices} lines={lines} curIdx={curIdx}
              stickyName={stickyName} colCell={colCell} onToggle={toggleCell} rowH={ROW_H}
              status={playerStatus[p.id] || null} onStatusChange={() => cycleStatus(p.id)} />
          ))}
          {males.length === 0 && <EmptySection label="No male players" stickyName={stickyName} colIndices={colIndices} colCell={colCell} rowH={ROW_H} />}

          {/* ── Score rows ── */}
          <div style={{ ...S.row, borderTop: '1px solid #2a2f42', marginTop: 2 }}>
            <div style={{ ...stickyName('#181c26'), height: SCORE_H, display: 'flex', alignItems: 'center',
              paddingLeft: 6, fontSize: 10, fontWeight: 800, color: '#00e5a0',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
              US
            </div>
            {colIndices.map(i => {
              const pt = points[i]
              return (
                <div key={i} style={{ ...colCell(i), height: SCORE_H, lineHeight: SCORE_H + 'px',
                  fontSize: 11, fontWeight: pt?.scoredBy === 'us' ? 800 : 500,
                  color: pt?.scoredBy === 'us' ? '#00e5a0' : pt ? '#e8eaf0' : '#2a2f42',
                  fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {pt ? pt.ourScoreAfter : ''}
                </div>
              )
            })}
          </div>
          <div style={S.row}>
            <div style={{ ...stickyName('#181c26'), height: SCORE_H, display: 'flex', alignItems: 'center',
              paddingLeft: 6, fontSize: 10, fontWeight: 800, color: '#ff4d6d',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
              {setup.opponent.slice(0, 4).toUpperCase()}
            </div>
            {colIndices.map(i => {
              const pt = points[i]
              return (
                <div key={i} style={{ ...colCell(i), height: SCORE_H, lineHeight: SCORE_H + 'px',
                  fontSize: 11, fontWeight: pt?.scoredBy === 'them' ? 800 : 500,
                  color: pt?.scoredBy === 'them' ? '#ff4d6d' : pt ? '#e8eaf0' : '#2a2f42',
                  fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {pt ? pt.theirScoreAfter : ''}
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* ── Score Bar (synced scroll) ── */}
      <div style={S.scoreBarOuter}>
        <div style={S.scoreBarInner} ref={scoreBarRef} onScroll={onScoreScroll}>
          <div style={{ ...S.sbNameCell }}>Score →</div>
          {colIndices.map(i => {
            const pt = points[i]
            return (
              <div key={i} style={{
                width: COL_W, minWidth: COL_W, flexShrink: 0, textAlign: 'center',
                fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: i === curIdx ? 800 : 500,
                color: i === curIdx ? '#00e5a0' : pt ? '#e8eaf0' : '#2a2f42',
                background: colBg(i, curIdx),
              }}>
                {pt ? `${pt.ourScoreAfter}-${pt.theirScoreAfter}` : i === curIdx ? '·' : ''}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionRow({ label, color, stickyName, colIndices, colBgFn, curIdx, secH }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ ...stickyName('rgba(0,0,0,0.4)'), height: secH, display: 'flex', alignItems: 'center',
        paddingLeft: 6, fontSize: 9, fontWeight: 800, color, letterSpacing: 1,
        textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif",
        borderTop: `1px solid ${color}22`, borderBottom: `1px solid ${color}22` }}>
        {label}
      </div>
      {colIndices.map(i => (
        <div key={i} style={{ width: COL_W, minWidth: COL_W, flexShrink: 0, height: secH,
          background: colBgFn(i, curIdx), borderTop: `1px solid ${color}22`, borderBottom: `1px solid ${color}22` }} />
      ))}
    </div>
  )
}

function PlayerRow({ player, colIndices, lines, curIdx, stickyName, colCell, onToggle, rowH, status, onStatusChange }) {
  const unavailable = !!status
  const borderColor = status === 'injured' ? '#f0a500' : status === 'away' ? '#4a5068' : 'transparent'
  const rowOpacity  = status === 'away' ? 0.28 : status === 'injured' ? 0.45 : 1

  return (
    <div style={{ display: 'flex', alignItems: 'center', opacity: rowOpacity }}>
      {/* Name cell — tap to cycle status */}
      <div
        onClick={onStatusChange}
        title={!status ? 'Tap to mark Away' : status === 'away' ? 'Tap to mark Injured' : 'Tap to mark Active'}
        style={{ ...stickyName('#0f1117'), height: rowH, display: 'flex', alignItems: 'center',
          paddingLeft: 4, gap: 3, borderBottom: '1px solid #1a1e2a',
          borderLeft: `3px solid ${borderColor}`,
          overflow: 'hidden', cursor: 'pointer', boxSizing: 'border-box' }}
      >
        <span style={{ fontSize: 12, fontWeight: 700,
          color: status === 'injured' ? '#c8a050' : '#c8ccd8',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: status ? 46 : 54,
          textDecoration: status === 'away' ? 'line-through' : 'none',
          fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {player.name}
        </span>
        {status ? (
          <span style={{ fontSize: 8, fontWeight: 800, flexShrink: 0, padding: '1px 3px', borderRadius: 3,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
            background: status === 'away' ? 'rgba(74,80,104,0.35)' : 'rgba(240,165,0,0.2)',
            color: status === 'away' ? '#7a8099' : '#f0a500' }}>
            {status === 'away' ? 'AWAY' : 'INJ'}
          </span>
        ) : player.position ? (
          <span style={{ fontSize: 9, fontWeight: 700, background: '#1f2435', color: '#5a6280',
            padding: '1px 3px', borderRadius: 3, flexShrink: 0,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
            {POS[player.position] || player.position}
          </span>
        ) : null}
      </div>

      {/* Point cells */}
      {colIndices.map(i => {
        const selected = lines[i]?.has(player.id) || false
        const isPast   = i < curIdx
        return (
          <div key={i}
            onClick={() => !unavailable && onToggle(player.id, i)}
            style={{ ...colCell(i), height: rowH, borderBottom: '1px solid #1a1e2a',
              cursor: unavailable || isPast ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {selected && (
              <div style={{
                width: 14, height: 14, borderRadius: 3,
                background: cellFill(true, i, curIdx),
                border: i > curIdx ? '1px dashed rgba(0,229,160,0.4)' : 'none',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptySection({ label, stickyName, colIndices, colCell, rowH }) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ ...stickyName('#0f1117'), height: rowH, display: 'flex', alignItems: 'center',
        paddingLeft: 6, fontSize: 10, color: '#3a3f52', fontFamily: "'Barlow Condensed', sans-serif" }}>
        {label}
      </div>
      {colIndices.map(i => <div key={i} style={{ ...colCell(i), height: rowH }} />)}
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

  // Header
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    padding: '8px 12px', flexShrink: 0
  },
  scoreBlock: { display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 72 },
  scoreBig: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, color: '#e8eaf0', lineHeight: 1
  },
  scoreSep: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: '#2a2f42', fontWeight: 300 },
  headerCenter: { flex: 1, minWidth: 0 },
  vsLine: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3
  },
  infoLine: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
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
  toBlock: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  toRow:   { display: 'flex', alignItems: 'center', gap: 4 },
  toLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1, minWidth: 24
  },
  toDot:      { width: 14, height: 14, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer' },
  toAvail:    { background: '#00e5a0' },
  toAvailOpp: { background: '#ff4d6d' },
  toUsed:     { background: '#2a2f42', cursor: 'default' },

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

  loading: {
    padding: '2rem', textAlign: 'center', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13
  },

  // Grid
  gridWrap: {
    flex: 1, overflowX: 'auto', overflowY: 'auto',
    background: '#0f1117', minHeight: 0
  },
  row: { display: 'flex', alignItems: 'stretch' },

  // Score bar
  scoreBarOuter: {
    background: '#181c26', borderTop: '2px solid #2a2f42', flexShrink: 0
  },
  scoreBarInner: {
    display: 'flex', alignItems: 'center', overflowX: 'auto',
    padding: '6px 0', scrollbarWidth: 'none'
  },
  sbNameCell: {
    width: NAME_W, minWidth: NAME_W, flexShrink: 0,
    paddingLeft: 6, fontSize: 9, fontWeight: 700, color: '#4a5068',
    textTransform: 'uppercase', letterSpacing: 1,
    fontFamily: "'Barlow Condensed', sans-serif",
    position: 'sticky', left: 0, background: '#181c26', zIndex: 2
  },
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Determine if a given point index was an O or D point for us.
// O = we received (opponent pulled to us)
// D = we pulled (we started on defense)
function getPointType(pointIndex, allPoints, startingAction) {
  if (pointIndex === 0) return startingAction === 'receive' ? 'O' : 'D'
  return allPoints[pointIndex - 1].scored_by === 'them' ? 'O' : 'D'
}

export default function StatsPage({ org, roster }) {
  const [players,  setPlayers]  = useState([])
  const [stats,    setStats]    = useState({})   // keyed by player id
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(null) // player id with inline O/D detail open

  useEffect(() => {
    if (!roster?.id) return
    loadStats()
  }, [roster?.id])

  const loadStats = async () => {
    setLoading(true)
    setExpanded(null)

    // 1. Players
    const { data: playerData } = await supabase
      .from('players').select('id, name, gender, position')
      .eq('roster_id', roster.id).order('name')
    const playerList = playerData || []
    setPlayers(playerList)

    // 2. Completed games for this roster
    const { data: gameData } = await supabase
      .from('games').select('id, starting_action')
      .eq('roster_id', roster.id).eq('status', 'completed')
    const games = gameData || []

    if (games.length === 0) {
      setStats({})
      setLoading(false)
      return
    }

    const gameIds = games.map(g => g.id)
    const startingActionById = Object.fromEntries(games.map(g => [g.id, g.starting_action]))

    // 3. All game_points for those games
    const { data: pointData } = await supabase
      .from('game_points')
      .select('game_id, point_number, scored_by, player_ids, goal_scorer_id, assist_player_id')
      .in('game_id', gameIds)
      .order('game_id').order('point_number')
    const allPoints = pointData || []

    // Group points by game_id so we can determine O/D per point
    const pointsByGame = {}
    allPoints.forEach(pt => {
      if (!pointsByGame[pt.game_id]) pointsByGame[pt.game_id] = []
      pointsByGame[pt.game_id].push(pt)
    })

    // 4. Aggregate per player
    const agg = {}
    playerList.forEach(p => {
      agg[p.id] = {
        gamesPlayed: 0,
        pointsPlayed: 0,
        goals: 0,
        assists: 0,
        pointsAgainst: 0,
        oPointsPlayed: 0,
        dPointsPlayed: 0,
        oPointsFor: 0,
        oPointsAgainst: 0,
        dPointsFor: 0,
        dPointsAgainst: 0,
        _gamesSeen: new Set(),
      }
    })

    Object.entries(pointsByGame).forEach(([gameId, pts]) => {
      const startingAction = startingActionById[gameId] || 'pull'

      pts.forEach((pt, idx) => {
        const playerIds = pt.player_ids || []
        const ptType    = getPointType(idx, pts, startingAction)

        playerIds.forEach(pid => {
          if (!agg[pid]) return
          const a = agg[pid]

          if (!a._gamesSeen.has(gameId)) {
            a._gamesSeen.add(gameId)
            a.gamesPlayed++
          }

          a.pointsPlayed++

          if (ptType === 'O') {
            a.oPointsPlayed++
            if (pt.scored_by === 'us')   a.oPointsFor++
            else                          a.oPointsAgainst++
          } else {
            a.dPointsPlayed++
            if (pt.scored_by === 'us')   a.dPointsFor++
            else                          a.dPointsAgainst++
          }

          if (pt.scored_by === 'them') a.pointsAgainst++
        })

        if (pt.goal_scorer_id  && agg[pt.goal_scorer_id])  agg[pt.goal_scorer_id].goals++
        if (pt.assist_player_id && agg[pt.assist_player_id]) agg[pt.assist_player_id].assists++
      })
    })

    // Clean up helper set
    Object.values(agg).forEach(a => delete a._gamesSeen)

    setStats(agg)
    setLoading(false)
  }

  // +/-: each point on field = +1 if we scored, -1 if they scored
  const pm = (a) => (a.pointsPlayed - a.pointsAgainst) - a.pointsAgainst

  const pmColor = (val) => val > 0 ? '#00e5a0' : val < 0 ? '#ff4d6d' : '#7a8099'
  const pmStr   = (val) => val > 0 ? `+${val}` : `${val}`

  if (!roster) {
    return (
      <div style={s.empty}>
        <div style={{ fontSize: 40 }}>📊</div>
        <p style={s.emptySub}>Select a roster to view stats.</p>
      </div>
    )
  }

  if (loading) {
    return <div style={s.loading}>Loading stats…</div>
  }

  const hasPlayers = players.length > 0

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div style={s.pageTitle}>Player Stats</div>
        <div style={s.rosterLabel}>{roster.name}</div>
      </div>

      {!hasPlayers ? (
        <div style={s.empty}>
          <p style={s.emptySub}>No players in this roster yet.</p>
        </div>
      ) : (
        <div style={s.tableWrap}>
          {/* Column headers */}
          <div style={s.colHeader}>
            <div style={{ ...s.hCell, ...s.nameCol }}>Player</div>
            <div style={s.hCell}>GP</div>
            <div style={{ ...s.hCell, ...s.clickableHdr }}>PTS</div>
            <div style={s.hCell}>G</div>
            <div style={s.hCell}>A</div>
            <div style={s.hCell}>PA</div>
            <div style={s.hCell}>+/-</div>
            <div style={s.hCell}>CAT</div>
            <div style={s.hCell}>DRP</div>
          </div>

          {/* Player rows */}
          {players.map(p => {
            const a   = stats[p.id] || {}
            const val = pm(a)
            const isOpen = expanded === p.id

            return (
              <div key={p.id}>
                <div style={s.playerRow}>
                  <div style={{ ...s.cell, ...s.nameCol }}>
                    <span style={s.playerName}>{p.name}</span>
                  </div>
                  <div style={s.cell}>{a.gamesPlayed ?? 0}</div>

                  {/* Clickable: points played opens O/D breakdown */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    style={{ ...s.cell, ...s.ptsCell }}
                  >
                    {a.pointsPlayed ?? 0}
                    <span style={s.expandCaret}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  <div style={{ ...s.cell, color: '#00e5a0', fontWeight: 800 }}>{a.goals ?? 0}</div>
                  <div style={{ ...s.cell, color: '#4d9fff', fontWeight: 800 }}>{a.assists ?? 0}</div>
                  <div style={{ ...s.cell, color: '#ff4d6d' }}>{a.pointsAgainst ?? 0}</div>
                  <div style={{ ...s.cell, color: pmColor(val), fontWeight: 800 }}>
                    {a.pointsPlayed ? pmStr(val) : '—'}
                  </div>
                  <div style={{ ...s.cell, color: '#4a5068' }}>—</div>
                  <div style={{ ...s.cell, color: '#4a5068' }}>—</div>
                </div>

                {/* Inline O/D breakdown */}
                {isOpen && (
                  <div style={s.breakdown}>
                    <div style={s.breakdownGrid}>
                      <div style={s.bdLabel}>O Points Played</div>
                      <div style={s.bdValue}>{a.oPointsPlayed ?? 0}</div>
                      <div style={s.bdLabel}>O +/-</div>
                      <div style={{ ...s.bdValue, color: pmColor((a.oPointsFor ?? 0) - (a.oPointsAgainst ?? 0)) }}>
                        {a.oPointsPlayed
                          ? pmStr((a.oPointsFor ?? 0) - (a.oPointsAgainst ?? 0))
                          : '—'}
                      </div>
                      <div style={s.bdLabel}>D Points Played</div>
                      <div style={s.bdValue}>{a.dPointsPlayed ?? 0}</div>
                      <div style={s.bdLabel}>D +/-</div>
                      <div style={{ ...s.bdValue, color: pmColor((a.dPointsFor ?? 0) - (a.dPointsAgainst ?? 0)) }}>
                        {a.dPointsPlayed
                          ? pmStr((a.dPointsFor ?? 0) - (a.dPointsAgainst ?? 0))
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Legend */}
          <div style={s.legend}>
            GP = Games Played · PTS = Points Played (tap for O/D) · G = Goals · A = Assists · PA = Points Against · CAT/DRP = coming soon
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: '#0f1117', overflowY: 'auto', minHeight: 0,
  },
  headerRow: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    padding: '18px 16px 10px',
  },
  pageTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 2,
  },
  rosterLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1,
  },
  loading: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#4a5068',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  emptySub: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#4a5068',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  tableWrap: {
    flex: 1, overflowY: 'auto', overflowX: 'auto', paddingBottom: 32,
  },
  colHeader: {
    display: 'flex', alignItems: 'center',
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    position: 'sticky', top: 0, zIndex: 4,
    minWidth: 560,
  },
  hCell: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1.2,
    padding: '6px 0', textAlign: 'center', flex: 1, minWidth: 38,
  },
  clickableHdr: { color: '#00e5a0' },
  nameCol: { flex: 3, minWidth: 110, textAlign: 'left', paddingLeft: 14 },
  playerRow: {
    display: 'flex', alignItems: 'center',
    borderBottom: '1px solid #1a1e2a',
    minWidth: 560,
  },
  cell: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
    color: '#e8eaf0', textAlign: 'center',
    flex: 1, minWidth: 38, padding: '10px 0',
  },
  ptsCell: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    color: '#00e5a0',
  },
  expandCaret: {
    fontSize: 7, color: '#4a5068', lineHeight: 1,
  },
  playerName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
    color: '#e8eaf0', letterSpacing: 0.3,
  },
  breakdown: {
    background: '#12151f', borderBottom: '1px solid #2a2f42',
    padding: '10px 14px 12px',
    minWidth: 560,
  },
  breakdownGrid: {
    display: 'grid', gridTemplateColumns: '1fr auto 1fr auto',
    gap: '6px 20px', maxWidth: 380,
  },
  bdLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1,
    display: 'flex', alignItems: 'center',
  },
  bdValue: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    color: '#e8eaf0', textAlign: 'right', minWidth: 32,
  },
  legend: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#2a2f42',
    padding: '14px 14px 0', letterSpacing: 0.5, lineHeight: 1.6,
    minWidth: 560,
  },
}

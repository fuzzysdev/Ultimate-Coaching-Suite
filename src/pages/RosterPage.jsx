import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PlayerModal from '../Components/PlayerModal'
import ConfirmDialog from '../Components/ConfirmDialog'

function RosterPage({ roster, onBack }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [deletingPlayer, setDeletingPlayer] = useState(null)
  const [sortField, setSortField] = useState('name')

  useEffect(() => { fetchPlayers() }, [])

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('players').select('id, name, grade, gender, position, created_at')
        .eq('roster_id', roster.id).order('name', { ascending: true })
      if (error) throw error
      setPlayers(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlayer = async (playerData) => {
    const { error } = await supabase.from('players').insert({
      name: playerData.name,
      grade: playerData.grade,
      gender: playerData.gender,
      position: playerData.position || null,
      roster_id: roster.id
    })
    if (error) throw error
    setShowPlayerModal(false)
    fetchPlayers()
  }

  const handleEditPlayer = async (playerData) => {
    const { error } = await supabase.from('players').update({
      name: playerData.name,
      grade: playerData.grade,
      gender: playerData.gender,
      position: playerData.position || null,
    }).eq('id', editingPlayer.id)
    if (error) throw error
    setEditingPlayer(null)
    fetchPlayers()
  }

  const handleDeletePlayer = async () => {
    const { error } = await supabase.from('players').delete().eq('id', deletingPlayer.id)
    if (error) throw error
    setDeletingPlayer(null)
    fetchPlayers()
  }

  const sortedPlayers = [...players].sort((a, b) => (a[sortField] || '').localeCompare(b[sortField] || ''))

  const genderCounts = players.reduce((acc, p) => {
    const key = p.gender || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const s = styles
  return (
    <div style={s.container}>
      {showPlayerModal && <PlayerModal roster={roster} onSave={handleAddPlayer} onClose={() => setShowPlayerModal(false)} />}
      {editingPlayer && <PlayerModal player={editingPlayer} roster={roster} onSave={handleEditPlayer} onClose={() => setEditingPlayer(null)} />}
      {deletingPlayer && <ConfirmDialog message={`Remove ${deletingPlayer.name} from this roster?`} onConfirm={handleDeletePlayer} onCancel={() => setDeletingPlayer(null)} />}

      {/* Page Header */}
      <div style={s.pageHeader}>
        <button onClick={onBack} style={s.backBtn}>← Rosters</button>
        <div style={s.headerCenter}>
          <h2 style={s.rosterTitle}>{roster.name}</h2>
          <p style={s.muted}>{players.length} player{players.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowPlayerModal(true)} style={s.addBtn}>+ Add Player</button>
      </div>

      {/* Gender Summary Chips */}
      {players.length > 0 && (
        <div style={s.summary}>
          {Object.entries(genderCounts).map(([gender, count]) => (
            <div key={gender} style={s.chip}>
              <span style={s.chipCount}>{count}</span>
              <span style={s.chipLabel}>{gender}</span>
            </div>
          ))}
        </div>
      )}

      {error && <div style={s.error}>{error}</div>}

      {/* Sort Bar */}
      {players.length > 0 && (
        <div style={s.sortBar}>
          <span style={s.muted}>Sort by:</span>
          {['name', ...(roster.age_group !== 'adult' ? ['grade'] : []), 'gender'].map(field => (
            <button
              key={field}
              onClick={() => setSortField(field)}
              style={{ ...s.sortBtn, ...(sortField === field ? s.sortBtnActive : {}) }}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Players Table */}
      {loading ? (
        <p style={s.muted}>Loading players...</p>
      ) : players.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
          <p>No players yet.</p>
          <button onClick={() => setShowPlayerModal(true)} style={{ ...s.addBtn, marginTop: '1rem' }}>
            + Add your first player
          </button>
        </div>
      ) : (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', ...(roster.age_group !== 'adult' ? ['Grade'] : []), 'Gender', 'Position', ''].map(h => (
                  <th key={h} style={{ ...s.th, ...(h === '' ? { textAlign: 'right' } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, i) => (
                <tr key={player.id} style={{ background: i % 2 === 0 ? '#181c26' : '#1a1e2a' }}>
                  <td style={s.td}><strong style={{ color: '#e8eaf0' }}>{player.name}</strong></td>
                  {roster.age_group !== 'adult' && (
                    <td style={s.td}>{player.grade || <span style={s.muted}>—</span>}</td>
                  )}
                  <td style={s.td}>
                    {player.gender ? (
                      <span style={{
                        ...s.badge,
                        background: player.gender === 'Male' ? 'rgba(77,159,255,0.15)' : 'rgba(255,128,200,0.15)',
                        color: player.gender === 'Male' ? '#4d9fff' : '#ff80c8'
                      }}>
                        {player.gender}
                      </span>
                    ) : <span style={s.muted}>—</span>}
                  </td>
                  <td style={s.td}>
                    {player.position ? (
                      <span style={{ ...s.badge, background: 'rgba(120,100,255,0.15)', color: '#a89aff' }}>
                        {{ h: 'Handler', c: 'Cutter', b: 'Hybrid', e: 'Either' }[player.position] || player.position}
                      </span>
                    ) : <span style={s.muted}>—</span>}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <button onClick={() => setEditingPlayer(player)} style={s.editBtn}>Edit</button>
                    <button onClick={() => setDeletingPlayer(player)} style={s.removeBtn}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { flex: 1, padding: '1.5rem', overflowY: 'auto' },
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap'
  },
  backBtn: {
    background: 'none', border: 'none', color: '#00e5a0', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700',
    fontSize: '14px', letterSpacing: '0.5px', textTransform: 'uppercase'
  },
  headerCenter: { flex: 1, textAlign: 'center' },
  rosterTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.5rem',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: 0
  },
  addBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '8px 18px', borderRadius: '7px',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  summary: { display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' },
  chip: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '9999px',
    padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px'
  },
  chipCount: { fontWeight: '800', color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.1rem' },
  chipLabel: { color: '#7a8099', fontSize: '0.8rem' },
  sortBar: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' },
  sortBtn: {
    padding: '8px 14px', border: '1px solid #2a2f42', borderRadius: '9999px',
    background: '#181c26', cursor: 'pointer', fontSize: '0.85rem', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.5px', minHeight: 36
  },
  sortBtnActive: { background: '#00e5a0', color: '#0f1117', borderColor: '#00e5a0' },
  tableWrapper: {
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: '10px', overflow: 'hidden'
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 12px', textAlign: 'left',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
    fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: '#7a8099', borderBottom: '1px solid #2a2f42', background: '#1f2435'
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #2a2f42', color: '#7a8099', fontSize: '14px' },
  badge: {
    display: 'inline-block', fontSize: '11px', fontWeight: '700',
    padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.5px'
  },
  editBtn: {
    background: 'none', border: '1px solid transparent', color: '#7a8099',
    padding: '8px 12px', borderRadius: '5px', cursor: 'pointer',
    fontSize: '13px', marginRight: '4px', transition: 'all 0.15s',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700', textTransform: 'uppercase',
    minHeight: 36
  },
  removeBtn: {
    background: 'none', border: '1px solid transparent', color: '#7a8099',
    padding: '8px 12px', borderRadius: '5px', cursor: 'pointer',
    fontSize: '13px', transition: 'all 0.15s',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700', textTransform: 'uppercase',
    minHeight: 36
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '200px', color: '#7a8099'
  },
  muted: { color: '#7a8099', fontSize: '0.85rem' },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem'
  }
}

export default RosterPage

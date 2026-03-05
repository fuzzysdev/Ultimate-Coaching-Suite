import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../Components/ConfirmDialog'

const GRADES = ['6th', '7th', '8th', '9th', '10th', '11th', '12th', 'College', 'Adult']
const GENDERS = ['Female', 'Male']

function TryoutSessionPage({ tryout, org, session, onBack }) {
  const [players, setPlayers] = useState([])
  const [rankings, setRankings] = useState(tryout.rankings || { M: [], F: [] })
  const [cutIndex, setCutIndex] = useState(tryout.cut_index || { M: 3, F: 3 })
  const [bubbleIndex, setBubbleIndex] = useState(tryout.bubble_index || { M: 2, F: 2 })
  const [notes, setNotes] = useState({})
  const [view, setView] = useState('rankings')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add player form
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [newGender, setNewGender] = useState('M')
  const [saving, setSaving] = useState(false)

  // Notes modal
  const [notesPlayerId, setNotesPlayerId] = useState(null)
  const [notesText, setNotesText] = useState('')

  // Edit modal
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState('')
  const [editGender, setEditGender] = useState('')

  // Rosters for promote
  const [rosters, setRosters] = useState([])
  const [promotingPlayer, setPromotingPlayer] = useState(null)
  const [selectedRoster, setSelectedRoster] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoteSuccess, setPromoteSuccess] = useState(null)

  // Remove confirmation
  const [removingPlayer, setRemovingPlayer] = useState(null)

  // Drag state
  const dragSrc = useRef(null)
  const dragGender = useRef(null)

  useEffect(() => {
    fetchPlayers()
    fetchRosters()
  }, [])

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tryout_players')
        .select('id, name, grade, gender, notes')
        .eq('tryout_id', tryout.id)
      if (error) throw error
      const playerList = data || []
      setPlayers(playerList)

      // Build notes map
      const notesMap = {}
      playerList.forEach(p => { if (p.notes) notesMap[p.id] = p.notes })
      setNotes(notesMap)

      // Sync rankings
      syncRankings(playerList, rankings, cutIndex, bubbleIndex)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchRosters = async () => {
    const { data } = await supabase
      .from('rosters').select('id, name')
      .eq('organization_id', org.id).order('name')
    setRosters(data || [])
  }

  const syncRankings = (playerList, r, cut, bubble) => {
    const newR = { ...r }
    ;['M', 'F'].forEach(g => {
      const gIds = playerList.filter(p => p.gender === g).map(p => p.id)
      newR[g] = (newR[g] || []).filter(id => gIds.includes(id))
      gIds.forEach(id => { if (!newR[g].includes(id)) newR[g].push(id) })
    })
    setRankings(newR)
    return newR
  }

  const saveToDb = async (newRankings, newCut, newBubble) => {
    await supabase.from('tryouts').update({
      rankings: newRankings,
      cut_index: newCut,
      bubble_index: newBubble
    }).eq('id', tryout.id)
  }

  // ── ADD PLAYER ──
  const handleAddPlayer = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('tryout_players')
        .insert({ tryout_id: tryout.id, name: newName.trim(), grade: newGrade || null, gender: newGender })
        .select()
        .single()
      if (error) throw error

      const newPlayers = [...players, data]
      setPlayers(newPlayers)
      const newR = { ...rankings }
      newR[newGender] = [...(newR[newGender] || []), data.id]
      setRankings(newR)
      await saveToDb(newR, cutIndex, bubbleIndex)
      setNewName('')
      setNewGrade('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── REMOVE PLAYER ──
  const handleRemovePlayer = async () => {
    const id = removingPlayer.id
    setRemovingPlayer(null)
    await supabase.from('tryout_players').delete().eq('id', id)
    const newPlayers = players.filter(x => x.id !== id)
    setPlayers(newPlayers)
    const newR = { M: rankings.M.filter(x => x !== id), F: rankings.F.filter(x => x !== id) }
    setRankings(newR)
    await saveToDb(newR, cutIndex, bubbleIndex)
  }

  // ── EDIT PLAYER ──
  const openEdit = (player) => {
    setEditingPlayer(player)
    setEditName(player.name)
    setEditGrade(player.grade || '')
    setEditGender(player.gender)
  }

  const handleSaveEdit = async () => {
    if (!editName.trim()) return
    const oldGender = editingPlayer.gender
    const { error } = await supabase
      .from('tryout_players')
      .update({ name: editName.trim(), grade: editGrade || null, gender: editGender })
      .eq('id', editingPlayer.id)
    if (error) return setError(error.message)

    const newPlayers = players.map(p =>
      p.id === editingPlayer.id ? { ...p, name: editName.trim(), grade: editGrade, gender: editGender } : p
    )
    setPlayers(newPlayers)

    // Move in rankings if gender changed
    let newR = { ...rankings }
    if (editGender !== oldGender) {
      newR[oldGender] = newR[oldGender].filter(x => x !== editingPlayer.id)
      newR[editGender] = [...(newR[editGender] || []), editingPlayer.id]
      setRankings(newR)
      await saveToDb(newR, cutIndex, bubbleIndex)
    }
    setEditingPlayer(null)
  }

  // ── NOTES ──
  const openNotes = (id) => {
    setNotesPlayerId(id)
    setNotesText(notes[id] || '')
  }

  const handleSaveNotes = async () => {
    await supabase.from('tryout_players').update({ notes: notesText }).eq('id', notesPlayerId)
    setNotes(prev => ({ ...prev, [notesPlayerId]: notesText }))
    setNotesPlayerId(null)
  }

  // ── MOVE CARD ──
  const moveCard = async (gender, index, dir) => {
    const list = [...rankings[gender]]
    const ni = index + dir
    if (ni < 0 || ni >= list.length) return
    ;[list[index], list[ni]] = [list[ni], list[index]]
    const newR = { ...rankings, [gender]: list }
    setRankings(newR)
    await saveToDb(newR, cutIndex, bubbleIndex)
  }

  // ── MOVE CUT / BUBBLE ──
  const moveCut = async (gender, dir) => {
    const newCut = {
      ...cutIndex,
      [gender]: Math.max(bubbleIndex[gender], Math.min(rankings[gender].length, cutIndex[gender] + dir))
    }
    setCutIndex(newCut)
    await saveToDb(rankings, newCut, bubbleIndex)
  }

  const moveBubble = async (gender, dir) => {
    const newBubble = {
      ...bubbleIndex,
      [gender]: Math.max(0, Math.min(cutIndex[gender], bubbleIndex[gender] + dir))
    }
    setBubbleIndex(newBubble)
    await saveToDb(rankings, cutIndex, newBubble)
  }

  // ── DRAG AND DROP ──
  const onDragStart = (e, id, gender, index) => {
    dragSrc.current = { id, index }
    dragGender.current = gender
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e) => { e.preventDefault() }

  const onDrop = async (e, toIndex, gender) => {
    e.preventDefault()
    if (!dragSrc.current || dragGender.current !== gender) return
    const fromIndex = dragSrc.current.index
    if (fromIndex === toIndex) return
    const list = [...rankings[gender]]
    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    const newR = { ...rankings, [gender]: list }
    setRankings(newR)
    dragSrc.current = null
    await saveToDb(newR, cutIndex, bubbleIndex)
  }

  // ── PROMOTE ──
  const handlePromote = async () => {
    if (!selectedRoster) return
    setPromoting(true)
    try {
      const p = promotingPlayer
      const { error } = await supabase.from('players').insert({
        roster_id: selectedRoster, name: p.name, grade: p.grade, gender: p.gender === 'M' ? 'Male' : 'Female'
      })
      if (error) throw error
      setPromotingPlayer(null)
      setSelectedRoster('')
      setPromoteSuccess(`${p.name} added to roster!`)
    } catch (err) {
      setError(err.message)
    } finally {
      setPromoting(false)
    }
  }

  // ── EXPORT ──
  const getZone = (i, gender) => {
    if (i < bubbleIndex[gender]) return 'keep'
    if (i < cutIndex[gender]) return 'bubble'
    return 'cut'
  }

  const buildExportText = (rosterOnly) => {
    const lines = [rosterOnly ? 'FINAL ROSTER' : 'FULL TRYOUT RANKINGS', '====================', '']
    ;['M', 'F'].forEach(g => {
      lines.push(`--- ${g === 'M' ? 'MALE' : 'FEMALE'} ---`)
      rankings[g].forEach((id, i) => {
        const p = players.find(x => x.id === id)
        if (!p) return
        const zone = getZone(i, g)
        const status = zone === 'keep' ? 'KEEP' : zone === 'bubble' ? 'BUBBLE' : 'CUT'
        if (rosterOnly && zone === 'cut') return
        const note = notes[id] ? ' | ' + notes[id].replace(/\n/g, ' ') : ''
        lines.push(`${String(i + 1).padStart(2, '0')}. ${p.name} (Gr.${p.grade || '?'}) [${status}]${rosterOnly ? '' : note}`)
      })
      lines.push('')
    })
    return lines.join('\n')
  }

  const buildCSV = (rosterOnly) => {
    const rows = [['Rank', 'Name', 'Gender', 'Grade', 'Status', 'Notes']]
    ;['M', 'F'].forEach(g => {
      rankings[g].forEach((id, i) => {
        const p = players.find(x => x.id === id)
        if (!p) return
        const zone = getZone(i, g)
        const status = zone === 'keep' ? 'KEEP' : zone === 'bubble' ? 'BUBBLE' : 'CUT'
        if (rosterOnly && zone === 'cut') return
        rows.push([i + 1, p.name, g === 'M' ? 'Male' : 'Female', p.grade || '', status, notes[id] || ''])
      })
    })
    return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  }

  const copyText = (text) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const downloadCSV = (rosterOnly) => {
    const csv = buildCSV(rosterOnly)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = (rosterOnly ? 'roster' : 'full-rankings') + '.csv'
    a.click()
  }

  const getPlayer = (id) => players.find(p => p.id === id)

  const s = styles
  const sc = scoreStyles

  // ── RENDER COLUMN ──
  const renderColumn = (gender) => {
    const ids = rankings[gender] || []
    const bubAt = Math.min(bubbleIndex[gender], ids.length)
    const cutAt = Math.min(cutIndex[gender], ids.length)
    const items = []

    ids.forEach((id, i) => {
      const p = getPlayer(id)
      if (!p) return
      const zone = getZone(i, gender)
      const hasNote = notes[id] && notes[id].trim()

      // Insert bubble divider before this item if needed
      if (i === bubAt && i > 0) {
        items.push(
          <div key={`bubble-${gender}`} style={sc.divider}>
            <div style={sc.dividerLine('bubble')} />
            <div style={sc.dividerPill('bubble')}>
              <div style={sc.dividerArrows}>
                <button style={sc.arrowBtn} onClick={() => moveBubble(gender, -1)}>▲</button>
                <button style={sc.arrowBtn} onClick={() => moveBubble(gender, 1)}>▼</button>
              </div>
              🫧 Bubble
            </div>
            <div style={sc.dividerLine('bubble')} />
          </div>
        )
      }

      // Insert cut divider before this item if needed
      if (i === cutAt && i > 0 && cutAt !== bubAt) {
        items.push(
          <div key={`cut-${gender}`} style={sc.divider}>
            <div style={sc.dividerLine('cut')} />
            <div style={sc.dividerPill('cut')}>
              <div style={sc.dividerArrows}>
                <button style={sc.arrowBtn} onClick={() => moveCut(gender, -1)}>▲</button>
                <button style={sc.arrowBtn} onClick={() => moveCut(gender, 1)}>▼</button>
              </div>
              ✂ Cut Line
            </div>
            <div style={sc.dividerLine('cut')} />
          </div>
        )
      }

      const zoneColor = zone === 'keep' ? '#00e5a0' : zone === 'bubble' ? '#a78bfa' : '#ff4d6d'
      const cardBg = zone === 'keep' ? 'rgba(0,229,160,0.04)' : zone === 'bubble' ? 'rgba(167,139,250,0.06)' : 'rgba(255,77,109,0.04)'
      const cardBorder = zone === 'keep' ? 'rgba(0,229,160,0.2)' : zone === 'bubble' ? 'rgba(167,139,250,0.2)' : 'rgba(255,77,109,0.2)'

      items.push(
        <div
          key={id}
          draggable
          onDragStart={(e) => onDragStart(e, id, gender, i)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, i, gender)}
          style={{ ...sc.card, background: cardBg, borderColor: cardBorder }}
        >
          <div style={sc.dragHandle}>
            <span /><span /><span />
          </div>
          <div style={sc.cardInfo}>
            <div style={sc.cardName}>{p.name}</div>
            <div style={sc.cardMeta}>
              {p.grade ? `Grade ${p.grade}` : 'No grade'} ·{' '}
              <span style={{ color: zoneColor }}>
                {zone === 'keep' ? '✓ Keep' : zone === 'bubble' ? '◈ Bubble' : '✗ Cut'}
              </span>
            </div>
          </div>
          <div style={sc.cardActions}>
            <button style={sc.moveBtn} onClick={() => moveCard(gender, i, -1)}>▲</button>
            <button style={sc.moveBtn} onClick={() => moveCard(gender, i, 1)}>▼</button>
            <button
              style={{ ...sc.notesBtn, ...(hasNote ? sc.notesBtnActive : {}) }}
              onClick={() => openNotes(id)}
            >
              {hasNote ? '📝' : '🗒️'}
            </button>
            <button style={sc.editBtn} onClick={() => openEdit(p)}>✏️</button>
            <button style={sc.removeBtn} onClick={() => setRemovingPlayer(p)}>✕</button>
            <button style={sc.promoteBtn} onClick={() => setPromotingPlayer(p)}>→</button>
          </div>
        </div>
      )

      // Dividers at end if needed
      if (i === ids.length - 1) {
        if (bubAt > ids.length) {
          items.push(
            <div key={`bubble-end-${gender}`} style={sc.divider}>
              <div style={sc.dividerLine('bubble')} />
              <div style={sc.dividerPill('bubble')}>
                <div style={sc.dividerArrows}>
                  <button style={sc.arrowBtn} onClick={() => moveBubble(gender, -1)}>▲</button>
                  <button style={sc.arrowBtn} onClick={() => moveBubble(gender, 1)}>▼</button>
                </div>
                🫧 Bubble
              </div>
              <div style={sc.dividerLine('bubble')} />
            </div>
          )
        }
        if (cutAt > ids.length) {
          items.push(
            <div key={`cut-end-${gender}`} style={sc.divider}>
              <div style={sc.dividerLine('cut')} />
              <div style={sc.dividerPill('cut')}>
                <div style={sc.dividerArrows}>
                  <button style={sc.arrowBtn} onClick={() => moveCut(gender, -1)}>▲</button>
                  <button style={sc.arrowBtn} onClick={() => moveCut(gender, 1)}>▼</button>
                </div>
                ✂ Cut Line
              </div>
              <div style={sc.dividerLine('cut')} />
            </div>
          )
        }
      }
    })

    // If no players, show dividers at top
    if (ids.length === 0) {
      items.push(
        <div key={`bubble-empty-${gender}`} style={sc.divider}>
          <div style={sc.dividerLine('bubble')} />
          <div style={sc.dividerPill('bubble')}>🫧 Bubble</div>
          <div style={sc.dividerLine('bubble')} />
        </div>
      )
      items.push(
        <div key={`cut-empty-${gender}`} style={sc.divider}>
          <div style={sc.dividerLine('cut')} />
          <div style={sc.dividerPill('cut')}>✂ Cut Line</div>
          <div style={sc.dividerLine('cut')} />
        </div>
      )
    }

    return items
  }

  return (
    <div style={s.container}>
      {removingPlayer && (
        <ConfirmDialog
          message={`Remove ${removingPlayer.name} from this tryout?`}
          onConfirm={handleRemovePlayer}
          onCancel={() => setRemovingPlayer(null)}
        />
      )}
      {promoteSuccess && (
        <div style={s.successBanner} onClick={() => setPromoteSuccess(null)}>
          {promoteSuccess} ✓
        </div>
      )}
      {/* Notes Modal */}
      {notesPlayerId && (
        <div style={s.overlay} onClick={() => setNotesPlayerId(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                📝 {getPlayer(notesPlayerId)?.name}
              </h2>
              <button onClick={() => setNotesPlayerId(null)} style={s.closeBtn}>✕</button>
            </div>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Add notes about this player..."
              style={s.textarea}
              autoFocus
            />
            <button onClick={handleSaveNotes} style={s.saveBtn}>Save Notes</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPlayer && (
        <div style={s.overlay} onClick={() => setEditingPlayer(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Edit Player</h2>
              <button onClick={() => setEditingPlayer(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.field}>
              <label style={s.label}>Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Grade</label>
                <select value={editGrade} onChange={e => setEditGrade(e.target.value)}>
                  <option value="">--</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Gender</label>
                <select value={editGender} onChange={e => setEditGender(e.target.value)}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
            <button onClick={handleSaveEdit} style={s.saveBtn}>Save Changes</button>
          </div>
        </div>
      )}

      {/* Promote Modal */}
      {promotingPlayer && (
        <div style={s.overlay} onClick={() => setPromotingPlayer(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Promote {promotingPlayer.name}</h2>
              <button onClick={() => setPromotingPlayer(null)} style={s.closeBtn}>✕</button>
            </div>
            <p style={s.muted}>Select a roster to add this player to:</p>
            <div style={{ margin: '1rem 0 1.5rem' }}>
              {rosters.length === 0 ? (
                <p style={s.muted}>No rosters found. Create a roster first.</p>
              ) : rosters.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoster(r.id)}
                  style={{
                    ...s.rosterOption,
                    ...(selectedRoster === r.id ? s.rosterOptionActive : {})
                  }}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <button
              onClick={handlePromote}
              disabled={!selectedRoster || promoting}
              style={s.saveBtn}
            >
              {promoting ? 'Adding...' : 'Add to Roster'}
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={s.pageHeader}>
        <button onClick={onBack} style={s.backBtn}>← Tryouts</button>
        <div style={s.headerCenter}>
          <h2 style={s.mainTitle}>{tryout.name}</h2>
          <p style={s.muted}>{players.length} candidate{players.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ width: '80px' }} />
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {[
          { key: 'rankings', label: '🏆 Rankings' },
          { key: 'add', label: '➕ Add Players' },
          { key: 'export', label: '📤 Export' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            style={{ ...s.tab, ...(view === t.key ? s.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* ── RANKINGS VIEW ── */}
      {view === 'rankings' && (
        loading ? <p style={s.muted}>Loading...</p> : (
          <div style={s.rankLayout}>
            {/* Male Column */}
            <div style={s.rankColumn}>
              <div style={s.colHeader}>
                <h3 style={{ ...s.colTitle, color: '#4d9fff' }}>Male</h3>
                <span style={s.colCount}>
                  {bubbleIndex.M} kept · {cutIndex.M - bubbleIndex.M} bubble
                </span>
              </div>
              <div>{renderColumn('M')}</div>
            </div>

            {/* Female Column */}
            <div style={s.rankColumn}>
              <div style={s.colHeader}>
                <h3 style={{ ...s.colTitle, color: '#ff80c8' }}>Female</h3>
                <span style={s.colCount}>
                  {bubbleIndex.F} kept · {cutIndex.F - bubbleIndex.F} bubble
                </span>
              </div>
              <div>{renderColumn('F')}</div>
            </div>
          </div>
        )
      )}

      {/* ── ADD PLAYERS VIEW ── */}
      {view === 'add' && (
        <div style={s.addContainer}>
          <form onSubmit={handleAddPlayer} style={s.form}>
            <h3 style={s.formTitle}>Add Candidate</h3>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Player's full name"
                  required
                  autoFocus
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Grade</label>
                <select value={newGrade} onChange={e => setNewGrade(e.target.value)}>
                  <option value="">-- Select --</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Gender</label>
                <select value={newGender} onChange={e => setNewGender(e.target.value)}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <button type="submit" disabled={saving} style={s.addBtn}>
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          {/* Players list */}
          {players.length > 0 && (
            <div style={s.tableWrapper}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Grade</th>
                    <th style={s.th}>Gender</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#181c26' : '#1a1e2a' }}>
                      <td style={s.td}><strong style={{ color: '#e8eaf0' }}>{p.name}</strong></td>
                      <td style={s.td}>{p.grade || <span style={s.muted}>—</span>}</td>
                      <td style={s.td}>
                        <span style={{
                          ...s.badge,
                          background: p.gender === 'M' ? 'rgba(77,159,255,0.15)' : 'rgba(255,128,200,0.15)',
                          color: p.gender === 'M' ? '#4d9fff' : '#ff80c8'
                        }}>
                          {p.gender === 'M' ? 'Male' : 'Female'}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <button onClick={() => openEdit(p)} style={s.iconBtn}>✏️</button>
                        <button onClick={() => setRemovingPlayer(p)} style={s.iconBtn}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EXPORT VIEW ── */}
      {view === 'export' && (
        <div style={s.exportContainer}>
          <div style={s.exportSection}>
            <h3 style={s.exportTitle}>Final Roster (Keep only)</h3>
            <div style={s.exportBox}>
              <pre style={s.exportText}>{buildExportText(true)}</pre>
              <div style={s.exportActions}>
                <button onClick={() => copyText(buildExportText(true))} style={s.exportBtn}>Copy Text</button>
                <button onClick={() => downloadCSV(true)} style={{ ...s.exportBtn, ...s.exportBtnPrimary }}>Download CSV</button>
              </div>
            </div>
          </div>

          <div style={s.exportSection}>
            <h3 style={s.exportTitle}>Full Rankings (All players)</h3>
            <div style={s.exportBox}>
              <pre style={s.exportText}>{buildExportText(false)}</pre>
              <div style={s.exportActions}>
                <button onClick={() => copyText(buildExportText(false))} style={s.exportBtn}>Copy Text</button>
                <button onClick={() => downloadCSV(false)} style={{ ...s.exportBtn, ...s.exportBtnPrimary }}>Download CSV</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { padding: '1.5rem', flex: 1, overflowY: 'auto' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px 16px 0 0',
    width: '100%', maxWidth: '600px', padding: '24px 20px 36px'
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase'
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer'
  },
  textarea: {
    width: '100%', background: '#0f1117', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: "'Barlow', sans-serif", fontSize: '15px', lineHeight: '1.6',
    padding: '12px', borderRadius: '8px', resize: 'none', minHeight: '180px',
    outline: 'none', marginBottom: '14px'
  },
  rosterOption: {
    display: 'block', width: '100%', textAlign: 'left',
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '600',
    fontSize: '15px', padding: '10px 14px', borderRadius: '7px',
    cursor: 'pointer', marginBottom: '6px'
  },
  rosterOptionActive: {
    background: 'rgba(0,229,160,0.1)', borderColor: 'rgba(0,229,160,0.4)', color: '#00e5a0'
  },
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.25rem', gap: '1rem'
  },
  backBtn: {
    background: 'none', border: 'none', color: '#00e5a0', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700',
    fontSize: '14px', textTransform: 'uppercase'
  },
  headerCenter: { flex: 1, textAlign: 'center' },
  mainTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.5rem',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: 0
  },
  tabs: { display: 'flex', gap: '4px', marginBottom: '1.5rem' },
  tab: {
    flex: 1, background: 'none', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  tabActive: { background: '#00e5a0', borderColor: '#00e5a0', color: '#0f1117' },
  rankLayout: { display: 'flex', gap: '16px' },
  rankColumn: { flex: 1, minWidth: 0 },
  colHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #2a2f42'
  },
  colTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
    fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', margin: 0
  },
  colCount: { fontSize: '12px', color: '#7a8099', fontWeight: '600' },
  addContainer: { maxWidth: '900px' },
  form: {
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem'
  },
  formTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase',
    marginBottom: '1rem'
  },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '130px' },
  label: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '1px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  addBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '10px 20px', borderRadius: '7px',
    textTransform: 'uppercase', alignSelf: 'flex-end', cursor: 'pointer'
  },
  saveBtn: {
    width: '100%', background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: '800',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  tableWrapper: { background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 12px', textAlign: 'left',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: '#7a8099', borderBottom: '1px solid #2a2f42', background: '#1f2435'
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #2a2f42', color: '#7a8099', fontSize: '14px' },
  badge: {
    display: 'inline-block', fontSize: '11px', fontWeight: '700',
    padding: '2px 8px', borderRadius: '20px'
  },
  iconBtn: {
    background: 'none', border: '1px solid transparent', color: '#7a8099',
    padding: '4px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', marginLeft: '4px'
  },
  exportContainer: { maxWidth: '800px' },
  exportSection: { marginBottom: '2rem' },
  exportTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '12px'
  },
  exportBox: { background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', padding: '16px' },
  exportText: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: '7px',
    padding: '14px', fontFamily: 'monospace', fontSize: '13px', color: '#e8eaf0',
    whiteSpace: 'pre', overflowX: 'auto', marginBottom: '12px',
    maxHeight: '280px', overflowY: 'auto', lineHeight: '1.6', display: 'block'
  },
  exportActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  exportBtn: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '8px 16px', borderRadius: '7px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  exportBtnPrimary: { background: '#00e5a0', color: '#0f1117', borderColor: '#00e5a0' },
  muted: { color: '#7a8099', fontSize: '0.85rem' },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem'
  },
  successBanner: {
    position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,229,160,0.15)', border: '1px solid rgba(0,229,160,0.4)',
    color: '#00e5a0', padding: '0.75rem 1.5rem', borderRadius: '8px',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700',
    fontSize: '14px', letterSpacing: '0.5px', zIndex: 600, cursor: 'pointer'
  }
}

const scoreStyles = {
  card: {
    display: 'flex', alignItems: 'center', gap: '8px',
    border: '1px solid', borderRadius: '10px',
    padding: '10px', marginBottom: '6px', cursor: 'grab'
  },
  dragHandle: {
    display: 'flex', flexDirection: 'column', gap: '5px',
    padding: '8px 10px', flexShrink: 0
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: {
    fontWeight: '600', fontSize: '14px', color: '#e8eaf0',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  },
  cardMeta: { fontSize: '11px', color: '#7a8099', marginTop: '2px' },
  cardActions: { display: 'flex', gap: '4px', alignItems: 'center' },
  moveBtn: {
    background: 'none', border: '1px solid transparent', cursor: 'pointer',
    color: '#7a8099', padding: '8px 10px', borderRadius: '6px', fontSize: '13px',
    transition: 'all 0.12s', minWidth: 36, textAlign: 'center'
  },
  notesBtn: {
    background: 'none', border: '1px solid transparent', cursor: 'pointer',
    padding: '8px 10px', borderRadius: '6px', fontSize: '15px', minWidth: 36, textAlign: 'center'
  },
  notesBtnActive: { color: '#00e5a0' },
  editBtn: {
    background: 'none', border: '1px solid transparent', cursor: 'pointer',
    color: '#7a8099', padding: '8px 10px', borderRadius: '6px', fontSize: '14px',
    minWidth: 36, textAlign: 'center'
  },
  removeBtn: {
    background: 'none', border: '1px solid transparent', cursor: 'pointer',
    color: '#7a8099', padding: '8px 10px', borderRadius: '6px', fontSize: '13px',
    minWidth: 36, textAlign: 'center'
  },
  promoteBtn: {
    background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)',
    cursor: 'pointer', color: '#00e5a0', padding: '8px 10px',
    borderRadius: '6px', fontSize: '13px', fontWeight: '700', minWidth: 36, textAlign: 'center'
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: '8px',
    margin: '4px 0', padding: '5px 0'
  },
  dividerLine: (type) => ({
    flex: 1, height: '2px',
    background: type === 'cut' ? '#f5a623' : '#a78bfa',
    borderRadius: '2px'
  }),
  dividerPill: (type) => ({
    display: 'flex', alignItems: 'center', gap: '5px',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: type === 'cut' ? '#f5a623' : '#a78bfa',
    whiteSpace: 'nowrap', padding: '4px 10px',
    border: `1px solid ${type === 'cut' ? '#f5a623' : '#a78bfa'}`,
    borderRadius: '20px',
    background: type === 'cut' ? 'rgba(245,166,35,0.08)' : 'rgba(167,139,250,0.08)'
  }),
  dividerArrows: { display: 'flex', flexDirection: 'column', gap: 0 },
  arrowBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'inherit', fontSize: '13px', lineHeight: 1, padding: '8px 10px',
    minWidth: 36, textAlign: 'center'
  }
}

export default TryoutSessionPage
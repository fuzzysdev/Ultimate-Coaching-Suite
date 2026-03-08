import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import RosterModal from '../Components/RosterModal'
import ConfirmDialog from '../Components/ConfirmDialog'
import RosterPage from './RosterPage'

function RostersPage({ org, session, onRostersChanged }) {
  const [rosters, setRosters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [editingRoster, setEditingRoster] = useState(null)
  const [deletingRoster, setDeletingRoster] = useState(null)
  const [viewingRoster, setViewingRoster] = useState(null)

  useEffect(() => { fetchRosters() }, [org.id])

  const fetchRosters = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('rosters')
        .select('id, name, age_group, gender_type, created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setRosters(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoster = async (name, ageGroup, genderType) => {
    const { error } = await supabase.from('rosters').insert({
      name, organization_id: org.id, created_by: session.user.id,
      age_group: ageGroup, gender_type: genderType
    })
    if (error) throw error
    setShowRosterModal(false)
    fetchRosters()
    onRostersChanged()
  }

  const handleEditRoster = async (name, ageGroup, genderType) => {
    const { error } = await supabase.from('rosters')
      .update({ name, age_group: ageGroup, gender_type: genderType })
      .eq('id', editingRoster.id)
    if (error) throw error
    setEditingRoster(null)
    fetchRosters()
    onRostersChanged()
  }

  const handleDeleteRoster = async () => {
    const { error } = await supabase.from('rosters').delete().eq('id', deletingRoster.id)
    if (error) throw error
    setDeletingRoster(null)
    fetchRosters()
    onRostersChanged()
  }

  if (viewingRoster) {
    return <RosterPage roster={viewingRoster} onBack={() => setViewingRoster(null)} />
  }

  const s = styles
  return (
    <div style={s.container}>
      {showRosterModal && <RosterModal onSave={handleCreateRoster} onClose={() => setShowRosterModal(false)} />}
      {editingRoster && <RosterModal roster={editingRoster} onSave={handleEditRoster} onClose={() => setEditingRoster(null)} />}
      {deletingRoster && (
        <ConfirmDialog
          message={`Permanently delete "${deletingRoster.name}" and all its players?`}
          onConfirm={handleDeleteRoster}
          onCancel={() => setDeletingRoster(null)}
        />
      )}

      <div style={s.pageHeader}>
        <div>
          <h2 style={s.mainTitle}>Rosters</h2>
          <p style={s.muted}>{org.name} · {rosters.length} roster{rosters.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowRosterModal(true)} style={s.newBtn}>+ New Roster</button>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <p style={s.muted}>Loading rosters...</p>
      ) : rosters.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📋</div>
          <p>No rosters yet.</p>
          <button onClick={() => setShowRosterModal(true)} style={{ ...s.newBtn, marginTop: '1rem' }}>
            + Create your first roster
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {rosters.map(roster => (
            <div key={roster.id} style={s.card}>
              <h3 style={s.cardTitle}>{roster.name}</h3>
              <div style={s.badgeRow}>
                <span style={s.badge}>{(roster.age_group || 'junior').toUpperCase()}</span>
                <span style={s.badge}>{(roster.gender_type || 'mixed') === 'mixed' ? 'MIXED' : 'SINGLE GENDER'}</span>
              </div>
              <p style={{ ...s.muted, marginTop: '6px' }}>Created {new Date(roster.created_at).toLocaleDateString()}</p>
              <div style={s.cardActions}>
                <button onClick={() => setViewingRoster(roster)} style={s.viewBtn}>View Players</button>
                <button onClick={() => setEditingRoster(roster)} style={s.editBtn}>Edit</button>
                <button onClick={() => setDeletingRoster(roster)} style={s.deleteBtn}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { padding: '1.5rem', flex: 1 },
  pageHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '1.5rem'
  },
  mainTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.75rem',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: 0
  },
  newBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '8px 18px', borderRadius: '7px',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  card: { background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', padding: '1.25rem' },
  cardTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.2rem',
    fontWeight: '700', color: '#e8eaf0', marginBottom: '6px',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  badgeRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  badge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: '700',
    letterSpacing: '0.5px', textTransform: 'uppercase', color: '#7a8099',
    background: '#1f2435', border: '1px solid #2a2f42',
    padding: '2px 8px', borderRadius: '4px'
  },
  cardActions: { display: 'flex', gap: '0.5rem', marginTop: '1rem' },
  viewBtn: {
    flex: 1, background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700',
    fontSize: '13px', padding: '7px', borderRadius: '6px', textTransform: 'uppercase',
    cursor: 'pointer'
  },
  editBtn: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700', fontSize: '13px',
    padding: '7px 12px', borderRadius: '6px', textTransform: 'uppercase', cursor: 'pointer'
  },
  deleteBtn: {
    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)',
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700',
    fontSize: '13px', padding: '7px 12px', borderRadius: '6px',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '200px', color: '#7a8099'
  },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  muted: { color: '#7a8099', fontSize: '0.85rem' },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem'
  }
}

export default RostersPage

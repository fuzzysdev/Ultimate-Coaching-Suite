import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TryoutSessionPage from './TryoutSessionPage'
import ConfirmDialog from '../Components/ConfirmDialog'

function TryoutsPage({ org, session }) {
  const [tryouts, setTryouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewingTryout, setViewingTryout] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingTryout, setDeletingTryout] = useState(null)

  useEffect(() => { fetchTryouts() }, [org.id])

  const fetchTryouts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tryouts')
        .select('id, name, date, created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setTryouts(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('tryouts').insert({
        name: newName.trim(),
        date: newDate || null,
        organization_id: org.id,
        created_by: session.user.id,
        rankings: { M: [], F: [] },
        cut_index: { M: 3, F: 3 },
        bubble_index: { M: 2, F: 2 }
      })
      if (error) throw error
      setNewName('')
      setNewDate('')
      setShowForm(false)
      fetchTryouts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    await supabase.from('tryout_players').delete().eq('tryout_id', deletingTryout.id)
    const { error } = await supabase.from('tryouts').delete().eq('id', deletingTryout.id)
    setDeletingTryout(null)
    if (error) return setError(error.message)
    fetchTryouts()
  }

  if (viewingTryout) {
    return (
      <TryoutSessionPage
        tryout={viewingTryout}
        org={org}
        session={session}
        onBack={() => { setViewingTryout(null); fetchTryouts() }}
      />
    )
  }

  const s = styles
  return (
    <div style={s.container}>
      {deletingTryout && (
        <ConfirmDialog
          message={`Delete "${deletingTryout.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingTryout(null)}
        />
      )}
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.mainTitle}>Tryouts</h2>
          <p style={s.muted}>{org.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={s.newBtn}>
          {showForm ? 'Cancel' : '+ New Tryout'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={s.form}>
          <div style={s.formRow}>
            <div style={s.field}>
              <label style={s.label}>Tryout Name *</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Fall 2025 Varsity Tryouts"
                required
                autoFocus
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Date (optional)</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
              />
            </div>
            <button type="submit" disabled={saving} style={s.saveBtn}>
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <p style={s.muted}>Loading tryouts...</p>
      ) : tryouts.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>🏃</div>
          <p>No tryout sessions yet.</p>
          <button onClick={() => setShowForm(true)} style={{ ...s.newBtn, marginTop: '1rem' }}>
            + Create your first tryout
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {tryouts.map(tryout => (
            <div key={tryout.id} style={s.card}>
              <h3 style={s.cardTitle}>{tryout.name}</h3>
              <p style={s.muted}>
                {tryout.date
                  ? new Date(tryout.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                  : 'No date set'}
              </p>
              <div style={s.cardActions}>
                <button onClick={() => setViewingTryout(tryout)} style={s.viewBtn}>Open</button>
                <button onClick={() => setDeletingTryout(tryout)} style={s.deleteBtn}>Delete</button>
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
  form: {
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem'
  },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' },
  label: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '1px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  newBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '8px 18px', borderRadius: '7px',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  saveBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '10px 20px', borderRadius: '7px',
    textTransform: 'uppercase', alignSelf: 'flex-end', cursor: 'pointer'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  card: { background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', padding: '1.25rem' },
  cardTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.2rem',
    fontWeight: '700', color: '#e8eaf0', marginBottom: '0.4rem',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  cardActions: { display: 'flex', gap: '0.5rem', marginTop: '1rem' },
  viewBtn: {
    flex: 1, background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700',
    fontSize: '13px', padding: '7px', borderRadius: '6px',
    textTransform: 'uppercase', cursor: 'pointer'
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

export default TryoutsPage
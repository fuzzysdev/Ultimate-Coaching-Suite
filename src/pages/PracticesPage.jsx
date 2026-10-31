import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { offlineStore } from '../lib/offlineStore'
import {
  newId, todayStr, formatPracticeDate, formatClock, totalMinutes, blockType,
  practicesCacheKey, savePractice, attendanceLabelFor, fetchAttendance, addAttendancePractice,
} from '../lib/practiceHelpers'
import PracticeSetupDialog from '../Components/PracticeSetupDialog'
import DrillLibraryModal from '../Components/DrillLibraryModal'
import PracticeEditor from './PracticeEditor'

const byDateDesc = (a, b) => (b.practice_date + (b.start_time || '')).localeCompare(a.practice_date + (a.start_time || ''))

export default function PracticesPage({ org, roster, isDemoOrg, openPracticeId, onOpened }) {
  const [practices,    setPractices]    = useState(() => (roster ? offlineStore.getCache(practicesCacheKey(roster.id)) || [] : []))
  const [loading,      setLoading]      = useState(false)
  const [setupFor,     setSetupFor]     = useState(null)   // { copyFromId } while the new-practice dialog is open
  const [openId,       setOpenId]       = useState(openPracticeId || null)
  const [showLibrary,  setShowLibrary]  = useState(false)

  const fetchPractices = async () => {
    const key = practicesCacheKey(roster.id)
    if (practices.length === 0) setLoading(true)
    const { data, error } = await supabase
      .from('practices').select('*')
      .eq('roster_id', roster.id)
      .order('practice_date', { ascending: false })
    setLoading(false)
    if (error) { console.warn('fetchPractices: using cache', error); return }
    // Keep local practices whose create/edit hasn't synced yet (still in the write queue)
    const queuedIds = new Set(offlineStore.getQueue()
      .filter(q => q.table === 'practices' && q.method === 'upsert').map(q => q.data.id))
    const local = (offlineStore.getCache(key) || []).filter(p => queuedIds.has(p.id))
    const merged = [...data.filter(p => !queuedIds.has(p.id)), ...local].sort(byDateDesc)
    offlineStore.setCache(key, merged)
    setPractices(merged)
  }

  useEffect(() => {
    if (!roster?.id) return
    setPractices(offlineStore.getCache(practicesCacheKey(roster.id)) || [])
    fetchPractices()
  }, [roster?.id])

  // Banner tap in MainShell → open that practice
  useEffect(() => {
    if (openPracticeId) { setOpenId(openPracticeId); onOpened?.() }
  }, [openPracticeId])

  const handleCreate = async (details, copyFromId) => {
    setSetupFor(null)
    const source = copyFromId && practices.find(p => p.id === copyFromId)
    const attendance = await fetchAttendance(roster.id)
    const label = attendanceLabelFor(details.practice_date, attendance.practices)
    const practice = {
      id: newId(),
      organization_id: org.id,
      roster_id: roster.id,
      ...details,
      focus: details.focus || source?.focus || null,
      blocks: source ? source.blocks.map(b => ({ ...b, id: newId() })) : [],
      reminders: [],
      attendance_label: label,
    }
    setPractices(prev => [...prev, practice].sort(byDateDesc))
    savePractice(practice, isDemoOrg)
    addAttendancePractice(roster.id, label, isDemoOrg)
    setOpenId(practice.id)
  }

  const handleChanged = (p) => setPractices(prev => prev.map(x => (x.id === p.id ? p : x)).sort(byDateDesc))

  const handleBack = ({ deletedId } = {}) => {
    if (deletedId) setPractices(prev => prev.filter(p => p.id !== deletedId))
    setOpenId(null)
  }

  if (!roster) return <div style={S.noRoster}>Select a roster to plan practices</div>

  const open = openId && practices.find(p => p.id === openId)
  if (open) {
    return (
      <PracticeEditor key={open.id} practice={open} org={org} roster={roster} isDemoOrg={isDemoOrg}
        onBack={handleBack} onChanged={handleChanged} />
    )
  }

  const today    = todayStr()
  const upcoming = practices.filter(p => p.practice_date >= today).sort((a, b) => -byDateDesc(a, b))
  const previous = practices.filter(p => p.practice_date < today)
  const next     = upcoming[0]
  const nextOpenReminders = next ? next.reminders.filter(r => !r.done) : []

  const card = (p) => {
    const mins = totalMinutes(p.blocks)
    const open = p.reminders.filter(r => !r.done).length
    return (
      <div key={p.id} style={S.card}>
        <button onClick={() => setOpenId(p.id)} style={S.cardMain}>
          <div style={S.cardTop}>
            <span style={S.cardDate}>{formatPracticeDate(p.practice_date)}</span>
            {p.start_time && <span style={S.cardTime}>{formatClock(p.start_time)}</span>}
            {open > 0 && <span style={S.remBadge}>🔔 {open}</span>}
          </div>
          {p.focus && <div style={S.cardFocus}>{p.focus}</div>}
          <div style={S.cardMeta}>
            {p.blocks.length} block{p.blocks.length !== 1 ? 's' : ''} · {mins}/{p.duration_min} min
            {p.location && ` · ${p.location}`}
          </div>
          {p.blocks.length > 0 && (
            <div style={S.miniStrip}>
              {p.blocks.map(b => (
                <span key={b.id} style={{ flex: Math.max(1, Number(b.duration) || 1), background: blockType(b.type).color }} />
              ))}
            </div>
          )}
        </button>
        <button onClick={() => setSetupFor({ copyFromId: p.id })} style={S.dupBtn} title="Plan a new practice from this one">
          ⧉ Copy
        </button>
      </div>
    )
  }

  return (
    <div style={S.container}>
      {setupFor && (
        <PracticeSetupDialog previousPractices={[...practices].sort(byDateDesc).slice(0, 25)}
          defaultCopyFromId={setupFor.copyFromId || ''}
          onSave={handleCreate} onCancel={() => setSetupFor(null)} />
      )}
      {showLibrary && <DrillLibraryModal org={org} isDemoOrg={isDemoOrg} onClose={() => setShowLibrary(false)} />}

      <div style={S.inner}>
        <div style={S.header}>
          <span style={S.title}>Practices</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowLibrary(true)} style={S.libBtn}>📚 Drills</button>
            <button onClick={() => setSetupFor({})} style={S.newBtn}>+ New Practice</button>
          </div>
        </div>

        {next && nextOpenReminders.length > 0 && (
          <button onClick={() => setOpenId(next.id)} style={S.reminderBanner}>
            <div style={S.bannerTitle}>🔔 Before {formatPracticeDate(next.practice_date)}</div>
            {nextOpenReminders.slice(0, 3).map(r => <div key={r.id} style={S.bannerItem}>• {r.text}</div>)}
            {nextOpenReminders.length > 3 && <div style={S.bannerItem}>+{nextOpenReminders.length - 3} more</div>}
          </button>
        )}

        {loading && practices.length === 0 && <p style={S.empty}>Loading...</p>}

        {upcoming.length > 0 && <div style={S.sectionLabel}>Upcoming</div>}
        {upcoming.map(card)}

        {previous.length > 0 && <div style={S.sectionLabel}>Previous</div>}
        {previous.map(card)}

        {!loading && practices.length === 0 && (
          <p style={S.empty}>No practices yet. Tap "+ New Practice" to plan one.</p>
        )}
      </div>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const S = {
  container: { flex: 1, overflowY: 'auto', background: '#0f1117', padding: '16px' },
  inner: { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 },
  noRoster: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8099',
    fontFamily: font, fontSize: 16, letterSpacing: 2, textTransform: 'uppercase'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' },
  title: { fontFamily: font, fontSize: '24px', fontWeight: '900', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px' },
  newBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none', fontFamily: font, fontSize: '14px',
    fontWeight: '800', padding: '10px 16px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  libBtn: {
    background: '#181c26', color: '#4d9fff', border: '1px solid #2a2f42', fontFamily: font, fontSize: '14px',
    fontWeight: '800', padding: '10px 14px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  reminderBanner: {
    background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.4)', borderRadius: '10px',
    padding: '12px 14px', textAlign: 'left', cursor: 'pointer'
  },
  bannerTitle: { fontFamily: font, fontSize: '15px', fontWeight: '800', color: '#f0a500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 },
  bannerItem: { fontFamily: font, fontSize: '15px', color: '#e8eaf0' },
  sectionLabel: {
    fontFamily: font, fontSize: '12px', fontWeight: '800', letterSpacing: '2px', color: '#7a8099',
    textTransform: 'uppercase', marginTop: 10
  },
  card: { display: 'flex', background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', overflow: 'hidden' },
  cardMain: { flex: 1, background: 'none', border: 'none', padding: '12px 14px', textAlign: 'left', cursor: 'pointer' },
  cardTop: { display: 'flex', alignItems: 'baseline', gap: 10 },
  cardDate: { fontFamily: font, fontSize: '18px', fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase' },
  cardTime: { fontFamily: font, fontSize: '14px', fontWeight: '700', color: '#7a8099' },
  remBadge: { marginLeft: 'auto', fontFamily: font, fontSize: '13px', fontWeight: '800', color: '#f0a500' },
  cardFocus: { fontFamily: font, fontSize: '15px', color: '#c8ccd8', marginTop: 2 },
  cardMeta: { fontFamily: font, fontSize: '13px', color: '#7a8099', fontWeight: '600', marginTop: 4 },
  miniStrip: { display: 'flex', gap: 2, height: 5, marginTop: 8, borderRadius: 3, overflow: 'hidden' },
  dupBtn: {
    background: 'none', border: 'none', borderLeft: '1px solid #2a2f42', color: '#7a8099', fontFamily: font,
    fontSize: '13px', fontWeight: '700', padding: '0 14px', textTransform: 'uppercase', cursor: 'pointer'
  },
  empty: { color: '#4a5068', fontFamily: font, fontSize: '14px', textAlign: 'center', margin: '24px 0' },
}

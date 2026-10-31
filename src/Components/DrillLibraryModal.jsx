import { useEffect, useState } from 'react'
import { blockType, BLOCK_TYPES, fetchDrills, getCachedDrills, deleteDrill } from '../lib/practiceHelpers'
import DrillFormModal from './DrillFormModal'
import ConfirmDialog from './ConfirmDialog'

// Org drill library. With onPick, tapping "Use" adds the drill to the practice;
// without it, the modal is just for browsing/managing.
function DrillLibraryModal({ org, isDemoOrg, onPick, onClose }) {
  const [drills,     setDrills]     = useState(() => getCachedDrills(org.id))
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editing,    setEditing]    = useState(null)   // drill, {} for new, or null
  const [deleting,   setDeleting]   = useState(null)

  useEffect(() => {
    let alive = true
    fetchDrills(org.id).then(list => { if (alive) setDrills(list) })
    return () => { alive = false }
  }, [org.id])

  const q = search.trim().toLowerCase()
  const visible = drills.filter(d =>
    (!typeFilter || d.block_type === typeFilter) &&
    (!q || d.name.toLowerCase().includes(q) || (d.tags || []).some(t => t.includes(q)) ||
      (d.description || '').toLowerCase().includes(q))
  )

  const handleSaved = () => { setEditing(null); setDrills(getCachedDrills(org.id)) }
  const handleDelete = async () => {
    await deleteDrill(deleting, isDemoOrg)
    setDeleting(null)
    setDrills(getCachedDrills(org.id))
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {editing && (
          <DrillFormModal org={org} drill={editing.id ? editing : null} isDemoOrg={isDemoOrg}
            onSaved={handleSaved} onClose={() => setEditing(null)} />
        )}
        {deleting && (
          <ConfirmDialog message={`Delete "${deleting.name}" from the drill library? Practices that used it keep their copy.`}
            onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
        )}

        <div style={s.modalHeader}>
          <h2 style={s.title}>Drill Library</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.toolbar}>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search drills or tags" maxLength={100} style={s.search} />
          <button onClick={() => setEditing({})} style={s.newBtn}>+ New</button>
        </div>

        <div style={s.chips}>
          <button onClick={() => setTypeFilter('')} style={{ ...s.chip, ...(!typeFilter ? s.chipOn : {}) }}>All</button>
          {BLOCK_TYPES.map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              style={{ ...s.chip, ...(typeFilter === t.key ? { borderColor: t.color, color: t.color } : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.list}>
          {visible.length === 0 && (
            <p style={s.empty}>
              {drills.length === 0
                ? 'No drills yet. Tap "+ New", or use "Save as drill" on any practice block.'
                : 'No drills match.'}
            </p>
          )}
          {visible.map(d => {
            const t = blockType(d.block_type)
            const open = expandedId === d.id
            return (
              <div key={d.id} style={s.item}>
                <button onClick={() => setExpandedId(open ? null : d.id)} style={s.itemHead}>
                  <span style={{ ...s.typeDot, background: t.color }} />
                  <span style={s.itemName}>{d.name}</span>
                  {d.default_duration && <span style={s.itemMeta}>{d.default_duration}m</span>}
                  <span style={s.chev}>{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div style={s.itemBody}>
                    {d.description && <p style={s.desc}>{d.description}</p>}
                    {d.tags?.length > 0 && (
                      <div style={s.tags}>{d.tags.map(tag => <span key={tag} style={s.tag}>{tag}</span>)}</div>
                    )}
                    <div style={s.itemActions}>
                      <button onClick={() => setDeleting(d)} style={s.delBtn}>Delete</button>
                      <button onClick={() => setEditing(d)} style={s.editBtn}>Edit</button>
                      {onPick && <button onClick={() => onPick(d)} style={s.useBtn}>Use in Practice</button>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px',
    width: '100%', maxWidth: '560px', padding: '24px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column'
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  title: { fontFamily: font, fontSize: '22px', fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 },
  closeBtn: { background: '#1f2435', border: 'none', color: '#7a8099', fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer' },
  toolbar: { display: 'flex', gap: '8px', marginBottom: '10px' },
  search: {
    flex: 1, background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: font, fontSize: '16px', padding: '10px 12px', borderRadius: '8px', outline: 'none'
  },
  newBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none', fontFamily: font, fontSize: '14px',
    fontWeight: '800', padding: '0 16px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' },
  chip: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099', fontFamily: font,
    fontSize: '12px', fontWeight: '700', padding: '5px 10px', borderRadius: '14px', textTransform: 'uppercase', cursor: 'pointer'
  },
  chipOn: { borderColor: '#e8eaf0', color: '#e8eaf0' },
  list: { overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  empty: { color: '#7a8099', fontFamily: font, fontSize: '14px', textAlign: 'center', padding: '24px 8px', margin: 0 },
  item: { background: '#1f2435', border: '1px solid #2a2f42', borderRadius: '10px' },
  itemHead: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none',
    padding: '12px 14px', cursor: 'pointer', textAlign: 'left'
  },
  typeDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  itemName: { flex: 1, fontFamily: font, fontSize: '16px', fontWeight: '700', color: '#e8eaf0' },
  itemMeta: { fontFamily: font, fontSize: '13px', color: '#7a8099', fontWeight: '700' },
  chev: { color: '#7a8099', fontSize: '14px' },
  itemBody: { padding: '0 14px 12px' },
  desc: { color: '#c8ccd8', fontFamily: "'Barlow', sans-serif", fontSize: '14px', lineHeight: 1.45, whiteSpace: 'pre-wrap', margin: '0 0 10px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' },
  tag: { background: '#181c26', color: '#7a8099', fontFamily: font, fontSize: '12px', padding: '2px 8px', borderRadius: '10px' },
  itemActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  delBtn: {
    background: 'none', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d', fontFamily: font,
    fontSize: '13px', fontWeight: '700', padding: '7px 12px', borderRadius: '7px', textTransform: 'uppercase', cursor: 'pointer'
  },
  editBtn: {
    background: 'none', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '13px', fontWeight: '700', padding: '7px 12px', borderRadius: '7px', textTransform: 'uppercase', cursor: 'pointer'
  },
  useBtn: {
    background: '#00e5a0', border: 'none', color: '#0f1117', fontFamily: font,
    fontSize: '13px', fontWeight: '800', padding: '7px 14px', borderRadius: '7px', textTransform: 'uppercase', cursor: 'pointer'
  },
}

export default DrillLibraryModal

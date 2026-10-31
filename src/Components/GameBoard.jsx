import { useEffect, useRef, useState } from 'react'

// Full-screen sideline drawboard for the game sheet. Completely separate from grid
// state: contents live only in localStorage under ucs_board_<gameId> so they survive
// hide/show, screen lock and reloads, and are discarded when the game ends or is
// abandoned (GameSheetPage calls clearBoard).
//
// Everything is vector data in field metres (100 × 37, end zones 18 deep). The
// half-field view just narrows the viewBox; each view keeps its own pieces/strokes.

const boardKey = (gameId) => `ucs_board_${gameId}`
export const clearBoard = (gameId) => { try { localStorage.removeItem(boardKey(gameId)) } catch {} }

const FIELD_L = 100, FIELD_W = 37, EZ = 18, BRICK = 18
const MID_Y = FIELD_W / 2
const VIEWS = {
  full: { x: -3, y: -3, w: 106, h: 43 },
  half: { x: 47, y: -3, w: 56,  h: 43 },
}
// Opening vertical stack, attacking the right-hand end zone
const STACK = { full: { x: 34, gap: 8, step: 4 }, half: { x: 54, gap: 6, step: 3.5 } }
const COLORS = ['#ffd23f', '#ffffff', '#0f1117', '#ff4d6d', '#4d9fff', '#ff9800', '#c77dff']
const TOOLS = [
  { id: 'pen',   label: '✎ Draw' },
  { id: 'cut',   label: '→ Cut' },
  { id: 'throw', label: '⇢ Throw' },
  { id: 'erase', label: '⌫ Erase' },
]

// Piece radius scales with the view so pieces are the same size on screen in both
const unit = (view) => VIEWS[view].w * 0.018
const round = (v) => Math.round(v * 100) / 100
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function defaultBoard(view) {
  const r = unit(view)
  const { x, gap, step } = STACK[view]
  const pieces = []
  for (let n = 1; n <= 7; n++) {
    const px = n === 1 ? x : x + gap + (n - 2) * step
    pieces.push({ id: `o${n}`, kind: 'o', n, x: px, y: MID_Y })
    pieces.push({ id: `d${n}`, kind: 'd', n, x: px, y: round(MID_Y - r * 2.2) })
  }
  pieces.push({ id: 'disc', kind: 'disc', x: round(x + r * 1.3), y: round(MID_Y + r * 1.3) })
  return { pieces, strokes: [] }
}

function loadBoard(gameId) {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(boardKey(gameId))) } catch {}
  return {
    view: saved?.view === 'half' ? 'half' : 'full',
    boards: {
      full: saved?.boards?.full || defaultBoard('full'),
      half: saved?.boards?.half || defaultBoard('half'),
    },
  }
}

function smoothPath(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1]
    d += ` Q${x},${y} ${round((x + nx) / 2)},${round((y + ny) / 2)}`
  }
  const last = pts[pts.length - 1]
  return d + ` L${last[0]},${last[1]}`
}

// Arrowhead aimed along the last stretch of the stroke (not the last jittery segment)
function arrowHead(pts, len) {
  const [tx, ty] = pts[pts.length - 1]
  let i = pts.length - 2
  while (i > 0 && Math.hypot(tx - pts[i][0], ty - pts[i][1]) < len) i--
  const a = Math.atan2(ty - pts[i][1], tx - pts[i][0])
  const wing = (s) => `${round(tx - len * Math.cos(a + s))},${round(ty - len * Math.sin(a + s))}`
  return `${tx},${ty} ${wing(0.45)} ${wing(-0.45)}`
}

function strokeLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return len
}

function Stroke({ stroke, sw }) {
  const w = stroke.kind === 'pen' ? sw : sw * 1.2
  const d = smoothPath(stroke.points)
  return (
    <g data-stroke={stroke.id}>
      {/* Wide invisible hit area so the eraser doesn't need pixel precision */}
      <path d={d} stroke="transparent" strokeWidth={w * 6} fill="none" />
      <path d={d} stroke={stroke.color} strokeWidth={w} fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={stroke.kind === 'throw' ? `${w * 0.01} ${w * 2.4}` : undefined} />
      {stroke.kind !== 'pen' && stroke.points.length > 1 && (
        <polygon points={arrowHead(stroke.points, w * 4)} fill={stroke.color} />
      )}
    </g>
  )
}

function Piece({ p, r }) {
  if (p.kind === 'disc') {
    return (
      <g data-piece={p.id}>
        <circle cx={p.x} cy={p.y} r={r * 1.1} fill="transparent" />
        <circle cx={p.x} cy={p.y} r={r * 0.6} fill="#f5f5f5" stroke="#0f1117" strokeWidth={r * 0.12} />
      </g>
    )
  }
  if (p.kind === 'cone') {
    const c = r * 0.8
    return (
      <g data-piece={p.id}>
        <circle cx={p.x} cy={p.y} r={r * 1.1} fill="transparent" />
        <polygon points={`${p.x},${p.y - c} ${p.x + c * 0.9},${p.y + c * 0.7} ${p.x - c * 0.9},${p.y + c * 0.7}`}
          fill="#ff9800" stroke="#0f1117" strokeWidth={r * 0.1} strokeLinejoin="round" />
      </g>
    )
  }
  const off = p.kind === 'o'
  return (
    <g data-piece={p.id}>
      <circle cx={p.x} cy={p.y} r={r} fill={off ? '#00e5a0' : '#ff4d6d'} stroke="#0f1117" strokeWidth={r * 0.1} />
      <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
        fontSize={r * 1.15} fontWeight="800" fontFamily="'Barlow Condensed', sans-serif"
        fill={off ? '#0f1117' : '#ffffff'} style={{ pointerEvents: 'none' }}>
        {p.n}
      </text>
    </g>
  )
}

function Field() {
  const lw = 0.25
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={0} y={0} width={FIELD_L} height={FIELD_W} fill="#2d6a3e" />
      <rect x={0} y={0} width={EZ} height={FIELD_W} fill="#265c36" />
      <rect x={FIELD_L - EZ} y={0} width={EZ} height={FIELD_W} fill="#265c36" />
      <rect x={0} y={0} width={FIELD_L} height={FIELD_W} fill="none" stroke="#e8eaf0" strokeWidth={lw} />
      <line x1={EZ} y1={0} x2={EZ} y2={FIELD_W} stroke="#e8eaf0" strokeWidth={lw} />
      <line x1={FIELD_L - EZ} y1={0} x2={FIELD_L - EZ} y2={FIELD_W} stroke="#e8eaf0" strokeWidth={lw} />
      {[EZ + BRICK, FIELD_L - EZ - BRICK].map(bx => (
        <g key={bx} stroke="#e8eaf0" strokeWidth={lw}>
          <line x1={bx - 0.6} y1={MID_Y - 0.6} x2={bx + 0.6} y2={MID_Y + 0.6} />
          <line x1={bx - 0.6} y1={MID_Y + 0.6} x2={bx + 0.6} y2={MID_Y - 0.6} />
        </g>
      ))}
    </g>
  )
}

function FieldThumb({ view }) {
  const v = VIEWS[view]
  return (
    <svg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} style={{ height: 30, width: 30 * v.w / v.h, display: 'block' }}>
      <Field />
    </svg>
  )
}

export default function GameBoard({ gameId, onClose }) {
  const [state, setState] = useState(() => loadBoard(gameId))
  const [tool,  setTool]  = useState('cut')
  const [color, setColor] = useState(COLORS[0])
  const [draft, setDraft] = useState(null)        // stroke currently being drawn
  const svgRef     = useRef(null)
  const gestureRef = useRef(null)                 // { pointerId, type: 'draw'|'drag'|'erase', ... }
  const draftRef   = useRef(null)
  const penSeenRef = useRef(false)                // once the Pencil is used, ignore palm touches for drawing
  const historyRef = useRef({ full: [], half: [] })

  useEffect(() => {
    try { localStorage.setItem(boardKey(gameId), JSON.stringify(state)) } catch {}
  }, [state, gameId])

  const view  = state.view
  const board = state.boards[view]
  const vb    = VIEWS[view]
  const r     = unit(view)
  const sw    = r * 0.22

  const update = (fn) => setState(prev => ({
    ...prev, boards: { ...prev.boards, [prev.view]: fn(prev.boards[prev.view]) },
  }))
  const pushHistory = () => {
    const h = historyRef.current[view]
    h.push(board)
    if (h.length > 50) h.shift()
  }

  const toField = (e) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return [round(p.x), round(p.y)]
  }
  const clampX = (x) => Math.min(vb.x + vb.w - r, Math.max(vb.x + r, x))
  const clampY = (y) => Math.min(vb.y + vb.h - r, Math.max(vb.y + r, y))

  const eraseAt = (e, g) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const sid = el?.closest?.('[data-stroke]')?.dataset.stroke
    const pid = el?.closest?.('[data-piece]')?.dataset.piece
    const coneId = pid?.startsWith('cone') ? pid : null
    if (!sid && !coneId) return
    if (!g.erased) { pushHistory(); g.erased = true }
    update(b => sid
      ? { ...b, strokes: b.strokes.filter(s => s.id !== sid) }
      : { ...b, pieces: b.pieces.filter(p => p.id !== coneId) })
  }

  const onPointerDown = (e) => {
    if (gestureRef.current) return                 // one finger / pen at a time
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'pen') penSeenRef.current = true
    const pieceId = e.target.closest?.('[data-piece]')?.dataset.piece
    let g
    if (tool === 'erase') {
      g = { pointerId: e.pointerId, type: 'erase', erased: false }
      eraseAt(e, g)
    } else if (pieceId) {
      const p = board.pieces.find(x => x.id === pieceId)
      const [x, y] = toField(e)
      g = { pointerId: e.pointerId, type: 'drag', pieceId, dx: p.x - x, dy: p.y - y, moved: false }
    } else {
      if (e.pointerType === 'touch' && penSeenRef.current) return
      draftRef.current = { id: newId(), kind: tool, color, points: [toField(e)] }
      setDraft(draftRef.current)
      g = { pointerId: e.pointerId, type: 'draw' }
    }
    gestureRef.current = g
    svgRef.current.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    if (g.type === 'erase') { eraseAt(e, g); return }
    if (g.type === 'drag') {
      const [x, y] = toField(e)
      if (!g.moved) { pushHistory(); g.moved = true }
      update(b => ({
        ...b,
        pieces: b.pieces.map(p => p.id === g.pieceId
          ? { ...p, x: round(clampX(x + g.dx)), y: round(clampY(y + g.dy)) } : p),
      }))
      return
    }
    // Draw — coalesced events give the Pencil's full sample rate where supported
    const events = e.getCoalescedEvents?.() || []
    const pts = [...draftRef.current.points]
    for (const ev of events.length ? events : [e]) {
      const pt = toField(ev)
      const last = pts[pts.length - 1]
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= r * 0.15) pts.push(pt)
    }
    if (pts.length === draftRef.current.points.length) return
    draftRef.current = { ...draftRef.current, points: pts }
    setDraft(draftRef.current)
  }

  const onPointerEnd = (e) => {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    gestureRef.current = null
    if (g.type !== 'draw') return
    const d = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (e.type === 'pointercancel' || !d || d.points.length < 2 || strokeLength(d.points) < r * 0.5) return
    pushHistory()
    update(b => ({ ...b, strokes: [...b.strokes, d] }))
  }

  const undo = () => {
    const prev = historyRef.current[view].pop()
    if (prev) update(() => prev)
  }
  const clearLines = () => {
    if (board.strokes.length === 0) return
    pushHistory()
    update(b => ({ ...b, strokes: [] }))
  }
  const resetAll = () => {
    pushHistory()
    update(() => defaultBoard(view))
  }
  const addCone = () => {
    pushHistory()
    const cones = board.pieces.filter(p => p.kind === 'cone').length
    update(b => ({
      ...b,
      pieces: [...b.pieces, {
        id: `cone_${newId()}`, kind: 'cone',
        x: round(clampX(vb.x + vb.w / 2 + cones * r * 2.2)), y: round(clampY(FIELD_W - 4)),
      }],
    }))
  }
  const setView = (v) => setState(prev => ({ ...prev, view: v }))

  const canUndo = historyRef.current[view].length > 0
  const s = styles

  return (
    <div style={s.screen}>
      <div style={s.toolbar}>
        <div style={s.group}>
          {['full', 'half'].map(v => (
            <button key={v} onClick={() => setView(v)} title={v === 'full' ? 'Full field' : 'Half field'}
              style={{ ...s.thumbBtn, ...(view === v ? s.thumbOn : {}) }}>
              <FieldThumb view={v} />
            </button>
          ))}
        </div>

        <div style={s.group}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)}
              style={{ ...s.toolBtn, ...(tool === t.id ? s.toolOn : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.group}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool === 'erase') setTool('pen') }}
              aria-label={`Colour ${c}`}
              style={{ ...s.swatch, background: c, ...(color === c ? s.swatchOn : {}) }} />
          ))}
        </div>

        <div style={s.group}>
          <button onClick={addCone} style={s.actBtn}>+ Cone</button>
          <button onClick={undo} disabled={!canUndo} style={{ ...s.actBtn, opacity: canUndo ? 1 : 0.35 }}>↩ Undo</button>
          <button onClick={clearLines} style={s.actBtn}>Clear</button>
          <button onClick={resetAll} style={s.actBtn}>Reset</button>
        </div>

        <button onClick={onClose} style={s.hideBtn}>✕ Hide</button>
      </div>

      <div style={s.fieldWrap}>
        <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
          style={s.svg}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#1c4429" />
          <Field />
          {board.strokes.map(st => <Stroke key={st.id} stroke={st} sw={sw} />)}
          {draft && draft.points.length > 1 && <Stroke stroke={draft} sw={sw} />}
          {board.pieces.map(p => <Piece key={p.id} p={p} r={r} />)}
        </svg>
      </div>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const styles = {
  screen: {
    position: 'fixed', inset: 0, zIndex: 800, background: '#0f1117', color: '#e8eaf0',
    display: 'flex', flexDirection: 'column', fontFamily: font,
    paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
    WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
  },
  toolbar: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px',
    padding: '10px 12px', borderBottom: '1px solid #2a2f42', background: '#181c26',
  },
  group: { display: 'flex', alignItems: 'center', gap: 6 },
  thumbBtn: {
    background: 'transparent', border: '2px solid #2a2f42', borderRadius: 8, padding: 3,
    cursor: 'pointer', touchAction: 'manipulation', opacity: 0.6,
  },
  thumbOn: { borderColor: '#00e5a0', opacity: 1 },
  toolBtn: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '15px', fontWeight: '800', padding: '9px 12px', borderRadius: 8,
    textTransform: 'uppercase', cursor: 'pointer', touchAction: 'manipulation',
  },
  toolOn: { background: '#00e5a0', borderColor: '#00e5a0', color: '#0f1117' },
  swatch: {
    width: 30, height: 30, borderRadius: '50%', border: '2px solid #2a2f42', padding: 0,
    cursor: 'pointer', touchAction: 'manipulation',
  },
  swatchOn: { border: '3px solid #e8eaf0', boxShadow: '0 0 0 2px #00e5a0' },
  actBtn: {
    background: 'transparent', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '14px', fontWeight: '700', padding: '9px 10px', borderRadius: 8,
    textTransform: 'uppercase', cursor: 'pointer', touchAction: 'manipulation',
  },
  hideBtn: {
    marginLeft: 'auto', background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: font, fontSize: '15px', fontWeight: '800', padding: '9px 14px', borderRadius: 8,
    textTransform: 'uppercase', cursor: 'pointer', touchAction: 'manipulation',
  },
  fieldWrap: { flex: 1, minHeight: 0, display: 'flex', padding: 8 },
  svg: { width: '100%', height: '100%', touchAction: 'none', display: 'block' },
}

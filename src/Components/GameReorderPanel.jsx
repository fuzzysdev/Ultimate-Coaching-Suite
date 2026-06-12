import { useState, useRef } from 'react'
import { POS, O_D_LINE_STYLE } from '../lib/gameSheetHelpers'

const ROW_H = 44

export default function ReorderGroup({ players, label, color, gender, onReorder }) {
  const dragIdx  = useRef(null)
  const overIdx  = useRef(null)
  const startY   = useRef(0)
  const [dragOver, setDragOver] = useState(null)

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const onTouchStart = (e, idx) => {
    dragIdx.current = idx
    overIdx.current = idx
    startY.current  = e.touches[0].clientY
  }

  const onTouchMove = (e) => {
    if (dragIdx.current === null) return
    e.preventDefault()
    const y      = e.touches[0].clientY
    const list   = e.currentTarget
    const rect   = list.getBoundingClientRect()
    const relY   = y - rect.top
    const newIdx = Math.max(0, Math.min(players.length - 1, Math.floor(relY / ROW_H)))
    if (newIdx !== overIdx.current) {
      overIdx.current = newIdx
      setDragOver(newIdx)
    }
  }

  const onTouchEnd = () => {
    if (dragIdx.current !== null && overIdx.current !== null) {
      onReorder(gender, dragIdx.current, overIdx.current)
    }
    dragIdx.current = null
    overIdx.current = null
    setDragOver(null)
  }

  // ── Mouse handlers (desktop) ────────────────────────────────────────────────
  const onMouseDown = (e, idx) => {
    dragIdx.current = idx
    overIdx.current = idx
  }

  const onMouseEnterRow = (idx) => {
    if (dragIdx.current === null) return
    overIdx.current = idx
    setDragOver(idx)
  }

  const onMouseUp = () => {
    if (dragIdx.current !== null && overIdx.current !== null) {
      onReorder(gender, dragIdx.current, overIdx.current)
    }
    dragIdx.current = null
    overIdx.current = null
    setDragOver(null)
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {label && (
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800,
          color, textTransform: 'uppercase', letterSpacing: 1.5,
          padding: '6px 14px 4px', borderBottom: `1px solid ${color}44` }}>
          {label}
        </div>
      )}
      <div
        data-reorder-list
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {players.map((p, idx) => (
          <div
            key={p.id}
            onMouseEnter={() => onMouseEnterRow(idx)}
            style={{ display: 'flex', alignItems: 'center',
              height: ROW_H, paddingRight: 8,
              borderBottom: dragOver === idx && dragOver !== dragIdx.current
                ? `2px solid ${color}`
                : '1px solid #1a1e2a',
              background: dragIdx.current === idx ? '#1a1e2a' : '#0f1117',
              transition: 'background 0.1s',
            }}>
            <div
              onTouchStart={(e) => onTouchStart(e, idx)}
              onMouseDown={(e) => onMouseDown(e, idx)}
              style={{ padding: '0 12px', cursor: 'grab', color: '#2a2f42',
                fontSize: 16, lineHeight: 1, userSelect: 'none', touchAction: 'none',
                display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}>
              ⣿
            </div>
            <span style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14, fontWeight: 800, color: '#e8eaf0',
              textTransform: 'uppercase', letterSpacing: 0.3, pointerEvents: 'none' }}>
              {p.name}
            </span>
            {p.position && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9,
                fontWeight: 700, background: '#1f2435', color: '#5a6280',
                padding: '2px 4px', borderRadius: 3, letterSpacing: 0.5, pointerEvents: 'none' }}>
                {POS[p.position] || p.position}
              </span>
            )}
            {O_D_LINE_STYLE[p.o_d_line] && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9,
                fontWeight: 800, background: O_D_LINE_STYLE[p.o_d_line].bg, color: O_D_LINE_STYLE[p.o_d_line].color,
                padding: '2px 4px', borderRadius: 3, letterSpacing: 0.5, pointerEvents: 'none' }}>
                {O_D_LINE_STYLE[p.o_d_line].label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

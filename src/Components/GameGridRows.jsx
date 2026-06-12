import { COL_W, POS, O_D_LINE_STYLE, cellFill } from '../lib/gameSheetHelpers'

export function SectionRow({ label, color, stickyName, colIndices, colBgFn, curIdx, secH, gt, htAfterPoint }) {
  const sectionTint = `${color}14`
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
      <div style={{ ...stickyName(sectionTint), height: secH, display: 'flex', alignItems: 'center',
        paddingLeft: 6, fontSize: 9, fontWeight: 800, color, letterSpacing: 1,
        textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif",
        borderTop: `2px solid ${color}88`, borderBottom: `1px solid ${color}44` }}>
        {label}
      </div>
      {colIndices.map(i => (
        <div key={i} style={{ width: COL_W, minWidth: COL_W, flexShrink: 0, height: secH,
          background: `${colBgFn(i, curIdx) === 'transparent' ? sectionTint : colBgFn(i, curIdx)}`,
          borderTop: `2px solid ${color}88`, borderBottom: `1px solid ${color}44`,
          borderRight: htAfterPoint !== null && i === htAfterPoint ? '3px solid rgba(255,152,0,0.7)' : undefined }} />
      ))}
    </div>
  )
}

export function PlayerRow({ player, colIndices, lines, curIdx, stickyName, colCell, rowH, status, onStatusChange, onToggle, readOnly, gt, lightGrid }) {
  const unavailable = !!status
  const borderColor = status === 'injured' ? '#f0a500' : status === 'away' ? '#4a5068' : 'transparent'
  const rowOpacity  = status === 'away' ? 0.28 : status === 'injured' ? 0.45 : 1

  return (
    <div style={{ display: 'flex', alignItems: 'center', opacity: rowOpacity }}>
      <div onClick={onStatusChange}
        title={!status ? 'Tap to mark Away' : status === 'away' ? 'Tap to mark Injured' : 'Tap to mark Active'}
        style={{ ...stickyName(gt.nameBg), height: rowH, display: 'flex', alignItems: 'center',
          paddingLeft: 4, gap: 3, borderBottom: `1px solid ${gt.rowBorder}`,
          borderLeft: `3px solid ${borderColor}`,
          overflow: 'hidden', cursor: 'pointer', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 12, fontWeight: 700,
          color: status === 'injured' ? gt.injColor : gt.nameColor,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: status ? 46 : 54,
          textDecoration: status === 'away' ? 'line-through' : 'none',
          fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {player.name}
        </span>
        {status ? (
          <span style={{ fontSize: 8, fontWeight: 800, flexShrink: 0, padding: '1px 3px', borderRadius: 3,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
            background: status === 'away' ? gt.awayBg : 'rgba(240,165,0,0.2)',
            color: status === 'away' ? gt.awayColor : '#f0a500' }}>
            {status === 'away' ? 'AWAY' : 'INJ'}
          </span>
        ) : (
          <>
            {player.position && (
              <span style={{ fontSize: 9, fontWeight: 700, background: gt.posTagBg, color: gt.posTagColor,
                padding: '1px 3px', borderRadius: 3, flexShrink: 0,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
                {POS[player.position] || player.position}
              </span>
            )}
            {O_D_LINE_STYLE[player.o_d_line] && (
              <span style={{ fontSize: 9, fontWeight: 800, flexShrink: 0, padding: '1px 3px', borderRadius: 3,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
                background: O_D_LINE_STYLE[player.o_d_line].bg,
                color: O_D_LINE_STYLE[player.o_d_line].color }}>
                {O_D_LINE_STYLE[player.o_d_line].label}
              </span>
            )}
          </>
        )}
      </div>

      {colIndices.map(i => {
        const selected = lines[i]?.has(player.id) || false
        const isInteractive = !readOnly && i >= curIdx && !unavailable
        const dot = selected ? (
          <div style={{
            width: 16, height: 16, borderRadius: 3,
            background: cellFill(true, i, curIdx, lightGrid),
            border: i > curIdx ? `1px dashed ${lightGrid ? 'rgba(0,160,110,0.4)' : 'rgba(0,229,160,0.4)'}` : 'none',
            pointerEvents: 'none',
          }} />
        ) : null

        if (isInteractive) {
          return (
            <button key={i} onClick={() => onToggle(player.id, i)}
              style={{ ...colCell(i), height: rowH,
                borderBottom: `1px solid ${gt.rowBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              {dot}
            </button>
          )
        }
        return (
          <div key={i} style={{ ...colCell(i), height: rowH, borderBottom: `1px solid ${gt.rowBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dot}
          </div>
        )
      })}
    </div>
  )
}

export function EmptySection({ label, stickyName, colIndices, colCell, rowH, gt }) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ ...stickyName(gt.nameBg), height: rowH, display: 'flex', alignItems: 'center',
        paddingLeft: 6, fontSize: 10, color: gt.light ? '#a0a8c0' : '#3a3f52',
        fontFamily: "'Barlow Condensed', sans-serif" }}>
        {label}
      </div>
      {colIndices.map(i => <div key={i} style={{ ...colCell(i), height: rowH }} />)}
    </div>
  )
}

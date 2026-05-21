import React, { useState, useEffect, useRef } from 'react'
import { getGenderForPoint } from '../lib/gameSheetHelpers'

// ── Constants ──────────────────────────────────────────────────────────────────
const SPIRIT_CATEGORIES = [
  { key: 'rules_knowledge', label: 'Rules Knowledge & Use' },
  { key: 'fouls_contact',   label: 'Fouls & Body Contact' },
  { key: 'fair_mindedness', label: 'Fair Mindedness' },
  { key: 'attitude',        label: 'Attitude' },
  { key: 'communication',   label: 'Communication' },
]
const SCORE_LABELS = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent']

const GENDER_COLOR = { m: '#60a5fa', f: '#f472b6' }

// ── Helpers ────────────────────────────────────────────────────────────────────
function contrastColor(hex) {
  if (!hex || hex.length < 7) return '#ffffff'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#ffffff'
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── Color Swatch ───────────────────────────────────────────────────────────────
function ColorSwatch({ color, onChange }) {
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color, border: '2px solid #4a5068', boxSizing: 'border-box' }} />
      <input
        type="color" value={color}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
      />
    </div>
  )
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [team1Name,   setTeam1Name]   = useState(() => localStorage.getItem('ucs_sb_home_name')  || 'Home')
  const [team2Name,   setTeam2Name]   = useState('Away')
  const [team1Color,  setTeam1Color]  = useState(() => localStorage.getItem('ucs_sb_home_color') || '#00b4d8')
  const [team2Color,  setTeam2Color]  = useState('#e63946')
  const [genderMode,  setGenderMode]  = useState('mixed')
  const [genderRule,  setGenderRule]  = useState('A')
  const [firstGender, setFirstGender] = useState('m')
  const [t1Action,    setT1Action]    = useState('pull')
  const [t1Side,      setT1Side]      = useState('left')

  const colorConflict = team1Color.toLowerCase() === team2Color.toLowerCase()
  const canStart      = team1Name.trim() && team2Name.trim() && !colorConflict

  const handleStart = () => {
    if (!canStart) return
    localStorage.setItem('ucs_sb_home_name',  team1Name.trim() || 'Home')
    localStorage.setItem('ucs_sb_home_color', team1Color)
    onStart({
      team1Name: team1Name.trim() || 'Home',
      team2Name: team2Name.trim() || 'Away',
      team1Color, team2Color, genderMode,
      genderRule:  genderMode === 'mixed' ? genderRule : null,
      firstGender: genderMode === 'mixed' && genderRule === 'A' ? firstGender : null,
      t1Action, t1Side,
    })
  }

  const s = SS
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <span style={s.headerLogo}>UCS</span>
          <span style={s.headerSub}>Scoreboard</span>
        </div>

        <SetupSection label="Teams">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <ColorSwatch color={team1Color} onChange={setTeam1Color} />
            <input style={s.nameInput} value={team1Name} maxLength={30} placeholder="Team 1"
              onChange={e => setTeam1Name(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <ColorSwatch color={team2Color} onChange={setTeam2Color} />
            <input style={s.nameInput} value={team2Name} maxLength={30} placeholder="Team 2"
              onChange={e => setTeam2Name(e.target.value)} />
          </div>
          {colorConflict && <div style={s.warn}>Teams must have different colours</div>}
        </SetupSection>

        <SetupSection label="Game Type">
          <BtnGroup>
            <Toggle active={genderMode === 'mixed'}  onClick={() => setGenderMode('mixed')}>Mixed</Toggle>
            <Toggle active={genderMode === 'single'} onClick={() => setGenderMode('single')}>Single Gender</Toggle>
          </BtnGroup>
        </SetupSection>

        {genderMode === 'mixed' && (
          <>
            <SetupSection label="Gender Rule">
              <BtnGroup>
                <Toggle active={genderRule === 'A'} onClick={() => setGenderRule('A')}>Rule A — Alternating</Toggle>
                <Toggle active={genderRule === 'B'} onClick={() => setGenderRule('B')}>Rule B — Endzone</Toggle>
              </BtnGroup>
              <div style={s.ruleNote}>
                {genderRule === 'A'
                  ? 'Ratio alternates automatically each point.'
                  : 'Receiving team chooses the ratio before each point.'}
              </div>
            </SetupSection>

            {genderRule === 'A' && (
              <SetupSection label="First Point Ratio">
                <BtnGroup>
                  <Toggle active={firstGender === 'm'} onClick={() => setFirstGender('m')}>♂  4M, 3F</Toggle>
                  <Toggle active={firstGender === 'f'} onClick={() => setFirstGender('f')}>♀  4F, 3M</Toggle>
                </BtnGroup>
              </SetupSection>
            )}
          </>
        )}

        <SetupSection label={`${team1Name.trim() || 'Team 1'} to Start`}>
          <BtnGroup>
            <Toggle active={t1Action === 'pull'}    onClick={() => setT1Action('pull')}>Pulls</Toggle>
            <Toggle active={t1Action === 'receive'} onClick={() => setT1Action('receive')}>Receives</Toggle>
          </BtnGroup>
          <BtnGroup style={{ marginTop: 8 }}>
            <Toggle active={t1Side === 'left'}  onClick={() => setT1Side('left')}>Left Side</Toggle>
            <Toggle active={t1Side === 'right'} onClick={() => setT1Side('right')}>Right Side</Toggle>
          </BtnGroup>
        </SetupSection>

        <button
          style={{ ...s.startBtn, opacity: canStart ? 1 : 0.4 }}
          onClick={handleStart}
          disabled={!canStart}
        >
          ▶  Start Game
        </button>
      </div>
    </div>
  )
}

function SetupSection({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={SS.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}
function BtnGroup({ children, style }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...style }}>{children}</div>
}
function Toggle({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#00e5a0' : '#2a2f42', border: 'none', borderRadius: 7,
      color: active ? '#0f1117' : '#e8eaf0',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 13, fontWeight: 800, padding: '9px 14px',
      textTransform: 'uppercase', letterSpacing: 0.3, cursor: 'pointer',
      touchAction: 'manipulation',
    }}>
      {children}
    </button>
  )
}

// ── Top Bar ────────────────────────────────────────────────────────────────────
function TopBar({ pointNum, genderLabel, genderColor }) {
  return (
    <div style={{
      height: 52, background: '#0a0d14', borderBottom: '1px solid #1e2336',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, flexShrink: 0, padding: '0 16px',
    }}>
      <span style={{
        fontSize: 15, fontWeight: 900, color: '#4a5068',
        textTransform: 'uppercase', letterSpacing: 2,
      }}>
        Point {pointNum}
      </span>
      {genderLabel && (
        <>
          <span style={{ color: '#1e2336', fontSize: 20, fontWeight: 900 }}>·</span>
          <span style={{
            fontSize: 22, fontWeight: 900, letterSpacing: 1,
            color: genderColor, textTransform: 'uppercase',
          }}>
            {genderLabel}
          </span>
        </>
      )}
    </div>
  )
}

// ── Score History Strip ────────────────────────────────────────────────────────
function ScoreHistory({ points, team1Color, team2Color, isMixed }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [points.length])

  // Build cumulative score after each point
  let h = 0, a = 0
  const history = points.map(p => {
    if (p.scoredBy === 'team1') h++; else a++
    return { h, a, scoredBy: p.scoredBy, gender: p.gender }
  })

  return (
    <div ref={scrollRef} style={{
      height: 42, background: '#0a0d14', borderTop: '1px solid #1e2336',
      display: 'flex', alignItems: 'center',
      overflowX: 'auto', flexShrink: 0,
      scrollbarWidth: 'none', msOverflowStyle: 'none',
      padding: '0 8px', gap: 3,
    }}>
      {history.length === 0 ? (
        <span style={{ fontSize: 11, color: '#1e2336', textTransform: 'uppercase', letterSpacing: 1, margin: '0 auto' }}>
          — no points yet —
        </span>
      ) : history.map((entry, i) => {
        const scorerColor = entry.scoredBy === 'team1' ? team1Color : team2Color
        const dotColor    = entry.gender ? GENDER_COLOR[entry.gender] : null
        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minWidth: 38, height: 32, borderRadius: 5, gap: 1,
            borderLeft: `3px solid ${scorerColor}`,
            background: `rgba(${hexToRgb(scorerColor)}, 0.1)`,
            padding: '0 5px 0 4px', flexShrink: 0,
          }}>
            {dotColor && (
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor }} />
            )}
            <span style={{
              fontSize: 12, fontWeight: 900, color: '#b0b8d0',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: 0.3, lineHeight: 1,
            }}>
              {entry.h}–{entry.a}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────
function EditModal({ config, onSave, onClose }) {
  const [team1Name,  setTeam1Name]  = useState(config.team1Name)
  const [team2Name,  setTeam2Name]  = useState(config.team2Name)
  const [team1Color, setTeam1Color] = useState(config.team1Color)
  const [team2Color, setTeam2Color] = useState(config.team2Color)
  const colorConflict = team1Color.toLowerCase() === team2Color.toLowerCase()

  return (
    <Overlay>
      <ModalCard>
        <div style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#e8eaf0', marginBottom: 20, alignSelf: 'flex-start' }}>
          Edit Teams
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ColorSwatch color={team1Color} onChange={setTeam1Color} />
            <input style={{ ...SS.nameInput, flex: 1 }} value={team1Name} maxLength={30}
              onChange={e => setTeam1Name(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ColorSwatch color={team2Color} onChange={setTeam2Color} />
            <input style={{ ...SS.nameInput, flex: 1 }} value={team2Name} maxLength={30}
              onChange={e => setTeam2Name(e.target.value)} />
          </div>
          {colorConflict && <div style={SS.warn}>Teams must have different colours</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 16 }}>
          <button
            onClick={() => onSave({
              team1Name:  team1Name.trim()  || config.team1Name,
              team2Name:  team2Name.trim()  || config.team2Name,
              team1Color, team2Color,
            })}
            disabled={colorConflict}
            style={{ ...primaryBtn, flex: 1, opacity: colorConflict ? 0.4 : 1 }}
          >
            Save
          </button>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
        </div>
      </ModalCard>
    </Overlay>
  )
}

// ── Halftime Modal ─────────────────────────────────────────────────────────────
function HalftimeModal({ config, onDismiss }) {
  const { team1Name, team2Name, team1Color, team2Color, t1Action, t1Side } = config
  const t1Action2 = t1Action === 'pull' ? 'Receives' : 'Pulls'
  const t1Side2   = t1Side   === 'left' ? 'Right'    : 'Left'
  const t2Action2 = t1Action === 'pull' ? 'Pulls'    : 'Receives'
  const t2Side2   = t1Side   === 'left' ? 'Left'     : 'Right'

  return (
    <Overlay>
      <ModalCard>
        <div style={{ fontSize: 13, color: '#7a8099', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Half Time</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#00e5a0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 28 }}>
          2nd Half
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginBottom: 28 }}>
          <HalfInfoRow color={team1Color} name={team1Name} action={t1Action2} side={`${t1Side2} Side`} />
          <HalfInfoRow color={team2Color} name={team2Name} action={t2Action2} side={`${t2Side2} Side`} />
        </div>
        <button onClick={onDismiss} style={primaryBtn}>Continue →</button>
      </ModalCard>
    </Overlay>
  )
}

function HalfInfoRow({ color, name, action, side }) {
  const tc = contrastColor(color)
  return (
    <div style={{ background: color, borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 15, fontWeight: 900, color: tc, textTransform: 'uppercase' }}>{name}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: tc, letterSpacing: 0.5 }}>
        {action.toUpperCase()} · {side.toUpperCase()}
      </span>
    </div>
  )
}

// ── Rule B Gender Picker ───────────────────────────────────────────────────────
function RuleBPicker({ receivingTeam, config, onChoose }) {
  const name  = receivingTeam === 'team1' ? config.team1Name  : config.team2Name
  const color = receivingTeam === 'team1' ? config.team1Color : config.team2Color
  const tc    = contrastColor(color)

  return (
    <Overlay>
      <ModalCard>
        <div style={{ fontSize: 12, color: '#7a8099', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Receiving Team Chooses
        </div>
        <div style={{ background: color, color: tc, padding: '10px 28px', borderRadius: 8, fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 28 }}>
          {name}
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { g: 'm', icon: '♂', label: '4M, 3F', color: GENDER_COLOR.m },
            { g: 'f', icon: '♀', label: '4F, 3M', color: GENDER_COLOR.f },
          ].map(({ g, icon, label, color: gc }) => (
            <button key={g} onClick={() => onChoose(g)} style={{
              background: '#0f1117', border: `2px solid ${gc}`, borderRadius: 12,
              color: gc, fontFamily: "'Barlow Condensed', sans-serif",
              padding: '20px 32px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              touchAction: 'manipulation',
            }}>
              <span style={{ fontSize: 36 }}>{icon}</span>
              <span style={{ fontSize: 17, fontWeight: 900 }}>{label}</span>
            </button>
          ))}
        </div>
      </ModalCard>
    </Overlay>
  )
}

// ── End Modal ──────────────────────────────────────────────────────────────────
function EndModal({ config, team1Score, team2Score, onNewGame }) {
  const [ratings, setRatings] = useState({
    rules_knowledge: null, fouls_contact: null,
    fair_mindedness: null, attitude: null, communication: null,
  })
  const [done, setDone] = useState(false)
  const allRated = Object.values(ratings).every(v => v !== null)
  const total    = allRated ? Object.values(ratings).reduce((a, b) => a + b, 0) : null
  const winner   = team1Score > team2Score ? config.team1Name
                 : team2Score > team1Score ? config.team2Name : null

  if (done) {
    return (
      <Overlay>
        <ModalCard>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 26, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#e8eaf0', marginBottom: 4, textAlign: 'center' }}>
            {winner ? `${winner} wins!` : "It's a draw!"}
          </div>
          <div style={{ fontSize: 18, color: '#7a8099', marginBottom: 8 }}>{team1Score} — {team2Score}</div>
          {total !== null && (
            <div style={{ fontSize: 15, color: '#7a8099', marginBottom: 28 }}>
              Spirit: <span style={{ color: '#00e5a0', fontWeight: 900 }}>{total} / 20</span>
            </div>
          )}
          <button onClick={onNewGame} style={primaryBtn}>New Game</button>
        </ModalCard>
      </Overlay>
    )
  }

  return (
    <Overlay style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
      <div style={{
        background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
        padding: '28px 24px', width: '100%', maxWidth: 440,
        margin: '20px auto', fontFamily: "'Barlow Condensed', sans-serif",
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, color: '#00e5a0', marginBottom: 20, textAlign: 'center' }}>
          Game Over
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 28 }}>
          <ScoreChip name={config.team1Name} score={team1Score} color={config.team1Color} win={team1Score > team2Score} />
          <span style={{ fontSize: 20, color: '#4a5068', fontWeight: 900 }}>—</span>
          <ScoreChip name={config.team2Name} score={team2Score} color={config.team2Color} win={team2Score > team1Score} />
        </div>
        <div style={{ borderTop: '1px solid #2a2f42', paddingTop: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#e8eaf0', marginBottom: 2 }}>Spirit Rating</div>
          <div style={{ fontSize: 12, color: '#7a8099', marginBottom: 18 }}>Rate the opposing team 0–4 in each category</div>
          {SPIRIT_CATEGORIES.map(cat => (
            <SpiritRow key={cat.key} label={cat.label} value={ratings[cat.key]}
              onChange={v => setRatings(prev => ({ ...prev, [cat.key]: v }))} />
          ))}
          {allRated && (
            <div style={{ textAlign: 'right', fontSize: 13, color: '#7a8099', marginTop: 6 }}>
              Total: <span style={{ color: '#00e5a0', fontWeight: 900 }}>{total} / 20</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setDone(true)} disabled={!allRated}
            style={{ ...primaryBtn, flex: 1, opacity: allRated ? 1 : 0.4 }}>
            Done
          </button>
          <button onClick={onNewGame} style={ghostBtn}>Skip</button>
        </div>
      </div>
    </Overlay>
  )
}

function ScoreChip({ name, score, color, win }) {
  const tc = contrastColor(color)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: win ? '#00e5a0' : '#e8eaf0' }}>{score}</div>
      <div style={{ background: color, color: tc, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 12px', borderRadius: 20 }}>
        {name}
      </div>
    </div>
  )
}

function SpiritRow({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#b0b8d0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2, 3, 4].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: 38, height: 38, borderRadius: 7,
            background: value === n ? '#00e5a0' : '#2a2f42',
            border: 'none', color: value === n ? '#0f1117' : '#7a8099',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 16, fontWeight: 900, cursor: 'pointer', touchAction: 'manipulation',
          }}>{n}</button>
        ))}
        {value !== null && (
          <span style={{ fontSize: 11, color: '#4a5068', marginLeft: 4 }}>{SCORE_LABELS[value]}</span>
        )}
      </div>
    </div>
  )
}

// ── Shared Primitives ──────────────────────────────────────────────────────────
function Overlay({ children, style }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}
function ModalCard({ children }) {
  return (
    <div style={{
      background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
      padding: '32px 28px', width: '100%', maxWidth: 380,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      {children}
    </div>
  )
}
const primaryBtn = {
  background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117',
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
  padding: '12px 32px', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  touchAction: 'manipulation',
}
const ghostBtn = {
  background: 'none', border: '1px solid #2a2f42', borderRadius: 8, color: '#7a8099',
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
  padding: '12px 20px', textTransform: 'uppercase', cursor: 'pointer',
  touchAction: 'manipulation',
}

// ── Team Panel ─────────────────────────────────────────────────────────────────
// Tapping anywhere on the panel scores +1; the persistent button is −1 (undo that team)
function TeamPanel({ name, score, bgColor, textColor, onScore, onMinus, canMinus }) {
  const rgb = hexToRgb(textColor)
  return (
    <div
      onClick={onScore}
      style={{
        flex: 1, background: bgColor,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 12px 16px', userSelect: 'none', overflow: 'hidden',
        cursor: 'pointer', touchAction: 'manipulation',
      }}
    >
      <div style={{
        fontSize: 'clamp(13px, 3vw, 22px)', fontWeight: 900, textTransform: 'uppercase',
        letterSpacing: 1, color: textColor, opacity: 0.85, textAlign: 'center',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {name}
      </div>

      <div style={{
        fontSize: 'clamp(80px, 26vw, 240px)', fontWeight: 900, lineHeight: 1,
        color: textColor, textAlign: 'center', pointerEvents: 'none',
      }}>
        {score}
      </div>

      {/* −1 button: stops propagation so it doesn't also trigger +1 */}
      <button
        onClick={e => { e.stopPropagation(); onMinus() }}
        disabled={!canMinus}
        style={{
          background: `rgba(${rgb}, 0.15)`,
          border: `2px solid rgba(${rgb}, ${canMinus ? '0.4' : '0.15'})`,
          borderRadius: 12, color: canMinus ? textColor : `rgba(${rgb}, 0.3)`,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 'clamp(18px, 4vw, 28px)', fontWeight: 900,
          padding: '12px 44px', cursor: canMinus ? 'pointer' : 'default',
          letterSpacing: 1, touchAction: 'manipulation',
        }}
      >
        − 1
      </button>
    </div>
  )
}

// ── Control Bar Button ─────────────────────────────────────────────────────────
function CtrlBtn({ onClick, disabled, label, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: danger ? 'rgba(255,77,109,0.12)' : '#181c26',
        border: `1px solid ${danger ? '#ff4d6d' : '#2a2f42'}`,
        borderRadius: 7,
        color: disabled ? '#2a2f42' : danger ? '#ff4d6d' : '#7a8099',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 12, fontWeight: 900, padding: '8px 12px',
        textTransform: 'uppercase', letterSpacing: 0.5,
        cursor: disabled ? 'default' : 'pointer', touchAction: 'manipulation',
      }}
    >
      {label}
    </button>
  )
}

// ── Main Scoreboard Page ───────────────────────────────────────────────────────
export default function ScoreboardPage() {
  const [phase,       setPhase]       = useState('setup')
  const [config,      setConfig]      = useState(null)
  const [points,      setPoints]      = useState([])
  const [pullTeam,    setPullTeam]    = useState(null)
  const [ruleBGender, setRuleBGender] = useState(null)
  const [editOpen,    setEditOpen]    = useState(false)
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)

  useEffect(() => {
    if (phase !== 'game' || !navigator.wakeLock) return
    let lock = null
    navigator.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    return () => { lock?.release() }
  }, [phase])

  useEffect(() => {
    const handler = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => { window.removeEventListener('resize', handler); window.removeEventListener('orientationchange', handler) }
  }, [])

  // Derived
  const team1Score  = points.filter(p => p.scoredBy === 'team1').length
  const team2Score  = points.filter(p => p.scoredBy === 'team2').length
  const curPointIdx = points.length
  const isMixed     = config?.genderMode === 'mixed'
  const isRuleB     = isMixed && config?.genderRule === 'B'
  const receivingTeam = pullTeam === 'team1' ? 'team2' : 'team1'

  const curGenderA = isMixed && !isRuleB ? getGenderForPoint(curPointIdx, config.firstGender) : null
  const curGender  = isRuleB ? ruleBGender : curGenderA
  const needsRuleB = isRuleB && ruleBGender === null && phase === 'game'

  const genderLabel = !isMixed       ? null
    : curGender === 'm' ? '♂  4M, 3F'
    : curGender === 'f' ? '♀  4F, 3M'
    : '— choosing'
  const genderColor = curGender ? GENDER_COLOR[curGender] : '#4a5068'

  // −1 for a specific team: undo only if that team scored the last point
  const lastScoredBy = points.length ? points[points.length - 1].scoredBy : null

  const handleStart = (cfg) => {
    setConfig(cfg)
    setPoints([])
    setPullTeam(cfg.t1Action === 'pull' ? 'team1' : 'team2')
    setRuleBGender(null)
    setPhase('game')
  }

  const handleScore = (scoringTeam) => {
    if (isRuleB && ruleBGender === null) return
    const gender = isMixed ? (isRuleB ? ruleBGender : curGenderA) : null
    setPoints(prev => [...prev, { scoredBy: scoringTeam, gender, pullTeamBefore: pullTeam }])
    setPullTeam(scoringTeam)
    if (isRuleB) setRuleBGender(null)
  }

  // Undo the last point only if it was scored by the specified team
  const handleMinus = (team) => {
    if (points.length === 0 || lastScoredBy !== team) return
    handleUndo()
  }

  const handleUndo = () => {
    if (points.length === 0) return
    const last = points[points.length - 1]
    setPoints(prev => prev.slice(0, -1))
    setPullTeam(last.pullTeamBefore)
    if (isRuleB) setRuleBGender(null)
  }

  const handleHalftime = () => {
    setPullTeam(prev => prev === 'team1' ? 'team2' : 'team1')
    setPhase('halftime')
  }

  const handleHalftimeDismiss = () => {
    setPhase('game')
    if (isRuleB) setRuleBGender(null)
  }

  const handleEditSave = (updates) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setEditOpen(false)
  }

  const handleNewGame = () => { setPhase('setup'); setConfig(null); setPoints([]) }

  if (phase === 'setup') return <SetupScreen onStart={handleStart} />

  const t1c = contrastColor(config.team1Color)
  const t2c = contrastColor(config.team2Color)

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      fontFamily: "'Barlow Condensed', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar — point counter + gender ratio */}
      <TopBar
        pointNum={curPointIdx + 1}
        genderLabel={genderLabel}
        genderColor={genderColor}
      />

      {/* Team panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <TeamPanel
          name={config.team1Name} score={team1Score}
          bgColor={config.team1Color} textColor={t1c}
          onScore={() => handleScore('team1')}
          onMinus={() => handleMinus('team1')}
          canMinus={lastScoredBy === 'team1'}
        />
        <div style={{ width: 3, background: '#0a0d14', flexShrink: 0 }} />
        <TeamPanel
          name={config.team2Name} score={team2Score}
          bgColor={config.team2Color} textColor={t2c}
          onScore={() => handleScore('team2')}
          onMinus={() => handleMinus('team2')}
          canMinus={lastScoredBy === 'team2'}
        />
      </div>

      {/* Running score history */}
      <ScoreHistory
        points={points}
        team1Color={config.team1Color}
        team2Color={config.team2Color}
        isMixed={isMixed}
      />

      {/* Control bar */}
      <div style={{
        height: 56, background: '#0a0d14', borderTop: '1px solid #1e2336',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', flexShrink: 0, gap: 8,
      }}>
        <CtrlBtn onClick={() => setEditOpen(true)} label="✏ Edit" />
        <div style={{ display: 'flex', gap: 7 }}>
          <CtrlBtn onClick={handleUndo}              disabled={points.length === 0} label="↩ Undo" />
          <CtrlBtn onClick={handleHalftime}          label="½ Half" />
          <CtrlBtn onClick={() => setPhase('ended')} label="■ End" danger />
        </div>
      </div>

      {/* Overlays */}
      {editOpen && (
        <EditModal config={config} onSave={handleEditSave} onClose={() => setEditOpen(false)} />
      )}
      {phase === 'halftime' && (
        <HalftimeModal config={config} onDismiss={handleHalftimeDismiss} />
      )}
      {phase === 'ended' && (
        <EndModal config={config} team1Score={team1Score} team2Score={team2Score} onNewGame={handleNewGame} />
      )}
      {needsRuleB && (
        <RuleBPicker receivingTeam={receivingTeam} config={config} onChoose={g => setRuleBGender(g)} />
      )}
    </div>
  )
}

// ── Setup Styles ───────────────────────────────────────────────────────────────
const SS = {
  page: {
    minHeight: '100vh', background: '#0f1117',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '28px 16px', fontFamily: "'Barlow Condensed', sans-serif", overflowY: 'auto',
  },
  card: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
    padding: '28px 24px', width: '100%', maxWidth: 420,
  },
  header: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 28 },
  headerLogo: { fontSize: 26, fontWeight: 900, color: '#00e5a0', textTransform: 'uppercase', letterSpacing: 2 },
  headerSub:  { fontSize: 16, fontWeight: 700, color: '#7a8099', textTransform: 'uppercase', letterSpacing: 1 },
  sectionLabel: {
    fontSize: 11, fontWeight: 800, color: '#4a5068',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  },
  nameInput: {
    flex: 1, background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 7,
    color: '#e8eaf0', padding: '10px 12px',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, outline: 'none', minWidth: 0,
  },
  ruleNote: { fontSize: 11, color: '#4a5068', marginTop: 8, lineHeight: 1.5 },
  warn:     { fontSize: 12, color: '#ff4d6d', fontWeight: 700, marginTop: 6 },
  startBtn: {
    width: '100%', background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 900,
    padding: '14px 0', textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
    marginTop: 4, touchAction: 'manipulation',
  },
}

import { useEffect, useRef, useState } from 'react'
import { blockType, formatClock, formatPracticeDate, totalMinutes } from '../lib/practiceHelpers'

// Full-screen sideline timer. Time is derived from timestamps (not tick counting)
// so it stays correct through screen lock, and the run state is saved so closing
// and reopening the app resumes the same block.
//
// When a block's time runs out it beeps and counts overtime — it never auto-advances.
// The coach decides: Next (skip ahead) or +1 / +5 min (stay on this block).

const runKey = (id) => `ucs_run_${id}`

const loadRun = (id) => { try { return JSON.parse(localStorage.getItem(runKey(id))) } catch { return null } }

function freshBlockState(idx) {
  return { idx, startedAt: Date.now(), pausedAt: null, pausedMs: 0, extraSec: 0 }
}

export default function RunPracticeMode({ practice, onClose }) {
  const blocks = practice.blocks
  const [run, setRun] = useState(() => loadRun(practice.id))   // null = not started
  const [now, setNow] = useState(() => Date.now())
  const wakeLockRef   = useRef(null)
  const audioRef      = useRef(null)
  const beepedRef     = useRef(null)   // `${idx}:${startedAt}` of the block we already beeped for

  // Persist every change so a reload resumes
  useEffect(() => {
    try {
      if (run) localStorage.setItem(runKey(practice.id), JSON.stringify(run))
      else localStorage.removeItem(runKey(practice.id))
    } catch {}
  }, [run, practice.id])

  // Tick
  useEffect(() => {
    if (!run) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [run])

  // Keep the screen on while running; re-acquire after the app comes back to the front
  useEffect(() => {
    if (!run || !('wakeLock' in navigator)) return
    const acquire = async () => {
      if (wakeLockRef.current || document.visibilityState !== 'visible') return
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null })
      } catch {}
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      wakeLockRef.current?.release(); wakeLockRef.current = null
    }
  }, [!!run])

  // iOS only allows audio after a user tap — create/resume the context inside one
  const unlockAudio = () => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      if (audioRef.current.state === 'suspended') audioRef.current.resume()
    } catch {}
  }

  const beep = () => {
    const ctx = audioRef.current
    if (!ctx) return
    try {
      ;[0, 0.35, 0.7].forEach(offset => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset)
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.25)
        osc.connect(gain).connect(ctx.destination)
        osc.start(ctx.currentTime + offset)
        osc.stop(ctx.currentTime + offset + 0.3)
      })
    } catch {}
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const idx       = run ? Math.min(run.idx, blocks.length - 1) : 0
  const block     = blocks[idx]
  const t         = blockType(block?.type)
  const plannedS  = (Number(block?.duration) || 0) * 60 + (run?.extraSec || 0)
  const elapsedS  = run ? Math.max(0, ((run.pausedAt ?? now) - run.startedAt - run.pausedMs) / 1000) : 0
  const remainS   = plannedS - elapsedS
  const overtime  = remainS < 0
  const paused    = !!run?.pausedAt
  const next      = blocks[idx + 1]
  const isLast    = idx === blocks.length - 1
  const plannedTotal = totalMinutes(blocks)
  const doneBeforeMin = blocks.slice(0, idx).reduce((sum, b) => sum + (Number(b.duration) || 0), 0)

  // Beep once when the current block hits zero
  useEffect(() => {
    if (!run || paused || !overtime) return
    const tag = `${run.idx}:${run.startedAt}`
    if (beepedRef.current === tag) return
    beepedRef.current = tag
    beep()
    navigator.vibrate?.([300, 150, 300])
  }, [overtime, paused, run])

  // ── Actions ───────────────────────────────────────────────────────────────
  const start      = () => { unlockAudio(); setRun(freshBlockState(0)) }
  const goTo       = (i) => { unlockAudio(); setRun(freshBlockState(Math.max(0, Math.min(blocks.length - 1, i)))) }
  const addTime    = (min) => { unlockAudio(); setRun(r => ({ ...r, extraSec: r.extraSec + min * 60 })) }
  const togglePause = () => {
    unlockAudio()
    setRun(r => r.pausedAt
      ? { ...r, pausedAt: null, pausedMs: r.pausedMs + (Date.now() - r.pausedAt) }
      : { ...r, pausedAt: Date.now() })
  }
  const finish = () => { setRun(null); onClose() }

  const fmt = (secs) => {
    const a = Math.abs(Math.round(secs))
    return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
  }

  const s = styles

  // ── Not started ───────────────────────────────────────────────────────────
  if (!run) {
    return (
      <div style={s.screen}>
        <div style={s.topBar}>
          <span style={s.topTitle}>Run Practice · {formatPracticeDate(practice.practice_date)}</span>
          <button onClick={onClose} style={s.exitBtn}>✕ Close</button>
        </div>
        <div style={s.center}>
          <div style={s.bigLabel}>{blocks.length} blocks · {plannedTotal} min</div>
          {practice.focus && <div style={s.focus}>Focus: {practice.focus}</div>}
          <div style={s.preview}>
            {blocks.map((b, i) => {
              const bt = blockType(b.type)
              return (
                <div key={b.id} style={s.previewRow}>
                  <span style={{ ...s.dot, background: bt.color }} />
                  <span style={s.previewName}>{b.title || bt.label}</span>
                  <span style={s.previewMin}>{b.duration}m</span>
                  {practice.start_time && (
                    <span style={s.previewClock}>
                      {formatClock(practice.start_time, blocks.slice(0, i).reduce((x, y) => x + (Number(y.duration) || 0), 0))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={start} style={s.startBtn}>▶ Start Practice</button>
        </div>
      </div>
    )
  }

  // ── Running ───────────────────────────────────────────────────────────────
  return (
    <div style={{ ...s.screen, background: overtime && !paused ? '#2a0f16' : '#0f1117' }}>
      <div style={s.topBar}>
        <span style={s.topTitle}>
          Block {idx + 1} / {blocks.length} · {doneBeforeMin + Math.floor(elapsedS / 60)} of {plannedTotal} min
        </span>
        <button onClick={finish} style={s.exitBtn}>End Practice</button>
      </div>

      {/* Progress strip — tap a block to jump to it */}
      <div style={s.strip}>
        {blocks.map((b, i) => (
          <button key={b.id} onClick={() => goTo(i)} title={b.title || blockType(b.type).label}
            style={{
              ...s.stripSeg, flex: Math.max(1, Number(b.duration) || 1),
              background: blockType(b.type).color,
              opacity: i < idx ? 0.35 : i === idx ? 1 : 0.6,
              outline: i === idx ? '2px solid #e8eaf0' : 'none',
            }} />
        ))}
      </div>

      <div style={s.center}>
        <div style={{ ...s.typeLabel, color: t.color }}>{t.label}</div>
        <div style={s.blockTitle}>{block.title || t.label}</div>

        <div style={{ ...s.timer, color: paused ? '#7a8099' : overtime ? '#ff4d6d' : '#e8eaf0' }}>
          {overtime && '+'}{fmt(remainS)}
        </div>
        <div style={s.timerSub}>
          {paused ? 'Paused' : overtime ? "Time's up — tap Next or add time" : `of ${block.duration + Math.round((run.extraSec || 0) / 60)} min`}
        </div>

        {block.notes && <div style={s.notes}>{block.notes}</div>}
      </div>

      <div style={s.controls}>
        <div style={s.ctrlRow}>
          <button onClick={() => addTime(1)} style={s.ctrlBtn}>+1 min</button>
          <button onClick={() => addTime(5)} style={s.ctrlBtn}>+5 min</button>
          <button onClick={togglePause} style={s.ctrlBtn}>{paused ? '▶ Resume' : '❚❚ Pause'}</button>
        </div>
        <div style={s.ctrlRow}>
          <button onClick={() => goTo(idx - 1)} disabled={idx === 0} style={{ ...s.navBtn, opacity: idx === 0 ? 0.35 : 1 }}>◀ Prev</button>
          {isLast
            ? <button onClick={finish} style={s.nextBtn}>Finish ✓</button>
            : <button onClick={() => goTo(idx + 1)} style={s.nextBtn}>Next ▶</button>}
        </div>
        {next && (
          <div style={s.upNext}>
            Up next: <span style={{ color: blockType(next.type).color }}>{next.title || blockType(next.type).label}</span> · {next.duration} min
          </div>
        )}
      </div>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const styles = {
  screen: {
    position: 'fixed', inset: 0, zIndex: 800, background: '#0f1117', color: '#e8eaf0',
    display: 'flex', flexDirection: 'column', fontFamily: font,
    paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'
  },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 12 },
  topTitle: { fontSize: '14px', fontWeight: '700', color: '#7a8099', textTransform: 'uppercase', letterSpacing: '1px' },
  exitBtn: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '13px', fontWeight: '700', padding: '8px 12px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  strip: { display: 'flex', gap: '3px', padding: '0 16px', height: '14px' },
  stripSeg: { border: 'none', borderRadius: '3px', padding: 0, cursor: 'pointer', minWidth: 6 },
  center: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '16px', textAlign: 'center', overflowY: 'auto'
  },
  typeLabel: { fontSize: '18px', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase' },
  blockTitle: { fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.05, marginTop: 4 },
  timer: { fontSize: 'clamp(96px, 26vw, 220px)', fontWeight: '900', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginTop: 12 },
  timerSub: { fontSize: '16px', fontWeight: '700', color: '#7a8099', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 6 },
  notes: {
    marginTop: 18, maxWidth: 640, background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px',
    padding: '12px 16px', fontFamily: "'Barlow', sans-serif", fontSize: '17px', lineHeight: 1.4,
    color: '#c8ccd8', whiteSpace: 'pre-wrap', textAlign: 'left'
  },
  controls: { padding: '12px 16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  ctrlRow: { display: 'flex', gap: '10px' },
  ctrlBtn: {
    flex: 1, background: '#181c26', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '18px', fontWeight: '800', padding: '16px 8px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  navBtn: {
    flex: 1, background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '20px', fontWeight: '800', padding: '18px 8px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  nextBtn: {
    flex: 2, background: '#00e5a0', border: 'none', color: '#0f1117', fontFamily: font,
    fontSize: '22px', fontWeight: '900', padding: '18px 8px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  upNext: { textAlign: 'center', color: '#7a8099', fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' },
  bigLabel: { fontSize: '28px', fontWeight: '900', textTransform: 'uppercase' },
  focus: { fontSize: '16px', color: '#7a8099', fontWeight: '700', marginTop: 4 },
  preview: { width: '100%', maxWidth: 480, margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 6 },
  previewRow: { display: 'flex', alignItems: 'center', gap: 10, background: '#181c26', borderRadius: 8, padding: '10px 12px' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  previewName: { flex: 1, textAlign: 'left', fontSize: '16px', fontWeight: '700' },
  previewMin: { fontSize: '14px', color: '#7a8099', fontWeight: '700' },
  previewClock: { fontSize: '13px', color: '#4a5068', fontWeight: '700', minWidth: 56, textAlign: 'right' },
  startBtn: {
    background: '#00e5a0', border: 'none', color: '#0f1117', fontFamily: font, fontSize: '24px',
    fontWeight: '900', padding: '18px 40px', borderRadius: '12px', textTransform: 'uppercase', cursor: 'pointer'
  },
}

import React, { useState } from 'react'

const STEPS = [
  {
    title: 'Welcome to UCS',
    body: "Ultimate Coaching Suite is your all-in-one tool for managing your ultimate frisbee program. From live game sheets to drag-and-drop tryout rankings, everything your staff needs is in one place.",
    icon: '🥏',
  },
  {
    title: 'Rosters',
    body: "Build your team roster by adding players with their position, gender, and grade. You can have multiple rosters per org — great for A/B teams or separate divisions.",
    icon: '👥',
  },
  {
    title: 'Game Sheet',
    body: "Track every point of every game live from your phone. See who's on the line, record goals and assists, and monitor gender ratios — all in real time with your coaching staff.",
    icon: '📋',
  },
  {
    title: 'Tryouts & Attendance',
    body: "Run structured tryout sessions with ratings and drag-to-rank final cuts. Track practice attendance per roster so you always know who's putting in the time.",
    icon: '🏆',
  },
  {
    title: "You're all set!",
    body: "You're currently in the demo org — explore all the features freely. When you're ready to track your real team, subscribe to get started. Enjoy!",
    icon: '✅',
  },
]

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0)
  const s = styles
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div style={s.overlay}>
      <div style={s.card}>

        {/* Dots */}
        <div style={s.dots}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ ...s.dot, ...(i === step ? s.dotActive : i < step ? s.dotVisited : {}) }} />
          ))}
        </div>

        {/* Content */}
        <div style={s.icon}>{current.icon}</div>
        <h2 style={s.title}>{current.title}</h2>
        <p style={s.body}>{current.body}</p>

        {/* Actions */}
        <div style={s.actions}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={s.backBtn}>← Back</button>
          )}
          <button
            onClick={isLast ? onClose : () => setStep(s => s + 1)}
            style={s.nextBtn}
          >
            {isLast ? "Let's Go →" : 'Next →'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={onClose} style={s.skipBtn}>Skip tour</button>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
    padding: '36px 32px 28px', width: '100%', maxWidth: 480,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 16, position: 'relative',
    fontFamily: "'Barlow Condensed', sans-serif",
  },

  // Step dots
  dots: { display: 'flex', gap: 8, marginBottom: 8 },
  dot: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#2a2f42', transition: 'background 0.2s',
  },
  dotActive: { background: '#00e5a0' },
  dotVisited: { background: '#4a5068' },

  // Content
  icon: { fontSize: 44, lineHeight: 1 },
  title: {
    fontSize: 24, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
    color: '#e8eaf0', margin: 0, textAlign: 'center',
  },
  body: {
    fontSize: 15, color: '#7a8099', lineHeight: 1.65,
    textAlign: 'center', margin: 0, maxWidth: 380,
  },

  // Buttons
  actions: {
    display: 'flex', gap: 10, width: '100%', justifyContent: 'center',
    marginTop: 8,
  },
  backBtn: {
    background: 'none', border: '1px solid #2a2f42', borderRadius: 8,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14, fontWeight: 700, padding: '10px 20px',
    textTransform: 'uppercase', cursor: 'pointer',
  },
  nextBtn: {
    background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 900,
    padding: '10px 28px', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },
  skipBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    fontWeight: 700, color: '#4a5068', marginTop: 4,
  },
}

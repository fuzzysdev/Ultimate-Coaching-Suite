import React from 'react'

const FEATURES = [
  {
    title: 'Rosters',
    icon: '👥',
    steps: [
      'Create an organization and invite your coaching staff.',
      'Add players with name, gender, position (handler / cutter / both), and grade.',
      'Build multiple rosters per org — A team, B team, youth divisions.',
    ],
  },
  {
    title: 'Game Sheet',
    icon: '📋',
    steps: [
      'Set up a game with opponent name, start time, and gender ratio rules.',
      "Track each point: who's on the line, who scored, who got the assist.",
      'The grid shows gender counts per point and running score in real time.',
    ],
  },
  {
    title: 'Tryouts',
    icon: '🏆',
    steps: [
      'Create a tryout session and add players — from a roster or from scratch.',
      'Rate each player across attributes you define.',
      'Drag-to-rank your final cut list and export it for your staff.',
    ],
  },
  {
    title: 'Attendance',
    icon: '✓',
    steps: [
      'Add practice sessions to any roster.',
      'Mark each player present or absent per session.',
      'See attendance rates at a glance across the season.',
    ],
  },
]

const GETTING_STARTED = [
  { n: '1', title: 'Sign up', desc: 'Create your account — individual coaches get a 30-day free trial.' },
  { n: '2', title: 'Create a roster', desc: 'Name your team and add your players. Import from a spreadsheet or add one by one.' },
  { n: '3', title: 'Add players', desc: 'Fill in names, positions, gender, and grade. Takes about 30 seconds per player.' },
  { n: '4', title: 'Run a game', desc: 'Open Game Sheet, set up the match, and start tracking points live from your phone.' },
]

export default function HowItWorksPage({ onSignIn, onSignUp }) {
  const s = styles

  const handleBack = () => {
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <button onClick={handleBack} style={s.navLogo}>
          UCS <span style={s.navLogoSub}>Ultimate Coaching Suite</span>
        </button>
        <div style={s.navLinks}>
          {onSignIn && <button onClick={onSignIn} style={s.navSignIn}>Sign In</button>}
          {onSignUp && <button onClick={onSignUp} style={s.navGetStarted}>Get Started</button>}
        </div>
      </nav>

      {/* ── Intro ── */}
      <section style={s.intro}>
        <h1 style={s.introTitle}>How It Works</h1>
        <p style={s.introText}>
          Ultimate Coaching Suite is a web app built specifically for ultimate frisbee coaching.
          It replaces the spreadsheets, whiteboards, and paper scorecards your staff uses today
          with a fast, mobile-friendly tool you can use on the sideline.
        </p>
      </section>

      {/* ── Feature deep-dives ── */}
      <div style={s.features}>
        {FEATURES.map((f, i) => (
          <section key={f.title} style={{ ...s.featureSection, ...(i % 2 === 1 ? s.featureSectionAlt : {}) }}>
            <div style={s.featureInner}>
              <div style={s.featureLeft}>
                <div style={s.featureIcon}>{f.icon}</div>
                <h2 style={s.featureTitle}>{f.title}</h2>
              </div>
              <ul style={s.featureSteps}>
                {f.steps.map((step, j) => (
                  <li key={j} style={s.featureStep}>
                    <span style={s.featureStepDot} />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      {/* ── Getting started steps ── */}
      <section style={s.gettingStarted}>
        <h2 style={s.gsTitle}>Getting Started</h2>
        <div style={s.gsGrid}>
          {GETTING_STARTED.map(step => (
            <div key={step.n} style={s.gsCard}>
              <div style={s.gsNum}>{step.n}</div>
              <div style={s.gsCardTitle}>{step.title}</div>
              <p style={s.gsCardDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={s.cta}>
        <h2 style={s.ctaTitle}>Ready to get started?</h2>
        <p style={s.ctaSub}>Free 30-day trial for individual coaches. No credit card required to start.</p>
        {onSignUp && (
          <button onClick={onSignUp} style={s.ctaBtn}>Start Free Trial</button>
        )}
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <button onClick={handleBack} style={s.footerLink}>← Back to home</button>
        {onSignIn && <button onClick={onSignIn} style={s.footerLink}>Sign In</button>}
        <div style={s.footerCopy}>© {new Date().getFullYear()} Ultimate Coaching Suite</div>
      </footer>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', background: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", color: '#e8eaf0',
  },

  // Nav
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 2rem', borderBottom: '1px solid #2a2f42',
    position: 'sticky', top: 0, background: '#0f1117', zIndex: 100,
  },
  navLogo: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 20, fontWeight: 900, color: '#00e5a0',
    textTransform: 'uppercase', letterSpacing: 1, padding: 0,
  },
  navLogoSub: { color: '#7a8099', fontWeight: 400, fontSize: 14, marginLeft: 8 },
  navLinks: { display: 'flex', gap: 10 },
  navSignIn: {
    background: 'none', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 700, padding: '6px 16px',
    textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },
  navGetStarted: {
    background: '#00e5a0', border: 'none', borderRadius: 6, color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 900,
    padding: '6px 16px', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },

  // Intro
  intro: {
    maxWidth: 640, margin: '0 auto', padding: '64px 24px 40px',
    textAlign: 'center',
  },
  introTitle: {
    fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 20px',
  },
  introText: {
    fontSize: 16, color: '#7a8099', lineHeight: 1.65, margin: 0,
  },

  // Features
  features: { display: 'flex', flexDirection: 'column' },
  featureSection: { padding: '48px 24px', background: '#0f1117' },
  featureSectionAlt: { background: '#181c26' },
  featureInner: {
    maxWidth: 760, margin: '0 auto',
    display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap',
  },
  featureLeft: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 },
  featureIcon: { fontSize: 36 },
  featureTitle: {
    fontSize: 22, fontWeight: 900, textTransform: 'uppercase',
    letterSpacing: 0.5, margin: 0, color: '#e8eaf0',
  },
  featureSteps: {
    flex: 1, listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  featureStep: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    fontSize: 15, color: '#b0b8d0', lineHeight: 1.5,
  },
  featureStepDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#00e5a0',
    flexShrink: 0, marginTop: 6,
  },

  // Getting Started
  gettingStarted: {
    padding: '64px 24px', maxWidth: 960, margin: '0 auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  gsTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 40px',
    textAlign: 'center',
  },
  gsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 20, width: '100%',
  },
  gsCard: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 12,
    padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  gsNum: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'rgba(0,229,160,0.12)', border: '2px solid #00e5a0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 900, color: '#00e5a0',
  },
  gsCardTitle: { fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 },
  gsCardDesc: { fontSize: 13, color: '#7a8099', lineHeight: 1.5, margin: 0 },

  // CTA
  cta: {
    background: '#181c26', borderTop: '1px solid #2a2f42', borderBottom: '1px solid #2a2f42',
    padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  ctaTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: 1, margin: 0, textAlign: 'center',
  },
  ctaSub: { fontSize: 15, color: '#7a8099', textAlign: 'center', margin: 0, maxWidth: 440 },
  ctaBtn: {
    background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    padding: '14px 32px', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
    marginTop: 8,
  },

  // Footer
  footer: {
    padding: '32px 24px', display: 'flex', flexWrap: 'wrap',
    justifyContent: 'center', alignItems: 'center', gap: 16,
    borderTop: '1px solid #2a2f42',
  },
  footerLink: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
    fontWeight: 700, color: '#7a8099',
  },
  footerCopy: { fontSize: 12, color: '#4a5068', width: '100%', textAlign: 'center' },
}

import React from 'react'

const FEATURES = [
  {
    title: 'Game Sheet',
    icon: '📋',
    desc: 'Live scoring grid with per-point player tracking. See who played, gender ratios, and score progression in real time.',
  },
  {
    title: 'Roster Management',
    icon: '👥',
    desc: 'Build your team with player profiles, positions (handler/cutter/both), gender, and grade — all searchable and exportable.',
  },
  {
    title: 'Tryout Rankings',
    icon: '🏆',
    desc: 'Rate players across multiple sessions and drag-to-rank your final cut list. No spreadsheets required.',
  },
  {
    title: 'Attendance Tracking',
    icon: '✓',
    desc: 'Track practice attendance per roster. See who shows up and keep your team accountable.',
  },
]

const STEPS = [
  { n: '1', label: 'Sign up for free', desc: '30-day trial, no card required' },
  { n: '2', label: 'Build your roster', desc: 'Add players in seconds' },
  { n: '3', label: 'Run your first game', desc: 'Live scoring, right from your phone' },
]

const PLANS = [
  {
    label: 'Individual Coach',
    price: '$10/mo',
    note: 'or $100/yr — save 20%',
    features: ['Full access to all tools', '1 coach license', '30-day free trial'],
    cta: 'Start Free Trial',
  },
  {
    label: '5-Coach Team',
    price: '$400/yr',
    note: '$80/coach/yr',
    features: ['Full access to all tools', '5 coach licenses', 'Admin seat management'],
    cta: 'Get Started',
  },
  {
    label: '10-Coach Team',
    price: '$600/yr',
    note: '$60/coach/yr',
    features: ['Full access to all tools', '10 coach licenses', 'Admin seat management'],
    cta: 'Get Started',
  },
]

export default function LandingPage({ onSignIn, onSignUp }) {
  const s = styles

  const handleHowItWorks = () => {
    window.history.pushState({}, '', '/how-it-works')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.navLogo}>UCS <span style={s.navLogoSub}>Ultimate Coaching Suite</span></div>
        <button onClick={onSignIn} style={s.navSignIn}>Sign In</button>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero}>
        <h1 style={s.heroTitle}>
          The coaching tool<br />
          <span style={s.heroAccent}>built for ultimate.</span>
        </h1>
        <p style={s.heroSub}>
          Game sheets, rosters, tryouts, and attendance — all in one app designed
          for ultimate frisbee coaches who care about the details.
        </p>
        <div style={s.heroCtas}>
          <button onClick={onSignUp} style={s.ctaPrimary}>Get Started — Free Trial</button>
          <button onClick={onSignIn} style={s.ctaSecondary}>Sign In</button>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Everything your coaching staff needs</h2>
        <div style={s.featureGrid}>
          {FEATURES.map(f => (
            <div key={f.title} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div style={s.featureCardTitle}>{f.title}</div>
              <p style={s.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works teaser ── */}
      <section style={s.sectionDark}>
        <h2 style={s.sectionTitle}>Up and running in minutes</h2>
        <div style={s.stepsRow}>
          {STEPS.map((step, i) => (
            <React.Fragment key={step.n}>
              <div style={s.step}>
                <div style={s.stepNum}>{step.n}</div>
                <div style={s.stepLabel}>{step.label}</div>
                <div style={s.stepDesc}>{step.desc}</div>
              </div>
              {i < STEPS.length - 1 && <div style={s.stepArrow}>→</div>}
            </React.Fragment>
          ))}
        </div>
        <button onClick={handleHowItWorks} style={s.howLink}>
          See how it works →
        </button>
      </section>

      {/* ── Pricing ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Simple, transparent pricing</h2>
        <p style={s.sectionSub}>Individual coaches and org teams both get full access to every feature.</p>
        <div style={s.pricingGrid}>
          {PLANS.map(plan => (
            <div key={plan.label} style={{ ...s.pricingCard, ...(plan.highlight ? s.pricingCardHL : {}) }}>
              {plan.highlight && <div style={s.popularBadge}>Most Popular</div>}
              <div style={s.planLabel}>{plan.label}</div>
              <div style={s.planPrice}>{plan.price}</div>
              <div style={s.planNote}>{plan.note}</div>
              <ul style={s.planFeatures}>
                {plan.features.map(f => (
                  <li key={f} style={s.planFeatureItem}>
                    <span style={s.checkMark}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignUp} style={{ ...s.planCta, ...(plan.highlight ? s.planCtaHL : {}) }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerLogo}>UCS</div>
        <div style={s.footerLinks}>
          <button onClick={onSignIn} style={s.footerLink}>Sign In</button>
          <span style={s.footerDot}>·</span>
          <button onClick={handleHowItWorks} style={s.footerLink}>How It Works</button>
        </div>
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
    fontSize: 20, fontWeight: 900, color: '#00e5a0',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  navLogoSub: { color: '#7a8099', fontWeight: 400, fontSize: 14, marginLeft: 8 },
  navSignIn: {
    background: 'none', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 700, padding: '6px 16px',
    textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },

  // Hero
  hero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', padding: '80px 24px 64px',
    maxWidth: 720, margin: '0 auto',
  },
  heroTitle: {
    fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.1,
    margin: '0 0 20px', color: '#e8eaf0',
  },
  heroAccent: { color: '#00e5a0' },
  heroSub: {
    fontSize: 17, color: '#7a8099', lineHeight: 1.6,
    maxWidth: 540, margin: '0 0 36px',
  },
  heroCtas: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: {
    background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    padding: '14px 28px', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },
  ctaSecondary: {
    background: 'none', border: '1px solid #2a2f42', borderRadius: 8, color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700,
    padding: '14px 28px', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },

  // Sections
  section: {
    padding: '64px 24px', maxWidth: 960, margin: '0 auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  sectionDark: {
    padding: '64px 24px', background: '#181c26',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: 1,
    color: '#e8eaf0', margin: '0 0 12px', textAlign: 'center',
  },
  sectionSub: {
    fontSize: 15, color: '#7a8099', textAlign: 'center',
    margin: '0 0 40px', maxWidth: 500,
  },

  // Features
  featureGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20, width: '100%', marginTop: 40,
  },
  featureCard: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 12,
    padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  featureIcon: { fontSize: 28 },
  featureCardTitle: {
    fontSize: 16, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: 0.5, color: '#e8eaf0',
  },
  featureDesc: { fontSize: 13, color: '#7a8099', lineHeight: 1.5, margin: 0 },

  // Steps
  stepsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexWrap: 'wrap', gap: 16, marginTop: 40, marginBottom: 32,
  },
  step: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 8, maxWidth: 160, textAlign: 'center',
  },
  stepNum: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(0,229,160,0.12)', border: '2px solid #00e5a0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 900, color: '#00e5a0',
  },
  stepLabel: { fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 },
  stepDesc: { fontSize: 12, color: '#7a8099' },
  stepArrow: { fontSize: 24, color: '#2a2f42', flexShrink: 0 },
  howLink: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
    color: '#00e5a0', letterSpacing: 0.3,
  },

  // Pricing
  pricingGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 20, width: '100%', marginTop: 40,
  },
  pricingCard: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 14,
    padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 12,
    position: 'relative',
  },
  pricingCardHL: { border: '1px solid #00e5a0' },
  popularBadge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    background: '#00e5a0', color: '#0f1117', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 900, padding: '2px 12px', borderRadius: 20,
    textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
  },
  planLabel: { fontSize: 17, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 },
  planPrice: { fontSize: 28, fontWeight: 900, color: '#e8eaf0' },
  planNote: { fontSize: 12, color: '#7a8099' },
  planFeatures: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  planFeatureItem: { fontSize: 13, color: '#b0b8d0', display: 'flex', alignItems: 'center', gap: 6 },
  checkMark: { color: '#00e5a0', fontWeight: 900, flexShrink: 0 },
  planCta: {
    marginTop: 'auto', background: '#2a2f42', border: 'none', borderRadius: 8, color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 900,
    padding: '12px 0', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },
  planCtaHL: { background: '#00e5a0', color: '#0f1117' },

  // Footer
  footer: {
    borderTop: '1px solid #2a2f42', padding: '32px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  footerLogo: {
    fontSize: 18, fontWeight: 900, color: '#00e5a0',
    textTransform: 'uppercase', letterSpacing: 2,
  },
  footerLinks: { display: 'flex', alignItems: 'center', gap: 8 },
  footerLink: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
    fontWeight: 700, color: '#7a8099',
  },
  footerDot: { color: '#2a2f42' },
  footerCopy: { fontSize: 12, color: '#4a5068' },
}

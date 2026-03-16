import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import UserProfileModal from '../Components/UserProfileModal'
import RostersPage from './RostersPage'
import TryoutsPage from './TryoutsPage'
import GameSheetPage from './GameSheetPage'
import AttendancePage from './Attendance'
import PlaceholderPage from './PlaceholderPage'


const NAV_ITEMS = [
  { key: 'rosters',     label: 'Rosters' },
  { key: 'tryouts',     label: 'Tryouts' },
  { key: 'gamesheet',   label: 'Game Sheet' },
  { key: 'attendance',  label: 'Attendance' },
  { key: 'stats',       label: 'Stats' },
  { key: 'tournaments', label: 'Tournaments' },
]

function MainShell({ session }) {
  const [organizations,  setOrganizations]  = useState([])
  const [selectedOrg,    setSelectedOrg]    = useState(null)
  const [rosters,        setRosters]        = useState([])
  const [selectedRoster, setSelectedRoster] = useState(null)
  const [currentApp,     setCurrentApp]     = useState('rosters')
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [toast,          setToast]          = useState(null)
  const [loadingOrgs,    setLoadingOrgs]    = useState(true)
  const isOnline = useOnlineStatus()

  useEffect(() => { fetchOrganizations() }, [])
  useEffect(() => { if (selectedOrg) fetchRosters(selectedOrg.id) }, [selectedOrg])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const autoJoinDemoOrg = async () => {
    // Uses a SECURITY DEFINER RPC to bypass RLS — new users can't see any
    // orgs yet so a direct SELECT on 'organizations' returns nothing.
    await supabase.rpc('join_demo_org')
  }

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true)
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id, organizations(id, name)')
        .eq('user_id', session.user.id)
      if (error) throw error

      let orgs = data.map(row => row.organizations).filter(Boolean)

      if (orgs.length === 0) {
        await autoJoinDemoOrg()
        const { data: retry } = await supabase
          .from('user_organizations')
          .select('organization_id, organizations(id, name)')
          .eq('user_id', session.user.id)
        orgs = (retry || []).map(row => row.organizations).filter(Boolean)
      }

      setOrganizations(orgs)
      if (orgs.length > 0) {
        const savedOrgId = localStorage.getItem(`selectedOrg_${session.user.id}`)
        const savedOrg = savedOrgId && orgs.find(o => o.id === savedOrgId)
        setSelectedOrg(savedOrg || orgs[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrgs(false)
    }
  }

  const fetchRosters = async (orgId) => {
    const { data } = await supabase
      .from('rosters')
      .select('id, name, age_group, gender_type')
      .eq('organization_id', orgId)
      .order('name')
    const rosterList = data || []
    setRosters(rosterList)
    const savedRosterId = localStorage.getItem(`selectedRoster_${session.user.id}`)
    const savedRoster = savedRosterId && rosterList.find(r => r.id === savedRosterId)
    setSelectedRoster(savedRoster || rosterList[0] || null)
  }

  const handleOrgChange = (e) => {
    const org = organizations.find(o => o.id === e.target.value)
    setSelectedOrg(org)
    setSelectedRoster(null)
    localStorage.setItem(`selectedOrg_${session.user.id}`, org.id)
  }

  const handleRosterChange = (e) => {
    const roster = rosters.find(r => r.id === e.target.value)
    setSelectedRoster(roster)
    localStorage.setItem(`selectedRoster_${session.user.id}`, roster.id)
  }

  const handleLogout = () => {
    localStorage.removeItem(`selectedOrg_${session.user.id}`)
    localStorage.removeItem(`selectedRoster_${session.user.id}`)
    supabase.auth.signOut()
  }

  // Called by UserProfileModal after any org membership change
  const handleOrgChanged = (toastMsg) => {
    fetchOrganizations()
    if (toastMsg) showToast(toastMsg)
  }

  const renderApp = () => {
    if (!selectedOrg) {
      return (
        <div style={styles.noOrg}>
          <div style={{ fontSize: 40 }}>🥏</div>
          <p>Tap your profile to join or create an organization.</p>
        </div>
      )
    }
    switch (currentApp) {
      case 'rosters':
        return <RostersPage org={selectedOrg} session={session} onRostersChanged={() => fetchRosters(selectedOrg.id)} />
      case 'tryouts':
        return <TryoutsPage org={selectedOrg} session={session} />
      case 'gamesheet':
        return <GameSheetPage org={selectedOrg} roster={selectedRoster} />
      case 'attendance':
        return <AttendancePage org={selectedOrg} session={session} roster={selectedRoster} />
      default:
        return <PlaceholderPage appName={NAV_ITEMS.find(n => n.key === currentApp)?.label} />
    }
  }

  const s = styles
  return (
    <div style={s.container}>
      {showProfileModal && (
        <UserProfileModal
          session={session}
          selectedOrg={selectedOrg}
          onClose={() => setShowProfileModal(false)}
          onRostersRefresh={() => fetchRosters(selectedOrg?.id)}
          onSignOut={handleLogout}
          onOrgChanged={handleOrgChanged}
        />
      )}

      {!isOnline && (
        <div style={s.offlineBanner}>
          Offline — changes will sync when connection is restored
        </div>
      )}

      {toast && <div style={s.toast}>✓ {toast}</div>}

      {/* Top Bar */}
      <header style={s.header}>
        <h1 style={s.logo}>
          UCS <span style={s.logoSub}>Ultimate Coaching Suite</span>
        </h1>

        {/* Centre — org + roster selectors */}
        <div style={s.selectors}>
          {organizations.length > 0 && (
            <div style={s.selectorGroup}>
              <label style={s.selectorLabel}>Org</label>
              <select value={selectedOrg?.id || ''} onChange={handleOrgChange} style={s.select}>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          {rosters.length > 0 && (
            <div style={s.selectorGroup}>
              <label style={s.selectorLabel}>Roster</label>
              <select value={selectedRoster?.id || ''} onChange={handleRosterChange} style={s.select}>
                {rosters.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={s.headerRight}>
          <button onClick={() => setShowProfileModal(true)} style={s.profileBtn} title={session.user.email}>
            🥏
          </button>
        </div>
      </header>

      {/* Nav Bar */}
      <nav style={s.nav}>
        {NAV_ITEMS.map(item => (
          <button key={item.key} onClick={() => setCurrentApp(item.key)}
            style={{ ...s.navBtn, ...(currentApp === item.key ? s.navBtnActive : {}) }}>
            {item.label}
          </button>
        ))}
      </nav>

      {/* App Content */}
      <div key={currentApp} style={s.content}>
        {loadingOrgs ? <div style={s.loading}>Loading...</div> : renderApp()}
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f1117' },
  offlineBanner: {
    background: '#2a1f0a', borderBottom: '1px solid #7a4a0a',
    color: '#fbbf24', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '12px', fontWeight: '700', textAlign: 'center',
    padding: '6px 16px', letterSpacing: '0.5px', textTransform: 'uppercase'
  },
  toast: {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: '#00e5a0', color: '#0f1117', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '14px', fontWeight: '700', padding: '10px 22px', borderRadius: '30px',
    zIndex: 1000, whiteSpace: 'nowrap', letterSpacing: '0.5px'
  },
  header: {
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    padding: '10px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
    position: 'sticky', top: 0, zIndex: 100
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#00e5a0', textTransform: 'uppercase',
    letterSpacing: '1px', whiteSpace: 'nowrap', margin: 0
  },
  logoSub: { color: '#7a8099', fontWeight: '400', fontSize: '13px', letterSpacing: '0.5px', marginLeft: '8px' },
  selectors: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, justifyContent: 'center' },
  selectorGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
  selectorLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#7a8099'
  },
  select: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: '600',
    padding: '6px 10px', borderRadius: '6px', outline: 'none', cursor: 'pointer'
  },
  headerRight: { display: 'flex', alignItems: 'center' },
  profileBtn: {
    background: 'none', border: 'none', fontSize: '24px', lineHeight: 1,
    cursor: 'pointer', padding: '4px', borderRadius: '6px', flexShrink: 0
  },
  nav: {
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    padding: '0 16px', display: 'flex', gap: '2px', overflowX: 'auto'
  },
  navBtn: {
    background: 'none', border: 'none', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '12px 16px', cursor: 'pointer', textTransform: 'uppercase',
    letterSpacing: '0.5px', borderBottom: '2px solid transparent', whiteSpace: 'nowrap'
  },
  navBtnActive: { color: '#00e5a0', borderBottomColor: '#00e5a0' },
  content: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#0f1117' },
  loading: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    flex: 1, color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase'
  },
  noOrg: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, gap: '12px',
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px'
  },
}

export default MainShell

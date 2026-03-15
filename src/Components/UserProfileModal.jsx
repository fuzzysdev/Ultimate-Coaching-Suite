import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import InviteModal from './InviteModal'
import CreateOrgModal from './CreateOrgModal'

function UserProfileModal({ session, selectedOrg, onClose, onRostersRefresh, onSignOut, onOrgChanged }) {
  const [activeTab,       setActiveTab]       = useState('profile')
  const [orgMemberships,  setOrgMemberships]  = useState([])
  const [loadingOrgs,     setLoadingOrgs]     = useState(true)
  const [orgError,        setOrgError]        = useState(null)
  const [refreshing,      setRefreshing]      = useState(false)
  const [resetStatus,     setResetStatus]     = useState(null) // null | 'sending' | 'sent' | 'error'
  const [confirmLeaveId,  setConfirmLeaveId]  = useState(null)
  const [leaving,         setLeaving]         = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateOrg,   setShowCreateOrg]   = useState(false)

  useEffect(() => { fetchMemberships() }, [])

  const fetchMemberships = async () => {
    setLoadingOrgs(true)
    setOrgError(null)
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id, role, organizations(name)')
        .eq('user_id', session.user.id)
        .order('role', { ascending: true })
      if (error) throw error
      setOrgMemberships((data || []).map(row => ({
        orgId:   row.organization_id,
        orgName: row.organizations?.name || 'Unknown',
        role:    row.role,
      })))
    } catch (err) {
      console.error(err)
      setOrgError('Could not load organizations.')
    } finally {
      setLoadingOrgs(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRostersRefresh()
    setRefreshing(false)
  }

  const handleResetPassword = async () => {
    setResetStatus('sending')
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email)
    if (error) { console.error(error); setResetStatus('error') }
    else setResetStatus('sent')
  }

  const handleLeave = async (orgId, orgName, role) => {
    setLeaving(true)
    setOrgError(null)
    try {
      if (role === 'admin') {
        const { data: admins } = await supabase
          .from('user_organizations').select('user_id')
          .eq('organization_id', orgId).eq('role', 'admin')
        if ((admins || []).length <= 1) {
          setOrgError(`You are the only admin of ${orgName}. Transfer admin rights before leaving.`)
          setConfirmLeaveId(null)
          return
        }
      }
      const { error } = await supabase.from('user_organizations')
        .delete().eq('user_id', session.user.id).eq('organization_id', orgId)
      if (error) throw error
      setConfirmLeaveId(null)
      setOrgMemberships(prev => prev.filter(m => m.orgId !== orgId))
      onOrgChanged()
    } catch (err) {
      console.error(err)
      setOrgError('Failed to leave organization.')
    } finally {
      setLeaving(false)
    }
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* Nested modals — rendered inside so they stack above the profile modal */}
        {showInviteModal && (
          <InviteModal
            org={selectedOrg}
            userId={session.user.id}
            onClose={() => setShowInviteModal(false)}
            onJoined={(orgName) => {
              setShowInviteModal(false)
              fetchMemberships()
              onOrgChanged(`Joined ${orgName}!`)
            }}
          />
        )}
        {showCreateOrg && (
          <CreateOrgModal
            userId={session.user.id}
            onClose={() => setShowCreateOrg(false)}
            onCreated={(org) => {
              setShowCreateOrg(false)
              fetchMemberships()
              onOrgChanged(`Created ${org.name}!`)
            }}
          />
        )}

        {/* Header */}
        <div style={s.modalHeader}>
          <div style={s.frisbeeIcon}>🥏</div>
          <div style={s.headerMeta}>
            <div style={s.profileEmail}>{session.user.email}</div>
            <div style={s.version}>v{__APP_VERSION__}</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* Tab Bar */}
        <div style={s.tabBar}>
          <button onClick={() => setActiveTab('profile')}
            style={{ ...s.tab, ...(activeTab === 'profile' ? s.tabActive : {}) }}>
            Profile
          </button>
          <button onClick={() => setActiveTab('orgs')}
            style={{ ...s.tab, ...(activeTab === 'orgs' ? s.tabActive : {}) }}>
            Organizations
          </button>
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <>
            <div style={s.section}>
              <div style={s.sectionLabel}>App</div>
              <div style={s.btnRow}>
                <button onClick={handleRefresh} disabled={refreshing || orgMemberships.length === 0} style={s.halfBtn}>
                  {refreshing ? 'Refreshing…' : 'Refresh Rosters'}
                </button>
                <button onClick={() => window.location.reload()} style={s.halfBtn}>
                  Reload App
                </button>
              </div>
            </div>

            <div style={s.divider} />

            <div style={s.section}>
              <div style={s.sectionLabel}>Reset Password</div>
              {resetStatus === 'sent' ? (
                <p style={s.successMsg}>Reset email sent — check your inbox.</p>
              ) : (
                <>
                  <button onClick={handleResetPassword} disabled={resetStatus === 'sending'} style={s.ghostBtn}>
                    {resetStatus === 'sending' ? 'Sending...' : 'Send Reset Email'}
                  </button>
                  {resetStatus === 'error' && (
                    <div style={{ ...s.error, marginTop: 8 }}>Failed to send. Please try again.</div>
                  )}
                </>
              )}
            </div>

            <div style={s.divider} />

            <button onClick={onSignOut} style={s.signOutBtn}>Sign Out</button>
          </>
        )}

        {/* ── ORGANIZATIONS TAB ── */}
        {activeTab === 'orgs' && (
          <>
            {orgError && <div style={{ ...s.error, marginBottom: 12 }}>{orgError}</div>}

            <div style={s.section}>
              <div style={s.sectionLabel}>My Organizations</div>
              {loadingOrgs ? (
                <p style={s.muted}>Loading...</p>
              ) : orgMemberships.length === 0 ? (
                <p style={s.muted}>No organizations yet.</p>
              ) : (
                orgMemberships.map((m) => (
                  <div key={m.orgId} style={s.orgRow}>
                    <div style={s.orgRowLeft}>
                      <span style={s.orgName}>{m.orgName}</span>
                      <span style={{ ...s.roleBadge, ...(m.role === 'admin' ? s.roleAdmin : s.roleMember) }}>
                        {m.role}
                      </span>
                    </div>
                    {confirmLeaveId === m.orgId ? (
                      <div style={s.confirmRow}>
                        <span style={s.confirmText}>Leave?</span>
                        <button onClick={() => handleLeave(m.orgId, m.orgName, m.role)}
                          disabled={leaving}
                          style={s.confirmYes}>
                          {leaving ? '...' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmLeaveId(null)} style={s.confirmNo}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setOrgError(null); setConfirmLeaveId(m.orgId) }}
                        style={s.leaveBtn}>
                        Leave
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={s.divider} />

            <div style={s.section}>
              <div style={s.sectionLabel}>Join or Create</div>
              <div style={s.btnCol}>
                <button onClick={() => setShowInviteModal(true)} style={s.ghostBtn}>
                  + Join with Invite Code
                </button>
                <button onClick={() => setShowCreateOrg(true)} style={s.ghostBtn}>
                  + Create New Organization
                </button>
              </div>
            </div>

            <div style={s.divider} />

            <div style={s.section}>
              <button onClick={handleRefresh} disabled={refreshing || orgMemberships.length === 0} style={s.ghostBtn}>
                {refreshing ? 'Refreshing…' : 'Refresh Rosters'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px',
    width: '100%', maxWidth: '480px', padding: '20px 20px 24px',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  frisbeeIcon: { fontSize: '28px', lineHeight: 1, flexShrink: 0 },
  headerMeta: { flex: 1, minWidth: 0 },
  profileEmail: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    color: '#e8eaf0', letterSpacing: '0.3px', wordBreak: 'break-all',
  },
  version: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    color: '#3a3f52', letterSpacing: '1px', marginTop: 2,
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', flexShrink: 0,
  },

  // Tabs
  tabBar: { display: 'flex', gap: 4, marginBottom: 16 },
  tab: {
    flex: 1, background: 'none', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    letterSpacing: '0.5px', padding: '8px 12px', borderRadius: '6px',
    cursor: 'pointer', textTransform: 'uppercase',
  },
  tabActive: { background: '#00e5a0', borderColor: '#00e5a0', color: '#0f1117' },

  divider: { height: 1, background: '#2a2f42', margin: '14px 0' },
  section: { marginBottom: '4px' },
  sectionLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: '700',
    letterSpacing: '1px', textTransform: 'uppercase', color: '#7a8099', marginBottom: '8px',
  },

  // Org list
  orgRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #2a2f42',
  },
  orgRowLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  orgName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '0.5px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  roleBadge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: '700',
    letterSpacing: '0.5px', textTransform: 'uppercase', borderRadius: '20px',
    padding: '2px 8px', border: '1px solid', flexShrink: 0,
  },
  roleAdmin:  { background: 'rgba(0,229,160,0.12)', borderColor: 'rgba(0,229,160,0.25)', color: '#00e5a0' },
  roleMember: { background: 'rgba(122,128,153,0.12)', borderColor: 'rgba(122,128,153,0.25)', color: '#7a8099' },

  leaveBtn: {
    background: 'transparent', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px',
    cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0,
  },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  confirmText: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', color: '#ff4d6d', fontWeight: '700',
  },
  confirmYes: {
    background: '#ff4d6d', border: 'none', color: '#fff',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', fontWeight: '800',
    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase',
  },
  confirmNo: {
    background: 'transparent', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', fontWeight: '700',
    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase',
  },

  // Buttons
  btnRow: { display: 'flex', gap: 8 },
  btnCol: { display: 'flex', flexDirection: 'column', gap: 8 },
  halfBtn: {
    flex: 1, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '800', padding: '9px 4px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer',
  },
  ghostBtn: {
    width: '100%', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '800', padding: '9px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer',
  },
  signOutBtn: {
    width: '100%', background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '9px', borderRadius: '8px', textTransform: 'uppercase',
    letterSpacing: '0.5px', cursor: 'pointer',
  },
  successMsg: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    color: '#00e5a0', fontWeight: '700', margin: 0,
  },
  muted: { color: '#7a8099', fontSize: '12px', margin: 0 },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.65rem', borderRadius: '8px', fontSize: '0.85rem',
  },
}

export default UserProfileModal

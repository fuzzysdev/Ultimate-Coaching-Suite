import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function UserProfileModal({ session, onClose, onRostersRefresh, onSignOut }) {
  const [orgMemberships, setOrgMemberships] = useState([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [orgError, setOrgError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [resetStatus, setResetStatus] = useState(null) // null | 'sending' | 'sent' | 'error'

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const { data, error } = await supabase
          .from('user_organizations')
          .select('role, organizations(name)')
          .eq('user_id', session.user.id)
          .order('role', { ascending: true })
        if (error) throw error
        setOrgMemberships((data || []).map(row => ({
          orgName: row.organizations?.name || 'Unknown',
          role: row.role
        })))
      } catch (err) {
        console.error(err)
        setOrgError('Could not load organizations.')
      } finally {
        setLoadingOrgs(false)
      }
    }
    fetchMemberships()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRostersRefresh()
    setRefreshing(false)
  }

  const handleResetPassword = async () => {
    setResetStatus('sending')
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email)
    if (error) {
      console.error(error)
      setResetStatus('error')
    } else {
      setResetStatus('sent')
    }
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.modalHeader}>
          <h2 style={s.title}>My Profile</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* Profile */}
        <div style={s.profileSection}>
          <div style={s.frisbeeIcon}>🥏</div>
          <div style={s.profileEmail}>{session.user.email}</div>
        </div>

        <div style={s.divider} />

        {/* Organizations */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Organizations</div>
          {loadingOrgs ? (
            <p style={s.muted}>Loading...</p>
          ) : orgError ? (
            <div style={s.error}>{orgError}</div>
          ) : orgMemberships.length === 0 ? (
            <p style={s.muted}>No organizations.</p>
          ) : (
            orgMemberships.map((m, i) => (
              <div key={i} style={s.orgRow}>
                <span style={s.orgName}>{m.orgName}</span>
                <span style={{ ...s.roleBadge, ...(m.role === 'admin' ? s.roleAdmin : s.roleMember) }}>
                  {m.role}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={s.divider} />

        {/* Refresh Data */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Refresh Data</div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || orgMemberships.length === 0}
            style={s.ghostBtn}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Rosters'}
          </button>
          {orgMemberships.length === 0 && !loadingOrgs && (
            <p style={{ ...s.muted, marginTop: 6, fontSize: 11 }}>Select an organization first.</p>
          )}
        </div>

        <div style={s.divider} />

        {/* App Update */}
        <div style={s.section}>
          <div style={s.sectionLabel}>App Update</div>
          <button onClick={() => window.location.reload()} style={s.ghostBtn}>
            Reload App
          </button>
          <p style={{ ...s.muted, marginTop: 6, fontSize: 11 }}>
            Forces any pending PWA update to activate.
          </p>
        </div>

        <div style={s.divider} />

        {/* Reset Password */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Reset Password</div>
          {resetStatus === 'sent' ? (
            <p style={s.successMsg}>Reset email sent — check your inbox.</p>
          ) : (
            <>
              <button
                onClick={handleResetPassword}
                disabled={resetStatus === 'sending'}
                style={s.ghostBtn}
              >
                {resetStatus === 'sending' ? 'Sending...' : 'Send Reset Email'}
              </button>
              {resetStatus === 'error' && (
                <div style={{ ...s.error, marginTop: 8 }}>Failed to send. Please try again.</div>
              )}
            </>
          )}
        </div>

        <div style={s.divider} />

        {/* Sign Out */}
        <button onClick={onSignOut} style={s.signOutBtn}>Sign Out</button>

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px 16px 0 0',
    width: '100%', maxWidth: '600px', padding: '24px 20px 36px',
    maxHeight: '90vh', overflowY: 'auto'
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px', margin: 0
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer'
  },
  profileSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '4px'
  },
  frisbeeIcon: {
    fontSize: '48px', lineHeight: 1, marginBottom: '10px'
  },
  profileEmail: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px',
    color: '#e8eaf0', letterSpacing: '0.5px', wordBreak: 'break-all', textAlign: 'center'
  },
  divider: { height: 1, background: '#2a2f42', margin: '20px 0' },
  section: { marginBottom: '4px' },
  sectionLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', fontWeight: '700',
    letterSpacing: '1px', textTransform: 'uppercase', color: '#7a8099', marginBottom: '12px'
  },
  orgRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #2a2f42'
  },
  orgName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  roleBadge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', fontWeight: '700',
    letterSpacing: '0.5px', textTransform: 'uppercase', borderRadius: '20px',
    padding: '2px 10px', border: '1px solid'
  },
  roleAdmin: {
    background: 'rgba(0,229,160,0.12)', borderColor: 'rgba(0,229,160,0.25)', color: '#00e5a0'
  },
  roleMember: {
    background: 'rgba(122,128,153,0.12)', borderColor: 'rgba(122,128,153,0.25)', color: '#7a8099'
  },
  ghostBtn: {
    width: '100%', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '11px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer'
  },
  signOutBtn: {
    width: '100%', background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: '700',
    padding: '11px', borderRadius: '8px', textTransform: 'uppercase',
    letterSpacing: '0.5px', cursor: 'pointer'
  },
  successMsg: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    color: '#00e5a0', fontWeight: '700', margin: 0
  },
  muted: { color: '#7a8099', fontSize: '13px', margin: 0 },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem'
  }
}

export default UserProfileModal

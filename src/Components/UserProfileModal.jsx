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

        {/* Profile — icon + email + version on one compact block */}
        <div style={s.profileSection}>
          <div style={s.frisbeeIcon}>🥏</div>
          <div style={s.profileEmail}>{session.user.email}</div>
          <div style={s.version}>v{__APP_VERSION__}</div>
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

        {/* Refresh + Reload — single row */}
        <div style={s.section}>
          <div style={s.sectionLabel}>App</div>
          <div style={s.btnRow}>
            <button
              onClick={handleRefresh}
              disabled={refreshing || orgMemberships.length === 0}
              style={s.halfBtn}
            >
              {refreshing ? 'Refreshing…' : 'Refresh Rosters'}
            </button>
            <button onClick={() => window.location.reload()} style={s.halfBtn}>
              Reload App
            </button>
          </div>
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
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px',
    width: '100%', maxWidth: '480px', padding: '20px 20px 28px',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'
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
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: '4px'
  },
  frisbeeIcon: {
    fontSize: '36px', lineHeight: 1, marginBottom: '4px'
  },
  profileEmail: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    color: '#e8eaf0', letterSpacing: '0.5px', wordBreak: 'break-all', textAlign: 'center'
  },
  version: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    color: '#3a3f52', letterSpacing: '1px'
  },
  divider: { height: 1, background: '#2a2f42', margin: '14px 0' },
  section: { marginBottom: '4px' },
  sectionLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: '700',
    letterSpacing: '1px', textTransform: 'uppercase', color: '#7a8099', marginBottom: '8px'
  },
  orgRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid #2a2f42'
  },
  orgName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  roleBadge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: '700',
    letterSpacing: '0.5px', textTransform: 'uppercase', borderRadius: '20px',
    padding: '2px 8px', border: '1px solid'
  },
  roleAdmin: {
    background: 'rgba(0,229,160,0.12)', borderColor: 'rgba(0,229,160,0.25)', color: '#00e5a0'
  },
  roleMember: {
    background: 'rgba(122,128,153,0.12)', borderColor: 'rgba(122,128,153,0.25)', color: '#7a8099'
  },
  btnRow: {
    display: 'flex', gap: 8
  },
  halfBtn: {
    flex: 1, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '800', padding: '9px 4px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer'
  },
  ghostBtn: {
    width: '100%', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '800', padding: '9px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer'
  },
  signOutBtn: {
    width: '100%', background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '9px', borderRadius: '8px', textTransform: 'uppercase',
    letterSpacing: '0.5px', cursor: 'pointer'
  },
  successMsg: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    color: '#00e5a0', fontWeight: '700', margin: 0
  },
  muted: { color: '#7a8099', fontSize: '12px', margin: 0 },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.65rem', borderRadius: '8px', fontSize: '0.85rem'
  }
}

export default UserProfileModal

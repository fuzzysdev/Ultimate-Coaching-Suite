import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const makeCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

function SuperAdminPage({ session }) {
  const [isAdmin, setIsAdmin] = useState(null) // null=checking, true/false=result
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedOrg, setExpandedOrg] = useState(null)
  const [orgMembers, setOrgMembers] = useState({})
  const [loadingMembers, setLoadingMembers] = useState({})

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  const [deletingOrg, setDeletingOrg] = useState(null)
  const [generatedCodes, setGeneratedCodes] = useState({})
  const [copiedCode, setCopiedCode] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { checkAccess() }, [])

  const checkAccess = async () => {
    const { data, error } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) {
      console.error('super_admins query error:', error)
      setError(`Access check failed: ${error.message} (code: ${error.code})`)
      setIsAdmin(false)
      setLoading(false)
      return
    }
    if (!data) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    setIsAdmin(true)
    fetchOrgs()
  }

  const fetchOrgs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('name')
    if (error) setError(error.message)
    setOrgs(data || [])
    setLoading(false)
  }

  const toggleExpand = async (orgId) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null)
      return
    }
    setExpandedOrg(orgId)
    if (orgMembers[orgId]) return
    setLoadingMembers(prev => ({ ...prev, [orgId]: true }))
    const { data, error } = await supabase.rpc('get_org_members', { p_org_id: orgId })
    if (error) setError(error.message)
    setOrgMembers(prev => ({ ...prev, [orgId]: data || [] }))
    setLoadingMembers(prev => ({ ...prev, [orgId]: false }))
  }

  const handleCreateOrg = async (e) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('organizations')
        .insert({ name: newOrgName.trim() })
      if (error) throw error
      setNewOrgName('')
      setShowCreateForm(false)
      fetchOrgs()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteOrg = async () => {
    const org = deletingOrg
    setDeletingOrg(null)
    setError(null)
    // Delete dependent rows first (foreign keys without CASCADE)
    await supabase.from('org_invites').delete().eq('organization_id', org.id)
    await supabase.from('user_organizations').delete().eq('organization_id', org.id)
    const { error } = await supabase.from('organizations').delete().eq('id', org.id)
    if (error) return setError(error.message)
    setOrgs(prev => prev.filter(o => o.id !== org.id))
    if (expandedOrg === org.id) setExpandedOrg(null)
  }

  const handleRemoveMember = async (orgId, userId) => {
    const { error } = await supabase
      .from('user_organizations')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId)
    if (error) return setError(error.message)
    setOrgMembers(prev => ({
      ...prev,
      [orgId]: prev[orgId].filter(m => m.user_id !== userId)
    }))
  }

  const handleGenerateCode = async (org) => {
    setError(null)
    const code = makeCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days for admin-generated
    const { error } = await supabase.from('org_invites').insert({
      organization_id: org.id,
      created_by: session.user.id,
      code,
      expires_at: expiresAt
    })
    if (error) return setError(error.message)
    setGeneratedCodes(prev => ({ ...prev, [org.id]: code }))
  }

  const handleCopyCode = (code, orgId) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(orgId)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const dismissCode = (orgId) => {
    setGeneratedCodes(prev => { const n = { ...prev }; delete n[orgId]; return n })
  }

  const s = styles

  // ── Checking access ──
  if (isAdmin === null) {
    return (
      <div style={s.fullPage}>
        <p style={s.muted}>Checking access...</p>
      </div>
    )
  }

  // ── Access denied ──
  if (!isAdmin) {
    return (
      <div style={s.fullPage}>
        <div style={s.deniedCard}>
          <h1 style={s.deniedTitle}>Access Denied</h1>
          <p style={s.muted}>You do not have super admin privileges.</p>
          {error && (
            <p style={{ color: '#ff4d6d', fontSize: '12px', marginTop: '1rem', wordBreak: 'break-all', textAlign: 'left' }}>
              {error}
            </p>
          )}
          <p style={{ color: '#3a4055', fontSize: '11px', marginTop: '1.5rem', wordBreak: 'break-all', textAlign: 'left', fontFamily: 'monospace' }}>
            Your session UUID:<br />
            <span style={{ color: '#7a8099' }}>{session.user.id}</span>
          </p>
          <button onClick={() => { window.location.href = '/' }} style={s.backBtn}>
            ← Back to App
          </button>
        </div>
      </div>
    )
  }

  // ── Super admin UI ──
  return (
    <div style={s.container}>
      <header style={s.header}>
        <h1 style={s.logo}>
          UCS <span style={s.logoAccent}>Super Admin</span>
        </h1>
        <div style={s.headerRight}>
          <span style={s.userEmail}>{session.user.email}</span>
          <button onClick={() => { window.location.href = '/' }} style={s.headerBtn}>
            ← App
          </button>
          <button onClick={() => supabase.auth.signOut()} style={s.signOutBtn}>
            Sign Out
          </button>
        </div>
      </header>

      <div style={s.content}>
        {error && (
          <div style={s.errorBanner} onClick={() => setError(null)}>
            {error} <span style={{ opacity: 0.6, marginLeft: 8 }}>✕</span>
          </div>
        )}

        {/* Section header */}
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>
            Organizations
            <span style={s.sectionCount}>{orgs.length}</span>
          </h2>
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={s.createBtn}>
            {showCreateForm ? 'Cancel' : '+ New Org'}
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <form onSubmit={handleCreateOrg} style={s.createForm}>
            <input
              type="text"
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="Organization name..."
              autoFocus
              required
              style={s.input}
            />
            <button type="submit" disabled={creating} style={s.saveBtn}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}

        {/* Org list */}
        {loading ? (
          <p style={s.muted}>Loading organizations...</p>
        ) : orgs.length === 0 ? (
          <p style={s.muted}>No organizations yet.</p>
        ) : (
          <div style={s.orgList}>
            {orgs.map(org => (
              <div key={org.id} style={s.orgCard}>

                {/* ── Org row ── */}
                <div style={s.orgRow}>
                  {/* Expand toggle + name */}
                  <button onClick={() => toggleExpand(org.id)} style={s.expandBtn}>
                    <span style={s.expandIcon}>{expandedOrg === org.id ? '▼' : '▶'}</span>
                    <span style={s.orgName}>{org.name}</span>
                  </button>

                  {/* Actions */}
                  <div style={s.orgActions}>
                    {/* Invite code display or button */}
                    {generatedCodes[org.id] ? (
                      <div style={s.codeRow}>
                        <span style={s.codeText}>{generatedCodes[org.id]}</span>
                        <button
                          onClick={() => handleCopyCode(generatedCodes[org.id], org.id)}
                          style={s.copyBtn}
                        >
                          {copiedCode === org.id ? '✓ Copied' : 'Copy'}
                        </button>
                        <button onClick={() => dismissCode(org.id)} style={s.dimBtn}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => handleGenerateCode(org)} style={s.codeBtn}>
                        + Invite Code
                      </button>
                    )}

                    {/* Delete with inline confirm */}
                    {deletingOrg?.id === org.id ? (
                      <div style={s.inlineConfirm}>
                        <span style={s.confirmText}>Delete "{org.name}"?</span>
                        <button onClick={handleDeleteOrg} style={s.confirmYes}>Yes, delete</button>
                        <button onClick={() => setDeletingOrg(null)} style={s.confirmNo}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingOrg(org)} style={s.deleteBtn}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Members section ── */}
                {expandedOrg === org.id && (
                  <div style={s.membersSection}>
                    <div style={s.membersHeader}>
                      <span style={s.membersLabel}>Members</span>
                      <span style={s.orgIdLabel}>Org ID: {org.id}</span>
                    </div>

                    {loadingMembers[org.id] ? (
                      <p style={s.muted}>Loading...</p>
                    ) : !orgMembers[org.id] || orgMembers[org.id].length === 0 ? (
                      <p style={s.muted}>No members yet.</p>
                    ) : (
                      <table style={s.table}>
                        <thead>
                          <tr>
                            <th style={s.th}>Email</th>
                            <th style={s.th}>Role</th>
                            <th style={s.th}>User ID</th>
                            <th style={s.th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgMembers[org.id].map((m, i) => (
                            <tr key={m.user_id} style={{ background: i % 2 === 0 ? '#181c26' : '#1c2030' }}>
                              <td style={s.td}>{m.email}</td>
                              <td style={s.td}>
                                <span style={{
                                  ...s.roleBadge,
                                  background: m.role === 'admin' ? 'rgba(0,229,160,0.1)' : 'rgba(122,128,153,0.08)',
                                  color: m.role === 'admin' ? '#00e5a0' : '#7a8099',
                                  borderColor: m.role === 'admin' ? 'rgba(0,229,160,0.3)' : 'rgba(122,128,153,0.2)'
                                }}>
                                  {m.role}
                                </span>
                              </td>
                              <td style={s.tdMono}>{m.user_id}</td>
                              <td style={{ ...s.td, textAlign: 'right' }}>
                                <button
                                  onClick={() => handleRemoveMember(org.id, m.user_id)}
                                  style={s.removeBtn}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  // full-page states
  fullPage: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    height: '100vh', background: '#0f1117'
  },
  deniedCard: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '12px',
    padding: '2.5rem', textAlign: 'center', maxWidth: '360px', width: '100%'
  },
  deniedTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.8rem',
    fontWeight: '800', color: '#ff4d6d', textTransform: 'uppercase',
    letterSpacing: '1px', marginBottom: '0.75rem'
  },
  backBtn: {
    marginTop: '1.5rem', background: '#00e5a0', color: '#0f1117',
    border: 'none', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '14px', fontWeight: '800', padding: '10px 24px',
    borderRadius: '7px', textTransform: 'uppercase', cursor: 'pointer'
  },
  // main layout
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f1117' },
  header: {
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    padding: '12px 24px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '12px',
    position: 'sticky', top: 0, zIndex: 100
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: 0
  },
  logoAccent: { color: '#a78bfa', marginLeft: '8px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  userEmail: { color: '#7a8099', fontSize: '12px' },
  headerBtn: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: '700',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  signOutBtn: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)',
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
    fontWeight: '700', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  content: { padding: '2rem', maxWidth: '1000px', width: '100%', margin: '0 auto' },
  errorBanner: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem 1rem', borderRadius: '8px',
    marginBottom: '1.5rem', fontSize: '0.9rem', cursor: 'pointer'
  },
  // section
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.25rem'
  },
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.5rem',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px'
  },
  sectionCount: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontSize: '13px', fontWeight: '700', padding: '2px 10px', borderRadius: '20px'
  },
  createBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '800', padding: '8px 18px', borderRadius: '7px',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  createForm: {
    display: 'flex', gap: '10px', marginBottom: '1.5rem',
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: '10px', padding: '1rem'
  },
  input: {
    flex: 1, background: '#0f1117', border: '1px solid #2a2f42',
    color: '#e8eaf0', padding: '10px 14px', borderRadius: '7px',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px',
    fontWeight: '600', outline: 'none'
  },
  saveBtn: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '800', padding: '10px 22px', borderRadius: '7px',
    textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap'
  },
  // org list
  orgList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  orgCard: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px',
    overflow: 'hidden'
  },
  orgRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', gap: '12px', flexWrap: 'wrap'
  },
  expandBtn: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1, minWidth: 0
  },
  expandIcon: { color: '#7a8099', fontSize: '11px', flexShrink: 0 },
  orgName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '0.5px', textAlign: 'left'
  },
  orgActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  // code display
  codeRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  codeText: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px',
    fontWeight: '800', color: '#00e5a0', letterSpacing: '3px',
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    padding: '4px 12px', borderRadius: '6px'
  },
  copyBtn: {
    background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '12px', fontWeight: '700', padding: '5px 10px',
    borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase'
  },
  dimBtn: {
    background: 'none', border: 'none', color: '#7a8099',
    cursor: 'pointer', padding: '4px 6px', fontSize: '13px'
  },
  codeBtn: {
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
    fontWeight: '800', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  deleteBtn: {
    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)',
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
    fontWeight: '700', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
    textTransform: 'uppercase'
  },
  inlineConfirm: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  confirmText: { color: '#ff4d6d', fontSize: '12px', fontWeight: '600' },
  confirmYes: {
    background: '#ff4d6d', color: '#fff', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: '800',
    padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase'
  },
  confirmNo: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: '700',
    padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase'
  },
  // members
  membersSection: {
    borderTop: '1px solid #2a2f42', padding: '16px',
    background: 'rgba(0,0,0,0.15)'
  },
  membersHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '12px'
  },
  membersLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#7a8099'
  },
  orgIdLabel: {
    fontFamily: 'monospace', fontSize: '11px', color: '#3a4055'
  },
  table: { width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' },
  th: {
    padding: '9px 12px', textAlign: 'left',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: '#7a8099', borderBottom: '1px solid #2a2f42', background: '#1f2435'
  },
  td: {
    padding: '10px 12px', borderBottom: '1px solid #23283a',
    color: '#c0c4d4', fontSize: '13px'
  },
  tdMono: {
    padding: '10px 12px', borderBottom: '1px solid #23283a',
    color: '#3a4055', fontSize: '11px', fontFamily: 'monospace'
  },
  roleBadge: {
    display: 'inline-block', fontSize: '11px', fontWeight: '700',
    padding: '2px 8px', borderRadius: '20px', border: '1px solid',
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  removeBtn: {
    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)',
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
    fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer',
    textTransform: 'uppercase'
  },
  muted: { color: '#7a8099', fontSize: '0.9rem' }
}

export default SuperAdminPage

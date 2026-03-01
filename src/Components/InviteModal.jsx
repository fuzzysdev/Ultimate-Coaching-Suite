import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

function InviteModal({ org, userId, onJoined, onClose }) {
  const [tab, setTab] = useState(org ? 'generate' : 'join')
  const [generatedCode, setGeneratedCode] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const makeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => chars[b % chars.length]).join('')
  }

  const handleGenerate = async () => {
    setError(null)
    setGenerating(true)
    try {
      const code = makeCode()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { error } = await supabase.from('org_invites').insert({
        organization_id: org.id,
        created_by: userId,
        code,
        expires_at: expiresAt
      })

      if (error) throw error
      setGeneratedCode(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError(null)
    setJoining(true)

    try {
      const code = joinCode.trim().toUpperCase()

      const { data: invite, error: fetchError } = await supabase
  .from('org_invites')
  .select('id, organization_id, expires_at, used_by')
  .eq('code', code)
  .is('used_by', null)
  .single()

if (fetchError || !invite) throw new Error('Invalid or already used invite code.')

// Fetch the org name separately
const { data: orgData } = await supabase
  .from('organizations')
  .select('name')
  .eq('id', invite.organization_id)
  .single()

const orgName = orgData?.name || 'Unknown Organization'

      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('This invite code has expired.')
      }

      const { data: existing } = await supabase
        .from('user_organizations')
        .select('user_id')
        .eq('user_id', userId)
        .eq('organization_id', invite.organization_id)
        .single()

      if (existing) throw new Error('You are already a member of this organization.')

      const { error: joinError } = await supabase
        .from('user_organizations')
        .insert({ user_id: userId, organization_id: invite.organization_id, role: 'member' })

      if (joinError) throw joinError

      await supabase
        .from('org_invites')
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq('id', invite.id)

      onJoined(invite.orgName)
    } catch (err) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.title}>Invite / Join</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* Only show generate tab if user is in an org */}
        <div style={s.tabs}>
          {org && (
            <button
              onClick={() => { setTab('generate'); setError(null) }}
              style={{ ...s.tab, ...(tab === 'generate' ? s.tabActive : {}) }}
            >
              Generate Code
            </button>
          )}
          <button
            onClick={() => { setTab('join'); setError(null) }}
            style={{ ...s.tab, ...(tab === 'join' ? s.tabActive : {}) }}
          >
            Join with Code
          </button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {/* Generate Tab */}
        {tab === 'generate' && org && (
          <div>
            <p style={s.description}>
              Generate a single-use code for <strong style={{ color: '#e8eaf0' }}>{org.name}</strong>.
              It expires in 24 hours.
            </p>

            {!generatedCode ? (
              <button onClick={handleGenerate} disabled={generating} style={s.saveBtn}>
                {generating ? 'Generating...' : 'Generate Invite Code'}
              </button>
            ) : (
              <div>
                <div style={s.codeBox}>
                  <span style={s.codeText}>{generatedCode}</span>
                </div>
                <button onClick={handleCopy} style={s.copyBtn}>
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
                <p style={{ ...s.description, marginTop: '1rem' }}>
                  Share this code with the coach you want to invite.
                  It can only be used once and expires in 24 hours.
                </p>
                <button
                  onClick={() => setGeneratedCode(null)}
                  style={s.generateAnotherBtn}
                >
                  Generate Another
                </button>
              </div>
            )}
          </div>
        )}

        {/* Join Tab */}
        {tab === 'join' && (
          <div>
            <p style={s.description}>
              Enter an invite code to join an organization.
            </p>
            <form onSubmit={handleJoin}>
              <div style={s.field}>
                <label style={s.label}>Invite Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD1234EFGH"
                  maxLength={12}
                  autoFocus
                  required
                  style={s.codeInput}
                />
              </div>
              <button type="submit" disabled={joining} style={s.saveBtn}>
                {joining ? 'Joining...' : 'Join Organization'}
              </button>
            </form>
          </div>
        )}
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
    width: '100%', maxWidth: '600px', padding: '24px 20px 36px'
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px'
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px'
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer'
  },
  tabs: { display: 'flex', gap: '4px', marginBottom: '20px' },
  tab: {
    flex: 1, background: 'none', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    letterSpacing: '0.5px', padding: '8px 12px', borderRadius: '6px',
    cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.15s'
  },
  tabActive: { background: '#00e5a0', borderColor: '#00e5a0', color: '#0f1117' },
  description: { color: '#7a8099', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' },
  label: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '1px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  codeInput: {
    background: '#0f1117', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontSize: '24px', padding: '12px 16px', borderRadius: '8px', outline: 'none',
    letterSpacing: '6px', textAlign: 'center',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '800',
    width: '100%', textTransform: 'uppercase'
  },
  codeBox: {
    background: '#0f1117', border: '2px solid rgba(0,229,160,0.3)',
    borderRadius: '10px', padding: '20px', textAlign: 'center', marginBottom: '12px'
  },
  codeText: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '36px',
    fontWeight: '800', color: '#00e5a0', letterSpacing: '8px'
  },
  copyBtn: {
    width: '100%', background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)',
    color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '14px', fontWeight: '800', padding: '10px', borderRadius: '7px',
    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'
  },
  generateAnotherBtn: {
    width: '100%', background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '10px', borderRadius: '7px', cursor: 'pointer', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginTop: '8px'
  },
  saveBtn: {
    width: '100%', background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: '800',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem 1rem', borderRadius: '8px',
    marginBottom: '1rem', fontSize: '0.9rem'
  }
}

export default InviteModal

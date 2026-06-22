'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface SettingsScreenProps {
  onBack: () => void
}

interface BlockedUser {
  blockId: string
  id: string
  name: string
  username: string | null
  avatarUrl: string | null
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [notifs, setNotifs] = useState(true)
  const [blocked, setBlocked] = useState<BlockedUser[]>([])
  const [loadingBlocked, setLoadingBlocked] = useState(true)
  const [blockedError, setBlockedError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'logout' | 'delete'>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem('spigen_notifications_enabled')
      if (v !== null) setTimeout(() => setNotifs(v === 'true'), 0)
    } catch {}
  }, [])

  const toggleNotifs = () => {
    setNotifs(prev => {
      const next = !prev
      try { localStorage.setItem('spigen_notifications_enabled', String(next)) } catch {}
      return next
    })
  }

  const loadBlocked = async () => {
    setLoadingBlocked(true)
    setBlockedError(null)
    try {
      const { data: rows, error } = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      const ids = (rows || []).map((r: any) => r.blocked_id)
      const profMap: Record<string, any> = {}
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', ids)
        ;(profs || []).forEach((p: any) => { profMap[p.id] = p })
      }
      setBlocked((rows || []).map((r: any) => {
        const p = profMap[r.blocked_id] || {}
        return {
          blockId: r.id,
          id: r.blocked_id,
          name: p.display_name || p.username || 'Unknown',
          username: p.username || null,
          avatarUrl: p.avatar_url || null,
        }
      }))
    } catch {
      setBlockedError('Failed to load blocked users')
    } finally {
      setLoadingBlocked(false)
    }
  }

  useEffect(() => { loadBlocked() }, [])

  const unblock = async (blockId: string) => {
    const snapshot = blocked.find(b => b.blockId === blockId)
    setBlocked(prev => prev.filter(b => b.blockId !== blockId))
    const { error } = await supabase.from('blocks').delete().eq('id', blockId)
    if (error && snapshot) {
      setBlocked(prev => [...prev, snapshot].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const doLogout = async () => {
    setBusy(true)
    await useAuthStore.getState().signOut()
  }

  const doDelete = async () => {
    setBusy(true)
    setActionError(null)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setActionError('Account deletion failed. Please try again.')
      setBusy(false)
      return
    }
    try { await supabase.auth.signOut() } catch {}
    useAuthStore.setState({ user: null, profile: null, isAuthenticated: false, privateKey: null } as any)
  }

  const wrap: any = { position: 'fixed', inset: 0, zIndex: 60, background: '#0a0a0a', display: 'flex', flexDirection: 'column', color: '#fff' }
  const header: any = { display: 'flex', alignItems: 'center', gap: 14, padding: 'calc(env(safe-area-inset-top) + 14px) 16px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }
  const body: any = { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 0 40px' }
  const sectionLabel: any = { fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: '#6b7280', padding: '22px 20px 6px' }
  const row: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }
  const rowBtn: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }

  return (
    <div style={wrap}>
      <div style={header}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 28, lineHeight: 1, cursor: 'pointer', padding: 0, width: 26 }}>{String.fromCharCode(8249)}</button>
        <span style={{ fontSize: 19, fontWeight: 700 }}>Settings</span>
      </div>

      <div style={body}>
        <div style={sectionLabel}>Notifications</div>
        <div style={row}>
          <div>
            <div style={{ fontSize: 15 }}>Push notifications</div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>New messages and mentions</div>
          </div>
          <button onClick={toggleNotifs} aria-label="Toggle push notifications" style={{ width: 50, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 3, background: notifs ? '#2563EB' : '#3a3a3a', display: 'flex', justifyContent: notifs ? 'flex-end' : 'flex-start', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', display: 'block' }} />
          </button>
        </div>

        <div style={sectionLabel}>Blocked users</div>
        {loadingBlocked ? (
          <div style={{ padding: '14px 20px', color: '#6b7280', fontSize: 14 }}>Loading…</div>
        ) : blockedError ? (
          <div style={{ padding: '14px 20px', color: '#EF4444', fontSize: 14 }}>{blockedError}</div>
        ) : blocked.length === 0 ? (
          <div style={{ padding: '14px 20px', color: '#6b7280', fontSize: 14 }}>You haven&apos;t blocked anyone.</div>
        ) : (
          blocked.map(b => (
            <div key={b.blockId} style={row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {b.avatarUrl
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={b.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>{(b.name[0] || '?').toUpperCase()}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                  {b.username && <div style={{ fontSize: 12.5, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{b.username}</div>}
                </div>
              </div>
              <button onClick={() => unblock(b.blockId)} style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#e5e7eb', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}>Unblock</button>
            </div>
          ))
        )}

        <div style={sectionLabel}>Account</div>
        <button style={rowBtn} onClick={() => setConfirm('logout')}>
          <span style={{ fontSize: 15 }}>Log out</span>
          <span style={{ fontSize: 20, color: '#666', lineHeight: 1 }}>{String.fromCharCode(8250)}</span>
        </button>
        <button style={rowBtn} onClick={() => setConfirm('delete')}>
          <span style={{ fontSize: 15, color: '#EF4444' }}>Delete account</span>
          <span style={{ fontSize: 20, color: '#666', lineHeight: 1 }}>{String.fromCharCode(8250)}</span>
        </button>
      </div>

      {confirm && (
        <div onClick={() => !busy && setConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{confirm === 'logout' ? 'Log out?' : 'Delete account?'}</div>
            <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.5, marginBottom: 20 }}>
              {confirm === 'logout'
                ? 'You can log back in anytime.'
                : 'This permanently deletes your profile, your messages, and any communities you created. This cannot be undone.'}
            </div>
            {actionError && <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 12 }}>{actionError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setConfirm(null); setActionError(null) }} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirm === 'logout' ? doLogout : doDelete} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}>{busy ? '…' : (confirm === 'logout' ? 'Log out' : 'Delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

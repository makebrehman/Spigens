'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { ProfileImage } from '@/components/ProfileImage'
import { BackButton } from '@/components/BackButton'

export interface ContactProfileScreenProps {
  userId: string
  displayName?: string
  username?: string
  avatarUrl?: string | null
  onBack: () => void
  onStartChat?: () => void
  onOpenCommunity?: (communityId: string, name: string, type: string, memberCount: number, avatarUrl: string | null) => void
  onBlocked?: () => void
}

export function ContactProfileScreen(props: ContactProfileScreenProps) {
  const { userId, displayName: initialName, username: initialUsername, avatarUrl: initialAvatarUrl, onBack, onStartChat, onOpenCommunity } = props
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.contactProfileScreen ?? null
  const [profile, setProfile] = useState<any>(null)
  const [mutualCommunities, setMutualCommunities] = useState<any[]>([])
  const currentUserId = useAuthStore(state => state.user?.id)
  const onBlocked = (props as any).onBlocked
  const [blockSheet, setBlockSheet] = useState(false)
  const [reportSheet, setReportSheet] = useState(false)
  const [alsoReport, setAlsoReport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const doBlock = async () => {
    if (!currentUserId || !userId || busy) return
    setBusy(true)
    const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: userId })
    if (error) {
      setBusy(false)
      setToast('Failed to block. Please try again.')
      setTimeout(() => setToast(null), 2600)
      return
    }
    if (alsoReport) {
      await supabase.from('reports').insert({ reporter_id: currentUserId, reported_id: userId, reason: 'Blocked user' })
    }
    setBusy(false)
    setBlockSheet(false)
    if (typeof onBlocked === 'function') onBlocked()
    else if (typeof onBack === 'function') onBack()
  }

  const doReport = async (reason: string) => {
    if (!currentUserId || !userId || busy) return
    setBusy(true)
    const { error } = await supabase.from('reports').insert({ reporter_id: currentUserId, reported_id: userId, reason })
    setBusy(false)
    setReportSheet(false)
    setToast(error ? 'Failed to submit report. Please try again.' : 'Thanks — our team will review this.')
    setTimeout(() => setToast(null), 2600)
  }

  const sheetOverlay: any = { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
  const sheetCard: any = { width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }
  const ghostBtn: any = { flex: 1, textAlign: 'center', padding: '12px', borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }
  const dangerBtn: any = { flex: 1, textAlign: 'center', padding: '12px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }
  const reasonBtn: any = { width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 12, background: '#1f1f1f', color: '#e5e7eb', fontSize: 15, fontWeight: 500, border: 'none', cursor: 'pointer', marginBottom: 8 }

  useEffect(() => {
    supabase.from('profiles')
      .select('id, display_name, username, avatar_url, bio, is_online, last_seen')
      .eq('id', userId)
      .single()
      .then(({ data }: any) => { if (data) { setProfile(data); useUIStore.getState().setComponentState('contactProfileData', data) } })
    return () => { useUIStore.getState().setComponentState('contactProfileData', null) }
  }, [userId])

  useEffect(() => {
    if (!userId || !currentUserId) return
    supabase.from('community_members')
      .select('community_id, communities(id, name, avatar_url, type)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .then(({ data: theirData }: any) => {
        if (!theirData?.length) return
        const theirIds = theirData.map((m: any) => m.community_id)
        supabase.from('community_members')
          .select('community_id')
          .eq('user_id', currentUserId)
          .eq('status', 'active')
          .in('community_id', theirIds)
          .then(({ data: myData }: any) => {
            const mySet = new Set((myData || []).map((m: any) => m.community_id))
            const _mutual = theirData.filter((m: any) => mySet.has(m.community_id)).map((m: any) => m.communities).filter(Boolean)
            setMutualCommunities(_mutual)
            useUIStore.getState().setComponentState('contactMutualCommunities', _mutual)
          })
      })
  }, [userId, currentUserId])

  useEffect(() => {
    return () => { useUIStore.getState().setComponentState('contactMutualCommunities', []) }
  }, [userId])

  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(
      () => (useUIStore.getState().componentState as Record<string, any>)?.[key] ?? defaultValue
    )
    useEffect(() => {
      const unsub = useUIStore.subscribe((state: any, prevState: any) => {
        const next = state.componentState?.[key]
        const prev = prevState.componentState?.[key]
        if (next !== prev) setValue(next ?? defaultValue)
      })
      return unsub
    }, [key, defaultValue])
    return [value, (newVal: any) => {
      if (typeof newVal === 'function') {
        setValue((prev: any) => {
          const r = newVal(prev)
          useUIStore.getState().setComponentState(key, r)
          return r
        })
      } else {
        setValue(newVal)
        useUIStore.getState().setComponentState(key, newVal)
      }
    }] as [any, (v: any) => void]
  }

  return (
    <>
      <RenderifyHost
        code={source}
        storeActions={{
          displayName: profile?.display_name || initialName || '',
          username: profile?.username || initialUsername || '',
          avatarUrl: profile?.avatar_url || initialAvatarUrl || null,
          bio: profile?.bio || '',
          isOnline: profile?.is_online ?? false,
          mutualCommunities,
          onStartChat: onStartChat || null,
          onBack,
          onOpenCommunity,
          ProfileImage,
          BackButton,
          useComponentState,
          onBlockClick: () => { setAlsoReport(false); setBlockSheet(true) },
          onReportClick: () => setReportSheet(true),
        }}
      />
      {blockSheet && (
        <div style={sheetOverlay} onClick={() => !busy && setBlockSheet(false)}>
          <div style={sheetCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              Block {profile?.display_name || initialName || 'this person'}?
            </div>
            <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.5, marginBottom: 18 }}>
              Their chat will be hidden from your list and they won&apos;t be able to message you. They won&apos;t be notified.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={alsoReport} onChange={e => setAlsoReport(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 14, color: '#d1d5db' }}>Also report this account</span>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={ghostBtn} onClick={() => setBlockSheet(false)} disabled={busy}>Cancel</button>
              <button style={dangerBtn} onClick={doBlock} disabled={busy}>{busy ? '…' : 'Block'}</button>
            </div>
          </div>
        </div>
      )}
      {reportSheet && (
        <div style={sheetOverlay} onClick={() => !busy && setReportSheet(false)}>
          <div style={sheetCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Report account</div>
            <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 16 }}>Why are you reporting this account?</div>
            {['Spam or scam', 'Harassment or bullying', 'Inappropriate content', 'Pretending to be someone', 'Something else'].map(r => (
              <button key={r} style={reasonBtn} onClick={() => doReport(r)} disabled={busy}>{r}</button>
            ))}
            <button style={{ ...ghostBtn, width: '100%', marginTop: 8 }} onClick={() => setReportSheet(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 'calc(32px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 210, background: '#1f2937', color: '#fff', padding: '12px 18px', borderRadius: 999, fontSize: 14, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </>
  )
}

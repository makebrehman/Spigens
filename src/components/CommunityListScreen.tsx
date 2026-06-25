'use client'
import { useState, useEffect, useLayoutEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { BackButton } from './BackButton'
import { cacheCommunityList, getCachedCommunityList } from '@/lib/offlineCache'
import { subscribeDb, topics } from '@/lib/dbEvents'

// Hot in-memory mirror of the cached community list, so reopening the tab is instant.
const commListCache = new Map<string, any[]>()

export interface CommunityListScreenProps {
  onBack: () => void
  onOpenCommunity: (community: any) => void
  onOpenCommunityProfile?: (community: any) => void
  onCommunityAvatarTap?: (community: any) => void
  onCreateCommunity: () => void
  hideHeader?: boolean
}
export function CommunityListScreen(props: CommunityListScreenProps) {
  const { onBack, onOpenCommunity, onOpenCommunityProfile, onCommunityAvatarTap, onCreateCommunity, hideHeader } = props
  const currentUserId = useAuthStore(state => state.user?.id)
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.communityListScreen ?? null
  // GenUI-safe loading gate (see ScreenLoader): covers the list until it resolves.
  const [loaded, setLoaded] = useState(false)
  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(() => (useUIStore.getState().componentState as Record<string,any>)?.[key] ?? defaultValue)
    useEffect(() => { const unsub = useUIStore.subscribe((state: any, prevState: any) => { const next = state.componentState?.[key]; const prev = prevState.componentState?.[key]; if (next !== prev) setValue(next ?? defaultValue) }); return unsub }, [key, defaultValue])
    return [value, (newVal: any) => { if (typeof newVal === 'function') { setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r }) } else { setValue(newVal); useUIStore.getState().setComponentState(key, newVal) } }] as [any, (v: any) => void]
  }
  // LOCAL-FIRST community list — render from SQLite, re-read on any DB change.
  // SQLite is the single source of truth: reveal the screen as soon as we've read it
  // (even if empty), so the chrome shows instantly instead of a network-gated spinner.
  // The server fetch below is only a background refresh that writes into SQLite.
  // Seed from the in-memory mirror before paint so the list shows instantly.
  useLayoutEffect(() => {
    if (!currentUserId) return
    const seed = commListCache.get(currentUserId)
    if (seed) { useUIStore.getState().setComponentState('communityList', seed); setLoaded(true) }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) return
    let active = true
    const reload = async () => {
      const cached = await getCachedCommunityList(currentUserId)
      if (!active) return
      if (cached) { commListCache.set(currentUserId, cached); useUIStore.getState().setComponentState('communityList', cached) }
      setLoaded(true) // local read done → reveal immediately (don't wait for network)
    }
    reload()
    const unsub = subscribeDb(topics.communities(), reload)
    return () => { active = false; unsub() }
  }, [currentUserId])

  useEffect(() => {
    let cancelled = false
    let debounceTimer: any = null

    const load = async () => {
      try {
        const { data: all, error: allError } = await supabase.from('communities').select('*').order('name')
        if (allError) { console.error('Communities load error:', allError); return }
        if (cancelled) return
        const membershipMap: Record<string, any> = {}
        if (currentUserId) {
          const { data: mine } = await supabase.from('community_members')
            .select('community_id, role, status')
            .eq('user_id', currentUserId)
            .eq('status', 'active')
          mine?.forEach((m: any) => { membershipMap[m.community_id] = m })
        }
        const formatted = (all || []).map((c: any) => ({
          ...c,
          isMember: !!membershipMap[c.id],
          userRole: membershipMap[c.id]?.role || null,
        }))
        const joinedIds = formatted.filter((c: any) => c.isMember).map((c: any) => c.id)
        let lastMsgMap: Record<string, any> = {}
        let unreadMap: Record<string, number> = {}
        if (joinedIds.length > 0) {
          const { data: lastMsgs } = await supabase.rpc('get_community_last_messages', { community_ids: joinedIds })
          lastMsgs?.forEach((m: any) => { lastMsgMap[m.community_id] = m })
          const { data: unreadRows } = await supabase.rpc('get_community_unread_counts')
          ;(unreadRows || []).forEach((r: any) => { unreadMap[r.community_id] = Number(r.unread_count) })
        }
        const withLastMsgs = formatted.map((c: any) => ({
          ...c,
          last_message: lastMsgMap[c.id] || null,
          unreadCount: unreadMap[c.id] || 0,
        }))
        // The Communities tab is the single-source-of-truth list of YOUR communities,
        // so only the joined ones are cached/shown (consistent with the sign-in sync).
        // This is what stops non-member communities from leaking in offline.
        const joined = withLastMsgs.filter((c: any) => c.isMember)
        if (!cancelled && currentUserId && joined.length > 0) {
          // Write to the DB → emit → the local-first effect re-reads and renders.
          // Only when non-empty: never let a transient empty reply wipe the saved list.
          await cacheCommunityList(currentUserId, joined)
        }
      } catch (e) {
        console.error('Communities load exception:', e)
      } finally {
        setLoaded(true) // network settled (or failed) → reveal
      }
    }
    const scheduleReload = () => { if (debounceTimer) clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { load() }, 600) }
    load()
    const channel = supabase
      .channel('community-list-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, (payload: any) => {
        const list = (useUIStore.getState().componentState?.['communityList'] || [])
        const c = list.find((x: any) => x.id === payload.new.community_id)
        if (c && c.isMember) scheduleReload()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_messages' }, (payload: any) => {
        const list = (useUIStore.getState().componentState?.['communityList'] || [])
        const c = list.find((x: any) => x.id === payload.new.community_id)
        if (c && c.isMember) scheduleReload()
      })
      .subscribe()
    return () => { cancelled = true; if (debounceTimer) clearTimeout(debounceTimer); supabase.removeChannel(channel) }
  }, [currentUserId])
  const onJoinCommunity = async (communityId: string) => {
    if (!currentUserId) return
    await supabase.from('community_members').insert({ community_id: communityId, user_id: currentUserId, role: 'member', status: 'active' })
    const { data: myProf } = await supabase.from('profiles').select('display_name, username').eq('id', currentUserId).single()
    const joinName = (myProf as any)?.display_name || (myProf as any)?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: joinName + ' joined', message_type: 'system' })
    const current = (useUIStore.getState().componentState?.['communityList'] ?? []) as any[]
    useUIStore.getState().setComponentState('communityList', current.map((c: any) => c.id === communityId ? { ...c, isMember: true, userRole: 'member', member_count: (c.member_count || 0) + 1 } : c))
  }
  return <><RenderifyHost code={source} storeActions={{ onBack, onOpenCommunity, onOpenCommunityProfile: (c: any) => onOpenCommunityProfile?.(c), onAvatarTap: (c: any) => onCommunityAvatarTap?.(c), onCreateCommunity, onJoinCommunity, onRequestCommunity: async (communityId: string) => {
    if (!currentUserId) return
    const current = (useUIStore.getState().componentState?.['communityList'] ?? []) as any[]
    useUIStore.getState().setComponentState('communityList', current.map((c: any) => c.id === communityId ? { ...c, joinState: 'loading' } : c))
    await supabase.from('community_members').insert({ community_id: communityId, user_id: currentUserId, role: 'member', status: 'pending' })
    useUIStore.getState().setComponentState('communityList', (useUIStore.getState().componentState?.['communityList'] ?? []).map((c: any) => c.id === communityId ? { ...c, joinState: 'requested' } : c))
  }, BackButton, useComponentState, hideHeader: hideHeader ?? false }} /></>
}

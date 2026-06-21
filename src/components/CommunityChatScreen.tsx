'use client'
import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { uploadCommunityImage } from '@/lib/avatarUpload'
import { CommunityMessageBubble } from './CommunityMessageBubble'
import { BackButton } from './BackButton'
import { CornerUpLeft, Copy, Trash2 } from 'lucide-react'
import { MessageReactions } from './MessageReactions'
import { DateSeparator } from './DateSeparator'
import { ReactionPicker } from './ReactionPicker'
export interface CommunityChatScreenProps {
  communityId: string
  communityName: string
  communityType: string
  isMember: boolean
  userRole?: string | null
  memberCount: number
  communityAvatarUrl?: string | null
  onViewCommunityProfile?: () => void
  onSenderTap?: (userId: string, name: string, avatarUrl: string | null) => void
  onBack: () => void
}
export function CommunityChatScreen(props: CommunityChatScreenProps) {
  const { communityId, communityName, communityType, userRole, onViewCommunityProfile, onSenderTap, onBack } = props
  const [memberCount, setMemberCount] = useState(props.memberCount)
  const [isMember, setIsMember] = useState(props.isMember)
  const [communityAvatarUrl, setCommunityAvatarUrl] = useState<string | null>(props.communityAvatarUrl ?? null)
  const currentUserId = useAuthStore(state => state.user?.id)
  const profile = useAuthStore(state => state.profile)
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.communityChatScreen ?? null
  const channelRef = useRef<any>(null)
  const lastTypingRef = useRef<number>(0)
  const typingExpireRef = useRef<Record<string, any>>({})
  const memberProfilesRef = useRef<Record<string, any>>({})
  const senderCacheRef = useRef<Record<string, { displayName: string; username: string; avatarUrl: string | null }>>({})
  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(() => (useUIStore.getState().componentState as Record<string,any>)?.[key] ?? defaultValue)
    useEffect(() => { const unsub = useUIStore.subscribe((state: any, prevState: any) => { const next = state.componentState?.[key]; const prev = prevState.componentState?.[key]; if (next !== prev) setValue(next ?? defaultValue) }); return unsub }, [key, defaultValue])
    return [value, (newVal: any) => { if (typeof newVal === 'function') { setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r }) } else { setValue(newVal); useUIStore.getState().setComponentState(key, newVal) } }] as [any, (v: any) => void]
  }
  const formatMsg = (row: any) => ({
    id: row.id, content: row.content || '', messageType: row.message_type || 'text',
    senderId: row.sender_id,
    senderName: senderCacheRef.current[row.sender_id]?.displayName || senderCacheRef.current[row.sender_id]?.username || 'Unknown',
    senderAvatar: senderCacheRef.current[row.sender_id]?.avatarUrl ?? null,
    senderInitials: (senderCacheRef.current[row.sender_id]?.displayName || senderCacheRef.current[row.sender_id]?.username || '?').charAt(0).toUpperCase(),
    timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: row.created_at,
    isMine: row.sender_id === currentUserId,
    isDeleted: !!row.deleted_at,
    replyTo: row.reply_to || null,
  })
  // mark community read for the unread badge (on open and on leave)
  useEffect(() => {
    if (!communityId || !currentUserId) return
    const markRead = () => { supabase.rpc('mark_community_read', { p_community_id: communityId }).then() }
    markRead()
    return () => { markRead() }
  }, [communityId, currentUserId])

  useEffect(() => {
    if (!communityId) return
    useUIStore.getState().setComponentState('communityJoinStatus', isMember ? 'member' : 'non-member')
    supabase.from('communities').select('avatar_url').eq('id', communityId).single().then(({ data }: any) => {
      if (data?.avatar_url) setCommunityAvatarUrl(data.avatar_url)
    })
    supabase.from('community_members').select('user_id, profiles(id, display_name, username, avatar_url)').eq('community_id', communityId).eq('status', 'active')
      .then(({ data }: any) => { const map: Record<string,any> = {}; data?.forEach((m: any) => { if (m.profiles) map[m.user_id] = m.profiles }); memberProfilesRef.current = map })
    supabase.from('community_messages').select('id, community_id, sender_id, content, message_type, metadata, created_at, reply_to, deleted_at, profiles!sender_id(display_name, username, avatar_url)').eq('community_id', communityId).order('created_at', { ascending: true }).limit(100)
      .then(({ data }: any) => {
        if (data) {
          data.forEach((row: any) => {
            if (row.sender_id && row.profiles) {
              senderCacheRef.current[row.sender_id] = {
                displayName: row.profiles.display_name,
                username: row.profiles.username,
                avatarUrl: row.profiles.avatar_url
              }
            }
          })
          useUIStore.getState().setComponentState('communityMessages', data.map(formatMsg))
          if (data && data.length > 0) {
            const msgIds = data.map((r: any) => r.id)
            supabase.from('community_message_reactions').select('message_id, user_id, emoji').in('message_id', msgIds)
              .then(({ data: rxns }: any) => {
                if (rxns) {
                  const grouped: Record<string, any[]> = {}
                  rxns.forEach((r: any) => { if (!grouped[r.message_id]) grouped[r.message_id] = []; grouped[r.message_id].push(r) })
                  Object.entries(grouped).forEach(([msgId, reactions]) => useUIStore.getState().setComponentState('reactions:' + msgId, reactions))
                }
              })
          }
        }
      })
    channelRef.current = supabase.channel('comm-chat:' + communityId)
      .on('broadcast', { event: 'typing' }, (msg: any) => {
        const p = msg.payload
        if (p?.userId && p.userId !== currentUserId) {
          const senderName = p.senderName || 'Someone'
          if (typingExpireRef.current[p.userId]) clearTimeout(typingExpireRef.current[p.userId])
          const current = (useUIStore.getState().componentState?.communityTypingUsers || []) as any[]
          const filtered = current.filter((u: any) => u.userId !== p.userId)
          useUIStore.getState().setComponentState('communityTypingUsers', [...filtered, { userId: p.userId, name: senderName }])
          const _allTyping = [...filtered, { userId: p.userId, name: senderName }]
          const _label = _allTyping.length === 1 ? _allTyping[0].name + ' is typing...' : _allTyping.length + ' people are typing...'
          const _cm = { ...(useUIStore.getState().componentState?.['communityTypingMap'] || {}) }; _cm[communityId] = _label; useUIStore.getState().setComponentState('communityTypingMap', _cm)
          typingExpireRef.current[p.userId] = setTimeout(() => {
            const users = (useUIStore.getState().componentState?.communityTypingUsers || []) as any[]
            useUIStore.getState().setComponentState('communityTypingUsers', users.filter((u: any) => u.userId !== p.userId))
            delete typingExpireRef.current[p.userId]
            const _rem = (useUIStore.getState().componentState?.communityTypingUsers || []) as any[]
            const _rem2 = _rem.filter((u: any) => u.userId !== p.userId)
            const _cm2 = { ...(useUIStore.getState().componentState?.['communityTypingMap'] || {}) }
            if (_rem2.length === 0) { delete _cm2[communityId] } else { _cm2[communityId] = _rem2.length === 1 ? _rem2[0].name + ' is typing...' : _rem2.length + ' people are typing...' }
            useUIStore.getState().setComponentState('communityTypingMap', _cm2)
          }, 3000)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: 'community_id=eq.' + communityId }, async (payload: any) => {
        const row = payload.new
        if (row.sender_id && !senderCacheRef.current[row.sender_id]) {
          const { data: p } = await supabase.from('profiles').select('id, display_name, username, avatar_url').eq('id', row.sender_id).single()
          if (p) senderCacheRef.current[p.id] = { displayName: p.display_name, username: p.username, avatarUrl: p.avatar_url }
        }
        const msg = formatMsg(row)
        const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
        if (!current.some((m: any) => m.id === msg.id)) useUIStore.getState().setComponentState('communityMessages', [...current, msg])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_messages', filter: 'community_id=eq.' + communityId }, (payload: any) => {
        const row = payload.new
        if (!row.deleted_at) return
        const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
        const idx = current.findIndex((m: any) => m.id === row.id)
        if (idx === -1) return
        if (current[idx].isDeleted) return
        const next = [...current]
        next[idx] = { ...next[idx], isDeleted: true, content: '' }
        useUIStore.getState().setComponentState('communityMessages', next)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_message_reactions', filter: 'community_id=eq.' + communityId }, async () => {
        const msgs = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
        const msgIds = msgs.map((m: any) => m.id)
        if (msgIds.length > 0) {
          const { data: rxns } = await supabase.from('community_message_reactions').select('message_id, user_id, emoji').in('message_id', msgIds)
          const grouped: Record<string, any[]> = {}
          if (rxns) { rxns.forEach((r: any) => { if (!grouped[r.message_id]) grouped[r.message_id] = []; grouped[r.message_id].push(r) }) }
          msgIds.forEach((mid: string) => useUIStore.getState().setComponentState('reactions:' + mid, grouped[mid] || []))
        }
      }).subscribe()
    const kickChannel = supabase
      .channel('community-kick-' + communityId)
      .on('broadcast', { event: 'member_removed' }, (event: any) => {
        if (event.payload?.userId === currentUserId) {
          onBack?.()
        }
      })
      .subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); supabase.removeChannel(kickChannel); useUIStore.getState().setComponentState('communityMessages', []); useUIStore.getState().setComponentState('communityTypingUsers', []); Object.values(typingExpireRef.current).forEach(clearTimeout); useUIStore.getState().setComponentState('activeMessageActions', null); useUIStore.getState().setComponentState('reactionDetail', null); useUIStore.getState().setComponentState('communityReplyingTo', null) }
  }, [communityId, currentUserId])
  useEffect(() => {
    if (!communityId) return
    const fetchCommunityAvatar = () => {
      supabase.from('communities').select('avatar_url').eq('id', communityId).single()
        .then(({ data }: any) => { if (data?.avatar_url) setCommunityAvatarUrl(data.avatar_url) })
    }
    fetchCommunityAvatar()
    const avatarTimer = setTimeout(fetchCommunityAvatar, 3500)
    return () => clearTimeout(avatarTimer)
  }, [communityId])

  if (typeof window !== 'undefined' && currentUserId) { useUIStore.getState().setComponentState('currentUserId', currentUserId) }
  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentUserId) return
    const replyingTo = (useUIStore.getState().componentState?.['communityReplyingTo'] ?? null) as any
    const newId = crypto.randomUUID()
    const optimistic = { id: newId, content: content.trim(), senderId: currentUserId, senderName: profile?.display_name || profile?.username || 'Me', senderAvatar: profile?.avatar_url || null, senderInitials: (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: new Date().toISOString(), isMine: true, replyTo: replyingTo?.id || null }
    const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
    useUIStore.getState().setComponentState('communityMessages', [...current, optimistic])
    useUIStore.getState().setComponentState('communityReplyingTo', null)
    await supabase.from('community_messages').insert({ id: newId, community_id: communityId, sender_id: currentUserId, content: content.trim(), reply_to: replyingTo?.id || null })
  }

  const onDeleteMessage = async (messageId: string) => {
    const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
    useUIStore.getState().setComponentState('communityMessages', current.map((m: any) => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m))
    await supabase.from('community_messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId).eq('sender_id', currentUserId)
  }

  const onToggleCommunityReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return
    const key = 'reactions:' + messageId
    const current = (useUIStore.getState().componentState?.[key] ?? []) as any[]
    const mine = current.find((r: any) => r.user_id === currentUserId && r.emoji === emoji)
    if (mine) {
      useUIStore.getState().setComponentState(key, current.filter((r: any) => !(r.user_id === currentUserId && r.emoji === emoji)))
      await supabase.from('community_message_reactions').delete().eq('message_id', messageId).eq('user_id', currentUserId)
    } else {
      useUIStore.getState().setComponentState(key, [...current.filter((r: any) => r.user_id !== currentUserId), { message_id: messageId, user_id: currentUserId, emoji }])
      await supabase.from('community_message_reactions').upsert({ message_id: messageId, community_id: communityId, user_id: currentUserId, emoji }, { onConflict: 'message_id,user_id' })
    }
  }

  const onJoin = async () => {
    if (!currentUserId) return
    useUIStore.getState().setComponentState('communityJoinStatus', 'loading')
    const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: currentUserId, role: 'member', status: 'active' })
    if (error) { useUIStore.getState().setComponentState('communityJoinStatus', 'non-member'); return }
    setIsMember(true); setMemberCount(prev => prev + 1)
    useUIStore.getState().setComponentState('communityJoinStatus', 'member')
    const joinName = profile?.display_name || profile?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: joinName + ' joined', message_type: 'system' })
  }
  const onRequest = async () => {
    if (!currentUserId) return
    useUIStore.getState().setComponentState('communityJoinStatus', 'requesting')
    await supabase.from('community_members').insert({ community_id: communityId, user_id: currentUserId, role: 'member', status: 'pending' })
    useUIStore.getState().setComponentState('communityJoinStatus', 'requested')
  }
  const onTyping = () => {
    const now = Date.now()
    if (now - lastTypingRef.current < 1500) return
    lastTypingRef.current = now
    channelRef.current?.send({
      type: 'broadcast', event: 'typing',
      payload: { userId: currentUserId, senderName: profile?.display_name || profile?.username || 'Someone' }
    })
  }
  const onLeave = async () => {
    if (!currentUserId) return
    const leaveName = profile?.display_name || profile?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: leaveName + ' left', message_type: 'system' })
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', currentUserId)
    setIsMember(false); setMemberCount(prev => Math.max(0, prev - 1)); onBack()
  }
  const onUpdateCommunityImage = async (file: File) => {
    const url = await uploadCommunityImage(communityId, file)
    if (url) setCommunityAvatarUrl(url)
  }
  return <RenderifyHost code={source} storeActions={{ communityId, communityName, communityType, isMember, userRole: userRole || null, memberCount, communityAvatarUrl, sendMessage, onTyping, onDeleteMessage, onJoin, onRequest, onLeave, onBack, onViewCommunityProfile: () => onViewCommunityProfile?.(), onSenderTap: (uid: string, name: string, avatar: string | null) => onSenderTap?.(uid, name, avatar), LucideReply: CornerUpLeft, LucideCopy: Copy, LucideTrash: Trash2, MessageReactions, ReactionPicker, onToggleReaction: (messageId: string, emoji: string) => onToggleCommunityReaction(messageId, emoji), CommunityMessageBubble, BackButton, DateSeparator, onReplyTo: (target: any) => { useUIStore.getState().setComponentState('communityReplyingTo', { id: target.id, senderName: target.senderName || '', content: target.content || '' }) }, onCancelReply: () => { useUIStore.getState().setComponentState('communityReplyingTo', null); useUIStore.getState().setComponentState('reactionDetail', null) }, onJumpToReply: (targetId: string) => { if (typeof document === 'undefined') return; const el = document.getElementById('msg-' + targetId); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); useUIStore.getState().setComponentState('highlightedMessageId', targetId); setTimeout(() => { useUIStore.getState().setComponentState('highlightedMessageId', null) }, 1500) },     onShowReactors: async (messageId: string) => {
      const key = 'reactions:' + messageId
      const reactions = (useUIStore.getState().componentState?.[key] ?? []) as any[]
      if (!reactions.length) return
      const userIds = [...new Set(reactions.map((r: any) => r.user_id))] as string[]
      const { data: profs } = await supabase.from('profiles').select('id, display_name, username').in('id', userIds)
      const nameMap: Record<string, string> = {}
      if (profs) profs.forEach((p: any) => { nameMap[p.id] = p.display_name || p.username || 'Unknown' })
      const enriched = reactions.map((r: any) => ({ emoji: r.emoji, name: nameMap[r.user_id] || 'Unknown', isMe: r.user_id === currentUserId }))
      useUIStore.getState().setComponentState('reactionDetail', { messageId, reactions: enriched })
    },
    useComponentState }} />
}

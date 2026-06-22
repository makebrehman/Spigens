'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MessageBubble } from './MessageBubble'
import { DateSeparator } from './DateSeparator'
import { ComposerBar } from './ComposerBar'
import { BackButton } from './BackButton'
import { ProfileImage } from './ProfileImage'
import { ChatName } from './ChatName'
import { OnlineStatus } from './OnlineStatus'
import { TypingIndicator } from './TypingIndicator'
import { RenderifyHost } from '@/components/RenderifyHost'
import { useMessageStore } from '@/stores/messageStore'
import { useUIStore } from '@/stores/uiStore'
import { useContactStore } from '@/stores/contactStore'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStore } from '@/stores/networkStore'
import { supabase } from '@/lib/supabase'
import { encryptMessage, decryptMessage } from '@/lib/encryption'
import {
  cacheMessages,
  getCachedMessages,
  savePendingMessage,
  getPendingMessages,
  removePendingMessage,
} from '@/lib/offlineCache'
import { CornerUpLeft, Copy, Trash2 } from 'lucide-react'

const EMPTY_MESSAGES: any[] = []

export interface ChatScreenProps {
  contactId?: string
  otherUserId?: string
  otherUserPublicKey?: string
  avatarUrl?: string
  contactName: string
  contactInitials: string
  contactAvatarColor?: string
  isOnline: boolean
  lastSeen?: string
  onBack?: () => void
  onViewContactProfile?: () => void
  onOpenCommunityInvite?: (meta: any, msgId: string) => void
}

export function ChatScreen(props: ChatScreenProps) {
  const {
    contactId, otherUserId, otherUserPublicKey, avatarUrl,
    contactName, contactInitials, contactAvatarColor,
    isOnline, lastSeen, onBack, onViewContactProfile, onOpenCommunityInvite,
  } = props

  const storeMessages = useMessageStore(state => (contactId ? state.messagesByContact[contactId] : undefined)) ?? EMPTY_MESSAGES

  useEffect(() => {
    if (contactId) useUIStore.getState().setComponentState('chatMessages', storeMessages)
  }, [contactId, storeMessages])

  const attachConfig = useUIStore(state => state.behaviorConfig.attachButton)
  const componentSources = useUIStore(state => state.componentSources)
  const chatScreenSource = componentSources?.chatScreen ?? null
  const bottomSheetSource = componentSources?.bottomSheet ?? null

  const [showAttachSheet, setShowAttachSheet] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [realMessages, setRealMessages] = useState<any[]>([])
  const [replyingTo, setReplyingTo] = useState<any>(null)

  const typingChannelRef = useRef<any>(null)
  const lastTypingSentRef = useRef<number>(0)
  const typingExpireRef = useRef<any>(null)

  const currentUserId = useAuthStore(state => state.user?.id)
  const myPublicKey = useAuthStore(state => state.profile?.public_key)
  const myPrivateKey = useAuthStore(state => state.privateKey)
  const networkIsOnline = useNetworkStore(state => state.isOnline)

  useEffect(() => {
    if (!otherUserId || !currentUserId) return
    setTimeout(() => setRealMessages([]), 0)
    useUIStore.getState().setComponentState('chatMessages', [])

    const resolve = async () => {
      const { data: mine, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId)

      if (error || !mine?.length) { setConversationId(null); return }

      const myIds = mine.map(r => r.conversation_id)
      const { data: shared, error: sharedErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUserId)
        .in('conversation_id', myIds)
        .limit(1)

      setConversationId(!sharedErr && shared?.length ? shared[0].conversation_id : null)
    }

    if (networkIsOnline) {
      resolve()
    } else {
      setConversationId(null)
    }
  }, [otherUserId, currentUserId, networkIsOnline])

  const decryptRow = (row: any, prevMessages: any[]): any => {
    let content = ''
    if (row.deleted_at) {
      content = ''
    } else if (row.encrypted_content && myPrivateKey && otherUserPublicKey) {
      content = decryptMessage(row.encrypted_content, otherUserPublicKey, myPrivateKey) ?? row.content ?? '🔒 encrypted'
    } else {
      content = row.content ?? ''
    }

    const isSent = row.sender_id === currentUserId
    let replyTo = null
    if (row.reply_to) {
      const orig = prevMessages.find(m => m.id === row.reply_to)
      if (orig) {
        replyTo = { id: row.reply_to, content: orig.content, senderLabel: orig.isSent ? 'You' : contactName }
      }
    }

    return {
      id: row.id,
      content,
      messageType: row.message_type || 'text',
      metadata: row.metadata || null,
      timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: row.created_at,
      isSent,
      isRead: true,
      status: row.status,
      replyTo,
      isDeleted: !!row.deleted_at,
    }
  }

  useEffect(() => {
    if (!otherUserId) return

    const cacheKey = conversationId ?? `pending_${otherUserId}`
    const cached = getCachedMessages(cacheKey)
    if (cached?.length) {
      setRealMessages(cached as any[])
      useUIStore.getState().setComponentState('chatMessages', cached)
    }

    if (!conversationId || !currentUserId || !myPublicKey) return
    if (!networkIsOnline) return

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, encrypted_content, message_type, metadata, status, reply_to, created_at, updated_at, deleted_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error || !data) { console.error('Failed to load messages:', error); return }

      const msgs: any[] = []
      data.forEach(row => msgs.push(decryptRow(row, msgs)))

      cacheMessages(conversationId, msgs)
      useUIStore.getState().setComponentState('chatMessages', msgs)
      useUIStore.getState().setComponentState('conversationId', conversationId)
      useUIStore.getState().setComponentState('currentUserId', currentUserId)
      setRealMessages(msgs)
    }

    const loadReactions = async () => {
      const { data: rows, error } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .eq('conversation_id', conversationId)
      if (error || !rows) return
      const grouped: Record<string, any[]> = {}
      rows.forEach(r => {
        if (!grouped[r.message_id]) grouped[r.message_id] = []
        grouped[r.message_id].push({ user_id: r.user_id, emoji: r.emoji })
      })
      Object.keys(grouped).forEach(id => useUIStore.getState().setComponentState('reactions:' + id, grouped[id]))
    }

    loadMessages()
    loadReactions()

    useUIStore.getState().setComponentState('conversationId', conversationId)
    useUIStore.getState().setComponentState('currentUserId', currentUserId)

    const channel = supabase
      .channel('messages:' + conversationId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, async (payload) => {
        const row = payload.new as any
        if (row.sender_id === currentUserId) return

        useUIStore.getState().setComponentState('otherUserTyping', false)
        if (typingExpireRef.current) clearTimeout(typingExpireRef.current)

        if (row.status === 'sent') {
          supabase.from('messages').update({ status: 'delivered' }).eq('id', row.id).then()
        }

        setRealMessages(prev => {
          if (prev.some(m => m.id === row.id)) return prev
          const msg = decryptRow(row, prev)
          msg.status = row.status === 'sent' ? 'delivered' : row.status
          const next = [...prev, msg]
          cacheMessages(conversationId, next)
          queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next))
          return next
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, (payload) => {
        const row = payload.new as any
        setRealMessages(prev => {
          const idx = prev.findIndex(m => m.id === row.id)
          if (idx === -1) return prev
          const existing = prev[idx]
          const next = [...prev]
          if (row.deleted_at && !existing.isDeleted) {
            next[idx] = { ...existing, isDeleted: true, content: '' }
          } else if (row.sender_id === currentUserId && existing.status !== row.status) {
            next[idx] = { ...existing, status: row.status }
          } else {
            return prev
          }
          cacheMessages(conversationId, next)
          queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next))
          return next
        })
      })
      .on('broadcast', { event: 'typing' }, (msg) => {
        const p = (msg as any).payload
        if (p?.userId && p.userId !== currentUserId) {
          const map = { ...(useUIStore.getState().componentState?.['dmTypingMap'] || {}) }
          map[p.userId] = true
          useUIStore.getState().setComponentState('dmTypingMap', map)
          setTimeout(() => {
            const m2 = { ...(useUIStore.getState().componentState?.['dmTypingMap'] || {}) }
            delete m2[p.userId]
            useUIStore.getState().setComponentState('dmTypingMap', m2)
          }, 3000)
          useUIStore.getState().setComponentState('otherUserTyping', true)
          if (typingExpireRef.current) clearTimeout(typingExpireRef.current)
          typingExpireRef.current = setTimeout(() => useUIStore.getState().setComponentState('otherUserTyping', false), 3000)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: 'conversation_id=eq.' + conversationId }, (payload) => {
        const row = payload.new as any
        const key = 'reactions:' + row.message_id
        const cur = (useUIStore.getState().componentState?.[key] ?? []) as any[]
        useUIStore.getState().setComponentState(key, [...cur.filter((r: any) => r.user_id !== row.user_id), { user_id: row.user_id, emoji: row.emoji }])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter: 'conversation_id=eq.' + conversationId }, (payload) => {
        const row = payload.new as any
        const key = 'reactions:' + row.message_id
        const cur = (useUIStore.getState().componentState?.[key] ?? []) as any[]
        useUIStore.getState().setComponentState(key, [...cur.filter((r: any) => r.user_id !== row.user_id), { user_id: row.user_id, emoji: row.emoji }])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions', filter: 'conversation_id=eq.' + conversationId }, (payload) => {
        const row = payload.old as any
        const key = 'reactions:' + row.message_id
        const cur = (useUIStore.getState().componentState?.[key] ?? []) as any[]
        useUIStore.getState().setComponentState(key, cur.filter((r: any) => r.user_id !== row.user_id))
      })
      .subscribe()

    typingChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      if (typingExpireRef.current) clearTimeout(typingExpireRef.current)
      typingChannelRef.current = null
      useUIStore.getState().setComponentState('otherUserTyping', false)
      useUIStore.getState().setComponentState('openReactionMessageId', null)
      useUIStore.getState().setComponentState('activeMessageActions', null)
      useUIStore.getState().setComponentState('reactionDetail', null)
    }
  }, [conversationId, currentUserId, myPublicKey, otherUserPublicKey, networkIsOnline])

  useEffect(() => {
    if (!networkIsOnline || !conversationId || !currentUserId) return
    const pending = getPendingMessages(currentUserId).filter(m => {
      return m.conversationId === conversationId || (!m.conversationId && m.otherUserId === otherUserId)
    })
    if (!pending.length) return

    pending.forEach(async pm => {
      let cid = conversationId
      if (!cid) {
        const { data } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: pm.otherUserId })
        if (data) { cid = data; setConversationId(data) } else return
      }
      const { error } = await supabase.from('messages').insert({
        id: pm.id,
        conversation_id: cid,
        sender_id: currentUserId,
        content: pm.encryptedContent ? null : pm.content,
        encrypted_content: pm.encryptedContent,
        status: 'sent',
        reply_to: pm.replyToId,
        created_at: pm.createdAt,
      })
      if (!error) {
        removePendingMessage(currentUserId, pm.id)
        setRealMessages(prev => {
          const idx = prev.findIndex(m => m.id === pm.id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], status: 'sent' }
          return next
        })
      }
    })
  }, [networkIsOnline, conversationId])

  useEffect(() => {
    if (contactId) {
      useContactStore.getState().clearUnread(contactId)
      useMessageStore.getState().markAllRead(contactId)
    }
  }, [contactId])

  useEffect(() => {
    if (!conversationId || !currentUserId || !networkIsOnline) return
    const hasUnread = realMessages.some(m => !m.isSent && m.status !== 'read')
    if (hasUnread) {
      supabase.from('messages').update({ status: 'read' })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .neq('status', 'read')
        .then()
    }
    supabase.from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)
      .then()
  }, [conversationId, currentUserId, realMessages, networkIsOnline])

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

  const chatScreenScope = {
    contactId,
    otherUserId,
    otherUserPublicKey,
    avatarUrl,
    contactName,
    contactInitials,
    contactAvatarColor,
    isOnline,
    lastSeen,
    messages: otherUserId ? realMessages : storeMessages,
    isOffline: !networkIsOnline,
    MessageBubble,
    DateSeparator,
    ComposerBar,
    BackButton,
    ProfileImage,
    ChatName,
    OnlineStatus,
    TypingIndicator,
    onBack: () => onBack?.(),
    onViewContactProfile: () => onViewContactProfile?.(),
    onAttach: () => setShowAttachSheet(true),
    replyingTo,
    onReplyTo: (target: any) => {
      const next = { id: target.id, content: target.content, senderLabel: target.isSent ? 'You' : contactName }
      setReplyingTo(next)
      useUIStore.getState().setComponentState('replyingTo', next)
    },
    onCancelReply: () => {
      setReplyingTo(null)
      useUIStore.getState().setComponentState('replyingTo', null)
    },
    onJumpToReply: (targetId: string) => {
      if (typeof document === 'undefined') return
      const el = document.getElementById('msg-' + targetId)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      useUIStore.getState().setComponentState('highlightedMessageId', targetId)
      setTimeout(() => useUIStore.getState().setComponentState('highlightedMessageId', null), 1500)
    },
    currentUserId,
    onToggleReaction: (messageId: string, emoji: string) => {
      const liveUserId = useUIStore.getState().componentState?.currentUserId
      const liveConversationId = useUIStore.getState().componentState?.conversationId
      const key = 'reactions:' + messageId
      const current = (useUIStore.getState().componentState?.[key] ?? []) as any[]
      const mine = current.find((r: any) => r.user_id === liveUserId)
      if (mine && mine.emoji === emoji) {
        useUIStore.getState().setComponentState(key, current.filter((r: any) => r.user_id !== liveUserId))
        supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', liveUserId).then()
      } else {
        useUIStore.getState().setComponentState(key, [...current.filter((r: any) => r.user_id !== liveUserId), { user_id: liveUserId, emoji }])
        supabase.from('message_reactions').upsert({ message_id: messageId, conversation_id: liveConversationId, user_id: liveUserId, emoji }, { onConflict: 'message_id,user_id' }).then()
      }
    },
    onOpenCommunityInvite: (meta: any, msgId: string) => onOpenCommunityInvite?.(meta, msgId),
    onTyping: () => {
      const now = Date.now()
      if (now - lastTypingSentRef.current < 1500) return
      lastTypingSentRef.current = now
      typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } })
    },
    sendMessage: async (content: string) => {
      if (contactId) {
        useMessageStore.getState().sendMessage(contactId, content)
        return
      }
      if (!otherUserId || !currentUserId) return

      const newId = crypto.randomUUID()
      const replyToSnapshot = useUIStore.getState().componentState?.replyingTo ?? null
      const replyToId = replyToSnapshot?.id ?? null

      let encryptedContent: string | null = null
      if (myPrivateKey && otherUserPublicKey) {
        try { encryptedContent = encryptMessage(content, otherUserPublicKey, myPrivateKey) } catch { /* fall through */ }
      }

      const newMsg = {
        id: newId,
        content,
        messageType: 'text',
        metadata: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        isSent: true,
        isRead: true,
        status: networkIsOnline ? 'sent' : 'sending',
        replyTo: replyToSnapshot ? { id: replyToSnapshot.id, content: replyToSnapshot.content, senderLabel: replyToSnapshot.senderLabel } : null,
        isDeleted: false,
      }

      setReplyingTo(null)
      useUIStore.getState().setComponentState('replyingTo', null)

      setRealMessages(prev => {
        const next = [...prev, newMsg]
        const cacheKey = conversationId ?? `pending_${otherUserId}`
        cacheMessages(cacheKey, next)
        queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next))
        return next
      })

      if (!networkIsOnline) {
        savePendingMessage(currentUserId, {
          id: newId,
          conversationId,
          otherUserId,
          content,
          encryptedContent,
          replyToId,
          createdAt: newMsg.createdAt,
        })
        return
      }

      let cid = conversationId
      if (!cid) {
        const { data, error } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: otherUserId })
        if (data) { cid = data; setConversationId(data) }
        else { console.error('Failed to get or create conversation:', error); return }
      }

      const { error } = await supabase.from('messages').insert({
        id: newId,
        conversation_id: cid,
        sender_id: currentUserId,
        content: encryptedContent ? null : content,
        encrypted_content: encryptedContent,
        status: 'sent',
        reply_to: replyToId,
      }).select('id, created_at').single()

      if (error) {
        console.error('Failed to insert message:', error)
        setRealMessages(prev => {
          const failed = prev.map(m => m.id === newId ? { ...m, status: 'failed', content: '🔒 failed to send' } : m)
          queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', failed))
          return failed
        })
      }
    },
    LucideReply: CornerUpLeft,
    LucideCopy: Copy,
    LucideTrash: Trash2,
    onDeleteMessage: async (messageId: string) => {
      const current = (useUIStore.getState().componentState?.['chatMessages'] ?? []) as any[]
      const next = current.map((m: any) => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m)
      useUIStore.getState().setComponentState('chatMessages', next)
      setRealMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m))
      if (conversationId) cacheMessages(conversationId, next)
      await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId).eq('sender_id', currentUserId)
    },
    onShowReactors: async (messageId: string) => {
      const key = 'reactions:' + messageId
      const reactions = (useUIStore.getState().componentState?.[key] ?? []) as any[]
      if (!reactions.length) return
      const userIds = [...new Set(reactions.map((r: any) => r.user_id))] as string[]
      const { data: profs } = await supabase.from('profiles').select('id, display_name, username').in('id', userIds)
      const nameMap: Record<string, string> = {}
      if (profs) profs.forEach((p: any) => { nameMap[p.id] = p.display_name || p.username || 'Unknown' })
      const liveUid = useUIStore.getState().componentState?.currentUserId as string
      const enriched = reactions.map((r: any) => ({ emoji: r.emoji, name: nameMap[r.user_id] || 'Unknown', isMe: r.user_id === liveUid }))
      useUIStore.getState().setComponentState('reactionDetail', { messageId, reactions: enriched })
    },
    useComponentState,
  }

  return (
    <>
      <RenderifyHost code={chatScreenSource} storeActions={chatScreenScope} />
      {attachConfig?.popup && showAttachSheet && createPortal(
        <RenderifyHost
          code={bottomSheetSource}
          storeActions={{
            sheetId: 'attachSheet',
            title: attachConfig.popup.title,
            options: attachConfig.popup.options,
            onClose: () => setShowAttachSheet(false),
            onOptionSelect: (option: any) => { console.log('attach option selected:', option.label); setShowAttachSheet(false) },
          }}
        />,
        document.body
      )}
    </>
  )
}

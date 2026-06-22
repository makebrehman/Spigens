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
import imageCompression from 'browser-image-compression'
import {
  cacheMessages,
  getCachedMessages,
  savePendingMessage,
  getPendingMessages,
  removePendingMessage,
} from '@/lib/offlineCache'
import { CornerUpLeft, Copy, Trash2, Mic, Square, X } from 'lucide-react'

const EMPTY_MESSAGES: any[] = []
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100 MB

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
  const [encWarning, setEncWarning] = useState(false)
  const [attachToast, setAttachToast] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contactSearch, setContactSearch] = useState('')

  const typingChannelRef = useRef<any>(null)
  const lastTypingSentRef = useRef<number>(0)
  const typingExpireRef = useRef<any>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const sendMsgRef = useRef<((content: string) => Promise<void>) | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)
  const recordingCancelledRef = useRef(false)

  const currentUserId = useAuthStore(state => state.user?.id)
  const myPublicKey = useAuthStore(state => state.profile?.public_key)
  const myPrivateKey = useAuthStore(state => state.privateKey)
  const networkIsOnline = useNetworkStore(state => state.isOnline)
  const contacts = useContactStore(state => state.contacts)

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

  const uploadChatMedia = async (file: File): Promise<string | null> => {
    if (!currentUserId) return null

    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) {
      setAttachToast('Video too large — max 100 MB')
      setTimeout(() => setAttachToast(null), 2600)
      return null
    }

    let processedFile: File | Blob = file

    if (file.type.startsWith('image/')) {
      try {
        processedFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1080,
          useWebWorker: true,
        })
      } catch { /* fall through with original */ }
    }

    const ext = file.name.split('.').pop() || 'bin'
    const path = `${currentUserId}/chat_media/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, processedFile, { upsert: false })

    if (error) {
      setAttachToast('Failed to send. Try again.')
      setTimeout(() => setAttachToast(null), 2600)
      return null
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  const sendMediaOptimistic = async (file: File) => {
    if (!currentUserId || !otherUserId) return

    const fileType = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'file'

    const localUrl = URL.createObjectURL(file)
    const tempId = `temp_${Date.now()}`
    const createdAt = new Date().toISOString()

    const optimisticMsg = {
      id: tempId,
      content: localUrl,
      messageType: fileType,
      metadata: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt,
      isSent: true,
      isRead: true,
      status: 'sending' as const,
      replyTo: null,
      isDeleted: false,
    }

    setRealMessages(prev => {
      const next = [...prev, optimisticMsg]
      queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next))
      return next
    })

    const url = await uploadChatMedia(file)
    URL.revokeObjectURL(localUrl)

    if (!url) {
      setRealMessages(prev => {
        const next = prev.filter(m => m.id !== tempId)
        queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next))
        return next
      })
      return
    }

    const realId = crypto.randomUUID()
    const realMsg = { ...optimisticMsg, id: realId, content: url, status: 'sent' as const }

    setRealMessages(prev => {
      const next = prev.map(m => m.id === tempId ? realMsg : m)
      queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next))
      return next
    })

    if (!networkIsOnline) {
      savePendingMessage(currentUserId, {
        id: realId,
        conversationId,
        otherUserId,
        content: url,
        encryptedContent: null,
        replyToId: null,
        createdAt,
      })
      return
    }

    let cid = conversationId
    if (!cid) {
      const { data } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: otherUserId })
      if (data) { cid = data; setConversationId(data) } else return
    }

    let encContent: string | null = null
    if (myPrivateKey && otherUserPublicKey) {
      try { encContent = encryptMessage(url, otherUserPublicKey, myPrivateKey) } catch { /* send plain */ }
    }

    await supabase.from('messages').insert({
      id: realId,
      conversation_id: cid,
      sender_id: currentUserId,
      content: encContent ? null : url,
      encrypted_content: encContent,
      message_type: fileType,
      status: 'sent',
      reply_to: null,
    })
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recordingCancelledRef.current = false

      recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)
        clearInterval(recordingTimerRef.current)
        setRecordingDuration(0)
        if (recordingCancelledRef.current) { recordingCancelledRef.current = false; return }
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        await sendMediaOptimistic(file)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000)
    } catch {
      setAttachToast('Microphone access denied')
      setTimeout(() => setAttachToast(null), 2600)
    }
  }

  const stopVoiceRecording = () => {
    recordingCancelledRef.current = false
    mediaRecorderRef.current?.stop()
    clearInterval(recordingTimerRef.current)
  }

  const cancelVoiceRecording = () => {
    recordingCancelledRef.current = true
    mediaRecorderRef.current?.stop()
    clearInterval(recordingTimerRef.current)
    setIsRecording(false)
    setRecordingDuration(0)
  }

  const handleAttachOption = async (option: any) => {
    setShowAttachSheet(false)
    if (option.id === 'photo') {
      photoInputRef.current?.click()
    } else if (option.id === 'document') {
      docInputRef.current?.click()
    } else if (option.id === 'audio') {
      audioInputRef.current?.click()
    } else if (option.id === 'voice') {
      startVoiceRecording()
    } else if (option.id === 'spigens-contact') {
      setShowContactPicker(true)
    }
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
        try {
          encryptedContent = encryptMessage(content, otherUserPublicKey, myPrivateKey)
        } catch {
          setEncWarning(true)
          setTimeout(() => setEncWarning(false), 3500)
        }
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

  sendMsgRef.current = chatScreenScope.sendMessage as any

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch.trim()) return true
    const q = contactSearch.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.rawProfile?.username || '').toLowerCase().includes(q)
  })

  return (
    <>
      <RenderifyHost code={chatScreenSource} storeActions={chatScreenScope} />

      {encWarning && (
        <div style={{ position: 'fixed', left: '50%', bottom: 'calc(80px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 210, background: '#92400e', color: '#fef3c7', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          ⚠️ Message sent without encryption
        </div>
      )}

      {attachToast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 'calc(80px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 210, background: '#1f2937', color: '#fff', padding: '12px 18px', borderRadius: 999, fontSize: 14, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {attachToast}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={photoInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
        await sendMediaOptimistic(file)
      }} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.ppt,.pptx,.csv" style={{ display: 'none' }} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
        await sendMediaOptimistic(file)
      }} />
      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
        await sendMediaOptimistic(file)
      }} />

      {/* Attach sheet */}
      {attachConfig?.popup && showAttachSheet && createPortal(
        <RenderifyHost
          code={bottomSheetSource}
          storeActions={{
            sheetId: 'attachSheet',
            title: attachConfig.popup.title,
            options: attachConfig.popup.options,
            onClose: () => setShowAttachSheet(false),
            onOptionSelect: (option: any) => handleAttachOption(option),
          }}
        />,
        document.body
      )}

      {/* Voice recording overlay */}
      {isRecording && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,10,10,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 88, height: 88, borderRadius: '50%', background: 'rgba(239,68,68,0.25)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={30} color="#fff" />
            </div>
          </div>
          <div style={{ color: '#fff', fontSize: 36, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>
            {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
          </div>
          <div style={{ color: '#6b7280', fontSize: 13, letterSpacing: 0.5 }}>Recording voice message</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={cancelVoiceRecording}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <X size={18} />
              Cancel
            </button>
            <button
              onClick={stopVoiceRecording}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#2563EB', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <Square size={16} fill="#fff" />
              Send
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Spigens contact picker */}
      {showContactPicker && createPortal(
        <div
          onClick={() => { setShowContactPicker(false); setContactSearch('') }}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          >
            <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}>Share contact</div>
              <input
                autoFocus
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Search by name or username…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#e8e8e8', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredContacts.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' as const, color: '#6b7280', fontSize: 14 }}>No contacts found</div>
              ) : filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => {
                    const username = contact.rawProfile?.username || ''
                    sendMsgRef.current?.(`Contact: ${contact.name}${username ? ' · @' + username : ''}`)
                    setShowContactPicker(false)
                    setContactSearch('')
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
                >
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: contact.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {contact.avatarInitials}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, color: '#e8e8e8', fontWeight: 500 }}>{contact.name}</div>
                    {contact.rawProfile?.username && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>@{contact.rawProfile.username}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

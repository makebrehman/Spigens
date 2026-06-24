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
import { encryptMessage } from '@/lib/encryption'
import imageCompression from 'browser-image-compression'
import {
  cacheMessages,
  getCachedMessages,
  upsertMessage,
  deleteCachedMessage,
  savePendingMessage,
  getPendingMessages,
  removePendingMessage,
} from '@/lib/offlineCache'
import { subscribeDb, topics } from '@/lib/dbEvents'
import { toLocalMessage, type LocalMessage } from '@/lib/messageShape'
import { CornerUpLeft, Copy, Trash2, Mic, Square, X, Forward } from 'lucide-react'

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
  // Always-current mirror of the rendered messages, for read-side logic inside async
  // realtime/send handlers (they must not depend on a stale render closure).
  const messagesRef = useRef<LocalMessage[]>([])
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [encWarning, setEncWarning] = useState(false)
  const [attachToast, setAttachToast] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [showForwardPicker, setShowForwardPicker] = useState(false)
  const forwardContentRef = useRef('')

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
  const prevOtherUserIdRef = useRef<string | undefined | null>(null)

  // Mirror live overlay values into componentState so the GenUI sources read them
  // (RenderifyHost freezes scope at mount, so changing values must flow via componentState).
  useEffect(() => { useUIStore.getState().setComponentState('chatRecordingDuration', recordingDuration) }, [recordingDuration])
  useEffect(() => { useUIStore.getState().setComponentState('chatAttachToastText', attachToast) }, [attachToast])

  const currentUserId = useAuthStore(state => state.user?.id)
  const myPublicKey = useAuthStore(state => state.profile?.public_key)
  const myPrivateKey = useAuthStore(state => state.privateKey)
  const networkIsOnline = useNetworkStore(state => state.isOnline)
  const contacts = useContactStore(state => state.contacts)

  useEffect(() => {
    if (!otherUserId || !currentUserId) return

    // Only clear messages when the contact changes, not on every network flip
    if (prevOtherUserIdRef.current !== otherUserId) {
      prevOtherUserIdRef.current = otherUserId
      messagesRef.current = []
      setRealMessages([])
      useUIStore.getState().setComponentState('chatMessages', [])
      setConversationId(null)
    }

    // Offline: keep current conversationId (don't null it — Effect 2 reads cache by it)
    if (!networkIsOnline) return

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

    resolve()
  }, [otherUserId, currentUserId, networkIsOnline])

  // Thin wrapper over the shared canonical transform (messageShape.ts) so the
  // bulk-download path (DataSyncScreen) and this screen produce identical rows.
  const decryptRow = (row: any, prevMessages: LocalMessage[]): LocalMessage =>
    toLocalMessage(row, {
      currentUserId,
      otherPublicKey: otherUserPublicKey,
      myPrivateKey,
      contactName,
      prev: prevMessages,
    })

  // ── LOCAL-FIRST READ ──────────────────────────────────────────────────────
  // The UI renders from componentState.chatMessages. Keep that (and realMessages)
  // as a pure reflection of local SQLite: read on mount, then re-read whenever a
  // write announces a change for this conversation. Every writer below goes to the
  // DB and emits — so DB write → this re-read → UI update. (Architecture A.)
  useEffect(() => {
    if (!otherUserId) return
    const convKey = conversationId ?? `pending_${otherUserId}`
    const pendKey = `pending_${otherUserId}`
    let active = true

    const reload = async () => {
      const primary = (await getCachedMessages(convKey)) ?? []
      let merged = primary
      // During the brief window after a conversation id resolves, optimistic msgs
      // may still sit under the pending key — fold them in so nothing flickers out.
      if (conversationId) {
        const pend = (await getCachedMessages(pendKey)) ?? []
        if (pend.length) {
          const seen = new Set(primary.map(m => m.id))
          merged = [...primary, ...pend.filter(m => !seen.has(m.id))]
            .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        }
      }
      if (!active) return
      messagesRef.current = merged
      setRealMessages(merged)
      useUIStore.getState().setComponentState('chatMessages', merged)
    }

    reload()
    const unsubA = subscribeDb(topics.messages(convKey), reload)
    const unsubB = convKey !== pendKey ? subscribeDb(topics.messages(pendKey), reload) : () => {}
    return () => { active = false; unsubA(); unsubB() }
  }, [otherUserId, conversationId])

  useEffect(() => {
    if (!otherUserId) return
    // Messages are read by the local-first effect above; this effect only pulls
    // fresh data from the network into the DB and wires realtime.
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

      // Merge any still-pending offline messages so they survive the DB refresh.
      // Without this, loadMessages overwrites realMessages and pending msgs disappear
      // (the realtime INSERT guard filters own-sender events, so they never come back).
      const allPending = await getPendingMessages(currentUserId!)
      const stillPending = allPending.filter(pm =>
        pm.conversationId === conversationId || (!pm.conversationId && pm.otherUserId === otherUserId)
      )
      const pendingMsgs = stillPending
        .filter(pm => !msgs.find(m => m.id === pm.id))
        .map(pm => ({
          id: pm.id,
          content: pm.content,
          messageType: (pm.messageType ?? 'text') as string,
          metadata: null,
          timestamp: new Date(pm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: pm.createdAt,
          isSent: true,
          isRead: true,
          status: 'sending' as const,
          replyTo: null,
          isDeleted: false,
        }))
      const allMsgs = [...msgs, ...pendingMsgs]

      // Write the fresh server state to the DB — the local-first effect re-reads
      // and re-renders. We do NOT setRealMessages here (single source of truth = DB).
      await cacheMessages(conversationId, allMsgs)
      useUIStore.getState().setComponentState('conversationId', conversationId)
      useUIStore.getState().setComponentState('currentUserId', currentUserId)
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

        if (messagesRef.current.some(m => m.id === row.id)) return
        const msg = decryptRow(row, messagesRef.current)
        msg.status = row.status === 'sent' ? 'delivered' : row.status
        await upsertMessage(conversationId, msg) // emit → local-first re-read renders it
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, async (payload) => {
        const row = payload.new as any
        const existing = messagesRef.current.find(m => m.id === row.id)
        if (!existing) return
        let updated: LocalMessage | null = null
        if (row.deleted_at && !existing.isDeleted) {
          updated = { ...existing, isDeleted: true, content: '' }
        } else if (row.sender_id === currentUserId && existing.status !== row.status) {
          updated = { ...existing, status: row.status }
        }
        if (!updated) return
        await upsertMessage(conversationId, updated)
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

    const flushPending = async () => {
      const allPending = await getPendingMessages(currentUserId)
      const pending = allPending.filter(m =>
        m.conversationId === conversationId || (!m.conversationId && m.otherUserId === otherUserId)
      )
      if (!pending.length) return

      for (const pm of pending) {
        let cid = conversationId
        if (!cid) {
          const { data } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: pm.otherUserId })
          if (data) { cid = data; setConversationId(data) } else continue
        }
        const { error } = await supabase.from('messages').insert({
          id: pm.id,
          conversation_id: cid,
          sender_id: currentUserId,
          content: pm.encryptedContent ? null : pm.content,
          encrypted_content: pm.encryptedContent,
          message_type: pm.messageType ?? 'text',
          status: 'sent',
          reply_to: pm.replyToId,
          created_at: pm.createdAt,
        })
        if (!error) {
          await removePendingMessage(currentUserId, pm.id)
          const existing = messagesRef.current.find(m => m.id === pm.id)
          const msg: LocalMessage = existing
            ? { ...existing, status: 'sent' }
            : {
                id: pm.id, content: pm.content, messageType: pm.messageType ?? 'text', metadata: null,
                timestamp: new Date(pm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: pm.createdAt, isSent: true, isRead: true, status: 'sent',
                replyTo: null, isDeleted: false,
              }
          await upsertMessage(cid, msg) // store under the now-resolved conversation key
        }
      }
    }

    flushPending()
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

    // Key the optimistic row under the active conversation (or the pending key if
    // the conversation isn't created yet). All writes go through the DB → emit.
    const mediaKey = ((useUIStore.getState().componentState as any)?.conversationId as string | null) ?? `pending_${otherUserId}`

    const optimisticMsg: LocalMessage = {
      id: tempId,
      content: localUrl,
      messageType: fileType,
      metadata: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt,
      isSent: true,
      isRead: true,
      status: 'sending',
      replyTo: null,
      isDeleted: false,
    }

    await upsertMessage(mediaKey, optimisticMsg)

    const url = await uploadChatMedia(file)
    URL.revokeObjectURL(localUrl)

    if (!url) {
      await deleteCachedMessage(mediaKey, tempId)
      return
    }

    const realId = crypto.randomUUID()
    const realMsg: LocalMessage = { ...optimisticMsg, id: realId, content: url, status: 'sent' }

    // swap the temp row for the real one
    await deleteCachedMessage(mediaKey, tempId)
    await upsertMessage(mediaKey, realMsg)

    const isOnline = useNetworkStore.getState().isOnline
    const liveCid = (useUIStore.getState().componentState as any)?.conversationId as string | null ?? null

    if (!isOnline) {
      await savePendingMessage(currentUserId, {
        id: realId,
        conversationId: liveCid,
        otherUserId,
        content: url,
        encryptedContent: null,
        replyToId: null,
        createdAt,
        messageType: fileType,
      })
      return
    }

    let cid = liveCid
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

  const sendForwardedMessage = async (targetUserId: string, content: string) => {
    if (!currentUserId) return
    const { data: cid } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: targetUserId })
    if (!cid) return
    await supabase.from('messages').insert({
      id: crypto.randomUUID(),
      conversation_id: cid,
      sender_id: currentUserId,
      content,
      status: 'sent',
    })
    setAttachToast('Forwarded')
    setTimeout(() => setAttachToast(null), 1500)
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

      // Read live values from stores — the scope is frozen at compile time so
      // closed-over React state (networkIsOnline, conversationId) would be stale
      const isOnline = useNetworkStore.getState().isOnline
      const liveCid = (useUIStore.getState().componentState as any)?.conversationId as string | null ?? null

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

      const cacheKey = liveCid ?? `pending_${otherUserId}`
      const newMsg: LocalMessage = {
        id: newId,
        content,
        messageType: 'text',
        metadata: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        isSent: true,
        isRead: true,
        status: isOnline ? 'sent' : 'sending',
        replyTo: replyToSnapshot ? { id: replyToSnapshot.id, content: replyToSnapshot.content, senderLabel: replyToSnapshot.senderLabel } : null,
        isDeleted: false,
      }

      setReplyingTo(null)
      useUIStore.getState().setComponentState('replyingTo', null)

      // optimistic write → DB → emit → local-first re-read shows it instantly
      await upsertMessage(cacheKey, newMsg)

      if (!isOnline) {
        await savePendingMessage(currentUserId, {
          id: newId,
          conversationId: liveCid,
          otherUserId,
          content,
          encryptedContent,
          replyToId,
          createdAt: newMsg.createdAt,
        })
        return
      }

      let cid = liveCid
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
        const existing = messagesRef.current.find(m => m.id === newId)
        if (existing) await upsertMessage(cacheKey, { ...existing, status: 'failed', content: '🔒 failed to send' })
      }
    },
    LucideReply: CornerUpLeft,
    LucideCopy: Copy,
    LucideTrash: Trash2,
    LucideForward: Forward,
    onForwardMessage: (content: string) => { forwardContentRef.current = content; setShowForwardPicker(true) },
    onDeleteMessage: async (messageId: string) => {
      // optimistic local delete → DB → emit → re-read; then persist to server
      const existing = messagesRef.current.find(m => m.id === messageId)
      const key = conversationId ?? (otherUserId ? `pending_${otherUserId}` : null)
      if (existing && key) await upsertMessage(key, { ...existing, isDeleted: true, content: '' })
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

  // Plain serializable contacts for the forward / share-contact picker sources.
  const pickerContacts = contacts.map(c => ({
    id: c.id,
    name: c.name,
    username: c.rawProfile?.username || '',
    avatarUrl: c.avatarUrl || null,
    avatarColor: c.avatarColor || '#333',
    avatarInitials: c.avatarInitials,
  }))

  const recordingOverlayScope = {
    onCancel: cancelVoiceRecording,
    onStop: stopVoiceRecording,
    LucideMic: Mic,
    LucideX: X,
    LucideSquare: Square,
    useComponentState,
  }

  const forwardPickerScope = {
    contacts: pickerContacts,
    onClose: () => setShowForwardPicker(false),
    onSelect: async (contactId: string) => {
      setShowForwardPicker(false)
      await sendForwardedMessage(contactId, forwardContentRef.current)
    },
  }

  const contactPickerScope = {
    contacts: pickerContacts,
    onClose: () => setShowContactPicker(false),
    onSelect: (contactId: string) => {
      const c = contacts.find(x => x.id === contactId)
      if (c) {
        const username = c.rawProfile?.username || ''
        sendMsgRef.current?.(`Contact: ${c.name}${username ? ' · @' + username : ''}`)
      }
      setShowContactPicker(false)
    },
  }

  return (
    <>
      <RenderifyHost code={chatScreenSource} storeActions={chatScreenScope} />

      {encWarning && <RenderifyHost code={componentSources?.chatEncryptionToast ?? null} storeActions={{}} />}

      <RenderifyHost code={componentSources?.chatAttachToast ?? null} storeActions={{ useComponentState }} />

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
        <RenderifyHost code={componentSources?.chatRecordingOverlay ?? null} storeActions={recordingOverlayScope} />,
        document.body
      )}

      {/* Forward picker */}
      {showForwardPicker && createPortal(
        <RenderifyHost code={componentSources?.chatForwardPicker ?? null} storeActions={forwardPickerScope} />,
        document.body
      )}

      {/* Spigens contact picker */}
      {showContactPicker && createPortal(
        <RenderifyHost code={componentSources?.chatContactPicker ?? null} storeActions={contactPickerScope} />,
        document.body
      )}
    </>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MessageBubble } from './MessageBubble'
import { DateSeparator } from './DateSeparator'
import { ComposerBar } from './ComposerBar'
import { BackButton } from './BackButton'
import { ProfileImage } from './ProfileImage'
import { ChatName } from './ChatName'
import { OnlineStatus } from './OnlineStatus'
import { TypingIndicator } from './TypingIndicator'
import { ChatMessageViewport } from './ChatMessageViewport'
import { RenderifyHost } from '@/components/RenderifyHost'
import { DEFAULT_CHATSCREEN_SOURCE } from '@/lib/defaultComponents'
import { useMessageStore } from '@/stores/messageStore'
import { useUIStore } from '@/stores/uiStore'
import { useContactStore } from '@/stores/contactStore'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStore } from '@/stores/networkStore'
import { supabase } from '@/lib/supabase'
import { encryptMessage } from '@/lib/encryption'
import { buildFallbackLinkPreview, firstPreviewableUrl, type LinkPreviewData } from '@/lib/linkPreview'
import { fetchPreview } from '@/lib/previewQueue'
import { makeBlurThumb, makeVideoThumb, getAudioDuration } from '@/lib/thumbnails'
import { cacheLocalBlob } from '@/lib/mediaCache'
import imageCompression from 'browser-image-compression'
import {
  cacheMessages,
  getCachedMessages,
  getCachedMessagesPage,
  upsertMessage,
  deleteCachedMessage,
  savePendingMessage,
  getPendingMessages,
  removePendingMessage,
  getCachedReactions,
  cacheReactions,
  upsertCachedReaction,
  deleteCachedReaction,
  savePendingReaction,
  getPendingReactions,
  clearPendingReaction,
  queueReadReceipt,
  getPendingReadReceipts,
  clearReadReceipt,
  updateCachedContactMessage,
} from '@/lib/offlineCache'
import { subscribeDb, topics } from '@/lib/dbEvents'
import { toLocalMessage, type LocalMessage } from '@/lib/messageShape'
import { dmMirror as msgCache, reactionMirror } from '@/lib/messageMirror'
import { CornerUpLeft, Copy, Trash2, Mic, Square, X, Forward } from 'lucide-react'

const EMPTY_MESSAGES: any[] = []
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100 MB
const MESSAGE_PAGE_SIZE = 50
// These chatScreenScope fields already have a live-updating componentState mirror
// (see the setChatComponentState effects below and CHAT_SCOPED_COMPONENT_KEYS), so a
// change to any of them alone doesn't need to force RenderifyHost to recompile/remount
// the whole chat screen — e.g. hasOlderMessages reliably flips false -> true moments
// after the initial cached-message read resolves, right after the chat opens, and
// without this list that flip alone tore down and rebuilt the message list + composer.
const CHAT_SCREEN_STABLE_KEYS = [
  'avatarUrl', 'contactName', 'contactInitials', 'contactAvatarColor',
  'isOnline', 'lastSeen', 'hasOlderMessages', 'currentUserId',
]
const CHAT_SCOPED_COMPONENT_KEYS = new Set([
  'chatMessages',
  'conversationId',
  'currentUserId',
  'chatContactName',
  'chatAvatarUrl',
  'chatContactInitials',
  'chatContactAvatarColor',
  'chatIsOnline',
  'chatLastSeen',
  'hasOlderMessages',
  'chatRecordingDuration',
  'chatAttachToastText',
  'activeMessageActions',
  'dmDeleteTarget',
  'reactionDetail',
  'openReactionMessageId',
  'otherUserTyping',
  'replyingTo',
  'highlightedMessageId',
  'composerText',
])

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
  onOpenUserProfile?: (user: { id: string; display_name?: string; username?: string; avatar_url?: string | null }) => void
  onOpenCommunityInvite?: (meta: any, msgId: string) => void
}

export function ChatScreen(props: ChatScreenProps) {
  const {
    contactId, otherUserId, otherUserPublicKey, avatarUrl,
    contactName, contactInitials, contactAvatarColor,
    isOnline, lastSeen, onBack, onViewContactProfile, onOpenUserProfile, onOpenCommunityInvite,
  } = props

  const storeMessages = useMessageStore(state => (contactId ? state.messagesByContact[contactId] : undefined)) ?? EMPTY_MESSAGES

  const attachConfig = useUIStore(state => state.behaviorConfig.attachButton)
  const componentSources = useUIStore(state => state.componentSources)
  const savedChatScreenSource = componentSources?.chatScreen ?? null
  const chatScreenSource = savedChatScreenSource && savedChatScreenSource.includes('ChatMessageViewport')
    ? savedChatScreenSource
    : DEFAULT_CHATSCREEN_SOURCE
  const bottomSheetSource = componentSources?.bottomSheet ?? null
  const initialConversationId = otherUserId
    ? useContactStore.getState().contacts.find(c => c.id === otherUserId)?.conversationId ?? null
    : null

  const [showAttachSheet, setShowAttachSheet] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [realMessages, setRealMessages] = useState<any[]>([])
  // Always-current mirror of the rendered messages, for read-side logic inside async
  // realtime/send handlers (they must not depend on a stale render closure).
  const messagesRef = useRef<LocalMessage[]>([])

  // GenUI-safe loading gate: true once this chat's messages have resolved (cache,
  // network, offline, or a brand-new empty chat). While false a plain React loader
  // covers the screen so the GenUI source's "no messages yet" never shows mid-load.
  const [loaded, setLoaded] = useState(false)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [encWarning, setEncWarning] = useState(false)
  const [attachToast, setAttachToast] = useState<string | null>(null)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
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
  const recordingStartRef = useRef<number>(0)
  const prevOtherUserIdRef = useRef<string | undefined | null>(null)
  const loadedMessageLimitRef = useRef(MESSAGE_PAGE_SIZE)
  // Stable refs for callback props — the GenUI compiled scope is frozen (useMemo
  // in RenderifyHost), but ref.current always points to the latest function.
  const onBackRef = useRef(onBack)
  const onViewContactProfileRef = useRef(onViewContactProfile)
  useEffect(() => {
    onBackRef.current = onBack
    onViewContactProfileRef.current = onViewContactProfile
  }, [onBack, onViewContactProfile])

  const currentUserId = useAuthStore(state => state.user?.id)
  const myPublicKey = useAuthStore(state => state.profile?.public_key)
  const myPrivateKey = useAuthStore(state => state.privateKey)
  const networkIsOnline = useNetworkStore(state => state.isOnline)
  const contacts = useContactStore(state => state.contacts)
  const chatKey = otherUserId || contactId || 'unknown'
  const scopeId = `dm:${chatKey}`
  const mapComponentKey = useCallback(
    (key: string) => CHAT_SCOPED_COMPONENT_KEYS.has(key) ? `${scopeId}:${key}` : key,
    [scopeId]
  )
  const getChatComponentState = useCallback(
    (key: string, defaultValue?: any) => {
      const mapped = mapComponentKey(key)
      return (useUIStore.getState().componentState as Record<string, any>)?.[mapped] ?? defaultValue
    },
    [mapComponentKey]
  )
  const setChatComponentState = useCallback(
    (key: string, value: any) => useUIStore.getState().setComponentState(mapComponentKey(key), value),
    [mapComponentKey]
  )
  const conversationIdRef = useRef<string | null>(initialConversationId)

  useEffect(() => {
    conversationIdRef.current = conversationId
    setChatComponentState('conversationId', conversationId ?? null)
  }, [conversationId, setChatComponentState])

  // Mirror live overlay values into scoped componentState so the GenUI sources keep
  // their old key names without sharing one global "current chat" bucket.
  useEffect(() => { setChatComponentState('chatRecordingDuration', recordingDuration) }, [recordingDuration, setChatComponentState])
  useEffect(() => { setChatComponentState('chatAttachToastText', attachToast) }, [attachToast, setChatComponentState])
  useEffect(() => { setChatComponentState('chatContactName', contactName) }, [contactName, setChatComponentState])
  useEffect(() => { setChatComponentState('chatAvatarUrl', avatarUrl ?? null) }, [avatarUrl, setChatComponentState])
  useEffect(() => { setChatComponentState('chatContactInitials', contactInitials) }, [contactInitials, setChatComponentState])
  useEffect(() => { setChatComponentState('chatContactAvatarColor', contactAvatarColor ?? null) }, [contactAvatarColor, setChatComponentState])
  useEffect(() => { setChatComponentState('chatIsOnline', isOnline) }, [isOnline, setChatComponentState])
  useEffect(() => { setChatComponentState('chatLastSeen', lastSeen ?? null) }, [lastSeen, setChatComponentState])
  useEffect(() => { setChatComponentState('currentUserId', currentUserId ?? null) }, [currentUserId, setChatComponentState])
  // hasOlderMessages flips from false -> true shortly after the initial cached-page
  // read resolves. Mirrored into componentState (like the fields above) so that
  // transition updates the rendered UI in place instead of forcing RenderifyHost to
  // recompile — a raw primitive on chatScreenScope would otherwise change the
  // auto-refresh fingerprint and remount the whole chat screen (message list +
  // composer) right as it finishes loading.
  useEffect(() => { setChatComponentState('hasOlderMessages', hasOlderMessages) }, [hasOlderMessages, setChatComponentState])
  useEffect(() => {
    if (contactId) setChatComponentState('chatMessages', storeMessages)
  }, [contactId, storeMessages, setChatComponentState])

  useEffect(() => {
    if (!otherUserId || !currentUserId) return

    // Reset the conversation id when the contact changes. The first render still
    // gets local messages through chatScreenScope.messages below.
    if (prevOtherUserIdRef.current !== otherUserId) {
      prevOtherUserIdRef.current = otherUserId
      conversationIdRef.current = null
      loadedMessageLimitRef.current = MESSAGE_PAGE_SIZE
      messagesRef.current = []
      setRealMessages([])
      setHasOlderMessages(false)
      setConversationId(null)
    }

    // Resolve the conversation id from the locally-cached contact. Messages are cached
    // under the real conversation id, so this is what makes them load offline (and load
    // instantly online, without waiting on the server lookup below).
    const cachedCid = useContactStore.getState().contacts.find(c => c.id === otherUserId)?.conversationId
    if (cachedCid) { conversationIdRef.current = cachedCid; setConversationId(cachedCid) }

    // Offline: keep current conversationId (don't null it — Effect 2 reads cache by it)
    if (!networkIsOnline) { setLoaded(true); return }

    const resolve = async () => {
      const { data: mine, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId)

      if (error || !mine?.length) { conversationIdRef.current = null; setConversationId(null); setLoaded(true); return }

      const myIds = mine.map(r => r.conversation_id)
      const { data: shared, error: sharedErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUserId)
        .in('conversation_id', myIds)
        .limit(1)

      const cid = !sharedErr && shared?.length ? shared[0].conversation_id : null
      conversationIdRef.current = cid
      setConversationId(cid)
      // No existing conversation → brand-new empty chat; nothing to load, reveal now.
      if (!cid) setLoaded(true)
    }

    resolve()
  }, [otherUserId, currentUserId, networkIsOnline])

  // Reset the loading gate when the contact changes; safety timeout guarantees the
  // loader can never hang even if a fetch stalls. (Legacy contactId path has no async
  // message load, so it reveals immediately.)
  useEffect(() => {
    if (!otherUserId) { setLoaded(true); return }
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 5000)
    return () => clearTimeout(t)
  }, [otherUserId])

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

  const encryptedPreviewMetadata = (metadata: any | null | undefined): any | null => {
    const preview = metadata?.linkPreview as LinkPreviewData | undefined
    if (!preview || !myPrivateKey || !otherUserPublicKey) return null
    try {
      return { enc: true, linkPreview: encryptMessage(JSON.stringify(preview), otherUserPublicKey, myPrivateKey) }
    } catch {
      return null
    }
  }

  const enrichDmLinkPreview = async (messageId: string, cacheKeys: string[], content: string) => {
    const url = firstPreviewableUrl(content)
    if (!url) return
    const preview = await fetchPreview(url) // cache-first → Edge Function server proxy
    if (!preview) return
    const metadata = { linkPreview: preview }

    for (const key of cacheKeys) {
      const existing = messagesRef.current.find(m => m.id === messageId)
      if (existing) await upsertMessage(key, { ...existing, metadata })
    }

    const cid = conversationIdRef.current
    const dbMeta = encryptedPreviewMetadata(metadata)
    if (cid && currentUserId && dbMeta) {
      await supabase.from('messages').update({ metadata: dbMeta }).eq('id', messageId).eq('sender_id', currentUserId)
    }
  }

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
      const limit = Math.max(MESSAGE_PAGE_SIZE, loadedMessageLimitRef.current)
      const primary = (await getCachedMessagesPage(convKey, { limit })) ?? []
      let merged = primary
      if (primary.length && messagesRef.current.length) {
        const firstCreated = primary[0]?.createdAt ?? ''
        const seen = new Set(primary.map(m => m.id))
        const preservedOlder = messagesRef.current.filter(m =>
          !seen.has(m.id) && (!firstCreated || (m.createdAt || '') < firstCreated)
        )
        if (preservedOlder.length) {
          merged = [...preservedOlder, ...primary]
            .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        }
      }
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
      if (merged.length > 0) {
        // Only update state when SQLite returned real data (same guard as
        // CommunityListScreen) so an empty DB read never wipes messages that
        // are about to arrive via the network load below.
        if (otherUserId) msgCache.set(otherUserId, merged)
        loadedMessageLimitRef.current = Math.max(loadedMessageLimitRef.current, merged.length)
        messagesRef.current = merged
        setRealMessages(merged)
        setChatComponentState('chatMessages', merged)
        if (primary.length < limit) setHasOlderMessages(false)
        else if (primary.length >= MESSAGE_PAGE_SIZE) setHasOlderMessages(true)
        setLoaded(true)
      } else if (!useNetworkStore.getState().isOnline) {
        // Offline + empty cache: reveal the screen to show "no messages yet"
        setLoaded(true)
      }
    }

    reload()
    const unsubA = subscribeDb(topics.messages(convKey), reload)
    const unsubB = convKey !== pendKey ? subscribeDb(topics.messages(pendKey), reload) : () => {}
    return () => { active = false; unsubA(); unsubB() }
  }, [otherUserId, conversationId, setChatComponentState])

  const loadOlderMessages = useCallback(async (): Promise<boolean> => {
    if (!otherUserId || loadingOlderMessages) return false
    const first = messagesRef.current[0]
    if (!first?.createdAt) { setHasOlderMessages(false); return false }

    const convKey = conversationIdRef.current ?? `pending_${otherUserId}`
    setLoadingOlderMessages(true)
    try {
      const older = (await getCachedMessagesPage(convKey, { limit: MESSAGE_PAGE_SIZE, beforeCreatedAt: first.createdAt })) ?? []
      if (!older.length) { setHasOlderMessages(false); return false }

      const seen = new Set(messagesRef.current.map(m => m.id))
      const merged = [...older.filter(m => !seen.has(m.id)), ...messagesRef.current]
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      loadedMessageLimitRef.current = Math.max(loadedMessageLimitRef.current, merged.length)
      messagesRef.current = merged
      setRealMessages(merged)
      setChatComponentState('chatMessages', merged)
      if (otherUserId) msgCache.set(otherUserId, merged)
      setHasOlderMessages(older.length >= MESSAGE_PAGE_SIZE)
      return true
    } finally {
      setLoadingOlderMessages(false)
    }
  }, [loadingOlderMessages, otherUserId, setChatComponentState])

  // ── REACTIONS: LOCAL-FIRST READ ───────────────────────────────────────────
  // Reads from SQLite immediately (works offline) and subscribes to any future
  // SQLite reaction writes so the UI re-renders automatically — same pattern as
  // the message local-first effect above. No network gate here.
  useEffect(() => {
    if (!conversationId || !currentUserId) return
    let active = true

    const renderFromCache = async () => {
      const cached = await getCachedReactions(conversationId)
      if (conversationId) reactionMirror.set(conversationId, cached)
      if (!active) return
      Object.keys(cached).forEach(msgId =>
        useUIStore.getState().setComponentState('reactions:' + msgId, cached[msgId])
      )
    }

    renderFromCache()
    const unsub = subscribeDb(topics.reactions(conversationId), renderFromCache)
    return () => { active = false; unsub() }
  }, [conversationId, currentUserId])

  // ── REACTIONS: ONLINE SUPABASE SYNC ──────────────────────────────────────
  // When online, fetch the authoritative server state, merge pending offline
  // toggles, and write to SQLite. The write above emits a dbEvents signal which
  // the local-first effect picks up automatically — no direct componentState
  // manipulation here, SQLite is the single source of truth.
  useEffect(() => {
    if (!conversationId || !currentUserId || !networkIsOnline) return

    ;(async () => {
      const { data: rows, error } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .eq('conversation_id', conversationId)
      if (error || !rows) return

      const pending = await getPendingReactions()
      const pendingForConv = pending.filter(r => r.conversationId === conversationId)
      const merged = new Map(rows.map(r => [`${r.message_id}:${r.user_id}`, r]))
      for (const p of pendingForConv) {
        const k = `${p.messageId}:${p.userId}`
        if (p.action === 'remove') merged.delete(k)
        else merged.set(k, { message_id: p.messageId, user_id: p.userId, emoji: p.emoji })
      }
      // cacheReactions → emitDb(topics.reactions) → subscribeDb listener → renderFromCache
      await cacheReactions(conversationId, [...merged.values()])
    })()
  }, [conversationId, currentUserId, networkIsOnline])

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
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !data) { console.error('Failed to load messages:', error); setLoaded(true); return }

      const msgs: any[] = []
      ;[...data].reverse().forEach(row => msgs.push(decryptRow(row, msgs)))

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
          metadata: pm.metadata ?? null,
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
      setChatComponentState('conversationId', conversationId)
      setChatComponentState('currentUserId', currentUserId)
      setLoaded(true) // network settled → reveal (the emit above already rendered messages)
    }

    loadMessages()

    setChatComponentState('conversationId', conversationId)
    setChatComponentState('currentUserId', currentUserId)

    const channel = supabase
      .channel('messages:' + conversationId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, async (payload) => {
        const row = payload.new as any
        const existing = messagesRef.current.find(m => m.id === row.id)
        if (!existing) return
        const fresh = decryptRow(row, messagesRef.current)
        let updated: LocalMessage | null = null
        if (row.deleted_at && !existing.isDeleted) {
          updated = { ...existing, isDeleted: true, content: '' }
        } else {
          const next = { ...existing }
          let changed = false
          if (row.sender_id === currentUserId && existing.status !== row.status) {
            next.status = row.status
            changed = true
          }
          if (JSON.stringify(existing.metadata ?? null) !== JSON.stringify(fresh.metadata ?? null)) {
            next.metadata = fresh.metadata
            changed = true
          }
          updated = changed ? next : null
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
          setChatComponentState('otherUserTyping', true)
          if (typingExpireRef.current) clearTimeout(typingExpireRef.current)
          typingExpireRef.current = setTimeout(() => setChatComponentState('otherUserTyping', false), 3000)
        }
      })
      .subscribe()

    typingChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      if (typingExpireRef.current) clearTimeout(typingExpireRef.current)
      typingChannelRef.current = null
      setChatComponentState('otherUserTyping', false)
      setChatComponentState('openReactionMessageId', null)
      setChatComponentState('activeMessageActions', null)
      setChatComponentState('reactionDetail', null)
    }
  }, [conversationId, currentUserId, myPublicKey, otherUserPublicKey, networkIsOnline, setChatComponentState])

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
          if (data) { cid = data; conversationIdRef.current = data; setConversationId(data) } else continue
        }
        const { error } = await supabase.from('messages').insert({
          id: pm.id,
          conversation_id: cid,
          sender_id: currentUserId,
          content: pm.encryptedContent ? null : pm.content,
          encrypted_content: pm.encryptedContent,
          message_type: pm.messageType ?? 'text',
          metadata: encryptedPreviewMetadata(pm.metadata),
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
                id: pm.id, content: pm.content, messageType: pm.messageType ?? 'text', metadata: pm.metadata ?? null,
                timestamp: new Date(pm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: pm.createdAt, isSent: true, isRead: true, status: 'sent',
                replyTo: null, isDeleted: false,
              }
          await upsertMessage(cid, msg) // store under the now-resolved conversation key
          enrichDmLinkPreview(pm.id, [cid], pm.content).catch(() => {})
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
    if (!conversationId || !currentUserId) return
    const hasUnread = realMessages.some(m => !m.isSent && m.status !== 'read')
    if (!networkIsOnline) {
      // Queue for when the device reconnects; repeated opens collapse to one row.
      if (hasUnread) queueReadReceipt(conversationId).catch(() => {})
      return
    }
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

  // Flush any read receipts that were queued while offline.
  useEffect(() => {
    if (!networkIsOnline || !currentUserId) return
    ;(async () => {
      const pending = await getPendingReadReceipts()
      if (!pending.length) return
      await Promise.all(pending.map(async cid => {
        await supabase.from('messages').update({ status: 'read' })
          .eq('conversation_id', cid)
          .neq('sender_id', currentUserId)
          .neq('status', 'read')
        await supabase.from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', cid)
          .eq('user_id', currentUserId)
        await clearReadReceipt(cid)
      }))
    })()
  }, [networkIsOnline, currentUserId])

  // Flush any reaction toggles that were queued while offline.
  useEffect(() => {
    if (!networkIsOnline || !currentUserId) return
    ;(async () => {
      const pending = await getPendingReactions()
      if (!pending.length) return
      await Promise.all(pending.map(async r => {
        if (r.action === 'remove') {
          await supabase.from('message_reactions').delete()
            .eq('message_id', r.messageId).eq('user_id', r.userId)
        } else {
          await supabase.from('message_reactions').upsert(
            { message_id: r.messageId, conversation_id: r.conversationId, user_id: r.userId, emoji: r.emoji },
            { onConflict: 'message_id,user_id' }
          )
        }
        await clearPendingReaction(r.messageId, r.userId)
      }))
    })()
  }, [networkIsOnline, currentUserId])

  function useComponentState(key: string, defaultValue: any) {
    const mappedKey = mapComponentKey(key)
    const [value, setValue] = useState(
      () => (useUIStore.getState().componentState as Record<string, any>)?.[mappedKey] ?? defaultValue
    )
    useEffect(() => {
      const unsub = useUIStore.subscribe((state: any, prevState: any) => {
        const next = state.componentState?.[mappedKey]
        const prev = prevState.componentState?.[mappedKey]
        if (next !== prev) setValue(next ?? defaultValue)
      })
      return unsub
    }, [mappedKey, defaultValue])
    return [value, (newVal: any) => {
      if (typeof newVal === 'function') {
        setValue((prev: any) => {
          const r = newVal(prev)
          useUIStore.getState().setComponentState(mappedKey, r)
          return r
        })
      } else {
        setValue(newVal)
        useUIStore.getState().setComponentState(mappedKey, newVal)
      }
    }] as [any, (v: any) => void]
  }

  const uploadChatMedia = async (file: File): Promise<{ url: string; blob: Blob } | null> => {
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
    return { url: data.publicUrl, blob: processedFile }
  }

  const sendMediaOptimistic = async (file: File, knownDuration?: number) => {
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
    const mediaKey = conversationIdRef.current ?? `pending_${otherUserId}`

    // Display metadata (plaintext, kept locally so the sender sees the right card /
    // thumbnail instantly and offline). Filenames + thumbnails are encrypted before
    // they reach the DB (below); dur/size/w/h are non-sensitive and ride plaintext.
    const displayMeta: any = {}
    if (fileType === 'file' || fileType === 'audio') {
      displayMeta.name = file.name
      displayMeta.size = file.size
    }

    // Generate the thumbnail / duration in parallel with the upload so it never
    // delays the optimistic bubble. For images this is the tiny blur placeholder;
    // for videos a real poster frame (+ duration, dimensions); for audio a duration.
    const metaP: Promise<void> = (async () => {
      try {
        if (fileType === 'image') {
          displayMeta.thumb = await makeBlurThumb(file).catch(() => null)
        } else if (fileType === 'video') {
          const v = await makeVideoThumb(file).catch(() => null)
          if (v) { displayMeta.thumb = v.thumb; displayMeta.dur = v.dur; displayMeta.w = v.w; displayMeta.h = v.h }
        } else if (fileType === 'audio') {
          displayMeta.dur = knownDuration && knownDuration > 0 ? knownDuration : await getAudioDuration(file).catch(() => 0)
        }
      } catch { /* leave whatever we have */ }
    })()

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

    // Show the poster / preview to the sender as soon as it's generated — before the
    // (potentially slow) upload finishes — so a video doesn't sit on a black frame
    // and an image shows its blur instantly. The bubble updates in place.
    await metaP
    if (Object.keys(displayMeta).length > 0) {
      await upsertMessage(mediaKey, { ...optimisticMsg, metadata: { ...displayMeta } })
    }

    const uploaded = await uploadChatMedia(file)
    URL.revokeObjectURL(localUrl)

    if (!uploaded) {
      await deleteCachedMessage(mediaKey, tempId)
      return
    }
    const { url, blob } = uploaded
    await metaP
    const hasMeta = Object.keys(displayMeta).length > 0

    // Keep an offline copy of our own media without re-downloading it later.
    cacheLocalBlob(url, blob, fileType).catch(() => {})

    const realId = crypto.randomUUID()
    const realMsg: LocalMessage = {
      ...optimisticMsg, id: realId, content: url, status: 'sent',
      metadata: hasMeta ? { ...displayMeta } : null,
    }

    // swap the temp row for the real one
    await deleteCachedMessage(mediaKey, tempId)
    await upsertMessage(mediaKey, realMsg)

    const isOnline = useNetworkStore.getState().isOnline
    const liveCid = conversationIdRef.current

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
      if (data) { cid = data; conversationIdRef.current = data; setConversationId(data) } else return
    }

    let encContent: string | null = null
    let metaForDb: any = hasMeta ? { ...displayMeta } : null
    if (myPrivateKey && otherUserPublicKey) {
      try { encContent = encryptMessage(url, otherUserPublicKey, myPrivateKey) } catch { /* send plain */ }
      // Encrypt the sensitive bits (poster/blur preview + filename) exactly like the
      // body so the server never sees them (enc:true tells the reader to decrypt).
      if (metaForDb) {
        try {
          if (displayMeta.thumb) { metaForDb.thumb = encryptMessage(displayMeta.thumb, otherUserPublicKey, myPrivateKey); metaForDb.enc = true }
          if (displayMeta.name) { metaForDb.name = encryptMessage(displayMeta.name, otherUserPublicKey, myPrivateKey); metaForDb.enc = true }
        } catch { metaForDb.thumb = null; metaForDb.name = null }
      }
    }

    const { error } = await supabase.from('messages').insert({
      id: realId,
      conversation_id: cid,
      sender_id: currentUserId,
      content: encContent ? null : url,
      encrypted_content: encContent,
      message_type: fileType,
      metadata: metaForDb,
      status: 'sent',
      reply_to: null,
    })

    if (error) {
      // Surface the failure instead of leaving a phantom "sent" media bubble that
      // never reached the recipient (this is how the DB constraint rejection hid).
      console.error('Failed to insert media message:', error)
      await upsertMessage(mediaKey, { ...realMsg, status: 'failed' })
      setAttachToast('Failed to send. Try again.')
      setTimeout(() => setAttachToast(null), 2600)
    }
  }

  // Share a Spigens user as a rich contact card (message_type 'contact'), with the
  // contact details carried as an encrypted JSON body — no raw text, no metadata leak.
  const sendContactMessage = async (contact: { id: string; name: string; username?: string; avatarUrl?: string | null }) => {
    if (!currentUserId || !otherUserId) return
    const payload = JSON.stringify({
      id: contact.id,
      name: contact.name,
      username: contact.username || '',
      avatarUrl: contact.avatarUrl || null,
    })

    const isOnline = useNetworkStore.getState().isOnline
    const liveCid = conversationIdRef.current
    const newId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    let encryptedContent: string | null = null
    if (myPrivateKey && otherUserPublicKey) {
      try { encryptedContent = encryptMessage(payload, otherUserPublicKey, myPrivateKey) } catch { /* send plain */ }
    }

    const cacheKey = liveCid ?? `pending_${otherUserId}`
    const msg: LocalMessage = {
      id: newId,
      content: payload,
      messageType: 'contact',
      metadata: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt,
      isSent: true,
      isRead: true,
      status: isOnline ? 'sent' : 'sending',
      replyTo: null,
      isDeleted: false,
    }
    await upsertMessage(cacheKey, msg)

    if (!isOnline) {
      await savePendingMessage(currentUserId, {
        id: newId, conversationId: liveCid, otherUserId,
        content: payload, encryptedContent, replyToId: null, createdAt, messageType: 'contact',
      })
      return
    }

    let cid = liveCid
    if (!cid) {
      const { data } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: otherUserId })
      if (data) { cid = data; conversationIdRef.current = data; setConversationId(data) } else return
    }

    const { error } = await supabase.from('messages').insert({
      id: newId,
      conversation_id: cid,
      sender_id: currentUserId,
      content: encryptedContent ? null : payload,
      encrypted_content: encryptedContent,
      message_type: 'contact',
      status: 'sent',
      reply_to: null,
    })

    if (error) {
      console.error('Failed to insert contact message:', error)
      await upsertMessage(cacheKey, { ...msg, status: 'failed' })
      setAttachToast('Failed to send. Try again.')
      setTimeout(() => setAttachToast(null), 2600)
    }
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
        const secs = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000))
        setIsRecording(false)
        clearInterval(recordingTimerRef.current)
        setRecordingDuration(0)
        if (recordingCancelledRef.current) { recordingCancelledRef.current = false; return }
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        await sendMediaOptimistic(file, secs)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      recordingStartRef.current = Date.now()
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000)
    } catch (err: any) {
      const name = err?.name || ''
      const msg =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone blocked — allow mic access for Spigens in your phone settings'
          : name === 'NotFoundError'
          ? 'No microphone found on this device'
          : 'Could not start recording. Please try again.'
      setAttachToast(msg)
      setTimeout(() => setAttachToast(null), 3200)
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

  const ScopedMessageBubble = (bubbleProps: any) => (
    <MessageBubble
      {...bubbleProps}
      useComponentState={useComponentState}
      getComponentState={getChatComponentState}
      scopeKey={scopeId}
    />
  )
  const ScopedComposerBar = (composerProps: any) => (
    <ComposerBar {...composerProps} useComponentState={useComponentState} scopeKey={scopeId} />
  )

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
    messages: otherUserId ? (realMessages.length ? realMessages : (msgCache.get(otherUserId) ?? EMPTY_MESSAGES)) : storeMessages,
    isOffline: !networkIsOnline,
    MessageBubble: ScopedMessageBubble,
    ChatMessageViewport,
    DateSeparator,
    ComposerBar: ScopedComposerBar,
    BackButton,
    ProfileImage,
    ChatName,
    OnlineStatus,
    TypingIndicator,
    onBack: () => onBackRef.current?.(),
    onViewContactProfile: () => onViewContactProfileRef.current?.(),
    onAttach: () => setShowAttachSheet(true),
    replyingTo,
    onReplyTo: (target: any) => {
      const next = { id: target.id, content: target.content, senderLabel: target.isSent ? 'You' : contactName }
      setReplyingTo(next)
      setChatComponentState('replyingTo', next)
    },
    onCancelReply: () => {
      setReplyingTo(null)
      setChatComponentState('replyingTo', null)
    },
    onJumpToReply: (targetId: string) => {
      if (typeof document === 'undefined') return
      const el = document.getElementById('msg-' + targetId)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setChatComponentState('highlightedMessageId', targetId)
      setTimeout(() => setChatComponentState('highlightedMessageId', null), 1500)
    },
    loadOlderMessages,
    hasOlderMessages,
    currentUserId,
    onToggleReaction: (messageId: string, emoji: string) => {
      const liveUserId = currentUserId
      const liveConversationId = conversationIdRef.current
      if (!liveUserId) return
      const isOnline = useNetworkStore.getState().isOnline
      const key = 'reactions:' + messageId
      const current = (useUIStore.getState().componentState?.[key] ?? []) as any[]
      const mine = current.find((r: any) => r.user_id === liveUserId)
      if (mine && mine.emoji === emoji) {
        useUIStore.getState().setComponentState(key, current.filter((r: any) => r.user_id !== liveUserId))
        if (liveConversationId) deleteCachedReaction(messageId, liveUserId, liveConversationId).catch(() => {})
        if (isOnline) {
          supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', liveUserId).then()
        } else if (liveConversationId) {
          savePendingReaction({ messageId, userId: liveUserId, conversationId: liveConversationId, emoji, action: 'remove' }).catch(() => {})
        }
      } else {
        useUIStore.getState().setComponentState(key, [...current.filter((r: any) => r.user_id !== liveUserId), { user_id: liveUserId, emoji }])
        if (liveConversationId) upsertCachedReaction(messageId, liveUserId, liveConversationId, emoji).catch(() => {})
        if (isOnline && liveConversationId) {
          supabase.from('message_reactions').upsert({ message_id: messageId, conversation_id: liveConversationId, user_id: liveUserId, emoji }, { onConflict: 'message_id,user_id' }).then()
        } else if (liveConversationId) {
          savePendingReaction({ messageId, userId: liveUserId, conversationId: liveConversationId, emoji, action: 'add' }).catch(() => {})
        }
      }
    },
    onOpenCommunityInvite: (meta: any, msgId: string) => onOpenCommunityInvite?.(meta, msgId),
    onOpenContactCard: (contact: { id: string; name: string; username?: string; avatarUrl?: string | null }) => {
      if (!contact?.id) return
      onOpenUserProfile?.({ id: contact.id, display_name: contact.name, username: contact.username, avatar_url: contact.avatarUrl ?? null })
    },
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
      const liveCid = conversationIdRef.current

      const newId = crypto.randomUUID()
      const replyToSnapshot = getChatComponentState('replyingTo', null)
      const replyToId = replyToSnapshot?.id ?? null
      const previewUrl = firstPreviewableUrl(content)
      const localMetadata = previewUrl ? { linkPreview: buildFallbackLinkPreview(previewUrl) } : null

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
        metadata: localMetadata,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        isSent: true,
        isRead: true,
        status: isOnline ? 'sent' : 'sending',
        replyTo: replyToSnapshot ? { id: replyToSnapshot.id, content: replyToSnapshot.content, senderLabel: replyToSnapshot.senderLabel } : null,
        isDeleted: false,
      }

      setReplyingTo(null)
      setChatComponentState('replyingTo', null)

      // optimistic write → DB → emit → local-first re-read shows it instantly
      await upsertMessage(cacheKey, newMsg)
      await updateCachedContactMessage(currentUserId, otherUserId, content, newMsg.timestamp)

      if (!isOnline) {
        await savePendingMessage(currentUserId, {
          id: newId,
          conversationId: liveCid,
          otherUserId,
          content,
          encryptedContent,
          replyToId,
          createdAt: newMsg.createdAt,
          metadata: localMetadata,
        })
        return
      }

      let cid = liveCid
      if (!cid) {
        const { data, error } = await supabase.rpc('get_or_create_conversation', { p_user_a: currentUserId, p_user_b: otherUserId })
        if (data) { cid = data; conversationIdRef.current = data; setConversationId(data) }
        else { console.error('Failed to get or create conversation:', error); return }
      }

      const { error } = await supabase.from('messages').insert({
        id: newId,
        conversation_id: cid,
        sender_id: currentUserId,
        content: encryptedContent ? null : content,
        encrypted_content: encryptedContent,
        metadata: encryptedPreviewMetadata(localMetadata),
        status: 'sent',
        reply_to: replyToId,
      }).select('id, created_at').single()

      if (error) {
        console.error('Failed to insert message:', error)
        const existing = messagesRef.current.find(m => m.id === newId)
        if (existing) await upsertMessage(cacheKey, { ...existing, status: 'failed', content: '🔒 failed to send' })
      } else {
        const resolvedCid = cid
        if (!resolvedCid) return
        const sentMsg: LocalMessage = { ...newMsg, status: 'sent' }
        await upsertMessage(cacheKey, sentMsg)
        if (resolvedCid !== cacheKey) await upsertMessage(resolvedCid, sentMsg)
        enrichDmLinkPreview(newId, resolvedCid === cacheKey ? [cacheKey] : [cacheKey, resolvedCid], content).catch(() => {})
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
      const key = conversationIdRef.current ?? (otherUserId ? `pending_${otherUserId}` : null)
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
      const liveUid = currentUserId as string
      const enriched = reactions.map((r: any) => ({ emoji: r.emoji, name: nameMap[r.user_id] || 'Unknown', isMe: r.user_id === liveUid }))
      setChatComponentState('reactionDetail', { messageId, reactions: enriched })
    },
    useComponentState,
  }

  useEffect(() => {
    sendMsgRef.current = chatScreenScope.sendMessage as any
  })

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
        sendContactMessage({
          id: c.id,
          name: c.name,
          username: c.rawProfile?.username || '',
          avatarUrl: c.avatarUrl || null,
        })
      }
      setShowContactPicker(false)
    },
  }

  return (
    <>
      <RenderifyHost code={chatScreenSource} storeActions={chatScreenScope} scopeKey={scopeId} stableKeys={CHAT_SCREEN_STABLE_KEYS} />

      {encWarning && <RenderifyHost code={componentSources?.chatEncryptionToast ?? null} storeActions={{}} />}

      <RenderifyHost code={componentSources?.chatAttachToast ?? null} storeActions={{ useComponentState }} scopeKey={scopeId} />

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
          scopeKey={scopeId}
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
        <RenderifyHost code={componentSources?.chatRecordingOverlay ?? null} storeActions={recordingOverlayScope} scopeKey={scopeId} />,
        document.body
      )}

      {/* Forward picker */}
      {showForwardPicker && createPortal(
        <RenderifyHost code={componentSources?.chatForwardPicker ?? null} storeActions={forwardPickerScope} scopeKey={scopeId} />,
        document.body
      )}

      {/* Spigens contact picker */}
      {showContactPicker && createPortal(
        <RenderifyHost code={componentSources?.chatContactPicker ?? null} storeActions={contactPickerScope} scopeKey={scopeId} />,
        document.body
      )}
    </>
  )
}

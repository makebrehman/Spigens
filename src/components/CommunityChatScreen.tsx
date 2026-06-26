'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useContactStore } from '@/stores/contactStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { uploadCommunityImage } from '@/lib/avatarUpload'
import { cacheCommunityMessages, getCachedCommunityMessages, upsertCommunityMessage, deleteCachedCommunityMessage, savePendingCommunityMessage, getPendingCommunityMessages, removePendingCommunityMessage } from '@/lib/offlineCache'
import { communityMirror as commMsgCache } from '@/lib/messageMirror'
import { getMirroredMediaUri, warmMediaMirror, cacheLocalBlob } from '@/lib/mediaCache'
import { makeBlurThumb, makeVideoThumb, getAudioDuration } from '@/lib/thumbnails'
import imageCompression from 'browser-image-compression'
import { subscribeDb, topics } from '@/lib/dbEvents'
import { useNetworkStore } from '@/stores/networkStore'
import { CommunityMessageBubble } from './CommunityMessageBubble'
import { BackButton } from './BackButton'
import { CornerUpLeft, Copy, Trash2, Mic, Square, X } from 'lucide-react'
import { MessageReactions } from './MessageReactions'
import { DateSeparator } from './DateSeparator'
import { ReactionPicker } from './ReactionPicker'

const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100 MB

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
  // GenUI-safe loading gate (see ScreenLoader): covers the screen until messages resolve.
  const [loaded, setLoaded] = useState(false)
  const currentUserId = useAuthStore(state => state.user?.id)
  const profile = useAuthStore(state => state.profile)
  const networkIsOnline = useNetworkStore(state => state.isOnline)
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.communityChatScreen ?? null
  const channelRef = useRef<any>(null)
  const lastTypingRef = useRef<number>(0)
  const typingExpireRef = useRef<Record<string, any>>({})
  const memberProfilesRef = useRef<Record<string, any>>({})
  const senderCacheRef = useRef<Record<string, { displayName: string; username: string; avatarUrl: string | null }>>({})

  // ── Attachments / voice (parity with DMs) ──
  const bottomSheetSource = componentSources?.bottomSheet ?? null
  const attachConfig = useUIStore(state => state.behaviorConfig.attachButton)
  const contacts = useContactStore(state => state.contacts)
  const [showAttachSheet, setShowAttachSheet] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [attachToast, setAttachToast] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)
  const recordingCancelledRef = useRef(false)
  const recordingStartRef = useRef<number>(0)
  // Live overlay values flow to the GenUI via componentState (same keys the DM
  // recording overlay / attach toast read; the two screens are never open at once).
  useEffect(() => { useUIStore.getState().setComponentState('chatRecordingDuration', recordingDuration) }, [recordingDuration])
  useEffect(() => { useUIStore.getState().setComponentState('chatAttachToastText', attachToast) }, [attachToast])

  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(() => (useUIStore.getState().componentState as Record<string,any>)?.[key] ?? defaultValue)
    useEffect(() => { const unsub = useUIStore.subscribe((state: any, prevState: any) => { const next = state.componentState?.[key]; const prev = prevState.componentState?.[key]; if (next !== prev) setValue(next ?? defaultValue) }); return unsub }, [key, defaultValue])
    return [value, (newVal: any) => { if (typeof newVal === 'function') { setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r }) } else { setValue(newVal); useUIStore.getState().setComponentState(key, newVal) } }] as [any, (v: any) => void]
  }
  const formatMsg = (row: any) => ({
    id: row.id, content: row.content || '', messageType: row.message_type || 'text',
    metadata: row.metadata ?? null, status: 'sent',
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
    // Cached messages render via the local-first effect below; this only pulls
    // fresh data into the DB and wires realtime.
    if (!networkIsOnline) return

    supabase.from('community_messages').select('id, community_id, sender_id, content, message_type, metadata, created_at, reply_to, deleted_at, profiles!sender_id(display_name, username, avatar_url)').eq('community_id', communityId).order('created_at', { ascending: true }).limit(100)
      .then(async ({ data }: any) => {
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
          const formatted = data.map(formatMsg)
          // Write to the DB → emit → the local-first effect re-reads and renders.
          await cacheCommunityMessages(communityId, formatted)
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
        setLoaded(true) // network settled → reveal
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
        const msg = formatMsg(row) // canonical shape (NOT the raw row)
        const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
        if (current.some((m: any) => m.id === msg.id)) return // already shown (e.g. our own optimistic row)
        await upsertCommunityMessage(communityId, msg) // emit → local-first re-read renders it
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_messages', filter: 'community_id=eq.' + communityId }, async (payload: any) => {
        const row = payload.new
        if (!row.deleted_at) return
        const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
        const existing = current.find((m: any) => m.id === row.id)
        if (!existing || existing.isDeleted) return
        await upsertCommunityMessage(communityId, { ...existing, isDeleted: true, content: '' })
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
  // LOCAL-FIRST community messages — render from SQLite, re-read on any DB change.
  // Seed the (global) message state DURING render — before RenderifyHost mounts and
  // snapshots it — so switching communities never flashes the previous one's messages.
  // An effect runs too late: the GenUI has already mounted with the stale value.
  const seededRef = useRef<string | null>(null)
  if (seededRef.current !== communityId) {
    seededRef.current = communityId
    useUIStore.getState().setComponentState('communityMessages', commMsgCache.get(communityId) ?? [])
  }

  // Resolve the header community photo to its cached on-device file so it shows offline.
  useEffect(() => {
    const url = props.communityAvatarUrl
    if (!url) return
    const local = getMirroredMediaUri(url)
    if (local) { setCommunityAvatarUrl(local); return }
    warmMediaMirror([url]).then(() => { const l = getMirroredMediaUri(url); if (l) setCommunityAvatarUrl(l) })
  }, [props.communityAvatarUrl])

  useEffect(() => {
    if (!communityId) return
    let active = true
    const reload = async () => {
      const cached = await getCachedCommunityMessages(communityId)
      if (!active) return
      commMsgCache.set(communityId, cached ?? []) // keep the hot mirror fresh
      if (cached) useUIStore.getState().setComponentState('communityMessages', cached)
      if ((cached && cached.length > 0) || !useNetworkStore.getState().isOnline) setLoaded(true)
    }
    reload()
    const unsub = subscribeDb(topics.communityMessages(communityId), reload)
    return () => { active = false; unsub() }
  }, [communityId])

  // Reset the loading gate when the community changes; safety timeout never hangs it.
  useEffect(() => {
    if (!communityId) { setLoaded(true); return }
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 5000)
    return () => clearTimeout(t)
  }, [communityId])

  useEffect(() => {
    if (!communityId) return
    const fetchCommunityAvatar = () => {
      supabase.from('communities').select('avatar_url').eq('id', communityId).single()
        .then(({ data }: any) => { if (data?.avatar_url) setCommunityAvatarUrl(data.avatar_url) })
    }
    fetchCommunityAvatar()
    const avatarTimer = setTimeout(fetchCommunityAvatar, 3500)
    return () => clearTimeout(avatarTimer)
  }, [communityId, networkIsOnline])

  if (typeof window !== 'undefined' && currentUserId) { useUIStore.getState().setComponentState('currentUserId', currentUserId) }

  useEffect(() => {
    if (!networkIsOnline || !currentUserId) return
    const flushPending = async () => {
      const allPending = await getPendingCommunityMessages(currentUserId)
      const pending = allPending.filter(m => m.communityId === communityId)
      if (!pending.length) return
      for (const pm of pending) {
        const { error } = await supabase.from('community_messages').insert({ id: pm.id, community_id: pm.communityId, sender_id: currentUserId, content: pm.content, reply_to: pm.replyToId, created_at: pm.createdAt })
        if (!error) {
          await removePendingCommunityMessage(currentUserId, pm.id)
        }
      }
    }
    flushPending()
  }, [networkIsOnline, communityId, currentUserId])

  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentUserId) return
    const replyingTo = (useUIStore.getState().componentState?.['communityReplyingTo'] ?? null) as any
    const newId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const optimistic = { id: newId, content: content.trim(), senderId: currentUserId, senderName: profile?.display_name || profile?.username || 'Me', senderAvatar: profile?.avatar_url || null, senderInitials: (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt, isMine: true, isDeleted: false, replyTo: replyingTo?.id || null }
    // optimistic write → DB → emit → local-first re-read shows it
    await upsertCommunityMessage(communityId, optimistic)
    useUIStore.getState().setComponentState('communityReplyingTo', null)
    if (!networkIsOnline) {
      await savePendingCommunityMessage(currentUserId, { id: newId, communityId, content: content.trim(), replyToId: replyingTo?.id || null, createdAt })
      return
    }
    const { error } = await supabase.from('community_messages').insert({ id: newId, community_id: communityId, sender_id: currentUserId, content: content.trim(), reply_to: replyingTo?.id || null })
    if (error) {
      await deleteCachedCommunityMessage(communityId, newId)
      useUIStore.getState().setComponentState('communityError', 'Failed to send message. Please try again.')
    }
  }

  const senderBase = () => ({
    senderId: currentUserId as string,
    senderName: profile?.display_name || profile?.username || 'Me',
    senderAvatar: profile?.avatar_url || null,
    senderInitials: (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase(),
    isMine: true, isDeleted: false, replyTo: null,
  })

  const uploadCommunityMedia = async (file: File): Promise<{ url: string; blob: Blob } | null> => {
    if (!currentUserId) return null
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) {
      setAttachToast('Video too large — max 100 MB'); setTimeout(() => setAttachToast(null), 2600); return null
    }
    let processed: File | Blob = file
    if (file.type.startsWith('image/')) {
      try { processed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1080, useWebWorker: true }) } catch { /* original */ }
    }
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${currentUserId}/community_media/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, processed, { upsert: false })
    if (error) { setAttachToast('Failed to send. Try again.'); setTimeout(() => setAttachToast(null), 2600); return null }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return { url: data.publicUrl, blob: processed }
  }

  // Community media is a group chat → stored plaintext (URL + metadata), no E2E.
  const sendCommunityMedia = async (file: File, knownDuration?: number) => {
    if (!currentUserId) return
    if (!networkIsOnline) { setAttachToast('Connect to the internet to share media'); setTimeout(() => setAttachToast(null), 2600); return }
    const fileType = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio' : 'file'
    const localUrl = URL.createObjectURL(file)
    const tempId = `temp_${Date.now()}`
    const createdAt = new Date().toISOString()
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const displayMeta: any = {}
    if (fileType === 'file' || fileType === 'audio') { displayMeta.name = file.name; displayMeta.size = file.size }
    const metaP = (async () => {
      try {
        if (fileType === 'image') displayMeta.thumb = await makeBlurThumb(file).catch(() => null)
        else if (fileType === 'video') { const v = await makeVideoThumb(file).catch(() => null); if (v) { displayMeta.thumb = v.thumb; displayMeta.dur = v.dur; displayMeta.w = v.w; displayMeta.h = v.h } }
        else if (fileType === 'audio') displayMeta.dur = knownDuration && knownDuration > 0 ? knownDuration : await getAudioDuration(file).catch(() => 0)
      } catch { /* keep what we have */ }
    })()

    const optimistic: any = { id: tempId, content: localUrl, messageType: fileType, metadata: null, status: 'sending', timestamp: ts, createdAt, ...senderBase() }
    await upsertCommunityMessage(communityId, optimistic)
    await metaP
    const hasMeta = Object.keys(displayMeta).length > 0
    if (hasMeta) await upsertCommunityMessage(communityId, { ...optimistic, metadata: { ...displayMeta } })

    const uploaded = await uploadCommunityMedia(file)
    URL.revokeObjectURL(localUrl)
    if (!uploaded) { await deleteCachedCommunityMessage(communityId, tempId); return }
    const { url, blob } = uploaded
    cacheLocalBlob(url, blob, fileType).catch(() => {})

    const realId = crypto.randomUUID()
    const realMsg: any = { ...optimistic, id: realId, content: url, status: 'sent', metadata: hasMeta ? { ...displayMeta } : null }
    await deleteCachedCommunityMessage(communityId, tempId)
    await upsertCommunityMessage(communityId, realMsg)

    const { error } = await supabase.from('community_messages').insert({ id: realId, community_id: communityId, sender_id: currentUserId, content: url, message_type: fileType, metadata: hasMeta ? { ...displayMeta } : null })
    if (error) {
      console.error('Failed to insert community media:', error)
      await upsertCommunityMessage(communityId, { ...realMsg, status: 'failed' })
      setAttachToast('Failed to send. Try again.'); setTimeout(() => setAttachToast(null), 2600)
    }
  }

  const sendCommunityContact = async (contact: { id: string; name: string; username?: string; avatarUrl?: string | null }) => {
    if (!currentUserId) return
    if (!networkIsOnline) { setAttachToast('Connect to the internet to share a contact'); setTimeout(() => setAttachToast(null), 2600); return }
    const payload = JSON.stringify({ id: contact.id, name: contact.name, username: contact.username || '', avatarUrl: contact.avatarUrl || null })
    const newId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const optimistic: any = { id: newId, content: payload, messageType: 'contact', metadata: null, status: 'sent', timestamp: ts, createdAt, ...senderBase() }
    await upsertCommunityMessage(communityId, optimistic)
    const { error } = await supabase.from('community_messages').insert({ id: newId, community_id: communityId, sender_id: currentUserId, content: payload, message_type: 'contact' })
    if (error) {
      await upsertCommunityMessage(communityId, { ...optimistic, status: 'failed' })
      setAttachToast('Failed to send. Try again.'); setTimeout(() => setAttachToast(null), 2600)
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
        setIsRecording(false); clearInterval(recordingTimerRef.current); setRecordingDuration(0)
        if (recordingCancelledRef.current) { recordingCancelledRef.current = false; return }
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        await sendCommunityMedia(file, secs)
      }
      recorder.start(); mediaRecorderRef.current = recorder; recordingStartRef.current = Date.now()
      setIsRecording(true); setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000)
    } catch (err: any) {
      const name = err?.name || ''
      setAttachToast(name === 'NotAllowedError' || name === 'SecurityError' ? 'Microphone blocked — allow mic access for Spigens in your phone settings' : name === 'NotFoundError' ? 'No microphone found on this device' : 'Could not start recording. Please try again.')
      setTimeout(() => setAttachToast(null), 3200)
    }
  }
  const stopVoiceRecording = () => { recordingCancelledRef.current = false; mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current) }
  const cancelVoiceRecording = () => { recordingCancelledRef.current = true; mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current); setIsRecording(false); setRecordingDuration(0) }

  const handleAttachOption = async (option: any) => {
    setShowAttachSheet(false)
    if (option.id === 'photo') photoInputRef.current?.click()
    else if (option.id === 'document') docInputRef.current?.click()
    else if (option.id === 'audio') audioInputRef.current?.click()
    else if (option.id === 'voice') startVoiceRecording()
    else if (option.id === 'spigens-contact') setShowContactPicker(true)
  }

  const onDeleteMessage = async (messageId: string) => {
    const current = (useUIStore.getState().componentState?.['communityMessages'] ?? []) as any[]
    const snapshot = current.find((m: any) => m.id === messageId)
    if (snapshot) await upsertCommunityMessage(communityId, { ...snapshot, isDeleted: true, content: '' })
    const { error } = await supabase.from('community_messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId).eq('sender_id', currentUserId)
    if (error && snapshot) await upsertCommunityMessage(communityId, snapshot) // revert
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
    const { error } = await supabase.from('community_members').upsert(
      { community_id: communityId, user_id: currentUserId, role: 'member', status: 'active' },
      { onConflict: 'community_id,user_id' }
    )
    if (error) { useUIStore.getState().setComponentState('communityJoinStatus', 'non-member'); return }
    setIsMember(true); setMemberCount(prev => prev + 1)
    useUIStore.getState().setComponentState('communityJoinStatus', 'member')
    const joinName = profile?.display_name || profile?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: joinName + ' joined', message_type: 'system' })
  }
  const onRequest = async () => {
    if (!currentUserId) return
    useUIStore.getState().setComponentState('communityJoinStatus', 'requesting')
    const { error } = await supabase.from('community_members').upsert(
      { community_id: communityId, user_id: currentUserId, role: 'member', status: 'pending' },
      { onConflict: 'community_id,user_id' }
    )
    if (error) { useUIStore.getState().setComponentState('communityJoinStatus', 'non-member'); return }
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
    const { error } = await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', currentUserId)
    if (error) { useUIStore.getState().setComponentState('communityError', 'Failed to leave. Please try again.'); return }
    setIsMember(false); setMemberCount(prev => Math.max(0, prev - 1)); onBack()
  }
  const onUpdateCommunityImage = async (file: File) => {
    const url = await uploadCommunityImage(communityId, file)
    if (url) setCommunityAvatarUrl(url)
  }
  const pickerContacts = contacts.map(c => ({
    id: c.id, name: c.name, username: c.rawProfile?.username || '',
    avatarUrl: c.avatarUrl || null, avatarColor: c.avatarColor || '#333', avatarInitials: c.avatarInitials,
  }))

  const scope = {
    communityId, communityName, communityType, isMember, userRole: userRole || null, memberCount, communityAvatarUrl,
    sendMessage, onTyping, onDeleteMessage, onJoin, onRequest, onLeave, onUpdateCommunityImage, onBack,
    onAttach: () => setShowAttachSheet(true),
    onViewCommunityProfile: () => onViewCommunityProfile?.(),
    onSenderTap: (uid: string, name: string, avatar: string | null) => onSenderTap?.(uid, name, avatar),
    onOpenContactCard: (c: { id: string; name: string; username?: string; avatarUrl?: string | null }) => onSenderTap?.(c.id, c.name, c.avatarUrl ?? null),
    LucideReply: CornerUpLeft, LucideCopy: Copy, LucideTrash: Trash2,
    MessageReactions, ReactionPicker,
    onToggleReaction: (messageId: string, emoji: string) => onToggleCommunityReaction(messageId, emoji),
    CommunityMessageBubble, BackButton, DateSeparator,
    onReplyTo: (target: any) => { useUIStore.getState().setComponentState('communityReplyingTo', { id: target.id, senderName: target.senderName || '', content: target.content || '' }) },
    onCancelReply: () => { useUIStore.getState().setComponentState('communityReplyingTo', null); useUIStore.getState().setComponentState('reactionDetail', null) },
    onJumpToReply: (targetId: string) => { if (typeof document === 'undefined') return; const el = document.getElementById('msg-' + targetId); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); useUIStore.getState().setComponentState('highlightedMessageId', targetId); setTimeout(() => { useUIStore.getState().setComponentState('highlightedMessageId', null) }, 1500) },
    onShowReactors: async (messageId: string) => {
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
    useComponentState,
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    sendCommunityMedia(file)
  }

  return (
    <>
      <RenderifyHost code={source} storeActions={scope} />

      <RenderifyHost code={componentSources?.chatAttachToast ?? null} storeActions={{ useComponentState }} />

      {/* Hidden file inputs */}
      <input ref={photoInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={onFileInput} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.ppt,.pptx,.csv" style={{ display: 'none' }} onChange={onFileInput} />
      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFileInput} />

      {/* Attach sheet */}
      {attachConfig?.popup && showAttachSheet && createPortal(
        <RenderifyHost code={bottomSheetSource} storeActions={{ sheetId: 'attachSheet', title: attachConfig.popup.title, options: attachConfig.popup.options, onClose: () => setShowAttachSheet(false), onOptionSelect: (option: any) => handleAttachOption(option) }} />,
        document.body
      )}

      {/* Voice recording overlay */}
      {isRecording && createPortal(
        <RenderifyHost code={componentSources?.chatRecordingOverlay ?? null} storeActions={{ onCancel: cancelVoiceRecording, onStop: stopVoiceRecording, LucideMic: Mic, LucideX: X, LucideSquare: Square, useComponentState }} />,
        document.body
      )}

      {/* Spigens contact picker */}
      {showContactPicker && createPortal(
        <RenderifyHost code={componentSources?.chatContactPicker ?? null} storeActions={{ contacts: pickerContacts, onClose: () => setShowContactPicker(false), onSelect: (contactId: string) => { const c = contacts.find(x => x.id === contactId); if (c) sendCommunityContact({ id: c.id, name: c.name, username: c.rawProfile?.username || '', avatarUrl: c.avatarUrl || null }); setShowContactPicker(false) } }} />,
        document.body
      )}
    </>
  )
}

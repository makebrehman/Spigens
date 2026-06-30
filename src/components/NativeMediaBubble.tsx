'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'
import { AudioMessage } from './AudioMessage'
import { ProfileImage } from './ProfileImage'
import { getCachedMediaUri, resolveMedia } from '@/lib/mediaCache'
import { useUIStore } from '@/stores/uiStore'

export interface NativeMediaBubbleProps {
  id: string
  content: string
  messageType: string
  metadata?: any | null
  timestamp: string
  isSent: boolean
  isRead: boolean
  status?: string
  replyTo?: { id?: string; content: string; senderLabel: string } | null
  onReplyTo?: (target: { id: string; content: string; isSent: boolean }) => void
  onJumpToReply?: (id: string) => void
  currentUserId?: string
  onToggleReaction?: (messageId: string, emoji: string) => void
  onShowReactors?: (messageId: string) => void
  onOpenContactCard?: (contact: { id: string; name: string; username?: string; avatarUrl?: string | null }) => void
  isDeleted?: boolean
  // ── Community reuse ──
  // `embedded` drops the full-width DM row wrapper so the bubble can sit inside the
  // community message row (next to the sender avatar). `senderName` is carried into
  // the long-press action payload so the community action tray (which reads
  // isMine/senderName) works the same as in DMs.
  embedded?: boolean
  senderName?: string
  useComponentState?: (key: string, defaultValue: any) => [any, (v: any) => void]
  scopeKey?: string
}

function useLocalComponentState(key: string, defaultValue: any) {
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

function fmtBytes(n?: number): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

function fmtDur(s?: number): string {
  const t = Math.max(0, Math.floor(s || 0))
  const m = Math.floor(t / 60)
  const ss = String(t % 60).padStart(2, '0')
  return `${m}:${ss}`
}

export function NativeMediaBubble(props: NativeMediaBubbleProps) {
  const {
    id, content, messageType, metadata, timestamp, isSent, isRead, status,
    replyTo, onReplyTo, onJumpToReply, currentUserId,
    onToggleReaction, onShowReactors, onOpenContactCard, isDeleted,
    embedded, senderName,
  } = props
  const scopedUseComponentState = props.useComponentState ?? useLocalComponentState
  const [, setActiveMessageActions] = scopedUseComponentState('activeMessageActions', null)
  const [, setOpenReactionMessageId] = scopedUseComponentState('openReactionMessageId', null)

  const isImage = messageType === 'image'
  const isContact = messageType === 'contact'
  const thumb: string | null =
    metadata && typeof metadata === 'object' && typeof metadata.thumb === 'string' ? metadata.thumb : null
  const metaName: string | null =
    metadata && typeof metadata === 'object' && typeof metadata.name === 'string' ? metadata.name : null
  const metaSize: number | undefined =
    metadata && typeof metadata === 'object' && typeof metadata.size === 'number' ? metadata.size : undefined
  const metaDur: number | undefined =
    metadata && typeof metadata === 'object' && typeof metadata.dur === 'number' ? metadata.dur : undefined

  // Parse the encrypted-then-decrypted contact payload (JSON in the body).
  const contactData: { id: string; name: string; username?: string; avatarUrl?: string | null } | null = (() => {
    if (!isContact || !content) return null
    try { return JSON.parse(content) } catch { return null }
  })()

  // ── Progressive image loading (blur → full, download-first) ─────────────────
  const [fullSrc, setFullSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const revealImageTimerRef = useRef<any>(null)

  // ── Non-image media (video/audio/file): local-first, download-first ─────────
  // localSrc is ONLY ever a local file (or a blob:/data: we already hold), never a
  // streamed remote URL on a real device — resolveMedia downloads to disk first.
  const [localSrc, setLocalSrc] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const [showLightbox, setShowLightbox] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    if (!isImage || isDeleted || !content) return
    let cancelled = false
    const run = async () => {
      if (revealImageTimerRef.current) {
        clearTimeout(revealImageTimerRef.current)
        revealImageTimerRef.current = null
      }
      setLoaded(false)
      setMissing(false)
      setFullSrc(null)
      if (content.startsWith('blob:') || content.startsWith('data:')) { setFullSrc(content); return }
      const cached = await getCachedMediaUri(content)
      if (cancelled) return
      if (cached) { setFullSrc(cached); return }
      setMissing(true)
    }
    run()
    return () => { cancelled = true }
  }, [content, isImage, isDeleted])

  useEffect(() => {
    return () => {
      if (revealImageTimerRef.current) clearTimeout(revealImageTimerRef.current)
    }
  }, [])

  const revealLoadedImage = () => {
    if (revealImageTimerRef.current) clearTimeout(revealImageTimerRef.current)
    revealImageTimerRef.current = setTimeout(() => {
      revealImageTimerRef.current = null
      setLoaded(true)
    }, thumb ? 140 : 0)
  }

  useEffect(() => {
    if (isImage || isContact || isDeleted || !content) return
    let cancelled = false
    const run = async () => {
      setLocalSrc(null)
      setResolving(false)
      if (content.startsWith('blob:') || content.startsWith('data:')) { setLocalSrc(content); return }
      const cached = await getCachedMediaUri(content)
      if (cancelled) return
      if (cached) { setLocalSrc(cached); return }
    }
    run()
    return () => { cancelled = true }
  }, [content, messageType, isImage, isContact, isDeleted])

  const retryDownload = async () => {
    if (downloading) return
    setMissing(false)
    setDownloading(true)
    const dl = await resolveMedia(content, 'image', { manual: true })
    setDownloading(false)
    if (dl) setFullSrc(dl)
    else setMissing(true)
  }

  // Download to the device (if needed) and return the local URI. Never streams.
  const ensureDownloaded = async (): Promise<string | null> => {
    if (localSrc) return localSrc
    if (content.startsWith('blob:') || content.startsWith('data:')) { setLocalSrc(content); return content }
    if (resolving) return null
    setResolving(true)
    const kind = messageType === 'video' ? 'video' : messageType === 'audio' ? 'audio' : 'file'
    const dl = await resolveMedia(content, kind, { manual: true })
    setResolving(false)
    if (dl) { setLocalSrc(dl); return dl }
    return null
  }

  const openVideo = async () => {
    const uri = await ensureDownloaded()
    if (uri) setShowVideo(true)
  }

  const openFile = async () => {
    const uri = await ensureDownloaded()
    if (uri) { try { window.open(uri, '_blank', 'noopener,noreferrer') } catch { /* ignore */ } }
  }

  const mediaLabel = (): string => {
    switch (messageType) {
      case 'image': return '📷 Photo'
      case 'video': return '🎥 Video'
      case 'audio': return '🎙️ Voice message'
      case 'file': return metaName ? '📄 ' + metaName : '📄 Document'
      case 'contact': return '👤 ' + (contactData?.name || 'Contact')
      default: return content
    }
  }

  // ── Tap vs. long-press vs. swipe-to-reply ───────────────────────────────────
  const [drag, setDrag] = useState(0)
  const press = useRef<{ t: any; active: boolean; startX: number; startY: number; dx: number; moved: boolean; long: boolean }>({ t: null, active: false, startX: 0, startY: 0, dx: 0, moved: false, long: false })
  // The tap action runs from onClick (reliable on touch) — a pointercancel from a
  // scroll gesture can swallow pointerup. This guards the click the browser still
  // fires right after a long-press or a swipe so it doesn't also trigger the tap.
  const suppressClick = useRef(false)

  const openActions = () => {
    if (isDeleted) return
    // isSent for the DM action tray; isMine + senderName for the community one.
    setActiveMessageActions({ id, isSent, isMine: isSent, senderName: senderName ?? undefined, content: mediaLabel() })
    setOpenReactionMessageId(id)
  }

  // The primary tap action depends on the media type. Audio has its own inline
  // play/seek controls, so a bare tap on an audio bubble does nothing.
  const primaryAction = () => {
    if (isDeleted) return
    if (messageType === 'image') { if (missing) retryDownload(); else if (fullSrc) setShowLightbox(true) }
    else if (messageType === 'video') openVideo()
    else if (messageType === 'file') openFile()
    else if (messageType === 'contact') { if (contactData) onOpenContactCard?.(contactData) }
  }

  const beginPress = (e: React.PointerEvent) => {
    suppressClick.current = false
    press.current = { t: null, active: true, startX: e.clientX, startY: e.clientY, dx: 0, moved: false, long: false }
    press.current.t = setTimeout(() => { press.current.t = null; press.current.long = true; suppressClick.current = true; setDrag(0); openActions() }, 480)
  }
  const movePress = (e: React.PointerEvent) => {
    if (!press.current.active) return
    const dx = e.clientX - press.current.startX
    const dy = e.clientY - press.current.startY
    if (!press.current.moved && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      press.current.moved = true
      suppressClick.current = true
      if (press.current.t) { clearTimeout(press.current.t); press.current.t = null }
    }
    // Horizontal drag → swipe-to-reply (ignore mostly-vertical scrolls).
    if (press.current.moved && !press.current.long && Math.abs(dx) > Math.abs(dy)) {
      const cdx = Math.max(-90, Math.min(90, dx))
      press.current.dx = cdx
      setDrag(cdx)
    }
  }
  const endPress = () => {
    if (!press.current.active) return
    press.current.active = false
    if (press.current.t) { clearTimeout(press.current.t); press.current.t = null }
    const { dx, long } = press.current
    press.current.dx = 0
    setDrag(0)
    if (long) { press.current.long = false; return }
    if (Math.abs(dx) > 45) { suppressClick.current = true; onReplyTo?.({ id, content: mediaLabel(), isSent }) }
  }
  const cancelPress = () => {
    press.current.active = false
    if (press.current.t) { clearTimeout(press.current.t); press.current.t = null }
    press.current.dx = 0
    setDrag(0)
  }
  // Genuine tap → primary action (open viewer / file / profile).
  const onBubbleClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return }
    primaryAction()
  }
  const gestureProps = {
    onPointerDown: beginPress,
    onPointerMove: movePress,
    onPointerUp: endPress,
    onClick: onBubbleClick,
    onPointerLeave: cancelPress,
    onPointerCancel: cancelPress,
  }

  const bubbleBg = isSent ? '#1d4ed8' : '#1f2937'
  const bubbleRadius = isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px'

  const spinner = (size = 24) => (
    <svg width={size} height={size} viewBox="0 0 50 50" style={{ display: 'block' }}>
      <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="5" strokeLinecap="round" strokeDasharray="80 50">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  )

  const renderMedia = () => {
    if (isDeleted) {
      return (
        <span style={{ color: isSent ? 'rgba(255,255,255,0.5)' : 'rgba(156,163,175,1)', fontStyle: 'italic', fontSize: 14 }}>
          This message was deleted
        </span>
      )
    }

    if (messageType === 'image') {
      const W = 240
      return (
        <div
          style={{
            position: 'relative', width: W, height: 280, maxWidth: '100%',
            borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
            background: 'rgba(0,0,0,0.22)', lineHeight: 0, touchAction: 'pan-y',
          }}
        >
          {thumb && (
            <img
              src={thumb} alt="" aria-hidden draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(12px)', transform: 'scale(1.08)', opacity: loaded ? 0 : 1, transition: 'opacity 0.35s ease', pointerEvents: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            />
          )}
          {fullSrc && (
            <img
              src={fullSrc} alt="image" draggable={false}
              onLoad={revealLoadedImage}
              onError={() => {
                if (revealImageTimerRef.current) {
                  clearTimeout(revealImageTimerRef.current)
                  revealImageTimerRef.current = null
                }
                setLoaded(false)
                setMissing(true)
              }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.35s ease', pointerEvents: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            />
          )}
          {downloading && !loaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spinner()}</div>
          )}
          {missing && !loaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.28)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span style={{ fontSize: 11, lineHeight: 1.2 }}>Tap to download</span>
            </div>
          )}
          {isSent && status === 'sending' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.32)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spinner(28)}</div>
            </div>
          )}
        </div>
      )
    }

    if (messageType === 'video') {
      const W = 240
      return (
        <div
          style={{
            position: 'relative', width: W, height: 280, maxWidth: '100%',
            borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
            background: '#0b0b0b', lineHeight: 0, touchAction: 'pan-y',
          }}
        >
          {thumb ? (
            <img src={thumb} alt="video" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)' }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {resolving || (isSent && status === 'sending') ? spinner(26) : localSrc ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            )}
          </div>
          <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 7px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="none" stroke="#fff" strokeWidth="2" /></svg>
            <span style={{ fontSize: 11, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtDur(metaDur)}</span>
          </div>
        </div>
      )
    }

    if (messageType === 'audio') {
      return (
        <AudioMessage src={localSrc} isSent={isSent} duration={metaDur} resolving={resolving} onRetry={ensureDownloaded} />
      )
    }

    if (messageType === 'contact') {
      const c = contactData
      const name = c?.name || 'Contact'
      const initials = (name[0] || '?').toUpperCase()
      return (
        <div style={{ width: 244, maxWidth: '100%', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 4px 10px' }}>
            <ProfileImage avatarUrl={c?.avatarUrl ?? null} contactInitials={initials} contactAvatarColor="#2563eb" size={46} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              {c?.username ? <div style={{ fontSize: 12, color: isSent ? 'rgba(255,255,255,0.7)' : 'rgba(156,163,175,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{c.username}</div> : null}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${isSent ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`, textAlign: 'center', paddingTop: 8, fontSize: 13, fontWeight: 600, color: isSent ? '#dbeafe' : '#60a5fa' }}>
            View profile
          </div>
        </div>
      )
    }

    // file / document
    const fallbackName = (() => {
      try { return decodeURIComponent(content.split('/').pop() || 'Document') } catch { return 'Document' }
    })()
    const fileName = metaName || fallbackName
    const sub = [fmtBytes(metaSize), localSrc ? 'Saved' : 'Tap to download'].filter(Boolean).join(' · ')
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 248, maxWidth: '100%', cursor: 'pointer' }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
          {resolving ? spinner(20) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, color: isSent ? '#fff' : '#e5e7eb', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
          {sub ? <div style={{ fontSize: 11, color: isSent ? 'rgba(255,255,255,0.6)' : 'rgba(156,163,175,0.9)', marginTop: 2 }}>{sub}</div> : null}
        </div>
        <div style={{ flexShrink: 0, color: isSent ? 'rgba(255,255,255,0.8)' : 'rgba(156,163,175,0.95)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
      </div>
    )
  }

  const pad = messageType === 'audio' || messageType === 'file' || messageType === 'contact' ? '10px 12px' : '6px'

  return (
    <div style={embedded
      ? { display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start', minWidth: 0 }
      : { display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start', marginBottom: 4, width: '100%', padding: '0 16px', boxSizing: 'border-box' }}>
      {replyTo && (
        <div style={{ maxWidth: 280, width: '100%', display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
          <ReplyQuote replyTo={replyTo} isSent={isSent} onJumpToReply={onJumpToReply} />
        </div>
      )}

      <div
        id={'msg-' + id}
        {...gestureProps}
        style={{
          background: bubbleBg, borderRadius: bubbleRadius, padding: pad, maxWidth: 280,
          position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          transform: drag ? `translateX(${drag}px)` : undefined,
          transition: drag ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
          cursor: 'pointer',
          userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none',
        }}
      >
        {renderMedia()}

        {/* Reactions live INSIDE the bubble, between the media and the date row —
            exactly like text messages. MessageReactions hardcodes alignSelf:flex-start,
            so in this flex column it stays left-aligned within the bubble. */}
        <MessageReactions
          messageId={id}
          currentUserId={currentUserId}
          onToggleReaction={onToggleReaction}
          onShowReactors={onShowReactors}
          useComponentState={scopedUseComponentState}
          scopeKey={props.scopeKey}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4, paddingRight: 2 }}>
          <span style={{ fontSize: 10, color: isSent ? 'rgba(255,255,255,0.6)' : 'rgba(156,163,175,0.8)' }}>{timestamp}</span>
          {isSent && <MessageStatus status={status} isSent={isSent} />}
        </div>
      </div>

      {showLightbox && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setShowLightbox(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={fullSrc || content} alt="image" style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain' }} />
          <button onClick={(e) => { e.stopPropagation(); setShowLightbox(false) }} aria-label="Close" style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: 14, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>,
        document.body
      )}

      {showVideo && localSrc && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setShowVideo(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            src={localSrc}
            controls
            autoPlay
            playsInline
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', background: '#000' }}
          />
          <button onClick={(e) => { e.stopPropagation(); setShowVideo(false) }} aria-label="Close" style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: 14, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>,
        document.body
      )}
    </div>
  )
}

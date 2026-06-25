'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'
import { getCachedMediaUri, resolveMedia } from '@/lib/mediaCache'
import { useNetworkStore } from '@/stores/networkStore'

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
  isDeleted?: boolean
}

export function NativeMediaBubble(props: NativeMediaBubbleProps) {
  const {
    id, content, messageType, metadata, timestamp, isSent, isRead, status,
    replyTo, onReplyTo, onJumpToReply, currentUserId,
    onToggleReaction, onShowReactors, isDeleted,
  } = props

  const isImage = messageType === 'image'
  const thumb: string | null =
    metadata && typeof metadata === 'object' && typeof metadata.thumb === 'string' ? metadata.thumb : null

  // ── Progressive image loading ──────────────────────────────────────────────
  // Show the (always-local) blur preview instantly, then resolve the full image:
  // a cached local file if we have one, else download it when online. If neither
  // is possible (offline + not cached, or the local file was deleted), we stay on
  // the blur and surface a re-download tap target.
  const [fullSrc, setFullSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // Non-image media (video/audio/file): prefer a cached local file, else stream
  // from the remote URL. We don't force-download these to disk in this pass.
  const [mediaSrc, setMediaSrc] = useState(content)
  // Full-screen viewer (lightbox) for images and videos.
  const [showLightbox, setShowLightbox] = useState(false)

  useEffect(() => {
    if (!isImage || isDeleted || !content) return
    let cancelled = false
    const run = async () => {
      setLoaded(false)
      setMissing(false)
      setFullSrc(null)
      // Optimistic local source (blob:/data:) — already on-device, show as-is.
      if (content.startsWith('blob:') || content.startsWith('data:')) {
        setFullSrc(content)
        return
      }
      const cached = await getCachedMediaUri(content)
      if (cancelled) return
      if (cached) { setFullSrc(cached); return }
      if (useNetworkStore.getState().isOnline) {
        setDownloading(true)
        const dl = await resolveMedia(content, 'image')
        if (cancelled) return
        setDownloading(false)
        if (dl) { setFullSrc(dl); return }
      }
      setMissing(true)
    }
    run()
    return () => { cancelled = true }
  }, [content, isImage, isDeleted])

  useEffect(() => {
    if (isImage || isDeleted || !content) return
    let cancelled = false
    const run = async () => {
      setMediaSrc(content)
      const cached = await getCachedMediaUri(content)
      if (!cancelled && cached) setMediaSrc(cached)
    }
    run()
    return () => { cancelled = true }
  }, [content, isImage, isDeleted])

  const retryDownload = async () => {
    if (downloading) return
    setMissing(false)
    setDownloading(true)
    const dl = await resolveMedia(content, 'image')
    setDownloading(false)
    if (dl) setFullSrc(dl)
    else setMissing(true)
  }

  const openFull = () => {
    const target = fullSrc || content
    if (target) window.open(target, '_blank', 'noopener,noreferrer')
  }

  const bubbleBg = isSent ? '#1d4ed8' : '#1f2937'
  const bubbleRadius = isSent
    ? '18px 18px 4px 18px'
    : '18px 18px 18px 4px'

  const handleSwipe = () => {
    if (onReplyTo) onReplyTo({ id, content, isSent })
  }

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
      const spinner = (
        <svg width="24" height="24" viewBox="0 0 50 50" style={{ display: 'block' }}>
          <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="5" strokeLinecap="round" strokeDasharray="80 50">
            <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
          </circle>
        </svg>
      )
      return (
        <div
          onClick={missing ? retryDownload : () => { if (fullSrc) setShowLightbox(true) }}
          style={{
            position: 'relative',
            width: W,
            height: 280,
            maxWidth: '100%',
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.22)',
            lineHeight: 0,
          }}
        >
          {thumb && (
            <img
              src={thumb}
              alt=""
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                filter: 'blur(12px)',
                transform: 'scale(1.08)',
                opacity: loaded ? 0 : 1,
                transition: 'opacity 0.35s ease',
              }}
            />
          )}

          {fullSrc && (
            <img
              src={fullSrc}
              alt="image"
              onLoad={() => setLoaded(true)}
              onError={() => { setLoaded(false); setMissing(true) }}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: loaded ? 1 : 0,
                transition: 'opacity 0.35s ease',
              }}
            />
          )}

          {downloading && !loaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {spinner}
            </div>
          )}

          {missing && !loaded && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, color: 'rgba(255,255,255,0.9)',
              background: 'rgba(0,0,0,0.28)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span style={{ fontSize: 11, lineHeight: 1.2 }}>Tap to download</span>
            </div>
          )}
        </div>
      )
    }

    if (messageType === 'video') {
      return (
        <div style={{ width: 240, height: 280, maxWidth: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', lineHeight: 0 }}>
          <video
            src={mediaSrc}
            controls
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      )
    }

    if (messageType === 'audio') {
      return (
        <audio
          src={mediaSrc}
          controls
          style={{ maxWidth: 240, borderRadius: 8, display: 'block' }}
        />
      )
    }

    // file
    const fileName = (() => {
      try { return decodeURIComponent(content.split('/').pop() || 'File') } catch { return 'File' }
    })()
    return (
      <a
        href={mediaSrc}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: isSent ? '#fff' : '#e5e7eb',
          textDecoration: 'none',
          maxWidth: 240,
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <span style={{ fontSize: 13, lineHeight: 1.4, wordBreak: 'break-all' }}>{fileName}</span>
      </a>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSent ? 'flex-end' : 'flex-start',
        marginBottom: 4,
        width: '100%',
      }}
    >
      {replyTo && (
        <div style={{ maxWidth: 280, width: '100%', display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
          <ReplyQuote replyTo={replyTo} isSent={isSent} onJumpToReply={onJumpToReply} />
        </div>
      )}

      <div
        onDoubleClick={handleSwipe}
        style={{
          background: bubbleBg,
          borderRadius: bubbleRadius,
          padding: messageType === 'audio' || messageType === 'file' ? '10px 14px' : '6px',
          maxWidth: 280,
          position: 'relative',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        {renderMedia()}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
          paddingRight: 2,
        }}>
          <span style={{ fontSize: 10, color: isSent ? 'rgba(255,255,255,0.6)' : 'rgba(156,163,175,0.8)' }}>
            {timestamp}
          </span>
          {isSent && <MessageStatus status={status} isSent={isSent} />}
        </div>
      </div>

      <MessageReactions
        messageId={id}
        currentUserId={currentUserId}
        onToggleReaction={onToggleReaction}
        onShowReactors={onShowReactors}
      />

      {showLightbox && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowLightbox(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img src={fullSrc || content} alt="image" style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain' }} />
          <button
            onClick={(e) => { e.stopPropagation(); setShowLightbox(false) }}
            aria-label="Close"
            style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: 14, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

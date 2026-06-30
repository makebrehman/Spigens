'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'

type MessageLike = {
  id: string
  contactId?: string
  content: string
  messageType?: string
  metadata?: any | null
  timestamp: string
  createdAt?: string
  isSent: boolean
  isRead: boolean
  status?: string
  replyTo?: { id?: string; content: string; senderLabel: string } | null
  isDeleted?: boolean
}

type BubbleComponent = (props: any) => ReactElement
type DateSeparatorComponent = (props: { label: string }) => ReactElement

interface ChatMessageViewportProps {
  messages?: MessageLike[]
  MessageBubble: BubbleComponent
  DateSeparator: DateSeparatorComponent
  currentUserId?: string | null
  onReplyTo?: (target: { id: string; content: string; isSent: boolean }) => void
  onJumpToReply?: (id: string) => void
  onToggleReaction?: (messageId: string, emoji: string) => void
  onShowReactors?: (messageId: string) => void
  onOpenContactCard?: (contact: { id: string; name: string; username?: string; avatarUrl?: string | null }) => void
  onOpenCommunityInvite?: (meta: any, msgId: string) => void
  loadOlderMessages?: () => Promise<boolean> | boolean
  hasOlderMessages?: boolean
}

const BOTTOM_THRESHOLD = 80
const TOP_THRESHOLD = 96

function isNearBottom(el: HTMLDivElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD
}

function dayLabel(iso?: string): string | null {
  if (!iso) return null
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  const today = new Date()
  const dDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((tDay.getTime() - dDay.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

function shouldShowSeparator(messages: MessageLike[], index: number): boolean {
  const current = messages[index]?.createdAt
  if (!current) return false
  const currentDt = new Date(current)
  if (Number.isNaN(currentDt.getTime())) return false
  const prev = index > 0 ? messages[index - 1]?.createdAt : null
  if (!prev) return true
  const prevDt = new Date(prev)
  if (Number.isNaN(prevDt.getTime())) return true
  return (
    currentDt.getFullYear() !== prevDt.getFullYear() ||
    currentDt.getMonth() !== prevDt.getMonth() ||
    currentDt.getDate() !== prevDt.getDate()
  )
}

export function ChatMessageViewport({
  messages = [],
  MessageBubble,
  DateSeparator,
  currentUserId,
  onReplyTo,
  onJumpToReply,
  onToggleReaction,
  onShowReactors,
  onOpenContactCard,
  onOpenCommunityInvite,
  loadOlderMessages,
  hasOlderMessages = false,
}: ChatMessageViewportProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const pinnedToBottomRef = useRef(true)
  const didInitialAnchorRef = useRef(false)
  const preservePrependRef = useRef<{ height: number; top: number } | null>(null)
  const loadingOlderRef = useRef(false)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const [initiallyAnchored, setInitiallyAnchored] = useState(false)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current
    if (!el) return
    if (behavior === 'auto') el.scrollTop = el.scrollHeight
    else el.scrollTo({ top: el.scrollHeight, behavior })
    pinnedToBottomRef.current = true
    setShowJumpToBottom(false)
  }, [])

  const onScroll = useCallback(async () => {
    const el = scrollerRef.current
    if (!el) return
    const nearBottom = isNearBottom(el)
    pinnedToBottomRef.current = nearBottom
    setShowJumpToBottom(!nearBottom)

    if (!hasOlderMessages || !loadOlderMessages || loadingOlderRef.current || el.scrollTop > TOP_THRESHOLD) return
    loadingOlderRef.current = true
    preservePrependRef.current = { height: el.scrollHeight, top: el.scrollTop }
    try {
      const loaded = await loadOlderMessages()
      if (!loaded) preservePrependRef.current = null
    } finally {
      loadingOlderRef.current = false
    }
  }, [hasOlderMessages, loadOlderMessages])

  const firstId = messages[0]?.id ?? ''
  const lastId = messages[messages.length - 1]?.id ?? ''

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const preserve = preservePrependRef.current
    if (preserve) {
      el.scrollTop = el.scrollHeight - preserve.height + preserve.top
      preservePrependRef.current = null
      return
    }

    if (!didInitialAnchorRef.current) {
      didInitialAnchorRef.current = true
      scrollToBottom('auto')
      setInitiallyAnchored(true)
      return
    }

    if (pinnedToBottomRef.current) scrollToBottom('auto')
  }, [firstId, lastId, messages.length, scrollToBottom])

  useEffect(() => {
    const target = contentRef.current
    if (!target || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) scrollToBottom('auto')
    })
    ro.observe(target)
    return () => ro.disconnect()
  }, [scrollToBottom])

  const renderInvite = (msg: MessageLike) => {
    const meta = msg.metadata || {}
    const isUsed = !!meta.usedAt
    const invTypeLabel = meta.communityType === 'protected' ? 'Protected' : meta.communityType === 'private' ? 'Private' : 'Public'
    return (
      <div key={msg.id} style={{ display: 'flex', justifyContent: msg.isSent ? 'flex-end' : 'flex-start', padding: '4px 16px' }}>
        <div
          onClick={() => onOpenCommunityInvite?.(meta, msg.id)}
          style={{ maxWidth: '72%', minWidth: 210, background: '#161B2E', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', WebkitTapHighlightColor: 'transparent' }}
        >
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {meta.avatarUrl ? <img src={meta.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18, fontWeight: 700, color: '#E8E8E8' }}>{(meta.communityName || '?').charAt(0).toUpperCase()}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.communityName || 'Community'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{invTypeLabel + ' - ' + (meta.memberCount || 0) + ' members'}</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ padding: '10px 14px' }}>
            <div style={{ background: isUsed ? 'rgba(255,255,255,0.06)' : '#2563EB', borderRadius: 999, padding: '9px 0', textAlign: 'center', fontSize: 13, fontWeight: 600, color: isUsed ? 'rgba(255,255,255,0.3)' : '#FFF' }}>
              {isUsed ? 'Already joined' : (msg.isSent ? 'View community' : 'Join community')}
            </div>
          </div>
          <div style={{ padding: '0 14px 10px', textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{msg.timestamp}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="chat-scrollbar-hide"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0 12px', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', visibility: initiallyAnchored ? 'visible' : 'hidden' }}
      >
        <div ref={contentRef} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: messages.length ? 'flex-start' : 'center', gap: 6 }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A8A' }}>no messages yet</div>
          ) : messages.map((msg, index) => {
            const label = shouldShowSeparator(messages, index) ? dayLabel(msg.createdAt) : null
            const bubble = msg.messageType === 'invite' && msg.metadata?.communityId
              ? renderInvite(msg)
              : (
                <MessageBubble
                  key={msg.id + '-' + (msg.status || '') + (msg.isDeleted ? '-deleted' : '')}
                  id={msg.id}
                  contactId={msg.contactId}
                  content={msg.content}
                  messageType={msg.messageType}
                  metadata={msg.metadata}
                  timestamp={msg.timestamp}
                  isSent={msg.isSent}
                  isRead={msg.isRead}
                  status={msg.status}
                  replyTo={msg.replyTo}
                  isDeleted={!!msg.isDeleted}
                  onReplyTo={onReplyTo}
                  onJumpToReply={onJumpToReply}
                  currentUserId={currentUserId ?? undefined}
                  onToggleReaction={onToggleReaction}
                  onShowReactors={onShowReactors}
                  onOpenContactCard={onOpenContactCard}
                />
              )
            return label ? (
              <div key={'frag-' + msg.id}>
                <DateSeparator label={label} />
                {bubble}
              </div>
            ) : bubble
          })}
        </div>
      </div>

      {showJumpToBottom && messages.length > 0 ? (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          aria-label="Scroll to latest message"
          style={{ position: 'absolute', right: 14, bottom: 14, width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: '#1f2937', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer' }}
        >
          v
        </button>
      ) : null}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

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

const TOP_THRESHOLD = 96
const BOTTOM_THRESHOLD = 80
// A rough middle-ground guess for an unmeasured bubble's height — corrected
// per-row by measureElement the moment it actually renders. Only affects the
// very first paint of items that haven't been measured yet.
const ESTIMATED_ROW_HEIGHT = 72
const ROW_GAP = 6

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
  const pinnedToBottomRef = useRef(true)
  const didInitialAnchorRef = useRef(false)
  const loadingOlderRef = useRef(false)
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const [initiallyAnchored, setInitiallyAnchored] = useState(false)

  // index 0 is the oldest message, the last index is the newest — anchorTo:'end'
  // keeps that last index pinned near the bottom (chat/log semantics), keeps the
  // view visually stable when older messages get prepended, and only actually
  // renders (plus a small overscan buffer) the rows near the current scroll
  // position instead of every message ever loaded into this conversation.
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: messages.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    gap: ROW_GAP,
    anchorTo: 'end',
    followOnAppend: 'auto',
    getItemKey: (index) => messages[index]?.id ?? index,
  })

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    virtualizer.scrollToEnd({ behavior })
    pinnedToBottomRef.current = true
    setShowJumpToBottom(false)
  }, [virtualizer])

  const onScroll = useCallback(async () => {
    const el = scrollerRef.current
    if (!el) return
    const nearBottom = virtualizer.isAtEnd(BOTTOM_THRESHOLD)
    pinnedToBottomRef.current = nearBottom
    setShowJumpToBottom(!nearBottom)

    if (!hasOlderMessages || !loadOlderMessages || loadingOlderRef.current || el.scrollTop > TOP_THRESHOLD) return
    loadingOlderRef.current = true
    try {
      await loadOlderMessages()
    } finally {
      loadingOlderRef.current = false
    }
  }, [hasOlderMessages, loadOlderMessages, virtualizer])

  const firstId = messages[0]?.id ?? ''
  const lastId = messages[messages.length - 1]?.id ?? ''

  // First paint: jump straight to the bottom before revealing the viewport, so
  // there's no visible scroll-from-top flash. After that, only follow new
  // messages if the user was already pinned to the bottom — anchorTo/
  // followOnAppend do the actual positioning math; this just decides whether
  // to move at all (e.g. never yank the view while someone's reading history).
  useLayoutEffect(() => {
    if (!didInitialAnchorRef.current) {
      didInitialAnchorRef.current = true
      scrollToBottom('auto')
      setInitiallyAnchored(true)
      return
    }
    if (pinnedToBottomRef.current) scrollToBottom('auto')
  }, [firstId, lastId, messages.length, scrollToBottom])

  // Catches a bubble growing in place (e.g. an image finishing its load) rather
  // than a new message arriving — total size only changes when some row's
  // measured height actually changes.
  const totalSize = virtualizer.getTotalSize()
  useEffect(() => {
    if (pinnedToBottomRef.current) scrollToBottom('auto')
  }, [totalSize, scrollToBottom])

  const renderInvite = (msg: MessageLike) => {
    const meta = msg.metadata || {}
    const isUsed = !!meta.usedAt
    const invTypeLabel = meta.communityType === 'protected' ? 'Protected' : meta.communityType === 'private' ? 'Private' : 'Public'
    return (
      <div style={{ display: 'flex', justifyContent: msg.isSent ? 'flex-end' : 'flex-start', padding: '4px 16px' }}>
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
        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A8A' }}>no messages yet</div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: totalSize }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = messages[virtualRow.index]
              if (!msg) return null
              const label = shouldShowSeparator(messages, virtualRow.index) ? dayLabel(msg.createdAt) : null
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
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  {label ? (<><DateSeparator label={label} />{bubble}</>) : bubble}
                </div>
              )
            })}
          </div>
        )}
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

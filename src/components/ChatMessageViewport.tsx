'use client'

import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { perfCount, perfMark } from '@/lib/perfHud'

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
// react-virtuoso keeps scroll position stable across prepends by keying rows to an
// absolute index. We start high and subtract for every batch of older messages that
// gets prepended, so loading history never jumps the view. (Virtuoso's documented
// reverse/endless pattern — https://virtuoso.dev/prepend-items/)
const START_INDEX = 1_000_000

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

type Row = { msg: MessageLike; label: string | null }

// Community-invite card. Module-level so it isn't reallocated per render and can be
// referenced from the memoized item renderer without widening its dependency list.
function renderInvite(msg: MessageLike, onOpenCommunityInvite?: (meta: any, msgId: string) => void): ReactElement {
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
  perfCount('viewport render')
  const virtuosoRef = useRef<VirtuosoHandle | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const loadingOlderRef = useRef(false)
  const anchoredRef = useRef(false)

  // ── Stable absolute index for prepends ──────────────────────────────────────
  // When older messages get prepended (loadOlderMessages), the array grows at the
  // FRONT. Virtuoso keeps the view from jumping only if firstItemIndex drops by the
  // same count in the same commit. We detect a prepend by finding the previous first
  // message's new position and subtracting it. Appends / in-place updates don't move
  // the first id, so firstItemIndex stays put. Done via the derive-state-during-render
  // pattern (React re-renders before commit) rather than refs.
  const firstId = messages[0]?.id ?? null
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX)
  const [prevFirstId, setPrevFirstId] = useState<string | null>(firstId)
  if (firstId !== prevFirstId) {
    const pos = prevFirstId ? messages.findIndex(m => m.id === prevFirstId) : -1
    setPrevFirstId(firstId)
    if (pos > 0) setFirstItemIndex(v => v - pos)
  }

  // Precompute date-separator labels once per messages change (not per scroll frame).
  const rows = useMemo<Row[]>(
    () => messages.map((msg, i) => ({ msg, label: shouldShowSeparator(messages, i) ? dayLabel(msg.createdAt) : null })),
    [messages]
  )

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth', align: 'end' })
  }, [])

  const handleStartReached = useCallback(async () => {
    if (!hasOlderMessages || !loadOlderMessages || loadingOlderRef.current) return
    loadingOlderRef.current = true
    try {
      await loadOlderMessages()
    } finally {
      loadingOlderRef.current = false
    }
  }, [hasOlderMessages, loadOlderMessages])

  const handleAtBottom = useCallback((bottom: boolean) => {
    setAtBottom(bottom)
    if (!anchoredRef.current) {
      anchoredRef.current = true
      perfMark('list anchored/visible')
    }
  }, [])

  // The one item renderer. Kept stable (only rebinds when a callback identity
  // changes) so virtuoso renders each row once instead of re-rendering the whole
  // visible set on every unrelated state change — the fix for the render storm.
  const itemContent = useCallback(
    (_index: number, row: Row) => {
      const msg = row.msg
      const bubble = msg.messageType === 'invite' && msg.metadata?.communityId
        ? renderInvite(msg, onOpenCommunityInvite)
        : (
          <MessageBubble
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
        <div style={{ paddingBottom: 6 }}>
          {row.label ? (<><DateSeparator label={row.label} />{bubble}</>) : bubble}
        </div>
      )
    },
    [MessageBubble, DateSeparator, onReplyTo, onJumpToReply, onToggleReaction, onShowReactors, onOpenContactCard, onOpenCommunityInvite, currentUserId]
  )

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A8A' }}>no messages yet</div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          className="chat-scrollbar-hide"
          style={{ flex: 1 }}
          data={rows}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={rows.length - 1}
          alignToBottom
          followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
          atBottomThreshold={BOTTOM_THRESHOLD}
          atBottomStateChange={handleAtBottom}
          startReached={handleStartReached}
          computeItemKey={(_index, row) => row.msg.id}
          itemContent={itemContent}
          increaseViewportBy={{ top: 300, bottom: 300 }}
        />
      )}

      {!atBottom && messages.length > 0 ? (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          style={{ position: 'absolute', right: 14, bottom: 14, width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: '#1f2937', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer' }}
        >
          v
        </button>
      ) : null}
    </div>
  )
}

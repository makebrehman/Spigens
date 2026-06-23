'use client'

import { useState } from 'react'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'

export interface NativeMediaBubbleProps {
  id: string
  content: string
  messageType: string
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
    id, content, messageType, timestamp, isSent, isRead, status,
    replyTo, onReplyTo, onJumpToReply, currentUserId,
    onToggleReaction, onShowReactors, isDeleted,
  } = props

  const [imgError, setImgError] = useState(false)

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
      if (imgError) {
        return (
          <div style={{ width: 220, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Image unavailable
          </div>
        )
      }
      return (
        <img
          src={content}
          alt="image"
          onError={() => setImgError(true)}
          onClick={() => window.open(content, '_blank', 'noopener,noreferrer')}
          style={{
            maxWidth: 240,
            maxHeight: 320,
            borderRadius: 12,
            display: 'block',
            objectFit: 'cover',
            cursor: 'pointer',
          }}
        />
      )
    }

    if (messageType === 'video') {
      return (
        <video
          src={content}
          controls
          style={{
            maxWidth: 240,
            maxHeight: 320,
            borderRadius: 12,
            display: 'block',
          }}
        />
      )
    }

    if (messageType === 'audio') {
      return (
        <audio
          src={content}
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
        href={content}
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
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'
import { NativeMediaBubble } from './NativeMediaBubble'
import { fetchLinkPreview, firstPreviewableUrl } from '@/lib/linkPreview'

export interface MessageBubbleProps {
  id: string
  contactId?: string
  content: string
  messageType?: string
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
}

export function MessageBubble(props: MessageBubbleProps) {
  const { id, content, messageType, metadata, timestamp, isSent, isRead, status, replyTo, onReplyTo, onJumpToReply, currentUserId, onToggleReaction, onShowReactors, onOpenContactCard, isDeleted } = props

  // Heal chat-screen sources that don't forward messageType/content/metadata. Saved
  // GenUI snapshots build MessageBubble with only a subset of props, so a media
  // message would render as a text URL and the blur preview (which lives in
  // metadata) would be lost. Resolve the real type/content/metadata from the live
  // message list by id so media renders correctly regardless of the source's props.
  let resolvedType = messageType
  let resolvedContent = content
  let resolvedMetadata = metadata ?? null
  {
    const all = (useUIStore.getState().componentState as any)?.chatMessages as any[] | undefined
    const self = all && all.find((m: any) => m.id === id)
    if (self) {
      if (!resolvedType) {
        resolvedType = self.messageType
        if (self.content != null) resolvedContent = self.content
      }
      if (resolvedMetadata == null && self.metadata != null) resolvedMetadata = self.metadata
    }
  }

  const componentSources = useUIStore(state => state.componentSources)
  const messageBubbleSource = componentSources?.messageBubble ?? null
  const [linkPreview, setLinkPreview] = useState<any>(null)

  useEffect(() => {
    if (isDeleted || (resolvedType && resolvedType !== 'text')) return
    const firstUrl = firstPreviewableUrl(resolvedContent)
    if (!firstUrl) return
    fetchLinkPreview(firstUrl).then(p => { if (p?.title) setLinkPreview(p) })
  }, [resolvedContent, resolvedType, isDeleted])

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

  const isMedia = resolvedType && resolvedType !== 'text'

  if (isMedia) {
    return (
      <NativeMediaBubble
        id={id}
        content={resolvedContent}
        messageType={resolvedType as string}
        metadata={resolvedMetadata}
        timestamp={timestamp}
        isSent={isSent}
        isRead={isRead}
        status={status}
        replyTo={replyTo}
        onReplyTo={onReplyTo}
        onJumpToReply={onJumpToReply}
        currentUserId={currentUserId}
        onToggleReaction={onToggleReaction}
        onShowReactors={onShowReactors}
        onOpenContactCard={onOpenContactCard}
        isDeleted={isDeleted}
      />
    )
  }

  return (
    <>
      <RenderifyHost
        code={messageBubbleSource}
        storeActions={{ id, content, messageType: messageType || 'text', timestamp, isSent, isRead, status, replyTo, onReplyTo, onJumpToReply, currentUserId, onToggleReaction, onShowReactors: onShowReactors ?? null, isDeleted: isDeleted ?? false, MessageStatus, ReplyQuote, MessageReactions, ReactionPicker, useComponentState }}
      />
      {linkPreview && (
        <div
          onClick={() => window.open(linkPreview.url, '_blank', 'noopener,noreferrer')}
          style={{
            margin: isSent ? '2px 16px 6px auto' : '2px auto 6px 16px',
            maxWidth: 280,
            background: isSent ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isSent ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {linkPreview.image && (
            <img
              src={linkPreview.image}
              alt=""
              style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div style={{ padding: '8px 12px 10px' }}>
            {linkPreview.siteName && (
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 3 }}>
                {linkPreview.siteName}
              </div>
            )}
            {linkPreview.title && (
              <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600, lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                {linkPreview.title}
              </div>
            )}
            {linkPreview.description && (
              <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                {linkPreview.description}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{linkPreview.hostname}</div>
          </div>
        </div>
      )}
    </>
  )
}

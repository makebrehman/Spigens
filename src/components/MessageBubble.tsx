'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'
import { NativeMediaBubble } from './NativeMediaBubble'
import { firstPreviewableUrl } from '@/lib/linkPreview'
import { LinkPreviewCard } from './LinkPreviewCard'

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
  const previewUrl = !isDeleted && (!resolvedType || resolvedType === 'text') ? firstPreviewableUrl(resolvedContent) : null

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
      {previewUrl && <LinkPreviewCard url={previewUrl} isSent={isSent} />}
    </>
  )
}

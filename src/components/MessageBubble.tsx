'use client'

import { memo, useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'
import { NativeMediaBubble } from './NativeMediaBubble'
import { buildFallbackLinkPreview, firstPreviewableUrl, normalizeLinkPreview, type LinkPreviewData } from '@/lib/linkPreview'
import { LinkPreviewCard } from './LinkPreviewCard'
import { queuePreviewFetch } from '@/lib/previewQueue'
import { perfCount } from '@/lib/perfHud'

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
  useComponentState?: (key: string, defaultValue: any) => [any, (v: any) => void]
  getComponentState?: (key: string, defaultValue?: any) => any
  scopeKey?: string
}

function MessageBubbleImpl(props: MessageBubbleProps) {
  perfCount('bubble render')
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
    const all = props.getComponentState
      ? props.getComponentState('chatMessages', [])
      : ((useUIStore.getState().componentState as any)?.chatMessages as any[] | undefined)
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

  // Stored preview (from message metadata, may be 'fallback' if enrichment hasn't run yet).
  const storedPreview = previewUrl
    ? (normalizeLinkPreview(resolvedMetadata?.linkPreview, previewUrl) ?? buildFallbackLinkPreview(previewUrl))
    : null

  // Lazy-enriched preview from the URL-keyed local cache. Starts null; populated by
  // the background queue when the stored preview is only a fallback (no rich data).
  const [enrichedPreview, setEnrichedPreview] = useState<LinkPreviewData | null>(null)

  useEffect(() => {
    if (!previewUrl || storedPreview?.status === 'ready') return
    const cancel = queuePreviewFetch(previewUrl, setEnrichedPreview)
    return cancel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

  const linkPreview = enrichedPreview ?? storedPreview

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

  const scopedUseComponentState = props.useComponentState ?? useComponentState
  const ScopedMessageReactions = (reactionProps: any) => (
    <MessageReactions {...reactionProps} useComponentState={scopedUseComponentState} scopeKey={props.scopeKey} />
  )
  const ScopedReactionPicker = (pickerProps: any) => (
    <ReactionPicker {...pickerProps} useComponentState={scopedUseComponentState} scopeKey={props.scopeKey} />
  )

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
        useComponentState={scopedUseComponentState}
        scopeKey={props.scopeKey}
      />
    )
  }

  return (
    <>
      <RenderifyHost
        code={messageBubbleSource}
        scopeKey={props.scopeKey}
        storeActions={{ id, content: resolvedContent, messageType: resolvedType || 'text', metadata: resolvedMetadata, timestamp, isSent, isRead, status, replyTo, onReplyTo, onJumpToReply, currentUserId, onToggleReaction, onShowReactors: onShowReactors ?? null, isDeleted: isDeleted ?? false, linkPreview, LinkPreviewCard, MessageStatus, ReplyQuote, MessageReactions: ScopedMessageReactions, ReactionPicker: ScopedReactionPicker, useComponentState: scopedUseComponentState }}
      />
    </>
  )
}

// Memoized so a re-render of the list (or the chat screen) does NOT re-render every
// visible bubble — only bubbles whose own props actually changed. Default shallow
// compare is correct here: message rows are replaced by identity when their data
// changes, and all callbacks/scoped wrappers passed in are stable. Live updates a
// bubble owns (its reactions, highlight, long-press tray) come through the internal
// useComponentState subscriptions, which memo does not block.
export const MessageBubble = memo(MessageBubbleImpl)

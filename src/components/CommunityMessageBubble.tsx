'use client'
import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { ProfileImage } from './ProfileImage'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'
import { NativeMediaBubble } from './NativeMediaBubble'
import { fetchLinkPreview, firstPreviewableUrl } from '@/lib/linkPreview'

export interface CommunityMessageBubbleProps {
  id: string
  content: string
  timestamp: string
  isMine: boolean
  senderName: string
  senderAvatar?: string | null
  senderInitials: string
  isDeleted?: boolean
  senderId?: string
  messageType?: string
  metadata?: any | null
  status?: string
  onSenderTap?: (userId: string, name: string, avatarUrl: string | null) => void
  onToggleReaction?: (messageId: string, emoji: string) => void
  replyToData?: { id?: string; senderName: string; content: string } | null
  onJumpToReply?: (id: string) => void
  onShowReactors?: (messageId: string) => void
  onReplyTo?: (target: { id: string; senderName: string; content: string }) => void
  onOpenContactCard?: (contact: { id: string; name: string; username?: string; avatarUrl?: string | null }) => void
}

export function CommunityMessageBubble(props: CommunityMessageBubbleProps) {
  const {
    id, content, timestamp, isMine, senderName, senderAvatar, senderInitials, senderId,
    onSenderTap, isDeleted, onToggleReaction, onShowReactors, replyToData, onJumpToReply,
    messageType, metadata, status, onReplyTo, onOpenContactCard,
  } = props
  const currentUserId = useAuthStore(state => state.user?.id) ?? null
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.communityMessageBubble ?? null

  // Heal media fields from the live community message list if the (possibly cached)
  // GenUI chat source didn't forward messageType/content/metadata to this bubble.
  let resolvedType = messageType
  let resolvedContent = content
  let resolvedMeta = metadata ?? null
  {
    const all = (useUIStore.getState().componentState as any)?.communityMessages as any[] | undefined
    const self = all && all.find((m: any) => m.id === id)
    if (self) {
      if (!resolvedType) resolvedType = self.messageType
      if ((resolvedContent == null || resolvedContent === '') && self.content != null) resolvedContent = self.content
      if (resolvedMeta == null && self.metadata != null) resolvedMeta = self.metadata
    }
  }

  const isMedia = !isDeleted && !!resolvedType && resolvedType !== 'text' && resolvedType !== 'system'

  const [linkPreview, setLinkPreview] = useState<any>(null)
  useEffect(() => {
    if (isDeleted || isMedia) return
    const firstUrl = firstPreviewableUrl(resolvedContent)
    if (!firstUrl) return
    fetchLinkPreview(firstUrl).then(p => { if (p?.title) setLinkPreview(p) })
  }, [resolvedContent, isMedia, isDeleted])

  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(() => (useUIStore.getState().componentState as Record<string,any>)?.[key] ?? defaultValue)
    useEffect(() => {
      const unsub = useUIStore.subscribe((state: any, prevState: any) => {
        const next = state.componentState?.[key]; const prev = prevState.componentState?.[key]
        if (next !== prev) setValue(next ?? defaultValue)
      }); return unsub
    }, [key, defaultValue])
    return [value, (newVal: any) => { if (typeof newVal === 'function') { setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r }) } else { setValue(newVal); useUIStore.getState().setComponentState(key, newVal) } }] as [any, (v: any) => void]
  }

  // ── Media message: sender chrome + the shared NativeMediaBubble (embedded) ──
  if (isMedia) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'row', padding: '2px 16px', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
        {!isMine && (
          <div onClick={() => onSenderTap?.(senderId || '', senderName, senderAvatar ?? null)} style={{ flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <ProfileImage avatarUrl={senderAvatar ?? null} contactInitials={senderInitials} contactAvatarColor="#2563EB" size={28} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', minWidth: 0 }}>
          {!isMine && (
            <div onClick={() => onSenderTap?.(senderId || '', senderName, senderAvatar ?? null)} style={{ fontSize: 11, fontWeight: 600, color: '#60A5FA', marginBottom: 3, paddingLeft: 2, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              {senderName}
            </div>
          )}
          <NativeMediaBubble
            embedded
            id={id}
            content={resolvedContent}
            messageType={resolvedType as string}
            metadata={resolvedMeta}
            timestamp={timestamp}
            isSent={isMine}
            isRead
            status={status || 'sent'}
            senderName={senderName}
            replyTo={replyToData ? { id: replyToData.id, content: replyToData.content, senderLabel: replyToData.senderName } : null}
            onReplyTo={onReplyTo ? (t) => onReplyTo({ id: t.id, senderName, content: t.content }) : undefined}
            onJumpToReply={onJumpToReply}
            currentUserId={currentUserId ?? undefined}
            onToggleReaction={onToggleReaction}
            onShowReactors={onShowReactors}
            onOpenContactCard={onOpenContactCard}
            isDeleted={isDeleted}
          />
        </div>
      </div>
    )
  }

  // ── Text / deleted / system: the GenUI bubble source (+ link preview) ──
  return (
    <>
      <RenderifyHost code={source} storeActions={{ id, content: resolvedContent, timestamp, isMine, senderName, senderAvatar: senderAvatar ?? null, senderInitials, senderId: senderId ?? null, onSenderTap: onSenderTap ?? null, isDeleted: isDeleted ?? false, currentUserId, onToggleReaction: onToggleReaction ?? null, onShowReactors: onShowReactors ?? null, replyToData: replyToData ?? null, onJumpToReply: onJumpToReply ?? null, onReplyTo: onReplyTo ?? null, MessageReactions, ReactionPicker, ProfileImage, useComponentState }} />
      {linkPreview && (
        <div
          onClick={() => window.open(linkPreview.url, '_blank', 'noopener,noreferrer')}
          style={{ margin: isMine ? '2px 16px 6px auto' : '2px auto 6px 52px', maxWidth: 280, background: isMine ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMine ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
        >
          {linkPreview.image && (
            <img src={linkPreview.image} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          <div style={{ padding: '8px 12px 10px' }}>
            {linkPreview.siteName && <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 3 }}>{linkPreview.siteName}</div>}
            {linkPreview.title && <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600, lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>{linkPreview.title}</div>}
            {linkPreview.description && <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>{linkPreview.description}</div>}
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{linkPreview.hostname}</div>
          </div>
        </div>
      )}
    </>
  )
}

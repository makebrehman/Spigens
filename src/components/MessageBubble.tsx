'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { MessageStatus } from './MessageStatus'
import { ReplyQuote } from './ReplyQuote'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
const previewCache = new Map<string, any>()

async function fetchLinkPreview(url: string): Promise<any> {
  if (previewCache.has(url)) return previewCache.get(url)
  try {
    const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`)
    const data = await res.json()
    if (data?.title) previewCache.set(url, data)
    return data
  } catch {
    return null
  }
}

export interface MessageBubbleProps {
  id: string
  contactId?: string
  content: string
  messageType?: string
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

export function MessageBubble(props: MessageBubbleProps) {
  const { id, content, messageType, timestamp, isSent, isRead, status, replyTo, onReplyTo, onJumpToReply, currentUserId, onToggleReaction, onShowReactors, isDeleted } = props
  const componentSources = useUIStore(state => state.componentSources)
  const messageBubbleSource = componentSources?.messageBubble ?? null
  const [linkPreview, setLinkPreview] = useState<any>(null)

  useEffect(() => {
    if (isDeleted || (messageType && messageType !== 'text')) return
    const matches = content?.match(URL_REGEX)
    if (!matches?.length) return
    const firstUrl = matches[0]
    // Skip Supabase storage and blob URLs — those are media content, not shareable links
    if (firstUrl.includes('supabase.co/storage') || firstUrl.startsWith('blob:')) return
    fetchLinkPreview(firstUrl).then(p => { if (p?.title) setLinkPreview(p) })
  }, [content, messageType, isDeleted])

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

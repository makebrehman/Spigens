'use client'
import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { ProfileImage } from './ProfileImage'
import { MessageReactions } from './MessageReactions'
import { ReactionPicker } from './ReactionPicker'

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
  onSenderTap?: (userId: string, name: string, avatarUrl: string | null) => void
  onToggleReaction?: (messageId: string, emoji: string) => void
  replyToData?: { id?: string; senderName: string; content: string } | null
  onJumpToReply?: (id: string) => void
  onShowReactors?: (messageId: string) => void
}

export function CommunityMessageBubble(props: CommunityMessageBubbleProps) {
  const { id, content, timestamp, isMine, senderName, senderAvatar, senderInitials, senderId, onSenderTap, isDeleted, onToggleReaction, onShowReactors, replyToData, onJumpToReply } = props
  const currentUserId = useAuthStore(state => state.user?.id) ?? null
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.communityMessageBubble ?? null
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
  return <RenderifyHost code={source} storeActions={{ id, content, timestamp, isMine, senderName, senderAvatar: senderAvatar ?? null, senderInitials, senderId: senderId ?? null, onSenderTap: onSenderTap ?? null, isDeleted: isDeleted ?? false, currentUserId, onToggleReaction: onToggleReaction ?? null, onShowReactors: onShowReactors ?? null, replyToData: replyToData ?? null, onJumpToReply: onJumpToReply ?? null, MessageReactions, ReactionPicker, ProfileImage, useComponentState }} />
}

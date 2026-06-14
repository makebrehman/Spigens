'use client'

import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'

export interface MessageBubbleProps {
  id: string
  contactId?: string
  content: string
  timestamp: string
  isSent: boolean
  isRead: boolean
}

export function MessageBubble(props: MessageBubbleProps) {
  const { content, timestamp, isSent, isRead } = props
  const componentSources = useUIStore(state => state.componentSources)
  const messageBubbleSource = componentSources?.messageBubble ?? null

  return (
    <RenderifyHost
      code={messageBubbleSource}
      storeActions={{ content, timestamp, isSent, isRead }}
    />
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MessageBubble } from './MessageBubble'
import { RenderifyHost } from '@/components/RenderifyHost'
import { useMessageStore } from '@/stores/messageStore'
import { useUIStore } from '@/stores/uiStore'
import { useContactStore } from '@/stores/contactStore'

export interface ChatScreenProps {
  contactId: string
  contactName: string
  contactInitials: string
  contactAvatarColor: string
  isOnline: boolean
  onBack?: () => void
}

export function ChatScreen(props: ChatScreenProps) {
  const { contactId, contactName, contactInitials, contactAvatarColor, isOnline, onBack } = props

  const messages = useMessageStore(state => state.messagesByContact[contactId]) ?? []
  const attachConfig = useUIStore(state => state.behaviorConfig.attachButton)
  const componentSources = useUIStore(state => state.componentSources)
  const chatScreenSource = componentSources?.chatScreen ?? null
  const bottomSheetSource = componentSources?.bottomSheet ?? null

  const [showAttachSheet, setShowAttachSheet] = useState(false)

  // on open: clear unread badge and mark received messages as read
  useEffect(() => {
    useContactStore.getState().clearUnread(contactId)
    useMessageStore.getState().markAllRead(contactId)
  }, [contactId])

  // useComponentState: persistent state for compiled components, survives re-renders
  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(
      () => (useUIStore.getState().componentState as Record<string, any>)?.[key] ?? defaultValue
    )
    // subscribe to store changes — re-renders this component when another component writes to this key
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

  const chatScreenScope = {
    contactName,
    contactInitials,
    contactAvatarColor,
    isOnline,
    messages,
    MessageBubble,
    onBack: () => onBack?.(),
    onAttach: () => setShowAttachSheet(true),
    sendMessage: (content: string) => useMessageStore.getState().sendMessage(contactId, content),
    useComponentState,
  }

  return (
    <>
      <RenderifyHost code={chatScreenSource} storeActions={chatScreenScope} />
      {attachConfig?.popup && showAttachSheet && createPortal(
        <RenderifyHost
          code={bottomSheetSource}
          storeActions={{
            sheetId: 'attachSheet',
            title: attachConfig.popup.title,
            options: attachConfig.popup.options,
            onClose: () => setShowAttachSheet(false),
            onOptionSelect: (option: any) => {
              console.log('attach option selected:', option.label)
              setShowAttachSheet(false)
            },
          }}
        />,
        document.body
      )}
    </>
  )
}

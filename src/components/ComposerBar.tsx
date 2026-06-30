'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { AttachButton } from './AttachButton'
import { SendButton } from './SendButton'
import { ReplyPreview } from './ReplyPreview'

export interface ComposerBarProps {
  sendMessage: (content: string) => void
  onAttach: () => void
  onTyping?: () => void
  replyingTo?: { content: string; senderLabel: string } | null
  onCancelReply?: () => void
  useComponentState?: (key: string, defaultValue: any) => [any, (v: any) => void]
  scopeKey?: string
}

export function ComposerBar(props: ComposerBarProps) {
  const componentSources = useUIStore(state => state.componentSources)
  const composerBarSource = componentSources?.composerBar ?? null

  function useLocalComponentState(key: string, defaultValue: any) {
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

  const scopedUseComponentState = props.useComponentState ?? useLocalComponentState
  const ScopedAttachButton = (buttonProps: any) => (
    <AttachButton {...buttonProps} useComponentState={scopedUseComponentState} scopeKey={props.scopeKey} />
  )
  const ScopedSendButton = (buttonProps: any) => (
    <SendButton {...buttonProps} useComponentState={scopedUseComponentState} scopeKey={props.scopeKey} />
  )
  const ScopedReplyPreview = (previewProps: any) => (
    <ReplyPreview {...previewProps} useComponentState={scopedUseComponentState} scopeKey={props.scopeKey} />
  )

  return (
    <RenderifyHost
      code={composerBarSource}
      scopeKey={props.scopeKey}
      storeActions={{
        ...props,
        useComponentState: scopedUseComponentState,
        AttachButton: ScopedAttachButton,
        SendButton: ScopedSendButton,
        ReplyPreview: ScopedReplyPreview,
      }}
    />
  )
}

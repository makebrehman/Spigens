'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'

export interface ReactionPickerProps {
  messageId: string
  onToggleReaction?: (messageId: string, emoji: string) => void
}

export function ReactionPicker(props: ReactionPickerProps) {
  const { messageId, onToggleReaction } = props
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.reactionPicker ?? null

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
    <RenderifyHost
      code={source}
      storeActions={{ messageId, onToggleReaction, useComponentState }}
    />
  )
}

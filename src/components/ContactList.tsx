'use client'

import { useState, useEffect } from 'react'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import type { Contact } from '@/types'

interface ContactListProps {
  onContactSelect?: (contact: Contact) => void
  onTileLongPress?: (contact: Contact) => void
}

export function ContactList({ onContactSelect, onTileLongPress }: ContactListProps) {
  const contacts = useContactStore(state => state.contacts)
  const componentSources = useUIStore(state => state.componentSources)
  const contactListSource = componentSources?.contactList ?? null

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
      code={contactListSource}
      storeActions={{
        contacts,
        onContactSelect: (contact: Contact) => onContactSelect?.(contact),
        onTileLongPress: (contact: Contact) => onTileLongPress?.(contact),
        useComponentState,
      }}
    />
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import type { Contact } from '@/types'

interface ContactListProps {
  contacts?: Contact[]
  onContactSelect?: (contact: Contact) => void
  onTileLongPress?: (contact: Contact) => void
  onContactAvatarTap?: (contact: any) => void
  openChat?: (contactId: string) => void
  openLongPressSheet?: (contactId: string) => void
  openContactProfile?: (contact: any) => void
}

export function ContactList({ contacts: propContacts, onContactSelect, onTileLongPress, onContactAvatarTap, openChat, openLongPressSheet, openContactProfile }: ContactListProps) {
  const storeContacts = useContactStore(state => state.contacts)
  const contacts = propContacts ?? storeContacts
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
        // old callback style — kept for backward compat with AI-customized code
        onContactSelect: (contact: Contact) => onContactSelect?.(contact),
        onTileLongPress: (contact: Contact) => onTileLongPress?.(contact),
        onAvatarTap: (contact: any) => onContactAvatarTap?.(contact),
        // new direct action vocabulary
        openChat: (contactId: string) => {
          if (openChat) {
            openChat(contactId)
          } else {
            const c = contacts.find(x => x.id === contactId)
            if (c) onContactSelect?.(c)
          }
        },
        openLongPressSheet: (contactId: string) => {
          if (openLongPressSheet) {
            openLongPressSheet(contactId)
          } else {
            const c = contacts.find(x => x.id === contactId)
            if (c) onTileLongPress?.(c)
          }
        },
        openContactProfile: openContactProfile ?? ((contact: any) => onContactAvatarTap?.(contact)),
        useComponentState,
      }}
    />
  )
}

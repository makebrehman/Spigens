'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { dispatchAction } from '@/lib/actionDispatcher'
import { RenderifyHost } from '@/components/RenderifyHost'
import { ContactList } from '@/components/ContactList'
import { ChatScreen } from '@/components/ChatScreen'
import { SearchBar } from '@/components/SearchBar'
import GenUIPanel from '@/components/GenUIPanel'
import { callGenUIForUpdate } from '@/lib/genuiClient'
import { useVolumeKeyTrigger } from '@/hooks/useVolumeKeyTrigger'
import { loadFontsFromMutation, loadGoogleFont } from '@/lib/fontLoader'
import type { Contact } from '@/types'

export default function Home() {
  const [showSearch, setShowSearch] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // persist middleware finished rehydrating from storage
    const unsubFinish = useUIStore.persist.onFinishHydration(() => setHydrated(true))
    // in case it already hydrated before this effect ran
    if (useUIStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return () => {
      unsubFinish()
    }
  }, [])

  const [showGenUI, setShowGenUI] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genUIError, setGenUIError] = useState<string | null>(null)

  const [longPressedContact, setLongPressedContact] = useState<Contact | null>(null)
  const longPressConfig = useUIStore(state => state.behaviorConfig.longPress)
  const interactions = useUIStore(state => state.interactions)
  const customComponents = useUIStore(state => state.customComponents)
  const componentSources = useUIStore(state => state.componentSources)
  const topAppBarSource = componentSources?.topAppBar
  const searchBarSource = componentSources?.searchBar
  const bottomSheetSource = componentSources?.bottomSheet

  const selectedContactId = useContactStore(state => state.selectedContactId)
  const setSelectedContactId = useContactStore(state => state.setSelectedContactId)
  const getSelectedContact = useContactStore(state => state.getSelectedContact)
  const selectedContact = getSelectedContact()

  const searchBarConfig = useUIStore(state => state.layoutConfig.searchBar)
  const barPosition = searchBarConfig.barPosition
  const iconPosition = searchBarConfig.iconPosition
  const canUndoUI = useUIStore(state => state.history.length > 0)
  const homeLayoutOrder = useUIStore(state => (state.componentState as any)?.['homeLayout.order']) as string[] | undefined

  const handleOpenGenUI = useCallback(() => setShowGenUI(true), [])
  useVolumeKeyTrigger(handleOpenGenUI)

  const handleGenerate = useCallback(async (message: string) => {
    setIsGenerating(true)
    setGenUIError(null)

    const contacts = useContactStore.getState().contacts
    const contactNames = contacts.map(c => c.name)
    const storeState = {
      layoutConfig: useUIStore.getState().layoutConfig,
      behaviorConfig: useUIStore.getState().behaviorConfig,
      componentSources: useUIStore.getState().componentSources,
    } as any

    // determine current screen
    const screen = selectedContact ? 'chat' : 'home'

    try {
      const mutation = await callGenUIForUpdate({
        message,
        screen,
        storeState,
        contactNames,
      })

      // snapshot current state before applying the change (for undo)
      useUIStore.getState().pushHistory()

      // load any google fonts the AI referenced before applying
      loadFontsFromMutation(mutation)

      // also scan custom component code strings explicitly
      if (mutation.customComponents) {
        Object.values(mutation.customComponents).forEach(code => {
          if (typeof code === 'string') {
            const matches = code.match(/fontFamily:\s*['"]([^'"]+)['"]/g)
            matches?.forEach(m => {
              const font = m.match(/['"]([^'"]+)['"]/)?.[1]
              if (font) loadGoogleFont(font)
            })
          }
        })
      }

      const uiStore = useUIStore.getState()

      // apply layout config
      if (mutation.layoutConfig?.searchBar) {
        uiStore.setSearchBarConfig(mutation.layoutConfig.searchBar)
      }

      // apply contact list container style
      if (mutation.contactListStyle) {
        uiStore.setContactListStyle(mutation.contactListStyle)
      }

      // apply behavior config
      if (mutation.behaviorConfig) {
        uiStore.setBehaviorConfig(mutation.behaviorConfig)
      }

      // apply interaction behavior changes
      if (mutation.interactions) {
        uiStore.setInteractions(mutation.interactions)
      }

      // apply custom generated components
      if (mutation.customComponents) {
        Object.entries(mutation.customComponents).forEach(([zone, code]) => {
          uiStore.setCustomComponent(zone, code)
        })
      }

      // apply AI-edited component source code
      if (mutation.componentSources) {
        Object.entries(mutation.componentSources).forEach(([name, source]) => {
          if (typeof source === 'string') {
            uiStore.setComponentSource(name, source)
          }
        })
      }

      // scan edited component source for fonts/icons to load
      if (mutation.componentSources) {
        Object.values(mutation.componentSources).forEach(source => {
          if (typeof source === 'string') {
            const fontMatches = source.match(/fontFamily:\s*['"]([^'"]+)['"]/g)
            fontMatches?.forEach(m => {
              const font = m.match(/['"]([^'"]+)['"]/)?.[1]
              if (font) loadGoogleFont(font)
            })
          }
        })
      }

      // apply layout order change
      if ((mutation as any).layoutOrder) {
        uiStore.setComponentState('homeLayout.order', (mutation as any).layoutOrder)
      }

      setIsGenerating(false)
      setShowGenUI(false)

    } catch (err) {
      setGenUIError(err instanceof Error ? err.message : 'something went wrong')
      setIsGenerating(false)
    }
  }, [selectedContact])

  // portal safety — only render portals after client mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    useUIStore.getState().setBehaviorConfig({
      attachButton: {
        onTap: 'show-bottom-sheet',
        popup: {
          title: 'send attachment',
          options: [
            { id: 'photo', label: 'photo', icon: '📷' },
            { id: 'document', label: 'document', icon: '📄' },
            { id: 'location', label: 'location', icon: '📍' },
            { id: 'contact-share', label: 'contact', icon: '👤' },
          ],
        },
      },
      longPress: {
        popup: {
          title: 'chat options',
          options: [
            { id: 'mute', label: 'mute notifications', icon: '🔕' },
            { id: 'pin', label: 'pin to top', icon: '📌' },
            { id: 'archive', label: 'archive chat', icon: '📦' },
            { id: 'delete', label: 'delete chat', icon: '🗑️', destructive: true },
          ],
        },
      },
    })
  }, [])

  const handleSearchClose = useCallback(() => setShowSearch(false), [])

  const renderifyActions = useMemo(() => ({
    openChat: (contactId?: string) => {
      if (contactId) useContactStore.getState().setSelectedContactId(contactId)
    },
    openLongPressSheet: () => {},
    openAttachSheet: () => {},
    toggleSearch: () => setShowSearch(prev => !prev),
    navigateBack: () => setSelectedContactId(null),
    getContacts: () => useContactStore.getState().contacts,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []) // created once — setters are stable refs

  const topBarScope = useMemo(() => {
    // useComponentState: works like React.useState but value persists across re-renders
    // the key must be unique per piece of state, e.g. 'globeToggle', 'myCounter'
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

    const handlers = {
      openChat: () => {},
      openLongPressSheet: () => { const first = useContactStore.getState().contacts[0]; if (first) setLongPressedContact(first) },
      openAttachSheet: () => {},
      toggleSearch: () => setShowSearch(prev => !prev),
      navigateBack: () => setSelectedContactId(null),
    }

    return {
      title: 'messages',
      useComponentState,
      getContacts: () => useContactStore.getState().contacts,
      onMenuTap: () => dispatchAction(useUIStore.getState().interactions?.menuTap, handlers),
      onSearchTap: () => setShowSearch(prev => !prev),
      onNewChatTap: () => dispatchAction(useUIStore.getState().interactions?.newChatTap, handlers),
      openSearch: () => setShowSearch(true),
      closeSearch: () => setShowSearch(false),
      toggleSearch: () => setShowSearch(prev => !prev),
      openLongPressSheet: () => { const first = useContactStore.getState().contacts[0]; if (first) setLongPressedContact(first) },
      setSearchBarConfig: (cfg: any) => useUIStore.getState().setSearchBarConfig(cfg),
      setContactListStyle: (s: any) => useUIStore.getState().setContactListStyle(s),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // created once — all functions read from store at call time, all setters are stable refs

  const searchBarScope = useMemo(() => {
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
    return {
      closeSearch: () => setShowSearch(false),
      openSearch: () => setShowSearch(true),
      toggleSearch: () => setShowSearch(prev => !prev),
      getContacts: () => useContactStore.getState().contacts,
      useComponentState,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // setShowSearch is a stable useState setter — safe to omit from deps

  if (!hydrated) {
    return <div className="h-screen w-full bg-[#0a0a0a]" />
  }

  // --- chat screen ---
  if (selectedContact) {
    return (
      <>
        <ChatScreen
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          contactInitials={selectedContact.avatarInitials}
          contactAvatarColor={selectedContact.avatarColor}
          isOnline={selectedContact.isOnline}
          onBack={() => setSelectedContactId(null)}
        />
        <GenUIPanel
          isOpen={showGenUI}
          isGenerating={isGenerating}
          onClose={() => !isGenerating && setShowGenUI(false)}
          onGenerate={handleGenerate}
          lastError={genUIError}
          onUndo={() => useUIStore.getState().undo()}
          onReset={() => useUIStore.getState().resetAllCustomizations()}
          canUndo={canUndoUI}
        />
      </>
    )
  }

  // --- determine overlay/floating portal position ---
  const overlayPosition =
    barPosition === 'floating' && searchBarConfig.position
      ? {
          bottom: String(searchBarConfig.position.bottom ?? '80px'),
          top: String(searchBarConfig.position.top ?? 'auto'),
          left: String(searchBarConfig.position.left ?? '16px'),
          right: String(searchBarConfig.position.right ?? '16px'),
        }
      : { bottom: '80px', left: '16px', right: '16px' }

  const showPortalSearch =
    mounted &&
    showSearch &&
    (barPosition === 'bottom-overlay' || barPosition === 'floating')

  const buildHandlers = (contactId?: string) => ({
    openChat: () => { if (contactId) setSelectedContactId(contactId) },
    openLongPressSheet: () => {
      const contact = useContactStore.getState().contacts.find(c => c.id === contactId)
      if (contact) setLongPressedContact(contact)
    },
    openAttachSheet: () => { /* attach sheet is inside ChatScreen, not used here */ },
    toggleSearch: () => setShowSearch(prev => !prev),
    navigateBack: () => setSelectedContactId(null),
  })

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* orderable home sections */}
      {(homeLayoutOrder ?? ['appBar', 'searchBar', 'homeTop', 'contactList', 'homeBottom']).map(key => {
        const sections: Record<string, React.ReactNode> = {
          appBar: <RenderifyHost code={topAppBarSource ?? null} storeActions={topBarScope} />,
          searchBar: showSearch && barPosition === 'top-bar'
            ? <RenderifyHost code={searchBarSource ?? null} storeActions={searchBarScope} />
            : null,
          homeTop: <RenderifyHost code={customComponents?.['home-top'] ?? null} storeActions={renderifyActions} />,
          contactList: (
            <div className="flex-1 overflow-hidden">
              <ContactList
                onContactSelect={(contact) => dispatchAction(interactions?.tileTap, buildHandlers(contact.id))}
                onTileLongPress={(contact) => dispatchAction(interactions?.tileLongPress, buildHandlers(contact.id))}
              />
            </div>
          ),
          homeBottom: <RenderifyHost code={customComponents?.['home-bottom'] ?? null} storeActions={renderifyActions} />,
        }
        const node = sections[key]
        return node ? <Fragment key={key}>{node}</Fragment> : null
      })}

      {/* portal search bar — bottom-overlay and floating containers */}
      {showPortalSearch && (
        <SearchBar
          mode="overlay"
          overlayPosition={overlayPosition}
          placeholder="search conversations..."
          onClose={() => setShowSearch(false)}
        />
      )}

      {mounted && iconPosition === 'bottom' && (
        <button
          onClick={() => setShowSearch(prev => !prev)}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--sab) + 24px)',
            right: '16px',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: '#2563EB',
            border: 'none',
            color: '#ffffff',
            fontSize: '20px',
            zIndex: 101,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          🔍
        </button>
      )}

      {longPressConfig && longPressedContact !== null && mounted && createPortal(
        <RenderifyHost
          code={bottomSheetSource ?? null}
          storeActions={{
            sheetId: 'longPressSheet',
            title: longPressConfig.popup.title,
            options: longPressConfig.popup.options,
            onClose: () => setLongPressedContact(null),
            onOptionSelect: (option: any) => {
              console.log(`${option.label} on ${longPressedContact?.name}`)
              setLongPressedContact(null)
            },
            contactName: longPressedContact?.name,
          }}
        />,
        document.body
      )}

      <GenUIPanel
        isOpen={showGenUI}
        isGenerating={isGenerating}
        onClose={() => !isGenerating && setShowGenUI(false)}
        onGenerate={handleGenerate}
        lastError={genUIError}
        onUndo={() => useUIStore.getState().undo()}
        onReset={() => useUIStore.getState().resetAllCustomizations()}
        canUndo={canUndoUI}
      />

      {/* floating zone */}
      <RenderifyHost code={customComponents?.['floating'] ?? null} storeActions={renderifyActions} />
    </div>
  )
}

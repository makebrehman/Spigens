'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { dispatchAction } from '@/lib/actionDispatcher'
import { RenderifyHost } from '@/components/RenderifyHost'
import { ContactList } from '@/components/ContactList'
import { ChatScreen } from '@/components/ChatScreen'
import { EmptyState } from '@/components/EmptyState'
import { SearchBar } from '@/components/SearchBar'
import GenUIPanel from '@/components/GenUIPanel'
import { callGenUIForUpdate } from '@/lib/genuiClient'
import { useVolumeKeyTrigger } from '@/hooks/useVolumeKeyTrigger'
import { loadFontsFromMutation, loadGoogleFont } from '@/lib/fontLoader'
import type { Contact } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { AuthScreen } from '@/components/AuthScreen'
import { supabase } from '@/lib/supabase'
import { loadConversations } from '@/lib/loadConversations'

function UserSearchResults({ searchQuery, onSelectUser }: { searchQuery: string, onSelectUser?: (user: any) => void }) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const currentUserId = useAuthStore(state => state.user?.id)

  useEffect(() => {
    if (searchQuery.trim().length < 2) return
    const t = setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_online, public_key, last_seen')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', currentUserId)
        .limit(20)
      if (!error && data) {
        setResults(data)
      } else {
        setResults([])
      }
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, currentUserId])

  if (searchQuery.trim().length < 2) return null

  return (
    <div className="flex-1 overflow-y-auto px-[16px] py-[8px] space-y-2">
      {loading ? (
        <div className="text-white/40 text-[14px] text-center mt-4">searching...</div>
      ) : results.length === 0 ? (
        <div className="text-white/40 text-[14px] text-center mt-4">no users found</div>
      ) : (
        results.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-[10px] rounded-[16px] active:bg-white/10 transition-colors cursor-pointer"
               onClick={() => {
                 onSelectUser?.(u)
               }}>
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" className="w-[48px] h-[48px] rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-[48px] h-[48px] rounded-full shrink-0 flex items-center justify-center font-bold text-[18px]" style={{
                background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
                color: '#fff',
                textTransform: 'uppercase'
              }}>
                {(u.display_name || u.username || '?')[0]}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[#E8E8E8] text-[16px] font-semibold truncate leading-tight mb-[2px]">{u.display_name}</span>
              <span className="text-[#8A8A8A] text-[13px] truncate leading-tight">@{u.username}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default function Home() {
  const [showSearch, setShowSearch] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [activeChatUser, setActiveChatUser] = useState<any>(null)

  const searchQuery = useUIStore(state => state.componentState?.['searchQuery'] as string | undefined) || ''

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

  // initialize auth on mount
  useEffect(() => {
    useAuthStore.getState().initialize()
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

  const contacts = useContactStore(state => state.contacts)
  const selectedContactId = useContactStore(state => state.selectedContactId)
  const setSelectedContactId = useContactStore(state => state.setSelectedContactId)
  const getSelectedContact = useContactStore(state => state.getSelectedContact)
  const selectedContact = getSelectedContact()
  const onlineUserIds = useContactStore(state => state.onlineUserIds)

  const searchBarConfig = useUIStore(state => state.layoutConfig.searchBar)
  const barPosition = searchBarConfig.barPosition
  const iconPosition = searchBarConfig.iconPosition
  const canUndoUI = useUIStore(state => state.history.length > 0)
  const homeLayoutOrder = useUIStore(state => (state.componentState as any)?.['homeLayout.order']) as string[] | undefined

  const { isAuthenticated, isLoading: authLoading, user, profile } = useAuthStore()
  const genUIEnabled = useNavStore(state => state.isGenUIEnabled())
  const navScreen = useNavStore(state => state.screen)
  const navigateTo = useNavStore(state => state.navigateTo)

  useEffect(() => {
    if (isAuthenticated && profile?.public_key && navScreen === 'auth') {
      navigateTo('home')
    }
  }, [isAuthenticated, profile?.public_key, navScreen, navigateTo])

  // load conversations on mount and when returning from chat
  const fetchConversations = useCallback(() => {
    if (isAuthenticated && user?.id && profile?.public_key && !activeChatUser) {
      loadConversations(user.id, profile.public_key).then((conversations) => {
        const mappedContacts: Contact[] = conversations.map(c => {
          const dt = new Date(c.lastMessageTime)
          const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return {
            id: c.otherProfile.id,
            name: c.otherProfile.display_name || c.otherProfile.username || 'Unknown',
            avatarInitials: (c.otherProfile.display_name || c.otherProfile.username || '?')[0].toUpperCase(),
            avatarColor: '#555',
            avatarUrl: c.otherProfile.avatar_url,
            lastMessage: c.lastMessage,
            lastMessageTime: timeStr,
            unreadCount: 0,
            isOnline: useContactStore.getState().onlineUserIds.has(c.otherProfile.id),
            rawProfile: c.otherProfile
          }
        })
        useContactStore.getState().setContacts(mappedContacts)
        useUIStore.getState().setComponentState('feedContacts', mappedContacts)
      })
    }
  }, [isAuthenticated, user?.id, profile?.public_key, activeChatUser])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // presence effect
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user.id } }
    })

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      const onlineIds = new Set<string>()
      for (const id of Object.keys(state)) {
        onlineIds.add(id)
      }
      useContactStore.getState().setOnlineUserIds(onlineIds)
    })

    presenceChannel.on('presence', { event: 'join' }, ({ key }) => {
      const current = useContactStore.getState().onlineUserIds
      if (!current.has(key)) {
        useContactStore.getState().setOnlineUserIds(new Set([...current, key]))
      }
    })

    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      const next = new Set(useContactStore.getState().onlineUserIds)
      next.delete(key)
      useContactStore.getState().setOnlineUserIds(next)
    })

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const iso = new Date().toISOString()
        presenceChannel.track({ user_id: user.id, online_at: iso })
        supabase.from('profiles').update({ is_online: true }).eq('id', user.id).then()
      }
    })

    const handleOffline = () => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString(), is_online: false }).eq('id', user.id).then()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleOffline()
      }
    }

    window.addEventListener('beforeunload', handleOffline)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleOffline)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      handleOffline()
      presenceChannel.untrack()
      supabase.removeChannel(presenceChannel)
    }
  }, [isAuthenticated, user?.id])

  // sync live presence to tile list without refetching
  useEffect(() => {
    let updated = false
    const currentContacts = useContactStore.getState().contacts
    const newContacts = currentContacts.map(c => {
      const isOnlineNow = onlineUserIds.has(c.id)
      if (c.isOnline !== isOnlineNow) {
        updated = true
        return { ...c, isOnline: isOnlineNow }
      }
      return c
    })
    
    if (updated) {
      useContactStore.getState().setContacts(newContacts)
      useUIStore.getState().setComponentState('feedContacts', newContacts)
    }
  }, [onlineUserIds])

  useEffect(() => {
    if (!isAuthenticated || !user?.id || activeChatUser) return

    const channel = supabase.channel('feed-messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      fetchConversations()
    }).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAuthenticated, user?.id, activeChatUser, fetchConversations])

  const handleOpenGenUI = useCallback(() => setShowGenUI(true), [])
  useVolumeKeyTrigger(genUIEnabled ? handleOpenGenUI : () => {})

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

  // auth splash — checking session
  if (authLoading) return (
    <div style={{ height: '100vh', width: '100%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-1px' }}>spigen</div>
    </div>
  )

  // auth screen — locked from GenUI entirely
  if (!isAuthenticated) return <AuthScreen />

  if (!hydrated) {
    return <div className="h-screen w-full bg-[#0a0a0a]" />
  }

  // --- chat screen ---
  if (activeChatUser) {
    return (
      <>
        <ChatScreen
          otherUserId={activeChatUser.id}
          otherUserPublicKey={activeChatUser.public_key}
          contactName={activeChatUser.display_name || activeChatUser.username}
          avatarUrl={activeChatUser.avatar_url}
          contactInitials={(activeChatUser.display_name || activeChatUser.username || '?')[0].toUpperCase()}
          isOnline={onlineUserIds.has(activeChatUser.id)}
          lastSeen={activeChatUser.last_seen}
          onBack={() => setActiveChatUser(null)}
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

  if (selectedContact) {
    return (
      <>
        <ChatScreen
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          contactInitials={selectedContact.avatarInitials}
          contactAvatarColor={selectedContact.avatarColor}
          isOnline={onlineUserIds.has(selectedContact.id)}
          lastSeen={selectedContact.rawProfile?.last_seen}
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
    openChat: () => { 
      if (contactId) {
        const c = useContactStore.getState().contacts.find(x => x.id === contactId)
        if (c?.rawProfile) {
          setActiveChatUser(c.rawProfile)
        } else {
          // fallback
          setSelectedContactId(contactId)
        }
      }
    },
    openLongPressSheet: () => {
      const contact = useContactStore.getState().contacts.find(c => c.id === contactId)
      if (contact) setLongPressedContact(contact)
    },
    openAttachSheet: () => { /* attach sheet is inside ChatScreen, not used here */ },
    toggleSearch: () => setShowSearch(prev => !prev),
    navigateBack: () => {
      setActiveChatUser(null)
      setSelectedContactId(null)
    },
  })

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* temporary testing logout button */}
      <button 
        onClick={() => useAuthStore.getState().signOut()}
        style={{
          position: 'fixed',
          top: '16px',
          right: '110px',
          zIndex: 9999,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          color: '#fff',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        logout
      </button>

      {/* orderable home sections */}
      {(homeLayoutOrder ?? ['appBar', 'searchBar', 'homeTop', 'contactList', 'homeBottom']).map(key => {
        const sections: Record<string, React.ReactNode> = {
          appBar: <RenderifyHost code={topAppBarSource ?? null} storeActions={topBarScope} />,
          searchBar: showSearch && barPosition === 'top-bar'
            ? <RenderifyHost code={searchBarSource ?? null} storeActions={searchBarScope} />
            : null,
          homeTop: <RenderifyHost code={customComponents?.['home-top'] ?? null} storeActions={renderifyActions} />,
          contactList: (
            <div className="flex-1 overflow-hidden flex flex-col">
              {searchQuery.trim().length >= 2 ? (
                <UserSearchResults 
                  searchQuery={searchQuery} 
                  onSelectUser={(u) => {
                    setActiveChatUser(u)
                    useUIStore.getState().setComponentState('searchQuery', '')
                    setShowSearch(false)
                  }}
                />
              ) : contacts.length === 0 ? (
                <EmptyState />
              ) : (
                <ContactList
                  onContactSelect={(contact) => dispatchAction(interactions?.tileTap, buildHandlers(contact.id))}
                  onTileLongPress={(contact) => dispatchAction(interactions?.tileLongPress, buildHandlers(contact.id))}
                />
              )}
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

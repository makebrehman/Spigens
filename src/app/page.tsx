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
import { GenUIReveal } from '@/components/GenUIReveal'
import { callGenUIForUpdate } from '@/lib/genuiClient'
import { useVolumeKeyTrigger } from '@/hooks/useVolumeKeyTrigger'
import { loadFontsFromMutation, loadGoogleFont } from '@/lib/fontLoader'
import type { Contact } from '@/types'
import { Pin, BellOff, Archive, ArchiveRestore, Trash2 as Trash, ChevronRight, ChevronLeft } from 'lucide-react'
import { registerServiceWorker, subscribeToPush } from '@/lib/pushNotifications'
import { loadGenUIFromServer, saveGenUIToServer, saveVersionToServer } from '@/lib/genuiSync'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useNetworkStore } from '@/stores/networkStore'
import { AuthScreen } from '@/components/AuthScreen'
import { supabase } from '@/lib/supabase'
import { loadConversations } from '@/lib/loadConversations'
import { cacheContacts, getCachedContacts } from '@/lib/offlineCache'
import { ProfileScreen } from '@/components/ProfileScreen'
import { ContactProfileScreen } from '@/components/ContactProfileScreen'
import { CommunityListScreen } from '@/components/CommunityListScreen'
import { CreateCommunityScreen } from '@/components/CreateCommunityScreen'
import { CommunityChatScreen } from '@/components/CommunityChatScreen'
import { CommunityProfileScreen } from '@/components/CommunityProfileScreen'
import { ProfileImage } from '@/components/ProfileImage'
import { SettingsScreen } from '@/components/SettingsScreen'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

function UserSearchResults({ searchQuery, onSelectUser, onAvatarTap }: { searchQuery: string, onSelectUser?: (user: any) => void, onAvatarTap?: (user: any) => void }) {
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
            <div onClick={(e) => { e.stopPropagation(); onAvatarTap?.(u); }} style={{ flexShrink: 0, cursor: 'pointer' }}>
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-[48px] h-[48px] rounded-full object-cover" />
              ) : (
                <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center font-bold text-[18px]" style={{ background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', color: '#fff', textTransform: 'uppercase' }}>
                  {(u.display_name || u.username || '?')[0]}
                </div>
              )}
            </div>
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
  const [showProfile, setShowProfile] = useState(false)
  const [contactProfileUser, setContactProfileUser] = useState<any>(null)
  const [showCommunityList, setShowCommunityList] = useState(false)
  const [showCreateCommunity, setShowCreateCommunity] = useState(false)
  const [activeCommunity, setActiveCommunity] = useState<any>(null)
  const [activeCommunityProfile, setActiveCommunityProfile] = useState<any>(null)
  const [returnToProfile, setReturnToProfile] = useState<any | null>(null)
  const [returnToCommunity, setReturnToCommunity] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'chats' | 'communities' | 'profile'>('chats')
  const [showSettings, setShowSettings] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set())
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [showArchivedView, setShowArchivedView] = useState(false)
  const [pendingDeleteContact, setPendingDeleteContact] = useState<Contact | null>(null)
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set())
  const [longPressedArchivedContact, setLongPressedArchivedContact] = useState<Contact | null>(null)

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

  const { isAuthenticated, isLoading: authLoading, user, profile, privateKey } = useAuthStore()
  const { isOnline, setOnline } = useNetworkStore()

  // Track online/offline state globally
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [setOnline])

  const [showGenUI, setShowGenUI] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genUIError, setGenUIError] = useState<string | null>(null)
  const [showReveal, setShowReveal] = useState(false)
  const [genuiSynced, setGenuiSynced] = useState(false)

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
  const genuiVersions = useUIStore(state => state.versions)
  const genuiActiveVersionId = useUIStore(state => state.activeVersionId)
  const genuiOwnerUserId = useUIStore(state => state.ownerUserId)
  const homeLayoutOrder = useUIStore(state => (state.componentState as any)?.['homeLayout.order']) as string[] | undefined
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
    if (!isAuthenticated || !user?.id || activeChatUser) return

    // Show cached contacts immediately while network loads
    if (user?.id) {
      const cached = getCachedContacts(user.id) as Contact[] | null
      if (cached?.length) {
        useContactStore.getState().setContacts(cached)
        useUIStore.getState().setComponentState('feedContacts', cached)
      }
    }

    if (!isOnline) { setLoadingContacts(false); return } // offline: cached contacts are enough

    Promise.all([
      loadConversations(user.id, privateKey ?? null),
      supabase.rpc('get_dm_unread_counts'),
      supabase.from('blocks').select('blocked_id')
    ]).then(([conversations, unreadRes, blocksRes]) => {
      // If we came back offline while the requests were in flight, discard empty results
      // so we don't wipe the cached contacts that are already showing.
      if (!useNetworkStore.getState().isOnline && !conversations.length) {
        setLoadingContacts(false)
        return
      }
      const unreadMap: Record<string, number> = {}
      ;(((unreadRes as any).data) || []).forEach((r: any) => { unreadMap[r.other_user_id] = Number(r.unread_count) })
      const blockedSet = new Set((((blocksRes as any).data) || []).map((b: any) => b.blocked_id))
      const mappedContacts: Contact[] = conversations.filter(c => !blockedSet.has(c.otherProfile.id)).map(c => {
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
          unreadCount: unreadMap[c.otherProfile.id] || 0,
          isOnline: useContactStore.getState().onlineUserIds.has(c.otherProfile.id),
          rawProfile: c.otherProfile
        }
      })
      useContactStore.getState().setContacts(mappedContacts)
      useUIStore.getState().setComponentState('feedContacts', mappedContacts)
      if (user?.id && mappedContacts.length) cacheContacts(user.id, mappedContacts)
      setLoadingContacts(false)
    })
  }, [isAuthenticated, user, privateKey, activeChatUser, isOnline])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Seed cached contacts instantly + load archived/pinned prefs as soon as user is known
  useEffect(() => {
    if (!user?.id) return
    const cached = getCachedContacts(user.id) as Contact[] | null
    if (cached?.length) {
      useContactStore.getState().setContacts(cached)
      useUIStore.getState().setComponentState('feedContacts', cached)
    }
    try {
      const arch: string[] = JSON.parse(localStorage.getItem(`spigens_archived_${user.id}`) || '[]')
      setArchivedIds(new Set(arch))
      const pinned: string[] = JSON.parse(localStorage.getItem(`spigens_pinned_${user.id}`) || '[]')
      setPinnedIds(new Set(pinned))
      const muted: string[] = JSON.parse(localStorage.getItem(`spigens_muted_${user.id}`) || '[]')
      setMutedIds(new Set(muted))
    } catch {}
  }, [user?.id])

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

  // Mark incoming messages as 'delivered' whenever the app is open (any screen).
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    const markDelivered = () => {
      supabase.rpc('mark_messages_delivered', { p_user_id: user.id }).then()
    }

    // Catch-up: anything that arrived while we were away.
    markDelivered()

    // Re-run when the app returns to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible') markDelivered()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Live: mark each new incoming message delivered while the app is open.
    const deliveredChannel = supabase
      .channel('delivered-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as any
        if (row.sender_id !== user.id && row.status === 'sent') {
          supabase.from('messages').update({ status: 'delivered' }).eq('id', row.id).then()
        }
      })
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(deliveredChannel)
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
            const matches = code.match(/fontFamily:\s*['"]([\'"]+)['"]\g/g)
            matches?.forEach(m => {
              const font = m.match(/['"]([^'"]+)['"]/)?.[ 1]
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
            const fontMatches = source.match(/fontFamily:\s*['"]([\'"]+)['"]\g/g)
            fontMatches?.forEach(m => {
              const font = m.match(/['"]([^'"]+)['"]/)?.[ 1]
              if (font) loadGoogleFont(font)
            })
          }
        })
      }

      // apply layout order change
      if ((mutation as any).layoutOrder) {
        uiStore.setComponentState('homeLayout.order', (mutation as any).layoutOrder)
      }

      // record a named version (AI-titled) and sync state + version to the server
      const uid = useAuthStore.getState().user?.id
      const version = uiStore.addVersion((mutation as any).versionName || message)
      if (uid) {
        saveVersionToServer(uid, version)
        saveGenUIToServer(uid)
      }

      setIsGenerating(false)
      setShowGenUI(false)
      setShowReveal(true)

    } catch (err) {
      setGenUIError(err instanceof Error ? err.message : 'something went wrong')
      setIsGenerating(false)
    }
  }, [selectedContact])

  // portal safety — only render portals after client mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    // Register service worker for push notifications
    registerServiceWorker()
  }, [])

  // Subscribe to push after auth
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    // Delay slightly so the app is visible before asking for permission
    const t = setTimeout(() => subscribeToPush(user.id), 3000)
    return () => clearTimeout(t)
  }, [isAuthenticated, user?.id])

  // Load this user's saved GenUI customizations + version history from the server.
  // genuiSynced flips true once the first fetch settles (success OR failure) so the
  // gate below knows the server has been consulted and can stop waiting.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) { setGenuiSynced(false); return }
    setGenuiSynced(false)
    let active = true
    loadGenUIFromServer(user.id).finally(() => { if (active) setGenuiSynced(true) })
    return () => { active = false }
  }, [isAuthenticated, user?.id])

  // Mirror home-nav state into componentState so the editable home-chrome
  // sources (homeHeader / homeSearch / bottomNav) can read it live.
  useEffect(() => { useUIStore.getState().setComponentState('activeTab', activeTab) }, [activeTab])
  useEffect(() => { useUIStore.getState().setComponentState('showSearch', showSearch) }, [showSearch])

  // Hardware back button (Android / Capacitor)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | null = null
    const register = async () => {
      handle = await CapApp.addListener('backButton', () => {
        if (activeChatUser) {
          setActiveChatUser(null)
          if (returnToProfile) { setActiveCommunityProfile(returnToProfile); setReturnToProfile(null) }
          else if (returnToCommunity) { setActiveCommunity(returnToCommunity); setReturnToCommunity(null) }
          return
        }
        if (contactProfileUser) { setContactProfileUser(null); return }
        if (activeCommunity) { setActiveCommunity(null); return }
        if (activeCommunityProfile) { setActiveCommunityProfile(null); return }
        if (showCreateCommunity) { setShowCreateCommunity(false); return }
        if (showSettings) { setShowSettings(false); return }
        if (activeTab !== 'chats') { setActiveTab('chats'); return }
        CapApp.exitApp()
      })
    }
    register()
    return () => { handle?.remove() }
  }, [activeChatUser, returnToProfile, returnToCommunity, contactProfileUser, activeCommunity, activeCommunityProfile, showCreateCommunity, showSettings, activeTab])

  useEffect(() => {
    useUIStore.getState().setBehaviorConfig({
      attachButton: {
        onTap: 'show-bottom-sheet',
        popup: {
          title: 'send attachment',
          options: [
            { id: 'photo', label: 'Photo / Video', icon: '🖼' },
            { id: 'document', label: 'Document', icon: '📄' },
            { id: 'audio', label: 'Audio', icon: '🎵' },
            { id: 'voice', label: 'Voice Note', icon: '🎤' },
            { id: 'spigens-contact', label: 'Contact', icon: '👤' },
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
      onCommunityTap: () => setShowCommunityList(true),
      myAvatarUrl: profile?.avatar_url ?? null,
      myAvatarInitials: (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase(),
      myAvatarColor: '#2563EB',
      onOpenProfile: () => setShowProfile(true),
      ProfileImage: ProfileImage,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]) // created once — all functions read from store at call time, all setters are stable refs

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

  // live persistent-state hook for compiled home-chrome sources (mirrors ContactList's)
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
        setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r })
      } else {
        setValue(newVal)
        useUIStore.getState().setComponentState(key, newVal)
      }
    }] as [any, (v: any) => void]
  }

  // editable home-chrome scopes — dynamic values flow via useComponentState (live),
  // only stable callbacks/static data go through storeActions.
  const homeHeaderScope = {
    useComponentState,
    onSearchTap: () => setShowSearch(s => !s),
    onCreateCommunity: () => setShowCreateCommunity(true),
  }
  const homeSearchScope = {
    useComponentState,
    onClose: () => { setShowSearch(false); useUIStore.getState().setComponentState('searchQuery', '') },
  }
  const bottomNavScope = {
    useComponentState,
    tabs: [
      { id: 'chats', label: 'Chats', path: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
      { id: 'communities', label: 'Communities', path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
      { id: 'profile', label: 'Profile', path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    ],
    onSelectTab: (id: string) => { setActiveTab(id as 'chats' | 'communities' | 'profile'); setShowSearch(false); useUIStore.getState().setComponentState('searchQuery', '') },
  }

  // shared props for every GenUIPanel instance (server-synced undo/reset/restore)
  const uid = user?.id
  const genuiPanelProps = {
    isGenerating,
    onClose: () => { if (!isGenerating) setShowGenUI(false) },
    onGenerate: handleGenerate,
    lastError: genUIError,
    canUndo: canUndoUI,
    versions: genuiVersions,
    activeVersionId: genuiActiveVersionId,
    onUndo: () => { useUIStore.getState().undo(); if (uid) saveGenUIToServer(uid) },
    onReset: () => { useUIStore.getState().resetAllCustomizations(); if (uid) saveGenUIToServer(uid) },
    onRestoreVersion: (id: string) => { useUIStore.getState().restoreVersion(id); if (uid) saveGenUIToServer(uid) },
  }

  // auth splash — checking session
  if (authLoading) return (
    <div style={{ height: '100vh', width: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <img src="/spigens_logo.png" alt="Spigens" style={{ width: 84, height: 84, borderRadius: 22, objectFit: 'cover' }} />
      <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-1px' }}>spigens</div>
    </div>
  )

  // auth screen — locked from GenUI entirely
  if (!isAuthenticated) return <AuthScreen />

  // Gate the home UI so the DEFAULT (un-customized) UI never flashes before this
  // account's saved design loads. Rules:
  //  - local cache belongs to THIS user and has versions -> show instantly (works offline)
  //  - offline                                           -> show whatever the cache restored
  //  - fresh device / different account / no cache, online -> wait for the server fetch
  const cacheMatchesUser = genuiOwnerUserId != null && genuiOwnerUserId === user?.id
  const waitingForGenUI = isOnline && !genuiSynced && (genuiVersions.length === 0 || !cacheMatchesUser)
  if (!hydrated || waitingForGenUI) {
    return (
      <div style={{ height: '100vh', width: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <img src="/spigens_logo.png" alt="Spigens" style={{ width: 84, height: 84, borderRadius: 22, objectFit: 'cover' }} />
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-1px' }}>spigens</div>
      </div>
    )
  }

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />
  }

  if (activeCommunityProfile) {
    return (
      <CommunityProfileScreen
        communityId={activeCommunityProfile.id}
        communityName={activeCommunityProfile.name}
        communityType={activeCommunityProfile.type}
        communityDescription={activeCommunityProfile.description}
        communityAvatarUrl={activeCommunityProfile.avatar_url}
        memberCount={activeCommunityProfile.member_count}
        inviteMessageId={activeCommunityProfile._inviteMessageId || undefined}
        userRole={activeCommunityProfile.userRole}
        isMember={activeCommunityProfile.isMember ?? false}
        onBack={() => setActiveCommunityProfile(null)}
        onLeaveAndExit={() => { setActiveCommunityProfile(null); setActiveCommunity(null) }}
        onCommunityDeleted={() => { setActiveCommunityProfile(null); setActiveCommunity(null) }}
        onStartDMWithUser={(userId, displayName, username, avatarUrl) => {
          setReturnToProfile(activeCommunityProfile)
          setActiveCommunityProfile(null)
          setActiveCommunity(null)
          setShowCommunityList(false)
          setActiveChatUser({ id: userId, display_name: displayName, username, avatar_url: avatarUrl })
        }}
        onViewMemberProfile={(userId, displayName, username, avatarUrl) => {
          setContactProfileUser({ id: userId, display_name: displayName, username, avatar_url: avatarUrl })
        }}
      />
    )
  }

  if (activeCommunity) {
    return (
      <CommunityChatScreen
        communityId={activeCommunity.id}
        communityName={activeCommunity.name}
        communityType={activeCommunity.type}
        isMember={activeCommunity.isMember ?? false}
        userRole={activeCommunity.userRole}
        memberCount={activeCommunity.member_count || 0}
        onBack={() => setActiveCommunity(null)}
        onViewCommunityProfile={() => setActiveCommunityProfile(activeCommunity)}
        onSenderTap={(userId: string, name: string, avatarUrl: string | null) => {
          setReturnToCommunity(activeCommunity)
          setActiveCommunity(null)
          setActiveChatUser({ id: userId, display_name: name, avatar_url: avatarUrl })
        }}
        communityAvatarUrl={activeCommunity.avatar_url ?? null}
      />
    )
  }

  if (showCreateCommunity) {
    return (
      <CreateCommunityScreen
        onBack={() => setShowCreateCommunity(false)}
        onCreated={(community) => { setShowCreateCommunity(false); setActiveCommunity(community) }}
      />
    )
  }

  if (contactProfileUser) {
    return (
      <ContactProfileScreen
        userId={contactProfileUser.id}
        displayName={contactProfileUser.display_name || contactProfileUser.username}
        username={contactProfileUser.username}
        avatarUrl={contactProfileUser.avatar_url}
        onBack={() => setContactProfileUser(null)}
        onBlocked={() => { setContactProfileUser(null); fetchConversations() }}
        onStartChat={() => { const u = contactProfileUser; setContactProfileUser(null); setActiveChatUser(u) }}
        onOpenCommunity={(communityId: string, name: string, type: string, memberCount: number, avatarUrl: string | null) => {
          setContactProfileUser(null)
          setActiveCommunityProfile(null)
          setReturnToProfile(null)
          setActiveCommunity({ id: communityId, name, type, member_count: memberCount, avatar_url: avatarUrl, isMember: true, userRole: 'member' })
          setShowCommunityList(false)
        }}
      />
    )
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
          onBack={() => { setActiveChatUser(null); if (returnToProfile) { setActiveCommunityProfile(returnToProfile); setReturnToProfile(null); } else if (returnToCommunity) { setActiveCommunity(returnToCommunity); setReturnToCommunity(null); } }}
          onViewContactProfile={() => setContactProfileUser(activeChatUser)}
          onOpenCommunityInvite={(meta: any, msgId: string) => { setActiveCommunityProfile({ id: meta.communityId, name: meta.communityName, type: meta.communityType || 'public', avatar_url: meta.avatarUrl || null, description: meta.description || null, member_count: meta.memberCount || 0, isMember: false, userRole: null, _inviteMessageId: msgId }) }}
        />
        <GenUIPanel isOpen={showGenUI} {...genuiPanelProps} />
        {showReveal && <GenUIReveal onDone={() => setShowReveal(false)} />}
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
        <GenUIPanel isOpen={showGenUI} {...genuiPanelProps} />
        {showReveal && <GenUIReveal onDone={() => setShowReveal(false)} />}
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0A0A0A', overflow: 'hidden' }}>
      {/* Top header — editable via GenUI (componentSources.homeHeader) */}
      <RenderifyHost code={componentSources?.homeHeader ?? null} storeActions={homeHeaderScope} />

      {/* Search bar — editable via GenUI (componentSources.homeSearch) */}
      {showSearch && (
        <RenderifyHost code={componentSources?.homeSearch ?? null} storeActions={homeSearchScope} />
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'chats' && (() => {
          const archivedContactsList = contacts.filter(c => archivedIds.has(c.id))
          const visibleContacts = contacts.filter(c => !archivedIds.has(c.id))
          const unmutedContacts = visibleContacts.filter(c => !mutedIds.has(c.id))
          const mutedVisibleContacts = visibleContacts.filter(c => mutedIds.has(c.id))
          const pinnedUnmutedContacts = unmutedContacts.filter(c => pinnedIds.has(c.id))
          const unmutedContactsWithPin = unmutedContacts.map(c => ({ ...c, isPinned: pinnedIds.has(c.id), isMuted: false }))
          const mutedContactsWithFlag = mutedVisibleContacts.map(c => ({ ...c, isPinned: pinnedIds.has(c.id), isMuted: true }))
          const chatHandlers = {
            onContactSelect: (contact: Contact) => dispatchAction(interactions?.tileTap, buildHandlers(contact.id)),
            onTileLongPress: (contact: Contact) => dispatchAction(interactions?.tileLongPress, buildHandlers(contact.id)),
            onContactAvatarTap: (contact: any) => setContactProfileUser({ id: contact.id, display_name: contact.name, username: contact.username || null, avatar_url: contact.avatarUrl || null }),
          }
          const archivedHandlers = {
            onContactSelect: (contact: Contact) => {
              const c = contact as any
              if (c?.rawProfile) setActiveChatUser(c.rawProfile)
              else setSelectedContactId(contact.id)
            },
            onTileLongPress: (contact: Contact) => setLongPressedArchivedContact(contact),
            onContactAvatarTap: (contact: any) => setContactProfileUser({ id: contact.id, display_name: contact.name, username: contact.username || null, avatar_url: contact.avatarUrl || null }),
          }
          return (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {showArchivedView ? (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
                    <button onClick={() => setShowArchivedView(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><ChevronLeft size={26} /></button>
                    <span style={{ fontSize: 17, fontWeight: 600, color: '#e8e8e8' }}>Archived</span>
                  </div>
                  {archivedContactsList.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 14 }}>No archived chats</div>
                  ) : (
                    <ContactList contacts={archivedContactsList} {...archivedHandlers} />
                  )}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <UserSearchResults
                  searchQuery={searchQuery}
                  onSelectUser={(u: any) => { setActiveChatUser(u); useUIStore.getState().setComponentState('searchQuery', ''); setShowSearch(false) }}
                  onAvatarTap={(u: any) => setContactProfileUser({ id: u.id, display_name: u.display_name, username: u.username, avatar_url: u.avatar_url })}
                />
              ) : (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {archivedContactsList.length > 0 && (
                    <button onClick={() => setShowArchivedView(true)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #1a1a1a', width: '100%', cursor: 'pointer', flexShrink: 0, textAlign: 'left' as const }}>
                      <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Archive size={22} color="#9ca3af" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, color: '#e8e8e8', fontWeight: 500 }}>Archived</div>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>{archivedContactsList.length} chat{archivedContactsList.length !== 1 ? 's' : ''}</div>
                      </div>
                      <ChevronRight size={18} color="#4b5563" />
                    </button>
                  )}
                  {loadingContacts && visibleContacts.length === 0 ? (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px' }}>
                          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 14, borderRadius: 7, background: '#1a1a1a', width: '50%', marginBottom: 8 }} />
                            <div style={{ height: 11, borderRadius: 6, background: '#141414', width: '75%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : visibleContacts.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {pinnedUnmutedContacts.length > 0 && (
                        <div style={{ padding: '10px 16px 2px', fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}><Pin size={11} strokeWidth={2.5} />Pinned</div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                        <ContactList contacts={unmutedContactsWithPin} {...chatHandlers} />
                      </div>
                      {mutedVisibleContacts.length > 0 && (
                        <div style={{ flexShrink: 0, maxHeight: '35%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '10px 16px 2px', fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}><BellOff size={11} strokeWidth={2.5} />Muted</div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <ContactList contacts={mutedContactsWithFlag} {...chatHandlers} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {activeTab === 'communities' && (
          <CommunityListScreen
            onBack={() => setActiveTab('chats')}
            onOpenCommunity={(community: any) => setActiveCommunity(community)}
            onCreateCommunity={() => setShowCreateCommunity(true)}
            onOpenCommunityProfile={(c: any) => setActiveCommunityProfile(c)}
            onCommunityAvatarTap={(c: any) => setActiveCommunityProfile(c)}
            hideHeader={true}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen onBack={() => setActiveTab('chats')} isTab={true} onOpenSettings={() => setShowSettings(true)} />
        )}
      </div>

      {/* Bottom navbar — editable via GenUI (componentSources.bottomNav) */}
      <RenderifyHost code={componentSources?.bottomNav ?? null} storeActions={bottomNavScope} />

      {/* Portals + GenUI */}
      {longPressConfig && longPressedContact !== null && mounted && createPortal(
        <RenderifyHost
          code={bottomSheetSource ?? null}
          storeActions={{
            sheetId: 'longPressSheet',
            title: longPressConfig.popup.title,
            options: longPressConfig.popup.options,
            onClose: () => setLongPressedContact(null),
            onOptionSelect: (option: any) => {
            const contact = longPressedContact
            if (!contact || !user?.id) { setLongPressedContact(null); return }
            const mutedKey = `spigens_muted_${user.id}`
            const pinnedKey = `spigens_pinned_${user.id}`
            const archivedKey = `spigens_archived_${user.id}`
            try {
              if (option.id === 'mute') {
                const muted: string[] = JSON.parse(localStorage.getItem(mutedKey) || '[]')
                const next = muted.includes(contact.id) ? muted.filter(id => id !== contact.id) : [...muted, contact.id]
                localStorage.setItem(mutedKey, JSON.stringify(next))
                setMutedIds(new Set(next))
              } else if (option.id === 'pin') {
                const pinned: string[] = JSON.parse(localStorage.getItem(pinnedKey) || '[]')
                const next = pinned.includes(contact.id) ? pinned.filter(id => id !== contact.id) : [contact.id, ...pinned]
                localStorage.setItem(pinnedKey, JSON.stringify(next))
                setPinnedIds(new Set(next))
                const nextSet = new Set(next)
                const sorted = [...useContactStore.getState().contacts].sort((a, b) => (nextSet.has(b.id) ? 1 : 0) - (nextSet.has(a.id) ? 1 : 0))
                useContactStore.getState().setContacts(sorted)
                useUIStore.getState().setComponentState('feedContacts', sorted)
              } else if (option.id === 'archive') {
                const archived: string[] = JSON.parse(localStorage.getItem(archivedKey) || '[]')
                if (!archived.includes(contact.id)) {
                  const next = [...archived, contact.id]
                  localStorage.setItem(archivedKey, JSON.stringify(next))
                  setArchivedIds(new Set(next))
                }
              } else if (option.id === 'delete') {
                setLongPressedContact(null)
                setPendingDeleteContact(contact)
                return
              }
            } catch { /* ignore storage errors */ }
            setLongPressedContact(null)
          },
            contactName: longPressedContact?.name,
          }}
        />,
        document.body
      )}
      {longPressedArchivedContact && mounted && createPortal(
        <div onClick={() => setLongPressedArchivedContact(null)} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxSizing: 'border-box' as const }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af', marginBottom: 16 }}>{longPressedArchivedContact.name}</div>
            <button
              onClick={() => {
                const c = longPressedArchivedContact
                if (!user?.id) { setLongPressedArchivedContact(null); return }
                const archivedKey = `spigens_archived_${user.id}`
                try {
                  const archived: string[] = JSON.parse(localStorage.getItem(archivedKey) || '[]')
                  const next = archived.filter(id => id !== c.id)
                  localStorage.setItem(archivedKey, JSON.stringify(next))
                  setArchivedIds(new Set(next))
                } catch {}
                setLongPressedArchivedContact(null)
              }}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: '#1f1f1f', color: '#e5e7eb', fontSize: 15, fontWeight: 500, border: 'none', cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const }}
            ><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ArchiveRestore size={16} />Unarchive chat</span></button>
            <button
              onClick={() => {
                const c = longPressedArchivedContact
                setLongPressedArchivedContact(null)
                setPendingDeleteContact(c)
              }}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: '#1f1f1f', color: '#ef4444', fontSize: 15, fontWeight: 500, border: 'none', cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const }}
            ><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Trash size={16} />Delete chat</span></button>
            <button
              onClick={() => setLongPressedArchivedContact(null)}
              style={{ width: '100%', padding: '12px', borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 4 }}
            >Cancel</button>
          </div>
        </div>,
        document.body
      )}
      {pendingDeleteContact && mounted && createPortal(
        <div onClick={() => setPendingDeleteContact(null)} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxSizing: 'border-box' as const }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Delete chat with {pendingDeleteContact.name}?</div>
            <div style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.5, marginBottom: 22 }}>
              This removes the chat from your list. The conversation still exists for the other person.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPendingDeleteContact(null)} style={{ flex: 1, padding: 12, borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  const c = pendingDeleteContact
                  const filtered = useContactStore.getState().contacts.filter(x => x.id !== c.id)
                  useContactStore.getState().setContacts(filtered)
                  useUIStore.getState().setComponentState('feedContacts', filtered)
                  if (user?.id) cacheContacts(user.id, filtered)
                  setPendingDeleteContact(null)
                }}
                style={{ flex: 1, padding: 12, borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <GenUIPanel isOpen={showGenUI} {...genuiPanelProps} />
    </div>
  )
}

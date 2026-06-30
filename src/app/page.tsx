'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { preloadGenUI } from '@/lib/renderify'
import { ArrowLeft, Search, Plus, MessageSquare, Users, User, LayoutGrid, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useContactStore } from '@/stores/contactStore'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { ContactList } from '@/components/ContactList'
import { ChatScreen } from '@/components/ChatScreen'
import { EmptyState } from '@/components/EmptyState'
import { SearchBar } from '@/components/SearchBar'
import GenUIPanel from '@/components/GenUIPanel'
import { GenUIReveal } from '@/components/GenUIReveal'
import { callGenUIForUpdate } from '@/lib/genuiClient'
import { useVolumeKeyTrigger } from '@/hooks/useVolumeKeyTrigger'
import { useAppRealtime } from '@/hooks/useAppRealtime'
import { loadFontsFromMutation, loadGoogleFont } from '@/lib/fontLoader'
import type { Contact } from '@/types'
import { Pin, BellOff, Archive, ArchiveRestore, Trash2 as Trash, ChevronRight, ChevronLeft } from 'lucide-react'
import { registerServiceWorker, subscribeToPush } from '@/lib/pushNotifications'
import { registerNativePush } from '@/lib/nativePush'
import { loadGenUIFromServer, saveGenUIToServer, saveVersionToServer } from '@/lib/genuiSync'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { useNetworkStore } from '@/stores/networkStore'
import { AuthScreen } from '@/components/AuthScreen'
import { supabase } from '@/lib/supabase'
import { loadConversations } from '@/lib/loadConversations'
import { cacheContacts, getCachedContacts, getCachedMessagesPage, getCachedCommunityList, getCachedReactions } from '@/lib/offlineCache'
import { dmMirror, reactionMirror } from '@/lib/messageMirror'
import { warmMediaMirror } from '@/lib/mediaCache'
import { subscribeDb, topics } from '@/lib/dbEvents'
import { initLocalDb, isNativeSqliteActive, isUsingFallback, onInitProgress, getInitDiagnostics } from '@/lib/localDb'
import { warmIconsFromSources } from '@/lib/iconLoader'
import { ProfileScreen } from '@/components/ProfileScreen'
import { ContactProfileScreen } from '@/components/ContactProfileScreen'
import { CommunityListScreen } from '@/components/CommunityListScreen'
import { CreateCommunityScreen } from '@/components/CreateCommunityScreen'
import { CommunityChatScreen } from '@/components/CommunityChatScreen'
import { DiscoverScreen } from '@/components/DiscoverScreen'
import { CommunityProfileScreen } from '@/components/CommunityProfileScreen'
import { ProfileImage } from '@/components/ProfileImage'
import { SettingsScreen } from '@/components/SettingsScreen'
import { DataSyncScreen } from '@/components/DataSyncScreen'
import { LaunchSplash } from '@/components/LaunchSplash'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'

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
  const [mediaWarmingStatus, setMediaWarmingStatus] = useState<'idle' | 'warming' | 'done'>('idle')
  const [hasInitiallyWarmed, setHasInitiallyWarmed] = useState(false)
  const [activeChatUser, setActiveChatUser] = useState<any>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [contactProfileUser, setContactProfileUser] = useState<any>(null)
  const [showCommunityList, setShowCommunityList] = useState(false)
  const [showCreateCommunity, setShowCreateCommunity] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
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

  // Kept-alive cache states for non-DM overlays. DM chats are keyed per contact so
  // send/header/message state cannot bleed between conversations.
  const [cachedContactProfileUser, setCachedContactProfileUser] = useState<any>(null)
  if (contactProfileUser && cachedContactProfileUser?.id !== contactProfileUser.id) setCachedContactProfileUser(contactProfileUser)

  const [cachedCommunity, setCachedCommunity] = useState<any>(null)
  if (activeCommunity && cachedCommunity?.id !== activeCommunity.id) setCachedCommunity(activeCommunity)

  const [cachedCommunityProfile, setCachedCommunityProfile] = useState<any>(null)
  if (activeCommunityProfile && cachedCommunityProfile?.id !== activeCommunityProfile.id) setCachedCommunityProfile(activeCommunityProfile)

  const [cachedCreateCommunity, setCachedCreateCommunity] = useState(false)
  if (showCreateCommunity && !cachedCreateCommunity) setCachedCreateCommunity(true)

  const [cachedDiscover, setCachedDiscover] = useState(false)
  if (showDiscover && !cachedDiscover) setCachedDiscover(true)

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

  const [dbStatus, setDbStatus] = useState<'initializing' | 'ready' | 'failed'>('initializing')
  const [dbStep, setDbStep] = useState('Starting...')
  const [dbDiag, setDbDiag] = useState<ReturnType<typeof getInitDiagnostics> | null>(null)

  // initialize local DB then auth on mount
  useEffect(() => {
    onInitProgress(setDbStep)
    initLocalDb().then(() => {
      const diag = getInitDiagnostics()
      setDbDiag(diag)
      setDbStep(diag.lastStep)
      if (diag.sqliteActive || diag.usingFallback) setDbStatus('ready')
      else setDbStatus('failed')
    }).finally(() => useAuthStore.getState().initialize())
  }, [])

  const { isAuthenticated, isLoading: authLoading, user, profile, privateKey, needsInitialSync, clearNeedsInitialSync } = useAuthStore()
  const { isOnline, setOnline } = useNetworkStore()

  // App-level realtime: one channel handles DM INSERT + reaction changes for all
  // conversations. Replaces the per-screen INSERT listeners in ChatScreen.
  useAppRealtime()

  // Track online/offline state globally.
  // On native Android/iOS we use the Capacitor Network plugin which reads from
  // the OS ConnectivityManager — reliable even when navigator.onLine lies (e.g.
  // WiFi connected to a router that has no upstream internet). On web we fall
  // back to the standard browser events.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let listenerHandle: { remove: () => void } | null = null
      ;(async () => {
        // Correct the initial value immediately with real OS status.
        const status = await Network.getStatus()
        setOnline(status.connected)
        // Subscribe to future changes.
        listenerHandle = await Network.addListener('networkStatusChange', (s) => setOnline(s.connected))
      })()
      return () => { listenerHandle?.remove() }
    }
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [setOnline])

  // Navigate to the correct chat/community when the user taps a push notification.
  // nativePush.ts dispatches this custom event with { type, conversationId, communityId }.
  useEffect(() => {
    if (!isAuthenticated) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; conversationId?: string; communityId?: string }>).detail ?? {}
      const { type, conversationId, communityId } = detail
      if ((type === 'dm' || type === 'reaction') && conversationId) {
        const contact = useContactStore.getState().contacts.find(c => c.conversationId === conversationId)
        if (contact?.rawProfile) setActiveChatUser(contact.rawProfile)
      } else if (type === 'community' && communityId) {
        supabase.from('communities').select('*').eq('id', communityId).maybeSingle().then(({ data }) => {
          if (data) setActiveCommunity(data)
        })
      }
    }
    window.addEventListener('push-notification-tap', handler)
    return () => window.removeEventListener('push-notification-tap', handler)
  }, [isAuthenticated])

  const [showGenUI, setShowGenUI] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genUIError, setGenUIError] = useState<string | null>(null)
  const [showReveal, setShowReveal] = useState(false)
  const [genuiSynced, setGenuiSynced] = useState(false)

  const [longPressedContact, setLongPressedContact] = useState<Contact | null>(null)
  const customComponents = useUIStore(state => state.customComponents)
  const componentSources = useUIStore(state => state.componentSources)

  // Warm GenUI icons into the offline cache while online, so the back/send/etc. icons
  // render with no network once offline (they're fetched from unpkg on first use).
  useEffect(() => {
    if (isOnline && componentSources) warmIconsFromSources(componentSources)
  }, [isOnline, componentSources])

  // Pre-warm the heavily used GenUI components silently in the background
  useEffect(() => {
    if (componentSources) {
      preloadGenUI([
        componentSources.chatScreen,
        componentSources.discover,
        componentSources.communityChat,
        componentSources.communityProfile,
        componentSources.contactProfile,
        componentSources.createCommunity,
        componentSources.bottomSheet,
      ])
    }
  }, [componentSources])

  const bottomSheetSource = componentSources?.bottomSheet

  const contacts = useContactStore(state => state.contacts)
  const selectedContactId = useContactStore(state => state.selectedContactId)
  const setSelectedContactId = useContactStore(state => state.setSelectedContactId)
  const getSelectedContact = useContactStore(state => state.getSelectedContact)
  const selectedContact = getSelectedContact()
  const onlineUserIds = useContactStore(state => state.onlineUserIds)

  const canUndoUI = useUIStore(state => state.history.length > 0)
  const genuiVersions = useUIStore(state => state.versions)
  const genuiActiveVersionId = useUIStore(state => state.activeVersionId)
  const genuiOwnerUserId = useUIStore(state => state.ownerUserId)
  const homeLayoutOrder = useUIStore(state => (state.componentState as any)?.['homeLayout.order']) as string[] | undefined
  const genUIEnabled = useNavStore(state => state.isGenUIEnabled())
  const navScreen = useNavStore(state => state.stack[state.stack.length - 1]?.name)
  const navigateTo = useNavStore(state => state.navigateTo)
  const replaceNav = useNavStore(state => state.replace)

  useEffect(() => {
    if (isAuthenticated && profile?.public_key && navScreen === 'auth') {
      replaceNav('home')
    }
  }, [isAuthenticated, profile?.public_key, navScreen, replaceNav])

  // load conversations on mount and when returning from chat
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated || !user?.id || activeChatUser) return

    // Cached contacts already render via the local-first effect below; this only
    // refreshes the DB from the network.
    if (!isOnline) { setLoadingContacts(false); return } // offline: cached contacts are enough

    const [conversations, unreadRes, blocksRes] = await Promise.all([
      loadConversations(user.id, privateKey ?? null),
      supabase.rpc('get_dm_unread_counts'),
      supabase.from('blocks').select('blocked_id')
    ])

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
        conversationId: c.conversationId,
        rawProfile: c.otherProfile
      }
    })
    // Write fresh contacts to the DB → emit → the local-first effect re-renders.
    // Guard against wiping the cache on a transient empty/error result.
    if (user?.id && mappedContacts.length) {
      await cacheContacts(user.id, mappedContacts)
    }
    setLoadingContacts(false)
  }, [isAuthenticated, user, privateKey, activeChatUser, isOnline])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Load archived/pinned/muted prefs as soon as the user is known
  useEffect(() => {
    if (!user?.id) return
    try {
      const arch: string[] = JSON.parse(localStorage.getItem(`spigens_archived_${user.id}`) || '[]')
      setArchivedIds(new Set(arch))
      const pinned: string[] = JSON.parse(localStorage.getItem(`spigens_pinned_${user.id}`) || '[]')
      setPinnedIds(new Set(pinned))
      const muted: string[] = JSON.parse(localStorage.getItem(`spigens_muted_${user.id}`) || '[]')
      setMutedIds(new Set(muted))
    } catch {}
  }, [user?.id])

  // LOCAL-FIRST contacts — the home feed renders from SQLite. Read on mount and
  // re-read whenever a write announces a change (live presence is overlaid on top,
  // since online/offline is ephemeral and not part of the durable DB row).
  useEffect(() => {
    if (!user?.id) return
    let active = true
    const reload = async () => {
      const cached = await getCachedContacts(user.id)
      if (!active || !cached) return
      const online = useContactStore.getState().onlineUserIds
      const withPresence = cached.map((c: any) => ({ ...c, isOnline: online.has(c.id) }))
      useContactStore.getState().setContacts(withPresence)
      useUIStore.getState().setComponentState('feedContacts', withPresence)
      // Pre-warm the DM message mirror so opening any chat is instant — even the
      // first open after a cold start (the mirror is empty until this runs).
      for (const c of cached) {
        if (c.conversationId) {
            getCachedMessagesPage(c.conversationId, { limit: 50 }).then(m => { if (m) dmMirror.set(c.id, m) }).catch(() => {})
          getCachedReactions(c.conversationId).then(r => { if (r) reactionMirror.set(c.conversationId, r) }).catch(() => {})
        }
      }
      // Pre-warm community avatars into the media mirror so community photos resolve
      // to their on-device file the moment the Communities tab/profile opens.
      if (user?.id) {
        setMediaWarmingStatus('warming')
        try {
          const list = await getCachedCommunityList(user.id)
          const avatarUrls = []
          if (list) avatarUrls.push(...list.map((c: any) => c.avatar_url))
          for (const c of cached) if (c.avatarUrl) avatarUrls.push(c.avatarUrl)
          await warmMediaMirror(avatarUrls)
        } catch {
          // ignore
        } finally {
          setMediaWarmingStatus('done')
          setHasInitiallyWarmed(true)
        }
      } else {
        setMediaWarmingStatus('done')
        setHasInitiallyWarmed(true)
      }
    }
    reload()
    const unsub = subscribeDb(topics.contacts(), reload)
    return () => { active = false; unsub() }
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

    // determine current screen — activeChatUser is the real DM path; selectedContact
    // is the legacy mock-contact path. both mean "user is inside a chat right now".
    const screen = (selectedContact || activeChatUser) ? 'chat' : 'home'

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

      // apply global tile style overrides (AI may return these directly)
      const globalTile = (mutation as any).globalTile
      if (globalTile && typeof globalTile === 'object') {
        Object.entries(globalTile).forEach(([tileState, style]) => {
          if (style && typeof style === 'object') {
            uiStore.setGlobalTileStyle(tileState as any, style as any)
          }
        })
      }

      // apply per-contact style overrides
      const perContact = (mutation as any).perContact
      if (perContact && typeof perContact === 'object') {
        Object.entries(perContact).forEach(([contactName, override]) => {
          if (override && typeof override === 'object') {
            uiStore.setContactOverride(contactName, override as any)
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
  }, [selectedContact, activeChatUser])

  // portal safety — only render portals after client mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    // Web push uses a service worker; native uses FCM (registered after auth below).
    if (!Capacitor.isNativePlatform()) registerServiceWorker()
  }, [])

  // Subscribe to push after auth
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    // Delay slightly so the app is visible before asking for permission.
    // Native (Android/iOS) → FCM; web/PWA → Web Push.
    const t = setTimeout(() => {
      if (Capacitor.isNativePlatform()) registerNativePush(user.id)
      else subscribeToPush(user.id)
    }, 3000)
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
            { id: 'photo', label: 'Photo / Video', icon: 'image' },
            { id: 'document', label: 'Document', icon: 'file-text' },
            { id: 'audio', label: 'Audio', icon: 'music' },
            { id: 'voice', label: 'Voice Note', icon: 'mic' },
            { id: 'spigens-contact', label: 'Contact', icon: 'user-round' },
          ],
        },
      },
      longPress: {
        popup: {
          title: 'chat options',
          options: [
            { id: 'mute', label: 'mute notifications', icon: 'bell-off' },
            { id: 'pin', label: 'pin to top', icon: 'pin' },
            { id: 'archive', label: 'archive chat', icon: 'archive' },
            { id: 'delete', label: 'delete chat', icon: 'trash-2', destructive: true },
          ],
        },
      },
    })
  }, [])

  const handleSearchClose = useCallback(() => setShowSearch(false), [])

  const openChat = useCallback((contactId: string) => {
    const c = useContactStore.getState().contacts.find(x => x.id === contactId)
    if (c?.rawProfile) setActiveChatUser(c.rawProfile)
    else setSelectedContactId(contactId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openLongPressSheet = useCallback((contactId: string) => {
    const contact = useContactStore.getState().contacts.find(c => c.id === contactId)
    if (contact) setLongPressedContact(contact)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // single scope object shared by all four home-screen GenUI slots
  const homeGlobalScope = useMemo(() => {
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

    return {
      useComponentState,

      // navigation
      openChat: (contactId: string) => {
        const c = useContactStore.getState().contacts.find(x => x.id === contactId)
        if (c?.rawProfile) setActiveChatUser(c.rawProfile)
        else setSelectedContactId(contactId)
      },
      openLongPressSheet: (contactId: string) => {
        const contact = useContactStore.getState().contacts.find(c => c.id === contactId)
        if (contact) setLongPressedContact(contact)
      },
      openCommunity: (community: any) => setActiveCommunity(community),
      openCommunityProfile: (community: any) => setActiveCommunityProfile(community),
      openContactProfile: (contact: any) => setContactProfileUser({
        id: contact.id,
        display_name: contact.display_name || contact.name || contact.username || '',
        username: contact.username || null,
        avatar_url: contact.avatar_url || contact.avatarUrl || null,
      } as any),
      openProfile: () => setShowProfile(true),
      openSettings: () => setShowSettings(true),
      openDiscover: () => setShowDiscover(true),
      openCreateCommunity: () => setShowCreateCommunity(true),

      // search
      openSearch: () => setShowSearch(true),
      closeSearch: () => { setShowSearch(false); useUIStore.getState().setComponentState('searchQuery', '') },
      toggleSearch: () => setShowSearch(prev => !prev),

      // tab navigation
      setTab: (id: string) => {
        setActiveTab(id as 'chats' | 'communities' | 'profile')
        setShowSearch(false)
        useUIStore.getState().setComponentState('searchQuery', '')
      },

      // data access
      getContacts: () => useContactStore.getState().contacts,
      getCommunities: () => (useUIStore.getState().componentState as any)?.communityList ?? [],

      // signed-in user identity
      myUserId: user?.id ?? null,
      myAvatarUrl: profile?.avatar_url ?? null,
      myAvatarInitials: (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase(),
      myDisplayName: profile?.display_name || profile?.username || '',
      myUsername: profile?.username || '',

      // tab definitions — AI can read/extend to build any navigation
      tabs: [
        { id: 'chats', label: 'Chats', icon: 'message-square' },
        { id: 'communities', label: 'Communities', icon: 'users' },
        { id: 'profile', label: 'Profile', icon: 'user' },
      ],

      // aliases kept for backward compat with previously AI-generated code
      onSearchTap: () => setShowSearch(s => !s),
      onCreateCommunity: () => setShowCreateCommunity(true),
      onClose: () => { setShowSearch(false); useUIStore.getState().setComponentState('searchQuery', '') },
      onSelectTab: (id: string) => {
        setActiveTab(id as 'chats' | 'communities' | 'profile')
        setShowSearch(false)
        useUIStore.getState().setComponentState('searchQuery', '')
      },
      onPlus: () => setShowDiscover(true),

      // account
      logout: () => useAuthStore.getState().signOut(),

      // UI components available in generated code
      ProfileImage,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user?.id])

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
  if (authLoading || dbStatus === 'failed') return <LaunchSplash dbStatus={dbStatus} dbStep={dbStep} dbDiag={dbDiag} mediaStatus={mediaWarmingStatus} />

  // auth screen — locked from GenUI entirely
  if (!isAuthenticated) return <AuthScreen />

  // Post-login data sync — one full download after sign-in. Driven by the auth store's
  // needsInitialSync (set on sign-in / profile creation). DataSyncScreen writes a durable
  // per-user "done" marker when it finishes, so an interrupted first sync resumes on the
  // next launch instead of being skipped, and a completed one never re-blocks the user.
  if (needsInitialSync && user?.id) {
    return (
      <DataSyncScreen
        userId={user.id}
        privateKey={privateKey}
        isOnline={isOnline}
        onDone={() => clearNeedsInitialSync()}
      />
    )
  }

  // Gate the home UI so the DEFAULT (un-customized) UI never flashes before this
  // account's saved design loads. Rules:
  //  - local cache belongs to THIS user and has versions -> show instantly (works offline)
  //  - offline                                           -> show whatever the cache restored
  //  - fresh device / different account / no cache, online -> wait for the server fetch
  const cacheMatchesUser = genuiOwnerUserId != null && genuiOwnerUserId === user?.id
  const waitingForGenUI = isOnline && !genuiSynced && (genuiVersions.length === 0 || !cacheMatchesUser)
  if (!hydrated || waitingForGenUI || !hasInitiallyWarmed) return <LaunchSplash dbStatus={dbStatus} dbStep={dbStep} dbDiag={dbDiag} mediaStatus={hasInitiallyWarmed ? 'done' : mediaWarmingStatus} />

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />
  }

  // --- chat screen ---
  // DM chats use the old direct full-screen path. This avoids the overlay's blank
  // background appearing before the GenUI chat tree is ready, while ChatScreen still
  // owns the per-conversation state isolation fixes.
  if (activeChatUser) {
    return (
      <>
        <ChatScreen
          key={activeChatUser.id}
          otherUserId={activeChatUser.id}
          otherUserPublicKey={activeChatUser.public_key}
          contactName={activeChatUser.display_name || activeChatUser.username}
          avatarUrl={activeChatUser.avatar_url}
          contactInitials={(activeChatUser.display_name || activeChatUser.username || '?')[0].toUpperCase()}
          isOnline={onlineUserIds.has(activeChatUser.id)}
          lastSeen={activeChatUser.last_seen}
          onBack={() => { setActiveChatUser(null); if (returnToProfile) { setActiveCommunityProfile(returnToProfile); setReturnToProfile(null); } else if (returnToCommunity) { setActiveCommunity(returnToCommunity); setReturnToCommunity(null); } }}
          onViewContactProfile={() => setContactProfileUser(activeChatUser)}
          onOpenUserProfile={(user) => setContactProfileUser({
            id: user.id,
            display_name: user.display_name || user.username || '',
            username: user.username || '',
            avatar_url: user.avatar_url || null,
          } as any)}
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
          key={selectedContact.id}
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

  const isOverlayActive = activeCommunityProfile || activeCommunity || showCreateCommunity || showDiscover || contactProfileUser;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#0A0A0A' }}>
      
      {/* Home Feed Base (Kept mounted to preserve state/scroll, hidden if overlay is active to save rendering) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, display: isOverlayActive ? 'none' : 'flex', flexDirection: 'column', background: '#0A0A0A', overflow: 'hidden' }}>
      {/* Top header — editable via GenUI (componentSources.homeHeader) */}
      <RenderifyHost code={componentSources?.homeHeader ?? null} storeActions={homeGlobalScope} />

      {/* Search bar — editable via GenUI (componentSources.homeSearch) */}
      {showSearch && (
        <RenderifyHost code={componentSources?.homeSearch ?? null} storeActions={homeGlobalScope} />
      )}

      {/* GenUI home-top zone — e.g. community icon rows, pinned shortcuts */}
      <RenderifyHost code={customComponents?.['home-top'] ?? null} storeActions={homeGlobalScope} />

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
            openChat: (contactId: string) => openChat(contactId),
            openLongPressSheet: (contactId: string) => openLongPressSheet(contactId),
            onContactSelect: (contact: Contact) => openChat(contact.id),
            onTileLongPress: (contact: Contact) => openLongPressSheet(contact.id),
            onContactAvatarTap: (contact: any) => setContactProfileUser({ id: contact.id, display_name: contact.name, username: contact.username || null, avatar_url: contact.avatarUrl || null }),
          }
          const archivedHandlers = {
            openChat: (contactId: string) => {
              const c = archivedContactsList.find(x => x.id === contactId)
              if ((c as any)?.rawProfile) setActiveChatUser((c as any).rawProfile)
              else setSelectedContactId(contactId)
            },
            openLongPressSheet: (contactId: string) => {
              const c = archivedContactsList.find(x => x.id === contactId)
              if (c) setLongPressedArchivedContact(c)
            },
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

      {/* GenUI home-bottom zone — e.g. content below the list, above the nav bar */}
      <RenderifyHost code={customComponents?.['home-bottom'] ?? null} storeActions={homeGlobalScope} />

      {/* Bottom navbar — editable via GenUI (componentSources.bottomNav) */}
      <RenderifyHost code={componentSources?.bottomNav ?? null} storeActions={homeGlobalScope} />

      {/* GenUI floating zone — fixed overlays e.g. compose FAB, banners */}
      <RenderifyHost code={customComponents?.['floating'] ?? null} storeActions={homeGlobalScope} />

      {/* Portals + GenUI */}
      {longPressedContact !== null && mounted && createPortal(
        <RenderifyHost
          code={bottomSheetSource ?? null}
          storeActions={{
            sheetId: 'longPressSheet',
            title: 'chat options',
            options: [
              { id: 'mute', label: 'mute notifications', icon: 'bell-off' },
              { id: 'pin', label: 'pin to top', icon: 'pin' },
              { id: 'archive', label: 'archive chat', icon: 'archive' },
              { id: 'delete', label: 'delete chat', icon: 'trash-2', destructive: true },
            ],
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
                if (user?.id) void cacheContacts(user.id, sorted) // persist order → emit → local-first re-read

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
                  if (user?.id) void cacheContacts(user.id, filtered) // emit → local-first re-read updates the list
                  setPendingDeleteContact(null)
                }}
                style={{ flex: 1, padding: 12, borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <GenUIPanel isOpen={showGenUI && !isOverlayActive} {...genuiPanelProps} />
      </div>

      {/* Slide-in Overlays using Framer Motion (Kept-Alive Navigation Stack) */}
      <>
        <motion.div initial={{ x: '100%' }} animate={{ x: activeCommunityProfile ? 0 : '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 260 }} style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#0A0A0A', pointerEvents: activeCommunityProfile ? 'auto' : 'none' }}>
          {cachedCommunityProfile && (
            <CommunityProfileScreen
              communityId={cachedCommunityProfile.id}
              communityName={cachedCommunityProfile.name}
              communityType={cachedCommunityProfile.type}
              communityDescription={cachedCommunityProfile.description}
              communityAvatarUrl={cachedCommunityProfile.avatar_url}
              memberCount={cachedCommunityProfile.member_count}
              inviteMessageId={cachedCommunityProfile._inviteMessageId || undefined}
              userRole={cachedCommunityProfile.userRole}
              isMember={cachedCommunityProfile.isMember ?? false}
              onBack={() => setActiveCommunityProfile(null)}
              onLeaveAndExit={() => { setActiveCommunityProfile(null); setActiveCommunity(null) }}
              onCommunityDeleted={() => { setActiveCommunityProfile(null); setActiveCommunity(null) }}
              onStartDMWithUser={(userId, displayName, username, avatarUrl) => {
                setReturnToProfile(cachedCommunityProfile)
                setActiveCommunityProfile(null)
                setActiveCommunity(null)
                setShowCommunityList(false)
                setActiveChatUser({ id: userId, display_name: displayName, username, avatar_url: avatarUrl })
              }}
              onViewMemberProfile={(userId, displayName, username, avatarUrl) => {
                setContactProfileUser({ id: userId, display_name: displayName, username, avatar_url: avatarUrl })
              }}
            />
          )}
        </motion.div>

        <motion.div initial={{ x: '100%' }} animate={{ x: activeCommunity ? 0 : '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 260 }} style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#0A0A0A', pointerEvents: activeCommunity ? 'auto' : 'none' }}>
          {cachedCommunity && (
            <CommunityChatScreen
              communityId={cachedCommunity.id}
              communityName={cachedCommunity.name}
              communityType={cachedCommunity.type}
              isMember={cachedCommunity.isMember ?? false}
              userRole={cachedCommunity.userRole}
              memberCount={cachedCommunity.member_count || 0}
              onBack={() => setActiveCommunity(null)}
              onViewCommunityProfile={() => setActiveCommunityProfile(cachedCommunity)}
              onSenderTap={(userId: string, name: string, avatarUrl: string | null) => {
                setReturnToCommunity(cachedCommunity)
                setActiveCommunity(null)
                setActiveChatUser({ id: userId, display_name: name, avatar_url: avatarUrl })
              }}
              communityAvatarUrl={cachedCommunity.avatar_url ?? null}
            />
          )}
        </motion.div>

        <motion.div initial={{ y: '100%' }} animate={{ y: showCreateCommunity ? 0 : '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 260 }} style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#0A0A0A', pointerEvents: showCreateCommunity ? 'auto' : 'none' }}>
          {cachedCreateCommunity && (
            <CreateCommunityScreen
              onBack={() => setShowCreateCommunity(false)}
              onCreated={(community) => { setShowCreateCommunity(false); setActiveCommunity(community) }}
            />
          )}
        </motion.div>

        <motion.div initial={{ x: '100%' }} animate={{ x: showDiscover ? 0 : '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 260 }} style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#0A0A0A', pointerEvents: showDiscover ? 'auto' : 'none' }}>
          {cachedDiscover && (
            <DiscoverScreen
              onBack={() => setShowDiscover(false)}
              onOpenChat={(u) => { setShowDiscover(false); setActiveChatUser(u) }}
            />
          )}
        </motion.div>

        <motion.div initial={{ x: '100%' }} animate={{ x: contactProfileUser ? 0 : '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 260 }} style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#0A0A0A', pointerEvents: contactProfileUser ? 'auto' : 'none' }}>
          {cachedContactProfileUser && (
            <ContactProfileScreen
              userId={cachedContactProfileUser.id}
              displayName={cachedContactProfileUser.display_name || cachedContactProfileUser.username}
              username={cachedContactProfileUser.username}
              avatarUrl={cachedContactProfileUser.avatar_url}
              onBack={() => setContactProfileUser(null)}
              onBlocked={() => { setContactProfileUser(null); fetchConversations() }}
              onStartChat={() => { const u = cachedContactProfileUser; setContactProfileUser(null); setActiveChatUser(u) }}
              onOpenCommunity={(communityId: string, name: string, type: string, memberCount: number, avatarUrl: string | null) => {
                setContactProfileUser(null)
                setActiveCommunityProfile(null)
                setReturnToProfile(null)
                setActiveCommunity({ id: communityId, name, type, member_count: memberCount, avatar_url: avatarUrl, isMember: true, userRole: 'member' })
                setShowCommunityList(false)
              }}
            />
          )}
        </motion.div>

      </>
    </div>
  )
}

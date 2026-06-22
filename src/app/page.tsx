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

  const searchQuery = useUIStore(state => state.componentState?.['searchQuery'] as string | undefined) || ''

  useEffect(() => {
    const unsubFinish = useUIStore.persist.onFinishHydration(() => setHydrated(true))
    if (useUIStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return () => {
      unsubFinish()
    }
  }, [])

  useEffect(() => {
    useAuthStore.getState().initialize()
  }, [])

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

  const { isAuthenticated, isLoading: authLoading, user, profile, privateKey } = useAuthStore()
  const { isOnline, setOnline } = useNetworkStore()
  const genUIEnabled = useNavStore(state => state.isGenUIEnabled())
  const navScreen = useNavStore(state => state.screen)
  const navigateTo = useNavStore(state => state.navigateTo)

  useEffect(() => {
    if (isAuthenticated && profile?.public_key && navScreen === 'auth') {
      navigateTo('home')
    }
  }, [isAuthenticated, profile?.public_key, navScreen, navigateTo])

  const fetchConversations = useCallback(() => {
    if (!isAuthenticated || !user?.id || activeChatUser) return

    if (user?.id) {
      const cached = getCachedContacts(user.id) as Contact[] | null
      if (cached?.length) {
        useContactStore.getState().setContacts(cached)
        useUIStore.getState().setComponentState('feedContacts', cached)
      }
    }

    if (!isOnline) return

    Promise.all([
      loadConversations(user.id, privateKey ?? null),
      supabase.rpc('get_dm_unread_counts'),
      supabase.from('blocks').select('blocked_id')
    ]).then(([conversations, unreadRes, blocksRes]) => {
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
      if (user?.id) cacheContacts(user.id, mappedContacts)
    })
  }, [isAuthenticated, user, privateKey, activeChatUser, isOnline])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

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

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    const markDelivered = () => {
      supabase.rpc('mark_messages_delivered', { p_user_id: user.id }).then()
    }

    markDelivered()

    const onVisible = () => {
      if (document.visibilityState === 'visible') markDelivered()
    }
    document.addEventListener('visibilitychange', onVisible)

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

    const screen = selectedContact ? 'chat' : 'home'

    try {
      const mutation = await callGenUIForUpdate({
        message,
        screen,
        storeState,
        contactNames,
      })

      useUIStore.getState().pushHistory()

      loadFontsFromMutation(mutation)

      if (mutation.customComponents) {
        Object.values(mutation.customComponents).forEach(code => {
          if (typeof code === 'string') {
            const matches = code.match(/fontFamily:\s*['"]([^'"]+)['"]/g)
            matches?.forEach(m => {
              const font = m.match(/['"]([^'"]+)['"]/)?.[ 1]
              if (font) loadGoogleFont(font)
            })
          }
        })
      }

      const uiStore = useUIStore.getState()

      if (mutation.layoutConfig?.searchBar) {
        uiStore.setSearchBarConfig(mutation.layoutConfig.searchBar)
      }

      if (mutation.contactListStyle) {
        uiStore.setContactListStyle(mutation.contactListStyle)
      }

      if (mutation.behaviorConfig) {
        uiStore.setBehaviorConfig(mutation.behaviorConfig)
      }

      if (mutation.interactions) {
        uiStore.setInteractions(mutation.interactions)
      }

      if (mutation.customComponents) {
        Object.entries(mutation.customComponents).forEach(([zone, code]) => {
          uiStore.setCustomComponent(zone, code)
        })
      }

      if (mutation.componentSources) {
        Object.entries(mutation.componentSources).forEach(([name, source]) => {
          if (typeof source === 'string') {
            uiStore.setComponentSource(name, source)
          }
        })
      }

      if (mutation.componentSources) {
        Object.values(mutation.componentSources).forEach(source => {
          if (typeof source === 'string') {
            const fontMatches = source.match(/fontFamily:\s*['"]([^'"]+)['"]/g)
            fontMatches?.forEach(m => {
              const font = m.match(/['"]([^'"]+)['"]/)?.[ 1]
              if (font) loadGoogleFont(font)
            })
          }
        })
      }

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
  }), [])

  const topBarScope = useMemo(() => {
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
  }, [profile])

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
  }, [])

  if (authLoading) return (
    <div style={{ height: '100vh', width: '100%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-1px' }}>spigen</div>
    </div>
  )

  if (!isAuthenticated) return <AuthScreen />

  if (!hydrated) {
    return <div className="h-screen w-full bg-[#0a0a0a]" />
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
          setSelectedContactId(contactId)
        }
      }
    },
    openLongPressSheet: () => {
      const contact = useContactStore.getState().contacts.find(c => c.id === contactId)
      if (contact) setLongPressedContact(contact)
    },
    openAttachSheet: () => {},
    toggleSearch: () => setShowSearch(prev => !prev),
    navigateBack: () => {
      setActiveChatUser(null)
      setSelectedContactId(null)
    },
  })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0A0A0A', overflow: 'hidden' }}>
      {!isOnline && (
        <div style={{ background: '#1a1a1a', borderBottom: '1px solid #333', padding: '6px 16px', textAlign: 'center', fontSize: '12px', color: '#888', letterSpacing: '0.3px', flexShrink: 0 }}>
          No internet connection · showing cached messages
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '0 16px', minHeight: '60px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0, gap: '12px' }}>
        <img src="/spigens_logo.png" alt="Spigen" style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: '20px', fontWeight: '700', color: '#F3F4F6' }}>
          {activeTab === 'chats' ? 'Chats' : activeTab === 'communities' ? 'Communities' : 'Profile'}
        </div>
        {activeTab !== 'profile' && (
          <button
            onClick={() => setShowSearch(s => !s)}
            style={{ background: 'none', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: showSearch ? '#2563EB' : 'rgba(255,255,255,0.6)', flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </button>
        )}
        {activeTab === 'communities' && (
          <button
            onClick={() => setShowCreateCommunity(true)}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563EB', border: 'none', color: '#FFF', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >+</button>
        )}
      </div>

      {showSearch && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 }}>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => useUIStore.getState().setComponentState('searchQuery', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); useUIStore.getState().setComponentState('searchQuery', '') } }}
            placeholder={activeTab === 'communities' ? 'Search communities...' : 'Search chats...'}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '9px 16px', fontSize: '14px', color: '#E8E8E8', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
          />
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'chats' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {searchQuery.trim().length >= 2 ? (
              <UserSearchResults
                searchQuery={searchQuery}
                onSelectUser={(u: any) => { setActiveChatUser(u); useUIStore.getState().setComponentState('searchQuery', ''); setShowSearch(false) }}
                onAvatarTap={(u: any) => setContactProfileUser({ id: u.id, display_name: u.display_name, username: u.username, avatar_url: u.avatar_url })}
              />
            ) : contacts.length === 0 ? (
              <EmptyState />
            ) : (
              <ContactList
                onContactSelect={(contact) => dispatchAction(interactions?.tileTap, buildHandlers(contact.id))}
                onTileLongPress={(contact) => dispatchAction(interactions?.tileLongPress, buildHandlers(contact.id))}
                onContactAvatarTap={(contact: any) => setContactProfileUser({ id: contact.id, display_name: contact.name, username: contact.username || null, avatar_url: contact.avatarUrl || null })}
              />
            )}
          </div>
        )}

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

      <div style={{ flexShrink: 0, background: '#141414', borderTop: '1px solid #1F1F1F', display: 'flex', flexDirection: 'row', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
        {([
          { id: 'chats' as const, label: 'Chats', path: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
          { id: 'communities' as const, label: 'Communities', path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
          { id: 'profile' as const, label: 'Profile', path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
        ]).map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowSearch(false); useUIStore.getState().setComponentState('searchQuery', '') }}
              style={{ flex: 1, padding: '10px 0 6px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', WebkitTapHighlightColor: 'transparent' as any, userSelect: 'none' as any }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isActive ? '#2563EB' : 'rgba(255,255,255,0.4)'}>
                <path d={tab.path} />
              </svg>
              <span style={{ fontSize: '10px', fontWeight: isActive ? '700' : '500', color: isActive ? '#2563EB' : 'rgba(255,255,255,0.4)', letterSpacing: '0.1px' }}>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {longPressConfig && longPressedContact !== null && mounted && createPortal(
        <RenderifyHost
          code={bottomSheetSource ?? null}
          storeActions={{
            sheetId: 'longPressSheet',
            title: longPressConfig.popup.title,
            options: longPressConfig.popup.options,
            onClose: () => setLongPressedContact(null),
            onOptionSelect: (option: any) => { console.log(`${option.label} on ${longPressedContact?.name}`); setLongPressedContact(null) },
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
    </div>
  )
}

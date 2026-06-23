import React from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { capacitorStorage } from '@/lib/persistStorage'
import type { UIOverrideState, ContactStyleOverride, MessageConditionRule, SearchBarLayoutConfig, BehaviorConfig, SearchBarStyleOverride, TopAppBarStyleOverride, ChatScreenStyleOverride, BottomSheetStyleOverride, ContactListStyleOverride, AppAction, InteractionConfig, CustomComponents, ComponentSources } from '@/types'
import { DEFAULT_HOMEHEADER_SOURCE, DEFAULT_HOMESEARCH_SOURCE, DEFAULT_BOTTOMNAV_SOURCE, DEFAULT_BOTTOMSHEET_SOURCE, DEFAULT_CHATSCREEN_SOURCE, DEFAULT_MESSAGEBUBBLE_SOURCE, DEFAULT_CONTACTLIST_SOURCE, DEFAULT_DATESEPARATOR_SOURCE, DEFAULT_COMPOSERBAR_SOURCE, DEFAULT_BACKBUTTON_SOURCE, DEFAULT_PROFILEIMAGE_SOURCE, DEFAULT_CHATNAME_SOURCE, DEFAULT_ONLINESTATUS_SOURCE, DEFAULT_ATTACHBUTTON_SOURCE, DEFAULT_SENDBUTTON_SOURCE, DEFAULT_EMPTYSTATE_SOURCE, DEFAULT_MESSAGESTATUS_SOURCE, DEFAULT_TYPINGINDICATOR_SOURCE, DEFAULT_REPLYPREVIEW_SOURCE, DEFAULT_REPLYQUOTE_SOURCE, DEFAULT_MESSAGEREACTIONS_SOURCE, DEFAULT_REACTIONPICKER_SOURCE, DEFAULT_PROFILESCREEN_SOURCE, DEFAULT_CONTACTPROFILESCREEN_SOURCE, DEFAULT_COMMUNITYMESSAGEBUBBLE_SOURCE, DEFAULT_COMMUNITYLISTSCREEN_SOURCE, DEFAULT_CREATECOMMUNITYSCREEN_SOURCE, DEFAULT_COMMUNITYCHATSCREEN_SOURCE, DEFAULT_COMMUNITYPROFILESCREEN_SOURCE } from '@/lib/defaultComponents'

// local on-device cache for the GenUI design state (component sources, versions, styles).
// ON for both web and mobile: Capacitor Preferences uses native storage on device and
// falls back to localStorage in the browser, so the customized UI loads instantly on open
// and works fully offline. The Supabase server sync runs on top of this as source of truth.
export const PERSISTENCE_ENABLED = true

// noop storage: reads return null (defaults always used), writes are silent no-ops
// used when PERSISTENCE_ENABLED is false so there is no console spam
const devStorage: StateStorage = {
  getItem: (_name: string) => Promise.resolve(null),
  setItem: (_name: string, _value: string) => Promise.resolve(),
  removeItem: (_name: string) => Promise.resolve(),
}

// runtime / ephemeral componentState keys that must NOT be cached to local storage —
// these are live app data (contacts, messages, open menus, typing, search text, the active
// tab) that have to be fresh at runtime, never restored stale from disk. Contacts have their
// own offline cache (offlineCache.ts). Any OTHER key (e.g. a GenUI-authored toggle the user
// set through the panel) is design state and DOES get persisted so it survives offline.
const RUNTIME_COMPONENT_STATE_KEYS = new Set<string>([
  'feedContacts', 'chatMessages', 'activeMessageActions', 'dmDeleteTarget', 'reactionDetail',
  'openReactionMessageId', 'otherUserTyping', 'replyingTo', 'searchQuery', 'activeTab', 'showSearch',
  'profileSaveError', 'contactProfileData', 'contactMutualCommunities', 'highlightedMessageId',
  'communityDeleteTarget',
])

function filterPersistentComponentState(cs: Record<string, any> | undefined): Record<string, any> {
  if (!cs) return {}
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(cs)) {
    if (RUNTIME_COMPONENT_STATE_KEYS.has(k)) continue
    if (k.startsWith('reactions:')) continue
    out[k] = v
  }
  return out
}

// a snapshot is all persisted customization fields
type Snapshot = {
  perContact: any
  messageConditions: any
  globalTile: any
  layoutConfig: any
  behaviorConfig: any
  searchBarStyle: any
  topAppBarStyle: any
  chatScreenStyle: any
  contactListStyle: any
  bottomSheetStyles: any
  interactions: any
  customComponents: any
  componentSources: any
}

// a named, restorable point in the customization timeline
export type GenUIVersion = {
  id: string
  name: string
  createdAt: string
  snapshot: Snapshot
}

// pull the full customization snapshot out of the live store state
function captureSnapshot(state: any): Snapshot {
  return {
    perContact: state.perContact,
    messageConditions: state.messageConditions,
    globalTile: state.globalTile,
    layoutConfig: state.layoutConfig,
    behaviorConfig: state.behaviorConfig,
    searchBarStyle: state.searchBarStyle,
    topAppBarStyle: state.topAppBarStyle,
    chatScreenStyle: state.chatScreenStyle,
    contactListStyle: state.contactListStyle,
    bottomSheetStyles: state.bottomSheetStyles,
    interactions: state.interactions,
    customComponents: state.customComponents,
    componentSources: state.componentSources,
  }
}

interface UIStoreState extends UIOverrideState {
  history: Snapshot[]
  searchBarStyle: SearchBarStyleOverride
  topAppBarStyle: TopAppBarStyleOverride
  chatScreenStyle: ChatScreenStyleOverride
  setContactOverride: (contactName: string, override: ContactStyleOverride) => void
  setMessageCondition: (rule: MessageConditionRule) => void
  removeMessageCondition: (ruleId: string) => void
  setGlobalTileStyle: (state: 'unread' | 'read', style: React.CSSProperties) => void
  setSearchBarStyle: (style: Partial<SearchBarStyleOverride>) => void
  setTopAppBarStyle: (style: Partial<TopAppBarStyleOverride>) => void
  setChatScreenStyle: (style: Partial<ChatScreenStyleOverride>) => void
  setContactListStyle: (style: Partial<ContactListStyleOverride>) => void
  setBottomSheetStyle: (sheetId: string, style: Partial<BottomSheetStyleOverride>) => void
  setSearchBarConfig: (config: Partial<SearchBarLayoutConfig>) => void
  setBehaviorConfig: (config: Partial<BehaviorConfig>) => void
  setInteraction: (key: keyof InteractionConfig, action: AppAction) => void
  setInteractions: (config: Partial<InteractionConfig>) => void
  setCustomComponent: (zone: string, code: string) => void
  clearCustomComponent: (zone: string) => void
  setComponentSource: (name: string, source: string) => void
  resetComponentSource: (name: string) => void
  resetAll: () => void
  pushHistory: () => void
  undo: () => void
  resetAllCustomizations: () => void
  canUndo: () => boolean
  componentState: Record<string, any>
  setComponentState: (key: string, value: any) => void
  // version timeline
  versions: GenUIVersion[]
  activeVersionId: string | null
  // which user the locally-cached design belongs to (guards against showing one
  // account's UI when a different account signs in on the same device)
  ownerUserId: string | null
  getSnapshot: () => Snapshot
  applySnapshot: (snapshot: Snapshot) => void
  addVersion: (name: string) => GenUIVersion
  restoreVersion: (id: string) => void
  hydrateFromServer: (snapshot: Snapshot | null, versions: GenUIVersion[], userId: string) => void
}

const defaultState = {
  perContact: {},
  messageConditions: [],
  globalTile: {},
  searchBarStyle: {},
  topAppBarStyle: {},
  chatScreenStyle: {},
  contactListStyle: {},
  bottomSheetStyles: {},
  customComponents: {},
  componentSources: {
    homeHeader: DEFAULT_HOMEHEADER_SOURCE,
    homeSearch: DEFAULT_HOMESEARCH_SOURCE,
    bottomNav: DEFAULT_BOTTOMNAV_SOURCE,
    bottomSheet: DEFAULT_BOTTOMSHEET_SOURCE,
    chatScreen: DEFAULT_CHATSCREEN_SOURCE,
    messageBubble: DEFAULT_MESSAGEBUBBLE_SOURCE,
    contactList: DEFAULT_CONTACTLIST_SOURCE,
    dateSeparator: DEFAULT_DATESEPARATOR_SOURCE,
    composerBar: DEFAULT_COMPOSERBAR_SOURCE,
    backButton: DEFAULT_BACKBUTTON_SOURCE,
    profileImage: DEFAULT_PROFILEIMAGE_SOURCE,
    chatName: DEFAULT_CHATNAME_SOURCE,
    onlineStatus: DEFAULT_ONLINESTATUS_SOURCE,
    attachButton: DEFAULT_ATTACHBUTTON_SOURCE,
    sendButton: DEFAULT_SENDBUTTON_SOURCE,
    emptyState: DEFAULT_EMPTYSTATE_SOURCE,
    messageStatus: DEFAULT_MESSAGESTATUS_SOURCE,
    typingIndicator: DEFAULT_TYPINGINDICATOR_SOURCE,
    replyPreview: DEFAULT_REPLYPREVIEW_SOURCE,
    replyQuote: DEFAULT_REPLYQUOTE_SOURCE,
    messageReactions: DEFAULT_MESSAGEREACTIONS_SOURCE,
    reactionPicker: DEFAULT_REACTIONPICKER_SOURCE,
    profileScreen: DEFAULT_PROFILESCREEN_SOURCE,
    contactProfileScreen: DEFAULT_CONTACTPROFILESCREEN_SOURCE,
    communityMessageBubble: DEFAULT_COMMUNITYMESSAGEBUBBLE_SOURCE,
    communityListScreen: DEFAULT_COMMUNITYLISTSCREEN_SOURCE,
    createCommunityScreen: DEFAULT_CREATECOMMUNITYSCREEN_SOURCE,
    communityChatScreen: DEFAULT_COMMUNITYCHATSCREEN_SOURCE,
    communityProfileScreen: DEFAULT_COMMUNITYPROFILESCREEN_SOURCE,
  },
  layoutConfig: {
    searchBar: {
      barPosition: 'top-bar' as const,
      iconPosition: 'top-bar' as const,
    }
  },
  behaviorConfig: {},
  interactions: {
    tileTap: 'open-chat' as AppAction,
    tileLongPress: 'open-longPressSheet' as AppAction,
    menuTap: 'none' as AppAction,
    searchIconTap: 'toggle-search' as AppAction,
    newChatTap: 'none' as AppAction,
    attachTap: 'open-attachSheet' as AppAction,
    backTap: 'navigate-back' as AppAction,
  },
  history: [] as Snapshot[],
  componentState: {} as Record<string, any>,
  versions: [] as GenUIVersion[],
  activeVersionId: null as string | null,
  ownerUserId: null as string | null,
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setContactOverride: (contactName, override) =>
        set((state) => {
          const existing = state.perContact[contactName] ?? {}
          const merged = { ...existing }

          // deep merge each style slot so setting one css property
          // preserves previously-set properties on the same slot
          for (const [slot, css] of Object.entries(override)) {
            merged[slot as keyof typeof merged] = {
              ...(existing[slot as keyof typeof existing] as object),
              ...(css as object),
            } as any
          }

          return {
            perContact: {
              ...state.perContact,
              [contactName]: merged,
            },
          }
        }),

      setMessageCondition: (rule) =>
        set((state) => ({
          messageConditions: [...state.messageConditions.filter(r => r.id !== rule.id), rule]
        })),

      removeMessageCondition: (ruleId) =>
        set((state) => ({
          messageConditions: state.messageConditions.filter(r => r.id !== ruleId)
        })),

      setGlobalTileStyle: (tileState, style) =>
        set((state) => ({
          globalTile: {
            ...state.globalTile,
            [tileState]: { ...state.globalTile[tileState], ...style }
          }
        })),

      setSearchBarStyle: (style) =>
        set((state) => ({
          searchBarStyle: { ...state.searchBarStyle, ...style }
        })),

      setTopAppBarStyle: (style) =>
        set((state) => ({
          topAppBarStyle: { ...state.topAppBarStyle, ...style }
        })),

      setChatScreenStyle: (style) =>
        set((state) => ({
          chatScreenStyle: { ...state.chatScreenStyle, ...style }
        })),

      setContactListStyle: (style) =>
        set((state) => ({
          contactListStyle: { ...state.contactListStyle, ...style }
        })),

      setBottomSheetStyle: (sheetId, style) =>
        set((state) => {
          const existing = state.bottomSheetStyles[sheetId] ?? {}

          // deep merge optionIconOverrides so changing one property
          // (e.g. iconStyle) does not wipe another (e.g. iconSvg)
          let mergedIconOverrides = existing.optionIconOverrides
          if (style.optionIconOverrides) {
            mergedIconOverrides = { ...existing.optionIconOverrides }
            for (const [optId, ov] of Object.entries(style.optionIconOverrides)) {
              mergedIconOverrides[optId] = {
                ...mergedIconOverrides[optId],
                ...ov,
              }
            }
          }

          return {
            bottomSheetStyles: {
              ...state.bottomSheetStyles,
              [sheetId]: {
                ...existing,
                ...style,
                ...(mergedIconOverrides ? { optionIconOverrides: mergedIconOverrides } : {}),
              },
            },
          }
        }),

      setSearchBarConfig: (config) =>
        set((state) => ({
          layoutConfig: { ...state.layoutConfig, searchBar: { ...state.layoutConfig.searchBar, ...config } }
        })),

      setBehaviorConfig: (config) =>
        set((state) => ({
          behaviorConfig: { ...state.behaviorConfig, ...config }
        })),

      setInteraction: (key, action) =>
        set((state) => ({
          interactions: { ...state.interactions, [key]: action }
        })),

      setInteractions: (config) =>
        set((state) => ({
          interactions: { ...state.interactions, ...config }
        })),

      setCustomComponent: (zone, code) =>
        set((state) => ({
          customComponents: { ...state.customComponents, [zone]: code }
        })),

      clearCustomComponent: (zone) =>
        set((state) => {
          const next = { ...state.customComponents }
          delete next[zone]
          return { customComponents: next }
        }),

      setComponentSource: (name, source) =>
        set((state) => ({
          componentSources: { ...state.componentSources, [name]: source }
        })),

      resetComponentSource: (name) =>
        set((state) => {
          const next = { ...state.componentSources }
          if (name === 'homeHeader') next[name] = DEFAULT_HOMEHEADER_SOURCE
          else if (name === 'homeSearch') next[name] = DEFAULT_HOMESEARCH_SOURCE
          else if (name === 'bottomNav') next[name] = DEFAULT_BOTTOMNAV_SOURCE
          else if (name === 'bottomSheet') next[name] = DEFAULT_BOTTOMSHEET_SOURCE
          else if (name === 'chatScreen') next[name] = DEFAULT_CHATSCREEN_SOURCE
          else if (name === 'messageBubble') next[name] = DEFAULT_MESSAGEBUBBLE_SOURCE
          else if (name === 'contactList') next[name] = DEFAULT_CONTACTLIST_SOURCE
          else if (name === 'dateSeparator') next[name] = DEFAULT_DATESEPARATOR_SOURCE
          else if (name === 'composerBar') next[name] = DEFAULT_COMPOSERBAR_SOURCE
          else if (name === 'backButton') next[name] = DEFAULT_BACKBUTTON_SOURCE
          else if (name === 'profileImage') next[name] = DEFAULT_PROFILEIMAGE_SOURCE
          else if (name === 'chatName') next[name] = DEFAULT_CHATNAME_SOURCE
          else if (name === 'onlineStatus') next[name] = DEFAULT_ONLINESTATUS_SOURCE
          else if (name === 'attachButton') next[name] = DEFAULT_ATTACHBUTTON_SOURCE
          else if (name === 'sendButton') next[name] = DEFAULT_SENDBUTTON_SOURCE
          else if (name === 'emptyState') next[name] = DEFAULT_EMPTYSTATE_SOURCE
          else if (name === 'messageStatus') next[name] = DEFAULT_MESSAGESTATUS_SOURCE
          else if (name === 'typingIndicator') next[name] = DEFAULT_TYPINGINDICATOR_SOURCE
          else if (name === 'replyPreview') next[name] = DEFAULT_REPLYPREVIEW_SOURCE
          else if (name === 'replyQuote') next[name] = DEFAULT_REPLYQUOTE_SOURCE
          else if (name === 'messageReactions') next[name] = DEFAULT_MESSAGEREACTIONS_SOURCE
          else if (name === 'reactionPicker') next[name] = DEFAULT_REACTIONPICKER_SOURCE
          else if (name === 'profileScreen') next[name] = DEFAULT_PROFILESCREEN_SOURCE
          else if (name === 'contactProfileScreen') next[name] = DEFAULT_CONTACTPROFILESCREEN_SOURCE
          else if (name === 'communityMessageBubble') next[name] = DEFAULT_COMMUNITYMESSAGEBUBBLE_SOURCE
          else if (name === 'communityListScreen') next[name] = DEFAULT_COMMUNITYLISTSCREEN_SOURCE
          else if (name === 'createCommunityScreen') next[name] = DEFAULT_CREATECOMMUNITYSCREEN_SOURCE
          else if (name === 'communityChatScreen') next[name] = DEFAULT_COMMUNITYCHATSCREEN_SOURCE
          else if (name === 'communityProfileScreen') next[name] = DEFAULT_COMMUNITYPROFILESCREEN_SOURCE
          else delete next[name]
          return { componentSources: next }
        }),

      resetAll: () => set(defaultState),

      // capture current customization state — call BEFORE applying a new AI change
      pushHistory: () => set((state) => {
        const snapshot: Snapshot = {
          perContact: state.perContact,
          messageConditions: state.messageConditions,
          globalTile: state.globalTile,
          layoutConfig: state.layoutConfig,
          behaviorConfig: state.behaviorConfig,
          searchBarStyle: state.searchBarStyle,
          topAppBarStyle: state.topAppBarStyle,
          chatScreenStyle: state.chatScreenStyle,
          contactListStyle: state.contactListStyle,
          bottomSheetStyles: state.bottomSheetStyles,
          interactions: state.interactions,
          customComponents: state.customComponents,
          componentSources: state.componentSources,
        }
        // cap at 30, drop oldest
        const newHistory = [...state.history, snapshot].slice(-30)
        return { history: newHistory }
      }),

      // undo — restore the most recent snapshot and remove it from history
      undo: () => set((state) => {
        if (state.history.length === 0) return {}
        const previous = state.history[state.history.length - 1]
        const newHistory = state.history.slice(0, -1)
        return { ...previous, history: newHistory }
      }),

      // reset — wipe everything back to defaults (keeps history empty)
      resetAllCustomizations: () => set(() => ({
        perContact: {},
        messageConditions: [],
        globalTile: {},
        layoutConfig: { searchBar: { barPosition: 'top-bar', iconPosition: 'top-bar' } },
        behaviorConfig: {},
        searchBarStyle: {},
        topAppBarStyle: {},
        chatScreenStyle: {},
        contactListStyle: {},
        bottomSheetStyles: {},
        interactions: {
          tileTap: 'open-chat',
          tileLongPress: 'open-longPressSheet',
          menuTap: 'none',
          searchIconTap: 'toggle-search',
          newChatTap: 'none',
          attachTap: 'open-attachSheet',
          backTap: 'navigate-back',
        },
        customComponents: {},
        componentSources: { homeHeader: DEFAULT_HOMEHEADER_SOURCE, homeSearch: DEFAULT_HOMESEARCH_SOURCE, bottomNav: DEFAULT_BOTTOMNAV_SOURCE, bottomSheet: DEFAULT_BOTTOMSHEET_SOURCE, chatScreen: DEFAULT_CHATSCREEN_SOURCE, messageBubble: DEFAULT_MESSAGEBUBBLE_SOURCE, contactList: DEFAULT_CONTACTLIST_SOURCE, dateSeparator: DEFAULT_DATESEPARATOR_SOURCE, composerBar: DEFAULT_COMPOSERBAR_SOURCE, backButton: DEFAULT_BACKBUTTON_SOURCE, profileImage: DEFAULT_PROFILEIMAGE_SOURCE, chatName: DEFAULT_CHATNAME_SOURCE, onlineStatus: DEFAULT_ONLINESTATUS_SOURCE, attachButton: DEFAULT_ATTACHBUTTON_SOURCE, sendButton: DEFAULT_SENDBUTTON_SOURCE, emptyState: DEFAULT_EMPTYSTATE_SOURCE, messageStatus: DEFAULT_MESSAGESTATUS_SOURCE, typingIndicator: DEFAULT_TYPINGINDICATOR_SOURCE, replyPreview: DEFAULT_REPLYPREVIEW_SOURCE, replyQuote: DEFAULT_REPLYQUOTE_SOURCE, messageReactions: DEFAULT_MESSAGEREACTIONS_SOURCE, reactionPicker: DEFAULT_REACTIONPICKER_SOURCE, profileScreen: DEFAULT_PROFILESCREEN_SOURCE, contactProfileScreen: DEFAULT_CONTACTPROFILESCREEN_SOURCE, communityMessageBubble: DEFAULT_COMMUNITYMESSAGEBUBBLE_SOURCE, communityListScreen: DEFAULT_COMMUNITYLISTSCREEN_SOURCE, createCommunityScreen: DEFAULT_CREATECOMMUNITYSCREEN_SOURCE, communityChatScreen: DEFAULT_COMMUNITYCHATSCREEN_SOURCE, communityProfileScreen: DEFAULT_COMMUNITYPROFILESCREEN_SOURCE },
        history: [],
        componentState: {},
        activeVersionId: null,
      })),

      // helper for UI to know if undo is available
      canUndo: () => get().history.length > 0,

      // ---- version timeline ----
      // capture the current full customization state
      getSnapshot: () => captureSnapshot(get()),

      // overwrite the live customization state with a snapshot (functions/versions untouched)
      applySnapshot: (snapshot) => set(() => ({ ...snapshot })),

      // append a named version capturing the CURRENT state; becomes the active version
      addVersion: (name) => {
        const snapshot = captureSnapshot(get())
        const version: GenUIVersion = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `v_${Date.now()}`,
          name: (name && name.trim() ? name.trim() : 'Untitled change').slice(0, 60),
          createdAt: new Date().toISOString(),
          snapshot,
        }
        // append-only; cap at 100 to bound storage, dropping the oldest
        set((state) => ({ versions: [...state.versions, version].slice(-100), activeVersionId: version.id }))
        return version
      },

      // jump to any version WITHOUT mutating the timeline — old chain stays intact
      restoreVersion: (id) => set((state) => {
        const v = state.versions.find(x => x.id === id)
        if (!v) return {}
        return { ...v.snapshot, activeVersionId: id }
      }),

      // load server-saved state + versions on login (only overwrites when server has data)
      hydrateFromServer: (snapshot, versions, userId) => set(() => {
        const next: Record<string, any> = { versions: versions ?? [], ownerUserId: userId }
        if (snapshot && Object.keys(snapshot).length > 0) Object.assign(next, snapshot)
        return next
      }),

      setComponentState: (key, value) =>
        set((state) => ({
          componentState: { ...state.componentState, [key]: value }
        })),
    }),
    {
      name: 'genui-customizations',
      storage: createJSONStorage(() => PERSISTENCE_ENABLED ? capacitorStorage : devStorage),
      // persist only the data fields, NOT the functions
      partialize: (state) => ({
        perContact: state.perContact,
        messageConditions: state.messageConditions,
        globalTile: state.globalTile,
        layoutConfig: state.layoutConfig,
        behaviorConfig: state.behaviorConfig,
        searchBarStyle: state.searchBarStyle,
        topAppBarStyle: state.topAppBarStyle,
        chatScreenStyle: state.chatScreenStyle,
        contactListStyle: state.contactListStyle,
        bottomSheetStyles: state.bottomSheetStyles,
        interactions: state.interactions,
        customComponents: state.customComponents,
        componentSources: state.componentSources,
        history: state.history,
        componentState: filterPersistentComponentState(state.componentState),
        versions: state.versions,
        activeVersionId: state.activeVersionId,
        ownerUserId: state.ownerUserId,
      }),
    }
  )
)

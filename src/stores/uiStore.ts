import React from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { capacitorStorage } from '@/lib/persistStorage'
import type { UIOverrideState, ContactStyleOverride, MessageConditionRule, SearchBarLayoutConfig, BehaviorConfig, SearchBarStyleOverride, TopAppBarStyleOverride, ChatScreenStyleOverride, BottomSheetStyleOverride, ContactListStyleOverride, AppAction, InteractionConfig, CustomComponents, ComponentSources } from '@/types'
import { DEFAULT_TOPAPPBAR_SOURCE, DEFAULT_SEARCHBAR_SOURCE, DEFAULT_CHATTILE_SOURCE, DEFAULT_BOTTOMSHEET_SOURCE, DEFAULT_CHATSCREEN_SOURCE, DEFAULT_MESSAGEBUBBLE_SOURCE, DEFAULT_CONTACTLIST_SOURCE } from '@/lib/defaultComponents'

// set false for web dev/testing (fresh state every refresh)
// set true for mobile builds (state persists via capacitor preferences)
export const PERSISTENCE_ENABLED = false

// noop storage: reads return null (defaults always used), writes are silent no-ops
// used when PERSISTENCE_ENABLED is false so there is no console spam
const devStorage: StateStorage = {
  getItem: (_name: string) => Promise.resolve(null),
  setItem: (_name: string, _value: string) => Promise.resolve(),
  removeItem: (_name: string) => Promise.resolve(),
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
    topAppBar: DEFAULT_TOPAPPBAR_SOURCE,
    searchBar: DEFAULT_SEARCHBAR_SOURCE,
    chatTile: DEFAULT_CHATTILE_SOURCE,
    bottomSheet: DEFAULT_BOTTOMSHEET_SOURCE,
    chatScreen: DEFAULT_CHATSCREEN_SOURCE,
    messageBubble: DEFAULT_MESSAGEBUBBLE_SOURCE,
    contactList: DEFAULT_CONTACTLIST_SOURCE,
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
          if (name === 'topAppBar') next[name] = DEFAULT_TOPAPPBAR_SOURCE
          else if (name === 'searchBar') next[name] = DEFAULT_SEARCHBAR_SOURCE
          else if (name === 'chatTile') next[name] = DEFAULT_CHATTILE_SOURCE
          else if (name === 'bottomSheet') next[name] = DEFAULT_BOTTOMSHEET_SOURCE
          else if (name === 'chatScreen') next[name] = DEFAULT_CHATSCREEN_SOURCE
          else if (name === 'messageBubble') next[name] = DEFAULT_MESSAGEBUBBLE_SOURCE
          else if (name === 'contactList') next[name] = DEFAULT_CONTACTLIST_SOURCE
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
        componentSources: { topAppBar: DEFAULT_TOPAPPBAR_SOURCE, searchBar: DEFAULT_SEARCHBAR_SOURCE, chatTile: DEFAULT_CHATTILE_SOURCE, bottomSheet: DEFAULT_BOTTOMSHEET_SOURCE, chatScreen: DEFAULT_CHATSCREEN_SOURCE, messageBubble: DEFAULT_MESSAGEBUBBLE_SOURCE, contactList: DEFAULT_CONTACTLIST_SOURCE },
        history: [],
        componentState: {},
      })),

      // helper for UI to know if undo is available
      canUndo: () => get().history.length > 0,

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
        componentState: state.componentState,
      }),
    }
  )
)

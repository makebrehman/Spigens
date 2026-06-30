import type { CSSProperties } from 'react'

// --- contact ---

export interface Contact {
  id: string
  name: string
  avatarInitials: string
  avatarColor: string
  avatarUrl?: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isOnline: boolean
  isPinned?: boolean
  isMuted?: boolean
  conversationId?: string | null
  rawProfile?: any
}

// --- message ---

export interface Message {
  id: string
  contactId: string
  content: string
  timestamp: string
  isSent: boolean
  isRead: boolean
}

// --- style overrides (layer 1) ---

export interface ContactStyleOverride {
  tile?: CSSProperties
  avatar?: CSSProperties
  avatarText?: CSSProperties
  name?: CSSProperties
  preview?: CSSProperties
  timestamp?: CSSProperties
  badge?: CSSProperties
  onlineIndicator?: CSSProperties
}

export interface MessageBubbleStyleOverride {
  wrapper?: CSSProperties
  bubble?: CSSProperties
  text?: CSSProperties
  timestamp?: CSSProperties
  readReceipt?: CSSProperties
}

export interface MessageConditionRule {
  id: string
  condition: {
    field: 'content' | 'isSent' | 'isRead'
    operator: 'includes' | 'equals' | 'startsWith'
    value: string | boolean
  }
  style: MessageBubbleStyleOverride
}

export interface SearchBarStyleOverride {
  container?: CSSProperties
  input?: CSSProperties
  placeholder?: CSSProperties
  searchIcon?: CSSProperties
  clearButton?: CSSProperties
  closeButton?: CSSProperties
  backdrop?: CSSProperties
  iconButton?: CSSProperties
}

export interface TopAppBarStyleOverride {
  titleText?: string
  container?: CSSProperties
  title?: CSSProperties
  menuButton?: CSSProperties
  menuIcon?: CSSProperties
  searchButton?: CSSProperties
  searchIcon?: CSSProperties
  newChatButton?: CSSProperties
  newChatIcon?: CSSProperties
  rightArea?: CSSProperties
  menuIconSvg?: string
  searchIconSvg?: string
  newChatIconSvg?: string
}

export interface ChatScreenStyleOverride {
  screen?: CSSProperties
  header?: CSSProperties
  backButton?: CSSProperties
  backIcon?: CSSProperties
  contactName?: CSSProperties
  onlineStatus?: CSSProperties
  headerAvatar?: CSSProperties
  headerAvatarText?: CSSProperties
  messagesArea?: CSSProperties
  emptyState?: CSSProperties
  inputBar?: CSSProperties
  input?: CSSProperties
  inputPlaceholder?: CSSProperties
  sendButton?: CSSProperties
  sendIcon?: CSSProperties
  attachButton?: CSSProperties
  attachIcon?: CSSProperties
  backIconSvg?: string
  sendIconSvg?: string
}

export interface BottomSheetOptionIconOverride {
  iconStyle?: CSSProperties
  iconSvg?: string
}

export interface BottomSheetStyleOverride {
  layout?: 'list' | 'grid-2x2' | 'grid-2col' | 'horizontal'
  optionDisplay?: 'both' | 'icon-only' | 'text-only'
  optionIconOverrides?: Record<string, BottomSheetOptionIconOverride>
  backdrop?: CSSProperties
  sheet?: CSSProperties
  handle?: CSSProperties
  title?: CSSProperties
  optionItem?: CSSProperties
  optionItemDestructive?: CSSProperties
  optionIcon?: CSSProperties
  optionText?: CSSProperties
  destructiveText?: CSSProperties
}

// --- layout config (layer 2) ---

export interface SearchBarLayoutConfig {
  barPosition: 'top-bar' | 'bottom-overlay' | 'injected' | 'floating' | 'hidden'
  iconPosition: 'top-bar' | 'bottom' | 'hidden'
  injectedAt?: number
  position?: CSSProperties
  animation?: string
  expandable?: boolean
}

export interface LayoutConfig {
  searchBar: SearchBarLayoutConfig
}

// --- behavior config (layer 3) ---

export interface BottomSheetOptionConfig {
  id: string
  label: string
  icon?: string
  destructive?: boolean
}

export interface PopupConfig {
  title?: string
  options: BottomSheetOptionConfig[]
}

export interface BehaviorConfig {
  attachButton?: {
    onTap: 'show-bottom-sheet'
    popup: PopupConfig
  }
  longPress?: {
    popup: PopupConfig
  }
}

export type AppAction =
  | 'open-chat'
  | 'open-longPressSheet'
  | 'open-attachSheet'
  | 'toggle-search'
  | 'navigate-back'
  | 'none'

export interface InteractionConfig {
  tileTap?: AppAction
  tileLongPress?: AppAction
  menuTap?: AppAction
  searchIconTap?: AppAction
  newChatTap?: AppAction
  attachTap?: AppAction
  backTap?: AppAction
}

export interface ContactListStyleOverride {
  container?: CSSProperties
  tileGap?: string
  topPadding?: string
  bottomPadding?: string
  showDividers?: boolean
  dividerStyle?: CSSProperties
}

export interface CustomComponents {
  // A zone's value is either:
  // - a single code string — the same component shown on every tab, or
  // - a map of tab id -> code string — a fully independent component per tab
  //   (a null value for a tab removes just that tab's variant)
  // A top-level null clears the entire zone.
  [zone: string]: string | Record<string, string | null> | null
}

export interface ComponentSources {
  [componentName: string]: string
}

// --- full ui override state ---

export interface UIOverrideState {
  perContact: Record<string, ContactStyleOverride>
  messageConditions: MessageConditionRule[]
  globalTile: {
    unread?: CSSProperties
    read?: CSSProperties
  }
  searchBarStyle?: SearchBarStyleOverride
  topAppBarStyle?: TopAppBarStyleOverride
  chatScreenStyle?: ChatScreenStyleOverride
  contactListStyle?: ContactListStyleOverride
  bottomSheetStyles: Record<string, BottomSheetStyleOverride>
  layoutConfig: LayoutConfig
  behaviorConfig: BehaviorConfig
  interactions?: InteractionConfig
  customComponents?: CustomComponents
  componentSources?: ComponentSources
}

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
  // shared across inline and overlay
  container?: CSSProperties      // the bar's outer container
  input?: CSSProperties          // the text input field
  placeholder?: CSSProperties    // placeholder text colour (applied via css)
  searchIcon?: CSSProperties     // the magnifying glass icon
  clearButton?: CSSProperties    // the × clear button
  closeButton?: CSSProperties    // the close button (overlay) / cancel text (inline)
  // overlay only
  backdrop?: CSSProperties       // the dark tint behind the overlay bar
  iconButton?: CSSProperties     // the collapsed icon-button state
}

export interface TopAppBarStyleOverride {
  // text content (not style — actual text)
  titleText?: string             // change the title words themselves

  // style slots
  container?: CSSProperties      // the whole bar background/border
  title?: CSSProperties          // title text style (color, size, weight)
  menuButton?: CSSProperties     // hamburger button wrapper
  menuIcon?: CSSProperties       // hamburger icon style (color, size)
  searchButton?: CSSProperties   // search button wrapper
  searchIcon?: CSSProperties     // search icon style
  newChatButton?: CSSProperties  // pencil button wrapper
  newChatIcon?: CSSProperties    // pencil icon style
  rightArea?: CSSProperties      // the right cluster container

  // svg shape replacement (raw svg inner markup, optional)
  menuIconSvg?: string           // replaces hamburger shape
  searchIconSvg?: string         // replaces search shape
  newChatIconSvg?: string        // replaces pencil shape
}

export interface ChatScreenStyleOverride {
  // overall
  screen?: CSSProperties          // the whole screen background
  // header
  header?: CSSProperties          // the top bar of the chat screen
  backButton?: CSSProperties      // the back chevron button wrapper
  backIcon?: CSSProperties        // the back chevron icon
  contactName?: CSSProperties     // the contact name text
  onlineStatus?: CSSProperties    // the online/offline status text
  headerAvatar?: CSSProperties    // the avatar circle in the header
  headerAvatarText?: CSSProperties// the avatar initials in the header
  // messages area
  messagesArea?: CSSProperties    // the scrollable messages container background
  emptyState?: CSSProperties      // the "no messages yet" text
  // input bar
  inputBar?: CSSProperties        // the bottom input bar container
  input?: CSSProperties           // the text input field
  inputPlaceholder?: CSSProperties// placeholder colour (via css)
  sendButton?: CSSProperties      // the send button circle
  sendIcon?: CSSProperties        // the send arrow icon
  attachButton?: CSSProperties    // the + attach button circle
  attachIcon?: CSSProperties      // the + attach icon
  // svg replacement
  backIconSvg?: string            // replace back chevron shape
  sendIconSvg?: string            // replace send icon shape
}

export interface BottomSheetOptionIconOverride {
  iconStyle?: CSSProperties   // color, fontSize for this specific option's icon
  iconSvg?: string            // replace this option's icon with custom svg
}

export interface BottomSheetStyleOverride {
  layout?: 'list' | 'grid-2x2' | 'grid-2col' | 'horizontal'
  optionDisplay?: 'both' | 'icon-only' | 'text-only'
  optionIconOverrides?: Record<string, BottomSheetOptionIconOverride>
  backdrop?: CSSProperties        // the dark tint behind the sheet
  sheet?: CSSProperties           // the sheet panel itself
  handle?: CSSProperties          // the drag handle pill
  title?: CSSProperties           // the title text
  optionItem?: CSSProperties      // each option row
  optionItemDestructive?: CSSProperties  // NEW — styles the whole destructive row (background etc)
  optionIcon?: CSSProperties      // the icon on each option
  optionText?: CSSProperties      // the option label text
  destructiveText?: CSSProperties // override colour for destructive options
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

// an action is a string command the app knows how to perform
export type AppAction =
  | 'open-chat'           // open the tapped contact's conversation
  | 'open-longPressSheet' // open the long-press bottom sheet
  | 'open-attachSheet'    // open the attach bottom sheet
  | 'toggle-search'       // toggle the search bar
  | 'navigate-back'       // go back from chat to list
  | 'none'                // do nothing

export interface InteractionConfig {
  // home screen interactions
  tileTap?: AppAction
  tileLongPress?: AppAction
  // top bar interactions
  menuTap?: AppAction
  searchIconTap?: AppAction
  newChatTap?: AppAction
  // chat screen interactions
  attachTap?: AppAction
  backTap?: AppAction
}

export interface ContactListStyleOverride {
  container?: CSSProperties       // the scroll container background and padding
  tileGap?: string                // gap between tiles (e.g. "8px")
  topPadding?: string             // padding at the top of the list
  bottomPadding?: string          // padding at the bottom of the list
  showDividers?: boolean          // whether to show dividers between tiles
  dividerStyle?: CSSProperties    // the divider line style if shown
}

export interface CustomComponents {
  // keyed by zone name -> jsx string
  // zones: "home-top", "home-bottom", "chat-header", "floating"
  [zone: string]: string
}

export interface ComponentSources {
  // keyed by component name -> JSX/createElement source string
  // e.g. "topAppBar"
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

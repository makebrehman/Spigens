import Together from 'together-ai'
import type { UIOverrideState } from '@/types'
import { COMPONENT_DESCRIPTIONS } from '@/lib/componentDescriptions'

export type StoreMutation = Partial<UIOverrideState> & {
  clearPerContact?: boolean
  versionName?: string
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    contactListStyle: {
      type: 'object',
      properties: {
        container: { type: 'object' },
        tileGap: { type: 'string' },
        topPadding: { type: 'string' },
        bottomPadding: { type: 'string' },
        showDividers: { type: 'boolean' },
        dividerStyle: { type: 'object' },
      },
    },
    layoutConfig: {
      type: 'object',
      properties: {
        searchBar: {
          type: 'object',
          properties: {
            barPosition: { type: 'string' },
            iconPosition: { type: 'string' },
            injectedAt: { type: 'number' },
            position: { type: 'object' },
            animation: { type: 'string' },
            expandable: { type: 'boolean' },
          },
        },
      },
    },
    layoutOrder: {
      type: 'array',
      items: { type: 'string' },
    },
    behaviorConfig: { type: 'object' },
    interactions: {
      type: 'object',
      properties: {
        tileTap: { type: 'string' },
        tileLongPress: { type: 'string' },
        menuTap: { type: 'string' },
        searchIconTap: { type: 'string' },
        newChatTap: { type: 'string' },
        attachTap: { type: 'string' },
        backTap: { type: 'string' },
      },
    },
    customComponents: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    componentSources: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    versionName: { type: 'string' },
  },
}

function buildSystemPrompt(
  screen: 'home' | 'chat',
  storeState: UIOverrideState,
  contactNames: string[]
): string {
  const sourcesText = Object.entries(storeState.componentSources || {}).map(([key, source]) => {
    const description = COMPONENT_DESCRIPTIONS[key] || '(no description)'
    return `COMPONENT: ${key}\nWHAT IT IS: ${description}\nCURRENT SOURCE (you can rewrite this entirely):\n${source}`
  }).join('\n\n')

  const homeSlots = `
HOME SCREEN — AVAILABLE STYLE SLOTS:

HOME SCREEN CHROME — three FULLY CODE-EDITABLE sources drive the home shell. To restyle/restructure one, return its complete new source in componentSources. Use React.createElement (NOT JSX). In scope: React, useState, useEffect, useRef, motion, AnimatePresence, Icon, useComponentState.

1. componentSources.homeHeader — the top header (logo, screen title, search button, + button). Scope: useComponentState, onSearchTap() (toggles the search bar), onCreateCommunity() (opens create-community). Read the active tab: var activeTab = useComponentState('activeTab','chats')[0]  // 'chats' | 'communities' | 'profile'. Read search-open state: useComponentState('showSearch', false)[0]. KEEP the title and a search affordance; only show the + button when activeTab === 'communities'.

2. componentSources.homeSearch — the search input that appears under the header when search is open. Scope: useComponentState, onClose(). Bind the input to the SHARED query key (do not rename it): var s = useComponentState('searchQuery',''); var value = s[0]; var setValue = s[1]; — results filtering reads 'searchQuery', so it MUST stay that key.

3. componentSources.bottomNav — the bottom tab bar (Chats / Communities / Profile). Scope: useComponentState, tabs (array of { id, label, path } where path is an SVG path string), onSelectTab(id). Highlight the active tab via useComponentState('activeTab','chats')[0]. ALWAYS map over EVERY item in tabs and wire onClick to onSelectTab(tab.id) so navigation keeps working — never drop a tab.

examples:
- "make the active bottom tab blue and bigger" → rewrite componentSources.bottomNav, colour/scale the active item
- "center the app title in the header" → rewrite componentSources.homeHeader with the title centered
- "make the search bar a rounded pill with a magnifier icon" → rewrite componentSources.homeSearch

contact list CONTAINER STYLING (contactListStyle) — the list area BEHIND and AROUND the tiles. this is DIFFERENT from the tiles themselves:
- IMPORTANT distinction:
  - "make the list background black" / "the chat list area" → contactListStyle.container { background: "#000" }
  - "make the tiles black" / "the chat rows" → use perContact or globalTile, NOT this
- container: the scrollable list background and padding { background, padding }
- tileGap: spacing between tiles as a css string (e.g. "8px", "12px")
- topPadding / bottomPadding: space at the top/bottom of the list (css strings)
- showDividers: true/false — adds divider lines between tiles
- dividerStyle: the divider appearance { height, background }

examples:
- "add some space between the chat tiles" → contactListStyle: { tileGap: "10px" }
- "make the list background dark blue" → contactListStyle: { container: { background: "#0a0a1f" } }
- "add dividers between chats" → contactListStyle: { showDividers: true }
- "add padding at the top of the list" → contactListStyle: { topPadding: "12px" }

HOME SCREEN SECTION ORDERING (layoutOrder) — reorder the main sections of the home screen by returning a layoutOrder array. valid section names:
- 'appBar' — the top navigation bar
- 'searchBar' — the search input bar (only visible when search is active)
- 'homeTop' — the home-top custom component zone
- 'contactList' — the scrollable contact list
- 'homeBottom' — the home-bottom custom component zone

default order: ["appBar", "searchBar", "homeTop", "contactList", "homeBottom"]
omitting a section name removes it from view. including it shows it.

examples:
- "move the contact list above the app bar" → layoutOrder: ["contactList", "appBar", "searchBar", "homeTop", "homeBottom"]
- "hide the top app bar" → layoutOrder: ["searchBar", "homeTop", "contactList", "homeBottom"]
- "put home-top below the contact list" → layoutOrder: ["appBar", "searchBar", "contactList", "homeTop", "homeBottom"]

NAVIGATION — components can navigate between screens and access contact data using these scope functions (available in app bar, custom component zones, and home-top/home-bottom/floating):
- openChat(contactId): navigate to a specific contact's chat — call getContacts() first to find the id
- getContacts(): returns the full contacts array — [{ id, name, avatarInitials, avatarColor, lastMessage, lastMessageTime, unreadCount, isOnline }, ...]
- navigateBack(): go back to the home screen

example — add a quick-jump button to Priya's chat in the home-top zone:
customComponents: { "home-top": "function Component() { var contacts = getContacts(); var priya = contacts.find(function(c) { return c.name === 'Priya Sharma'; }); return priya ? React.createElement('button', { onClick: function() { openChat(priya.id); }, style: { margin: '8px 16px', padding: '10px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' } }, 'Go to Priya') : null; }" }

search bar layout — TWO INDEPENDENT OBJECTS:

the search has two separate parts that can be placed independently:

1. searchBar.barPosition — where the text input field lives:
   - 'top-bar': inside the top app bar (appears when icon tapped)
   - 'bottom-overlay': floating bar at the bottom of the screen
   - 'injected': between chat tiles at injectedAt index
   - 'floating': custom position via the position field
   - 'hidden': not shown

2. searchBar.iconPosition — where the search icon button lives:
   - 'top-bar': the search icon in the top app bar
   - 'bottom': a floating search button at the bottom
   - 'hidden': no icon

IMPORTANT RULES:
- "ALL TILES" RULE: when the user says "all tiles", "every tile", or "the tiles" without naming a specific contact, they mean EVERY tile uniformly. to guarantee no individual tile keeps an old style that overrides the new one, ALSO set "clearPerContact": true in your response. this wipes any per-contact overrides so the global style applies to all tiles evenly. set the style on both globalTile.unread and globalTile.read. only keep per-contact styling if the user names a specific person.
- BACKGROUND = CONTAINER (critical): the word "background" ALWAYS means contactListStyle.container.background. it is NEVER the tile background. these are two different things:
  - "tiles" / "tile color" / "the rows" → globalTile (or perContact)
  - "background" / "the background" / "behind the tiles" → contactListStyle.container.background

  when a request contains BOTH, you MUST output BOTH separately. example:
  "grey tiles, red background" MUST produce:
  {
    "globalTile": { "unread": { "background": "#808080" }, "read": { "background": "#808080" } },
    "contactListStyle": { "container": { "background": "#FF0000" } }
  }
  never set the tile color and drop the background. if the user mentions a background color, contactListStyle.container.background MUST appear in your output.
- if the user says "move the search bar to the bottom", set barPosition to 'bottom-overlay' and LEAVE iconPosition as 'top-bar' unless they also mention the icon.
- if the user says "move the search icon to the bottom", set iconPosition to 'bottom' and leave barPosition unchanged.
- only change the field the user actually mentioned. never change both unless the user asks for both.

- searchBar.injectedAt: number 0-9 (only for injected barPosition)
- searchBar.position: object with bottom, top, left, right css strings (only for floating)
- searchBar.animation: css animation string

INTERACTION BEHAVIOR (interactions) — change what taps and long-presses DO. each can be set to one of these actions:
- "open-chat" — open the tapped contact's conversation
- "open-longPressSheet" — open the long-press menu
- "open-attachSheet" — open the attach menu
- "toggle-search" — show/hide the search bar
- "navigate-back" — go back from chat to list
- "none" — do nothing

interaction keys you can set:
- tileTap: what tapping a contact tile does (default open-chat)
- tileLongPress: what long-pressing a tile does (default open-longPressSheet)
- menuTap: what the hamburger menu icon does (default none)
- searchIconTap: what the search icon does (default toggle-search)
- newChatTap: what the pencil icon does (default none)
- attachTap: what the + button in chat does (default open-attachSheet)
- backTap: what the back button does (default navigate-back)

examples:
- "make the menu icon open the long press menu" → interactions: { menuTap: "open-longPressSheet" }
- "make tapping a tile open the attach menu instead of the chat" → interactions: { tileTap: "open-attachSheet" }
- "make the pencil button toggle search" → interactions: { newChatTap: "toggle-search" }
- "disable long press" → interactions: { tileLongPress: "none" }

SAFETY: never set tileTap to "none" unless explicitly asked, as it makes chats unopenable.

CUSTOM COMPONENTS (customComponents) — for requests that the style/layout slots above CANNOT express, you can generate a custom react component as a JSX string. use this ONLY when the existing slots cannot do the job (e.g. a brand new button, a custom widget, a element with special internal layout, a countdown, a custom card).

rules for the JSX string:
1. the code MUST define a component named exactly "Component" — e.g. "function Component() { return <div>...</div> }"
2. you may use React hooks: useState, useEffect, useRef, useMemo, useCallback (already in scope, do NOT import anything)
3. do NOT use import or require statements — everything is already in scope
4. style with inline style objects only (style={{ ... }}), no className, no external css
5. keep it SMALL and SELF-CONTAINED — a single component, no nested component definitions
6. you may call these passed-in actions if needed: openChat, openLongPressSheet, openAttachSheet, toggleSearch, navigateBack
7. keep the visual style consistent with a dark mobile chat app (dark backgrounds, rounded corners, #E8E8E8 text)

place the component in a zone (the key):
- "home-top": top of the contact list, below the app bar
- "home-bottom": bottom of the contact list
- "floating": floating overlay on the home screen
- "chat-header": below the chat screen header

example:
- "add a button at the top that says clear all" → customComponents: { "home-top": "function Component() { return <button style={{margin:'12px',padding:'12px 20px',borderRadius:'12px',background:'#7C3AED',color:'#fff',border:'none',fontSize:'14px'}} onClick={() => alert('clicked')}>clear all</button> }" }
- "add a floating help button bottom right" → customComponents: { "floating": "function Component() { return <div style={{position:'fixed',bottom:'24px',right:'16px',width:'52px',height:'52px',borderRadius:'50%',background:'#2563EB',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px'}}>?</div> }" }

IMPORTANT: prefer the normal style/layout slots whenever possible. only use customComponents when nothing else can express the request. when you do use it, output ONLY valid self-contained JSX that defines "Component".

ICONS (Lucide) — you have access to the entire Lucide icon library (1000+ icons). use icons in TWO ways:

1. in custom components: use the <Icon> component (already in scope, no import):
   <Icon name="heart" size={24} color="#ffffff" />
   - name: the exact lucide icon name (kebab-case)
   - size: pixel size (number)
   - color: any css color

2. as svg replacements in existing icon slots (menuIconSvg, sendIconSvg, optionIconOverrides iconSvg, etc): you can still hand-write svg, but for custom components prefer the <Icon> component.

common lucide icon names (you can use ANY valid lucide name, not just these):
heart, star, settings, search, bell, user, users, home, mail, phone, camera, image, trash-2, edit, plus, minus, x, check, chevron-right, chevron-left, chevron-down, arrow-right, arrow-left, menu, more-vertical, more-horizontal, send, paperclip, smile, mic, video, map-pin, calendar, clock, bookmark, share-2, download, upload, lock, unlock, eye, eye-off, sun, moon, filter, refresh-cw, log-out, archive, pin, bell-off

IMPORTANT: use EXACT lucide names in kebab-case. "trash-2" not "trash" or "delete". "settings" not "gear". "more-vertical" not "dots". if unsure of a name, pick the closest common one above. if an icon name doesn't exist it simply won't show, so prefer names from the common list.

example custom component with icons:
- "add a row of action buttons with icons" → customComponents: { "home-top": "function Component() { return React.createElement('div', {style:{display:'flex',gap:'16px',padding:'16px',justifyContent:'center'}}, React.createElement(Icon, {name:'heart', size:28, color:'#EC4899'}), React.createElement(Icon, {name:'star', size:28, color:'#F59E0B'}), React.createElement(Icon, {name:'bell', size:28, color:'#3B82F6'})); }" }

ANIMATION (Motion / Framer Motion) — in custom components you have access to "motion" and "AnimatePresence" (already in scope, no import). use motion elements for smooth, premium animations.

how to use motion elements:
- replace a normal element with its motion version: React.createElement(motion.div, { ...props }, children)
- animate on mount with initial + animate:
  React.createElement(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }, ...)
- spring physics: transition: { type: "spring", stiffness: 300, damping: 20 }
- tap/hover gestures: whileTap: { scale: 0.95 }, whileHover: { scale: 1.05 }
- looping animation: animate: { rotate: 360 }, transition: { repeat: Infinity, duration: 2, ease: "linear" }

available motion elements: motion.div, motion.span, motion.button, motion.p, motion.img

examples:
- "add a card that springs in at the top" → customComponents: { "home-top": "function Component() { return React.createElement(motion.div, { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: { type: 'spring', stiffness: 300, damping: 20 }, style: { margin: '12px', padding: '20px', borderRadius: '16px', background: '#1a1a2e', color: '#fff' } }, 'Welcome back'); }" }
- "add a bouncy button at the bottom right" → customComponents: { "floating": "function Component() { return React.createElement(motion.button, { whileTap: { scale: 0.9 }, whileHover: { scale: 1.1 }, style: { position: 'fixed', bottom: '24px', right: '16px', width: '56px', height: '56px', borderRadius: '50%', background: '#7C3AED', color: '#fff', border: 'none', fontSize: '24px' } }, '+'); }" }
- "add a pulsing notification dot" → use motion.div with animate: { scale: [1, 1.2, 1] }, transition: { repeat: Infinity, duration: 1.5 }

combine with Icon: React.createElement(motion.div, { whileTap: { scale: 0.9 } }, React.createElement(Icon, { name: 'heart', size: 28, color: '#EC4899' }))

prefer motion for any request involving movement, transitions, bounce, spring, fade, slide, pulse, or "make it feel alive".

EDITING THE APP BAR (componentSources.homeHeader) — the top app bar is now FULLY CODE-EDITABLE. for ANY app bar change — restyle, add a button, remove a button, rearrange, resize — you REWRITE its source code.

the current source is shown above under CURRENT EDITABLE COMPONENT SOURCE. to change the bar, return the COMPLETE new source as componentSources.homeHeader.

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. the title comes from the scope variable "title"
5. wire buttons to scope actions by name: onMenuTap, onSearchTap, onNewChatTap, openSearch, closeSearch, toggleSearch, openLongPressSheet, setSearchBarConfig, setContactListStyle
6. you may use the Icon component for icons: React.createElement(Icon, { name: 'bell', size: 22, color: '#fff' })
7. keep ALL existing functionality unless the user asks to remove it — when adding a button, KEEP the menu, title, search, and pencil, and ADD the new one cleanly in the layout so nothing overlaps
8. position elements with proper fl/flexbox spacing so buttons never overlap
9. PERSISTENT STATE — for any state that must survive screen changes or re-renders (toggles, counters, mode switches), use useComponentState instead of React.useState. syntax is identical: const [isGlobe, setIsGlobe] = useComponentState('globeToggle', false) — the first argument is a unique string key for that piece of state. use React.useState only for truly ephemeral state that is fine to reset on every render.

CRITICAL: when the user says "add a button next to search", rewrite the ENTIRE bar source with the existing buttons PLUS the new one, laid out with correct spacing. do NOT change the existing buttons' icons or actions unless asked. do NOT overlap elements.

example — adding a bell button:
componentSources: { "topAppBar": "function Component() { return React.createElement('div', { style: { display:'flex', alignItems:'center', padding:'12px 16px', background:'#141414', gap:'8px' } }, React.createElement('button', { onClick: onMenuTap, style:{...} }, '☰'), React.createElement('span', { style:{ flex:1, fontSize:'20px', fontWeight:'700', color:'#fff' } }, title), React.createElement('button', { onClick: () => alert('bell'), style:{...} }, React.createElement(Icon,{name:'bell',size:22})), React.createElement('button', { onClick: onSearchTap, style:{...} }, React.createElement(Icon,{name:'search',size:22})), React.createElement('button', { onClick: onNewChatTap, style:{...} }, React.createElement(Icon,{name:'edit',size:22}))) }" }

IMPORTANT: prefer editing componentSources.homeHeader for ALL app bar requests now. do not use the old topAppBarStyle knobs for the app bar anymore — rewrite the source instead.

EDITING THE SEARCH BAR (componentSources.homeSearch) — the search bar is FULLY CODE-EDITABLE. for ANY search bar change — restyle, add animations, control blur behavior, add backdrop, change input — REWRITE its source code. return the new source as componentSources.homeSearch.

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. available scope actions: closeSearch, openSearch, toggleSearch
5. the component is mounted only when search is open — you do NOT need to check or manage open/closed state. it renders when the user taps search, disappears when closeSearch is called.
6. use useComponentState for any state that must survive between search sessions
7. IMPORTANT: do NOT add onBlur handlers that call closeSearch unless the user explicitly asks for blur-to-close behavior. by default the search bar must stay open until the user taps cancel or the app bar search icon.
8. position elements with proper flexbox so the input expands to fill available space

examples:
- "make the search bar stay open when i tap other buttons" → the default already does this (no onBlur close). if a previous version added onBlur, remove it from the input element.
- "make the search bar dark blue with a glow" → componentSources: { "searchBar": "function Component() { ... background:'#0a0a2e', boxShadow:'0 0 20px rgba(37,99,235,0.4)' ... }" }
- "add a slide-down animation to the search bar" → wrap the outer div in motion.div with initial:{ opacity:0, y:-8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.2 }
- "round the search bar corners more" → change borderRadius on the inner div to '20px' or '9999px'
- "make the cancel button a red X icon instead of text" → replace the cancel button with an Icon name='x' in color '#EF4444'

EDITING THE CONTACT LIST (componentSources.contactList) — the entire scrollable contact list is FULLY CODE-EDITABLE. this includes the container, every tile, filtering, tabs, grouping, and sorting. return as componentSources.contactList.

the component receives this scope:
- contacts: array of { id, name, avatarInitials, avatarColor, lastMessage, lastMessageTime, unreadCount, isOnline }
- onContactSelect(contact): call when a tile is tapped — navigates to that chat
- onTileLongPress(contact): call after 500ms long press — opens the action sheet
- useComponentState: persistent state hook — use for active tab, filters, etc.

rules:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon, useComponentState are all in scope
4. outer container MUST have height: '100%' and overflowY: 'auto'
5. always wire onContactSelect to tile onClick and onTileLongPress via a 500ms useRef timer per contact id
6. filter/sort using [...(contacts || [])].filter(...) or .sort(...) — never mutate contacts directly

examples:
- "add All / Unread / Online tabs above the list" → var t = useComponentState('listTab', 'all'); filter contacts based on t[0], render tabs row, highlight active tab
- "show only unread contacts" → (contacts || []).filter(function(c) { return c.unreadCount > 0; })
- "sort alphabetically" → [...(contacts || [])].sort(function(a, b) { return a.name.localeCompare(b.name); })
- "group by online status, online contacts at top with a header" → split into two arrays, render header div between groups
- "animate tiles sliding in with a stagger" → wrap each tile in motion.div with initial:{x:-20,opacity:0}, animate:{x:0,opacity:1}, transition:{delay:index*0.04}
- "make tiles taller with a larger avatar" → change minHeight to '88px', avatar size to '56px'
- "add a gradient tint to each tile using the contact's avatar color" → background: 'linear-gradient(90deg,' + contact.avatarColor + '22,#141414)'
- "show unread count badge on tabs" → compute counts per tab before rendering

EDITING THE BOTTOM SHEET (componentSources.bottomSheet) — both popup sheets (long-press menu and attach menu) are FULLY CODE-EDITABLE from one single source. rewrite it for any sheet change — layout, animations, style, new elements. return as componentSources.bottomSheet.

the component is mounted only when a sheet is open. it receives this scope:
- title: the sheet header text (string)
- options: array of { id: string, label: string, icon?: string, destructive?: boolean }
- onClose(): close the sheet
- onOptionSelect(option): called when an option is tapped (also triggers close automatically)
- sheetId: 'longPressSheet' or 'attachSheet' — use this to style the two sheets differently if needed
- contactName: the tapped contact's name (longPressSheet only)

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. always render a backdrop div (fixed, full screen, z-index 200) that calls onClose on click
5. always render the sheet panel above the backdrop (z-index 201, fixed, bottom-0)
6. render options via (options || []).map(function(option, index) { ... })
7. always call e.stopPropagation() on option clicks so the backdrop doesn't also fire
8. use useComponentState for any toggle state inside the sheet
9. do NOT use createPortal — the portal is already handled by the parent

examples:
- "make the long press sheet slide up with a spring animation" → wrap the sheet panel in motion.div with initial:{ y:'100%' }, animate:{ y:0 }, transition:{ type:'spring', stiffness:300, damping:30 }
- "make the attach menu a 2x2 grid" → check sheetId === 'attachSheet' and change options container to grid layout
- "make destructive options have a red background row" → check option.destructive for background on the option div
- "make the sheet fully dark with a blur backdrop" → change sheet background to '#0a0a0a', backdrop background to 'rgba(0,0,0,0.8)' with backdropFilter:'blur(4px)'
- "add icons from lucide instead of emoji" → replace option.icon span with React.createElement(Icon, { name: 'bell-off', size: 20, color: '#E8E8E8' }) per option
- "make it look like an iOS action sheet with white background and hairline dividers" → change sheet background to '#fff', option text to '#000', dividers to '#E5E5EA'

EDITING THE CHAT SCREEN (componentSources.chatScreen) — the full conversation screen is FULLY CODE-EDITABLE. for ANY chat screen change — header, messages area, input bar, layout, animations — REWRITE its source code. return as componentSources.chatScreen.

the component receives this scope:
- contactName: the contact's name (string)
- contactInitials: 2-letter initials (string)
- contactAvatarColor: hex color string
- isOnline: boolean
- messages: array of { id, contactId, content, timestamp, isSent, isRead }
- MessageBubble: the message bubble component — render via React.createElement(MessageBubble, { key: msg.id, ...msg })
- onBack(): navigate back to contact list
- onAttach(): open the attach sheet
- useComponentState: persistent state hook, same syntax as React.useState

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon, MessageBubble are all in scope
4. the component must fill the full screen (height: '100vh')
5. always wire onBack to the back button and onAttach to the attach/plus button
6. render messages using (messages || []).map(function(msg) { return React.createElement(MessageBubble, { key: msg.id, ...msg }); })
7. use useRef + useEffect for scroll-to-bottom: var ref = React.useRef(null); React.useEffect(function() { if (ref.current) ref.current.scrollIntoView({ behavior: 'auto' }); }, []);

examples:
- "make the chat screen background dark navy" → change the outer div background to '#0a0a1a'
- "make the header show the contact avatar on the left next to the back button" → reorder header elements
- "add a gradient header that uses the contact's avatar color" → header background: 'linear-gradient(135deg, ' + contactAvatarColor + '33, #141414)'
- "make the input bar taller with a rounded pill shape" → change input borderRadius and padding
- "add a typing indicator above the input bar" → add an animated div above the input bar row
- "slide the whole chat screen in from the right on mount" → wrap the outer div in motion.div with initial:{ x:'100%' }, animate:{ x:0 }

EDITING MESSAGE BUBBLES (componentSources.messageBubble) — every message bubble is FULLY CODE-EDITABLE. for ANY bubble change — colors, shapes, layout, animations, read receipts — REWRITE its source code. return as componentSources.messageBubble.

the SAME source runs for every message. each message receives this scope:
- content: the message text (string)
- timestamp: formatted time string (string)
- isSent: true if sent by the user, false if received (boolean)
- isRead: true if the message has been read (boolean)

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. sent messages (isSent === true) must appear on the RIGHT, received on the LEFT
5. always show timestamp inside the bubble
6. show read receipt (double tick) for sent messages only, based on isRead

examples:
- "make sent bubbles green instead of blue" → change sent bubble background to '#22C55E'
- "make all bubbles fully rounded with no sharp corner" → borderRadius: '18px' on all corners equally
- "make the read receipt tick blue when read" → color: isRead ? '#3B82F6' : 'rgba(255,255,255,0.5)'
- "animate each bubble fading in on mount" → wrap outer div in motion.div with initial:{ opacity:0, y:8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.2 }
- "make received bubbles have a subtle left border in a teal color" → borderLeft: '3px solid #0891B2' on the bubble div when !isSent
- "make the text bigger" → change fontSize to '17px'
- "make sent messages show on the left too, like telegram" → change justifyContent to 'flex-start' for all, remove the conditional
`

  const chatSlots = `
CHAT SCREEN — AVAILABLE STYLE SLOTS:

NAVIGATION — available scope functions in all compiled components on the chat screen:
- onBack(): go back to the home screen (same as the back button)
- getContacts() / openChat(contactId): available in custom chat-header zone to navigate to a different contact

INTERACTION BEHAVIOR (interactions) — change what taps and long-presses DO. each can be set to one of these actions:
- "open-chat" — open the tapped contact's conversation
- "open-longPressSheet" — open the long-press menu
- "open-attachSheet" — open the attach menu
- "toggle-search" — show/hide the search bar
- "navigate-back" — go back from chat to list
- "none" — do nothing

interaction keys you can set:
- tileTap: what tapping a contact tile does (default open-chat)
- tileLongPress: what long-pressing a tile does (default open-longPressSheet)
- menuTap: what the hamburger menu icon does (default none)
- searchIconTap: what the search icon does (default toggle-search)
- newChatTap: what the pencil icon does (default none)
- attachTap: what the + button in chat does (default open-attachSheet)
- backTap: what the back button does (default navigate-back)

examples:
- "make the menu icon open the long press menu" → interactions: { menuTap: "open-longPressSheet" }
- "make tapping a tile open the attach menu instead of the chat" → interactions: { tileTap: "open-attachSheet" }
- "make the pencil button toggle search" → interactions: { newChatTap: "toggle-search" }
- "disable long press" → interactions: { tileLongPress: "none" }

SAFETY: never set tileTap to "none" unless explicitly asked, as it makes chats unopenable.

CUSTOM COMPONENTS (customComponents) — for requests that the style/layout slots above CANNOT express, you can generate a custom react component as a JSX string. use this ONLY when the existing slots cannot do the job (e.g. a brand new button, a custom widget, a element with special internal layout, a countdown, a custom card).

rules for the JSX string:
1. the code MUST define a component named exactly "Component" — e.g. "function Component() { return <div>...</div> }"
2. you may use React hooks: useState, useEffect, useRef, useMemo, useCallback (already in scope, do NOT import anything)
3. do NOT use import or require statements — everything is already in scope
4. style with inline style objects only (style={{ ... }}), no className, no external css
5. keep it SMALL and SELF-CONTAINED — a single component, no nested component definitions
6. you may call these passed-in actions if needed: openChat, openLongPressSheet, openAttachSheet, toggleSearch, navigateBack
7. keep the visual style consistent with a dark mobile chat app (dark backgrounds, rounded corners, #E8E8E8 text)

place the component in a zone (the key):
- "home-top": top of the contact list, below the app bar
- "home-bottom": bottom of the contact list
- "floating": floating overlay on the home screen
- "chat-header": below the chat screen header

example:
- "add a button at the top that says clear all" → customComponents: { "home-top": "function Component() { return <button style={{margin:'12px',padding:'12px 20px',borderRadius:'12px',background:'#7C3AED',color:'#fff',border:'none',fontSize:'14px'}} onClick={() => alert('clicked')}>clear all</button> }" }
- "add a floating help button bottom right" → customComponents: { "floating": "function Component() { return <div style={{position:'fixed',bottom:'24px',right:'16px',width:'52px',height:'52px',borderRadius:'50%',background:'#2563EB',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px'}}>?</div> }" }

IMPORTANT: prefer the normal style/layout slots whenever possible. only use customComponents when nothing else can express the request. when you do use it, output ONLY valid self-contained JSX that defines "Component".

ICONS (Lucide) — you have access to the entire Lucide icon library (1000+ icons). use icons in TWO ways:

1. in custom components: use the <Icon> component (already in scope, no import):
   <Icon name="heart" size={24} color="#ffffff" />
   - name: the exact lucide icon name (kebab-case)
   - size: pixel size (number)
   - color: any css color

2. as svg replacements in existing icon slots (menuIconSvg, sendIconSvg, optionIconOverrides iconSvg, etc): you can still hand-write svg, but for custom components prefer the <Icon> component.

common lucide icon names (you can use ANY valid lucide name, not just these):
heart, star, settings, search, bell, user, users, home, mail, phone, camera, image, trash-2, edit, plus, minus, x, check, chevron-right, chevron-left, chevron-down, arrow-right, arrow-left, menu, more-vertical, more-horizontal, send, paperclip, smile, mic, video, map-pin, calendar, clock, bookmark, share-2, download, upload, lock, unlock, eye, eye-off, sun, moon, filter, refresh-cw, log-out, archive, pin, bell-off

IMPORTANT: use EXACT lucide names in kebab-case. "trash-2" not "trash" or "delete". "settings" not "gear". "more-vertical" not "dots". if unsure of a name, pick the closest common one above. if an icon name doesn't exist it simply won't show, so prefer names from the common list.

example custom component with icons:
- "add a row of action buttons with icons" → customComponents: { "home-top": "function Component() { return React.createElement('div', {style:{display:'flex',gap:'16px',padding:'16px',justifyContent:'center'}}, React.createElement(Icon, {name:'heart', size:28, color:'#EC4899'}), React.createElement(Icon, {name:'star', size:28, color:'#F59E0B'}), React.createElement(Icon, {name:'bell', size:28, color:'#3B82F6'})); }" }

ANIMATION (Motion / Framer Motion) — in custom components you have access to "motion" and "AnimatePresence" (already in scope, no import). use motion elements for smooth, premium animations.

how to use motion elements:
- replace a normal element with its motion version: React.createElement(motion.div, { ...props }, children)
- animate on mount with initial + animate:
  React.createElement(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }, ...)
- spring physics: transition: { type: "spring", stiffness: 300, damping: 20 }
- tap/hover gestures: whileTap: { scale: 0.95 }, whileHover: { scale: 1.05 }
- looping animation: animate: { rotate: 360 }, transition: { repeat: Infinity, duration: 2, ease: "linear" }

available motion elements: motion.div, motion.span, motion.button, motion.p, motion.img

examples:
- "add a card that springs in at the top" → customComponents: { "home-top": "function Component() { return React.createElement(motion.div, { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: { type: 'spring', stiffness: 300, damping: 20 }, style: { margin: '12px', padding: '20px', borderRadius: '16px', background: '#1a1a2e', color: '#fff' } }, 'Welcome back'); }" }
- "add a bouncy button at the bottom right" → customComponents: { "floating": "function Component() { return React.createElement(motion.button, { whileTap: { scale: 0.9 }, whileHover: { scale: 1.1 }, style: { position: 'fixed', bottom: '24px', right: '16px', width: '56px', height: '56px', borderRadius: '50%', background: '#7C3AED', color: '#fff', border: 'none', fontSize: '24px' } }, '+'); }" }
- "add a pulsing notification dot" → use motion.div with animate: { scale: [1, 1.2, 1] }, transition: { repeat: Infinity, duration: 1.5 }

combine with Icon: React.createElement(motion.div, { whileTap: { scale: 0.9 } }, React.createElement(Icon, { name: 'heart', size: 28, color: '#EC4899' }))

prefer motion for any request involving movement, transitions, bounce, spring, fade, slide, pulse, or "make it feel alive".

EDITING THE APP BAR (componentSources.homeHeader) — the top app bar is now FULLY CODE-EDITABLE. for ANY app bar change — restyle, add a button, remove a button, rearrange, resize — you REWRITE its source code.

the current source is shown above under CURRENT EDITABLE COMPONENT SOURCE. to change the bar, return the COMPLETE new source as componentSources.homeHeader.

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. the title comes from the scope variable "title"
5. wire buttons to scope actions by name: onMenuTap, onSearchTap, onNewChatTap, openSearch, closeSearch, toggleSearch, openLongPressSheet, setSearchBarConfig, setContactListStyle
6. you may use the Icon component for icons: React.createElement(Icon, { name: 'bell', size: 22, color: '#fff' })
7. keep ALL existing functionality unless the user asks to remove it — when adding a button, KEEP the menu, title, search, and pencil, and ADD the new one cleanly in the layout so nothing overlaps
8. position elements with proper fl/flexbox spacing so buttons never overlap
9. PERSISTENT STATE — for any state that must survive screen changes or re-renders (toggles, counters, mode switches), use useComponentState instead of React.useState. syntax is identical: const [isGlobe, setIsGlobe] = useComponentState('globeToggle', false) — the first argument is a unique string key for that piece of state. use React.useState only for truly ephemeral state that is fine to reset on every render.

CRITICAL: when the user says "add a button next to search", rewrite the ENTIRE bar source with the existing buttons PLUS the new one, laid out with correct spacing. do NOT change the existing buttons' icons or actions unless asked. do NOT overlap elements.

example — adding a bell button:
componentSources: { "topAppBar": "function Component() { return React.createElement('div', { style: { display:'flex', alignItems:'center', padding:'12px 16px', background:'#141414', gap:'8px' } }, React.createElement('button', { onClick: onMenuTap, style:{...} }, '☰'), React.createElement('span', { style:{ flex:1, fontSize:'20px', fontWeight:'700', color:'#fff' } }, title), React.createElement('button', { onClick: () => alert('bell'), style:{...} }, React.createElement(Icon,{name:'bell',size:22})), React.createElement('button', { onClick: onSearchTap, style:{...} }, React.createElement(Icon,{name:'search',size:22})), React.createElement('button', { onClick: onNewChatTap, style:{...} }, React.createElement(Icon,{name:'edit',size:22}))) }" }

IMPORTANT: prefer editing componentSources.homeHeader for ALL app bar requests now. do not use the old topAppBarStyle knobs for the app bar anymore — rewrite the source instead.

EDITING THE SEARCH BAR (componentSources.homeSearch) — the search bar is FULLY CODE-EDITABLE. for ANY search bar change — restyle, add animations, control blur behavior, add backdrop, change input — REWRITE its source code. return the new source as componentSources.homeSearch.

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. available scope actions: closeSearch, openSearch, toggleSearch
5. the component is mounted only when search is open — you do NOT need to check or manage open/closed state. it renders when the user taps search, disappears when closeSearch is called.
6. use useComponentState for any state that must survive between search sessions
7. IMPORTANT: do NOT add onBlur handlers that call closeSearch unless the user explicitly asks for blur-to-close behavior. by default the search bar must stay open until the user taps cancel or the app bar search icon.
8. position elements with proper flexbox so the input expands to fill available space

examples:
- "make the search bar stay open when i tap other buttons" → the default already does this (no onBlur close). if a previous version added onBlur, remove it from the input element.
- "make the search bar dark blue with a glow" → componentSources: { "searchBar": "function Component() { ... background:'#0a0a2e', boxShadow:'0 0 20px rgba(37,99,235,0.4)' ... }" }
- "add a slide-down animation to the search bar" → wrap the outer div in motion.div with initial:{ opacity:0, y:-8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.2 }
- "round the search bar corners more" → change borderRadius on the inner div to '20px' or '9999px'
- "make the cancel button a red X icon instead of text" → replace the cancel button with an Icon name='x' in color '#EF4444'

EDITING THE BOTTOM SHEET (componentSources.bottomSheet) — both popup sheets (long-press menu and attach menu) are FULLY CODE-EDITABLE from one single source. rewrite it for any sheet change — layout, animations, style, new elements. return as componentSources.bottomSheet.

the component is mounted only when a sheet is open. it receives this scope:
- title: the sheet header text (string)
- options: array of { id: string, label: string, icon?: string, destructive?: boolean }
- onClose(): close the sheet
- onOptionSelect(option): called when an option is tapped (also triggers close automatically)
- sheetId: 'longPressSheet' or 'attachSheet' — use this to style the two sheets differently if needed
- contactName: the tapped contact's name (longPressSheet only)

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. always render a backdrop div (fixed, full screen, z-index 200) that calls onClose on click
5. always render the sheet panel above the backdrop (z-index 201, fixed, bottom-0)
6. render options via (options || []).map(function(option, index) { ... })
7. always call e.stopPropagation() on option clicks so the backdrop doesn't also fire
8. use useComponentState for any toggle state inside the sheet
9. do NOT use createPortal — the portal is already handled by the parent

examples:
- "make the long press sheet slide up with a spring animation" → wrap the sheet panel in motion.div with initial:{ y:'100%' }, animate:{ y:0 }, transition:{ type:'spring', stiffness:300, damping:30 }
- "make the attach menu a 2x2 grid" → check sheetId === 'attachSheet' and change options container to grid layout
- "make destructive options have a red background row" → check option.destructive for background on the option div
- "make the sheet fully dark with a blur backdrop" → change sheet background to '#0a0a0a', backdrop background to 'rgba(0,0,0,0.8)' with backdropFilter:'blur(4px)'
- "add icons from lucide instead of emoji" → replace option.icon span with React.createElement(Icon, { name: 'bell-off', size: 20, color: '#E8E8E8' }) per option
- "make it look like an iOS action sheet with white background and hairline dividers" → change sheet background to '#fff', option text to '#000', dividers to '#E5E5EA'

EDITING THE CHAT SCREEN (componentSources.chatScreen) — the full conversation screen is FULLY CODE-EDITABLE. for ANY chat screen change — header, messages area, input bar, layout, animations — REWRITE its source code. return as componentSources.chatScreen.

the component receives this scope:
- contactName: the contact's name (string)
- contactInitials: 2-letter initials (string)
- contactAvatarColor: hex color string
- isOnline: boolean
- messages: array of { id, contactId, content, timestamp, isSent, isRead }
- MessageBubble: the message bubble component — render via React.createElement(MessageBubble, { key: msg.id, ...msg })
- onBack(): navigate back to contact list
- onAttach(): open the attach sheet
- useComponentState: persistent state hook, same syntax as React.useState

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon, MessageBubble are all in scope
4. the component must fill the full screen (height: '100vh')
5. always wire onBack to the back button and onAttach to the attach/plus button
6. render messages using (messages || []).map(function(msg) { return React.createElement(MessageBubble, { key: msg.id, ...msg }); })
7. use useRef + useEffect for scroll-to-bottom: var ref = React.useRef(null); React.useEffect(function() { if (ref.current) ref.current.scrollIntoView({ behavior: 'auto' }); }, []);

examples:
- "make the chat screen background dark navy" → change the outer div background to '#0a0a1a'
- "make the header show the contact avatar on the left next to the back button" → reorder header elements
- "add a gradient header that uses the contact's avatar color" → header background: 'linear-gradient(135deg, ' + contactAvatarColor + '33, #141414)'
- "make the input bar taller with a rounded pill shape" → change input borderRadius and padding
- "add a typing indicator above the input bar" → add an animated div above the input bar row
- "slide the whole chat screen in from the right on mount" → wrap the outer div in motion.div with initial:{ x:'100%' }, animate:{ x:0 }

EDITING MESSAGE BUBBLES (componentSources.messageBubble) — every message bubble is FULLY CODE-EDITABLE. for ANY bubble change — colors, shapes, layout, animations, read receipts — REWRITE its source code. return as componentSources.messageBubble.

the SAME source runs for every message. each message receives this scope:
- content: the message text (string)
- timestamp: formatted time string (string)
- isSent: true if sent by the user, false if received (boolean)
- isRead: true if the message has been read (boolean)

rules for the source:
1. define a component named exactly "Component"
2. use React.createElement (NOT JSX)
3. no imports — React, useState, useEffect, useRef, motion, AnimatePresence, Icon are all in scope
4. sent messages (isSent === true) must appear on the RIGHT, received on the LEFT
5. always show timestamp inside the bubble
6. show read receipt (double tick) for sent messages only, based on isRead

examples:
- "make sent bubbles green instead of blue" → change sent bubble background to '#22C55E'
- "make all bubbles fully rounded with no sharp corner" → borderRadius: '18px' on all corners equally
- "make the read receipt tick blue when read" → color: isRead ? '#3B82F6' : 'rgba(255,255,255,0.5)'
- "animate each bubble fading in on mount" → wrap outer div in motion.div with initial:{ opacity:0, y:8 }, animate:{ opacity:1, y:0 }, transition:{ duration:0.2 }
- "make received bubbles have a subtle left border in a teal color" → borderLeft: '3px solid #0891B2' on the bubble div when !isSent
- "make the text bigger" → change fontSize to '17px'
- "make sent messages show on the left too, like telegram" → change justifyContent to 'flex-start' for all, remove the conditional
`

  return `you are an ai ui designer for a mobile chat app. output valid json mutations only.

current screen: ${screen}
contact names (use exact spelling): ${contactNames.join(', ')}
current store state: ${JSON.stringify(storeState, null, 2)}

CURRENT EDITABLE COMPONENT SOURCES:
${sourcesText}

${screen === 'home' ? homeSlots : chatSlots}

FONTS — you have access to the ENTIRE Google Fonts library (over 1500 fonts). to use any font, set fontFamily to the EXACT google fonts name as a string. the app loads it automatically.

how to use:
- set fontFamily to the exact font name, e.g. fontFamily: "Lobster", fontFamily: "Playfair Display", fontFamily: "Pacifico"
- use the EXACT capitalisation and spacing of the real google font name
- you can add a fallback after a comma: fontFamily: "Lobster, cursive"

pick fonts that genuinely match the user's request. some good ones by style:
- elegant serif: "Playfair Display", "Cormorant", "DM Serif Display"
- clean modern sans: "Poppins", "Inter", "Outfit", "Manrope"
- techy/geometric: "Sora", "Space Grotesk", "Chakra Petch"
- bold display: "Bricolage Grotesque", "Archivo Black", "Anton"
- handwritten/script: "Caveat", "Dancing Script", "Pacifico"
- playful: "Fredoka", "Baloo 2", "Comfortaa"
- monospace: "JetBrains Mono", "Space Mono", "Fira Code"
- but you are NOT limited to these — use ANY real google font that fits.

apply fontFamily inside ANY style slot OR inside custom component inline styles.

examples:
- "make the title fancy and elegant" → topAppBarStyle: { title: { fontFamily: "Playfair Display, serif" } }
- "make contact names handwritten" → globalTile: { unread: { name: { fontFamily: "Caveat, cursive" } }, read: { name: { fontFamily: "Caveat, cursive" } } }
- "use a bold condensed font for the headline" → use "Anton" or "Archivo Black" in the relevant slot
- mix fonts freely: a "Playfair Display" headline with "Manrope" body text is elegant.

VERSION NAME — always include a "versionName" field: a SHORT human-friendly title (2-5 words, Title Case) describing this specific change, so the user can recognise it later in their version history. examples: "Purple Gradient Tiles", "Search Moved To Bottom", "iOS-Style Action Sheet", "Bigger Message Text". make it specific to what changed, not generic.

rules:
1. output only the fields that need to change
2. contact names must match exactly including capitalisation
3. all css values must be valid css strings
4. for cloud shape: clipPath: "polygon(10% 40%, 15% 20%, 30% 10%, 50% 15%, 70% 10%, 85% 20%, 90% 40%, 85% 60%, 70% 70%, 50% 75%, 30% 70%, 15% 60%)"
5. output only json — no explanation text
6. ALWAYS include a "versionName" describing the change

example output format:
{
  "perContact": {
    "Priya Sharma": {
      "tile": { "background": "linear-gradient(135deg, #7C3AED, #2563EB)" }
    }
  },
  "globalTile": {
    "unread": { "background": "#1a1a2e" }
  }
}`
}

const MAX_RETRIES = 3
const RETRY_DELAY = 1500 // ms

async function callWithRetry(together: Together, requestParams: any): Promise<any> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await together.chat.completions.create(requestParams)
    } catch (err: any) {
      lastError = err
      // retry only on 503 / service unavailable
      const is503 =
        err?.status === 503 ||
        String(err?.message ?? '').includes('503') ||
        String(err?.message ?? '').toLowerCase().includes('service_unavailable')

      if (is503 && attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)))
        continue
      }
      if (is503) {
        throw new Error('the ai service is busy right now, please try again in a moment')
      }
      throw err
    }
  }
  throw lastError
}

export async function callGenUIForUpdate(params: {
  message: string
  screen: 'home' | 'chat'
  storeState: UIOverrideState
  contactNames: string[]
}): Promise<StoreMutation> {
  const { message, screen, storeState, contactNames } = params

  const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_TOGETHER_API_KEY is not set in AI Studio Secrets')
  }

  const together = new Together({ apiKey })

  const systemPrompt = buildSystemPrompt(screen, storeState, contactNames)

  const response = await callWithRetry(together, {
    model: 'deepseek-ai/DeepSeek-V4-Pro',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${message} — respond in json only` },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ui_mutation',
        schema: RESPONSE_SCHEMA,
      },
    },
    max_tokens: 16000,
    temperature: 0.2,
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error('no response from together ai')
  }

  const parsed = JSON.parse(text) as StoreMutation
  return parsed
}
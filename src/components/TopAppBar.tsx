'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useUIStore } from '@/stores/uiStore'

export interface TopAppBarStyleOverride {
  container?: CSSProperties
  title?: CSSProperties
  leftButton?: CSSProperties
  rightArea?: CSSProperties
  searchSlot?: CSSProperties
}

export interface TopAppBarProps {
  title?: string
  showSearchInBar?: boolean
  hideSearchButton?: boolean
  searchBarSlot?: ReactNode
  onMenuTap?: () => void
  onSearchTap?: () => void
  onNewChatTap?: () => void
  override?: TopAppBarStyleOverride
}

export function TopAppBar(props: TopAppBarProps) {
  const {
    title,
    showSearchInBar = false,
    hideSearchButton = false,
    searchBarSlot,
    onMenuTap,
    onSearchTap,
    onNewChatTap,
    override
  } = props

  const s = useUIStore(state => state.topAppBarStyle) || {}
  const displayTitle = s.titleText ?? title

  return (
    <div
      className="flex flex-row items-center w-full px-[16px] bg-[#141414] border-b border-[#1F1F1F] shrink-0 box-content"
      style={{
        paddingTop: 'var(--sat, env(safe-area-inset-top))',
        height: '56px',
        ...override?.container,
        ...s.container
      }}
    >
      {/* Left Section */}
      <button
        onClick={onMenuTap}
        className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-[#1E1E1E] text-[#E8E8E8] shrink-0"
        style={{ ...override?.leftButton, ...s.menuButton }}
      >
        {s.menuIconSvg ? (
          <span
            style={{ display: 'inline-flex', ...s.menuIcon }}
            dangerouslySetInnerHTML={{ __html: s.menuIconSvg }}
          />
        ) : (
          <div className="text-[20px] font-bold leading-none" style={{ ...s.menuIcon }}>☰</div>
        )}
      </button>

      {/* Center Section */}
      <div className="flex-1 px-[12px] min-w-0">
        {showSearchInBar ? (
          <div style={override?.searchSlot}>
            {searchBarSlot}
          </div>
        ) : (
          <div
            className="text-[20px] font-bold text-[#F0F0F0] truncate"
            style={{ ...override?.title, ...s.title }}
          >
            {displayTitle}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div
        className="flex flex-row items-center gap-[8px] shrink-0"
        style={{ ...override?.rightArea, ...s.rightArea }}
      >
        {!showSearchInBar && !hideSearchButton && (
          <button
            onClick={onSearchTap}
            className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-[#1E1E1E] text-[#E8E8E8]"
            style={{ ...s.searchButton }}
          >
            {s.searchIconSvg ? (
              <span
                style={{ display: 'inline-flex', ...s.searchIcon }}
                dangerouslySetInnerHTML={{ __html: s.searchIconSvg }}
              />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...s.searchIcon }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            )}
          </button>
        )}
        <button
          onClick={onNewChatTap}
          className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-[#1E1E1E] text-[#E8E8E8]"
          style={{ ...s.newChatButton }}
        >
          {s.newChatIconSvg ? (
            <span
              style={{ display: 'inline-flex', ...s.newChatIcon }}
              dangerouslySetInnerHTML={{ __html: s.newChatIconSvg }}
            />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...s.newChatIcon }}>
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

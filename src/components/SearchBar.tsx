'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useUIStore } from '@/stores/uiStore'

export type SearchBarMode = 'inline' | 'overlay'
export type SearchBarStyle = 'full-width' | 'icon-button' | 'pill'

export interface SearchBarStyleOverride {
  container?: CSSProperties
  input?: CSSProperties
  icon?: CSSProperties
  clearButton?: CSSProperties
}

export interface SearchBarProps {
  mode?: SearchBarMode
  style?: SearchBarStyle
  placeholder?: string
  overlayPosition?: {
    bottom?: string
    top?: string
    left?: string
    right?: string
  }
  onClose?: () => void
  override?: SearchBarStyleOverride
}

export function SearchBar(props: SearchBarProps) {
  const {
    mode = 'inline',
    style = 'full-width',
    placeholder = 'Search...',
    overlayPosition = { bottom: '80px', left: '16px', right: '16px' },
    onClose,
    override,
  } = props

  const [mounted, setMounted] = useState(false)
  const value = useUIStore(state => state.componentState?.['searchQuery'] as string | undefined) || ''
  const setValue = (v: string) => useUIStore.getState().setComponentState('searchQuery', v)
  const [isExpanded, setIsExpanded] = useState(false)

  const s = useUIStore(state => state.searchBarStyle)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // Portal must only happen client-side
  if (mode === 'overlay' && !mounted) return null

  const SearchIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...override?.icon, ...s.searchIcon }}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  )

  const ClearIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...override?.clearButton, ...s.clearButton }}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )

  if (mode === 'overlay') {
    return createPortal(
      <>
        {s.placeholder?.color && (
          <style>{`.searchbar-input::placeholder { color: ${s.placeholder.color} !important; }`}</style>
        )}
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[100]"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', ...s.backdrop }}
          onClick={onClose}
        />
        
        {/* Search Bar Container */}
        <div
          className="fixed z-[101] h-[52px] bg-[#1E1E1E] rounded-[24px] flex flex-row items-center px-[16px] gap-[10px]"
          style={{
            ...overlayPosition,
            ...override?.container,
            ...s.container
          }}
        >
          <div className="text-[#8A8A8A] shrink-0" style={{ ...override?.icon, ...s.searchIcon }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="searchbar-input flex-1 bg-transparent border-none outline-none text-[#E8E8E8] placeholder-[#8A8A8A] text-[16px] min-w-0"
            style={{ ...override?.input, ...s.input }}
          />
          
          {value && (
            <button
              onClick={() => setValue('')}
              className="text-[#8A8A8A] w-[24px] h-[24px] flex items-center justify-center shrink-0"
              style={{ ...override?.clearButton, ...s.clearButton }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
          
          <button
            onClick={onClose}
            className="text-[#8A8A8A] flex items-center justify-center shrink-0 ml-[4px]"
            style={s.closeButton}
          >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
          </button>
        </div>
      </>,
      document.body
    )
  }

  // Inline mode
  if (style === 'icon-button' && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-[44px] h-[44px] rounded-full bg-[#1E1E1E] flex items-center justify-center text-[#8A8A8A] shrink-0"
        style={{ ...override?.container, ...s.iconButton }}
      >
        {SearchIcon}
      </button>
    )
  }

  const isPill = style === 'pill'
  const containerClasses = [
    'flex flex-row items-center w-full bg-[#1E1E1E] h-[44px] gap-[8px]',
    isPill ? 'rounded-[24px] px-[16px]' : 'rounded-[12px] px-[12px]'
  ].join(' ')

  return (
    <div className={containerClasses} style={{ ...override?.container, ...s.container }}>
      {s.placeholder?.color && (
        <style>{`.searchbar-input::placeholder { color: ${s.placeholder.color} !important; }`}</style>
      )}
      <div className="text-[#8A8A8A] shrink-0" style={{ ...override?.icon, ...s.searchIcon }}>
        {SearchIcon}
      </div>
      
      <input
        autoFocus={mode === 'inline'}
        onBlur={() => {
          setTimeout(() => {
            onClose?.()
          }, 150)
        }}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="searchbar-input flex-1 bg-transparent border-none outline-none text-[#E8E8E8] placeholder-[#8A8A8A] text-[15px] min-w-0"
        style={{ ...override?.input, ...s.input }}
      />
      
      {value && (
        <button
          onClick={() => setValue('')}
          className="text-[#8A8A8A] w-[20px] h-[20px] flex items-center justify-center shrink-0"
          style={{ ...override?.clearButton, ...s.clearButton }}
        >
          {ClearIcon}
        </button>
      )}
      
      {style === 'icon-button' && isExpanded && (
        <button
          onClick={() => {
            setIsExpanded(false)
            setValue('')
          }}
          className="text-[#8A8A8A] text-[14px] ml-[4px] shrink-0"
          style={s.closeButton}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

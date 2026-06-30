'use client'

import type { CSSProperties } from 'react'
import { useMemo, useRef } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { evaluateContactStyle, mergeStyleOverride } from '@/lib/styleEngine'

export interface ChatTileStyleOverride {
  tile?: CSSProperties
  avatar?: CSSProperties
  avatarText?: CSSProperties
  name?: CSSProperties
  preview?: CSSProperties
  timestamp?: CSSProperties
  badge?: CSSProperties
  onlineIndicator?: CSSProperties
}

export interface ChatTileProps {
  id: string
  name: string
  avatarInitials: string
  avatarColor: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isOnline: boolean
  override?: ChatTileStyleOverride
  onClick?: () => void
  onLongPress?: () => void
}

export const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#DC2626',
  '#D97706', '#7C3AED', '#0891B2', '#BE185D',
  '#4F46E5', '#065F46'
]

export function ChatTile(props: ChatTileProps) {
  const {
    name,
    avatarInitials,
    avatarColor,
    lastMessage,
    lastMessageTime,
    unreadCount,
    isOnline,
    override,
    onClick,
    onLongPress
  } = props

  const perContact = useUIStore(state => state.perContact)
  const globalTile = useUIStore(state => state.globalTile)

  const computedOverride = useMemo(
    () => mergeStyleOverride(
      evaluateContactStyle(name, unreadCount, { perContact, globalTile }),
      override
    ),
    [name, unreadCount, perContact, globalTile, override]
  )

  const displayUnreadCount = unreadCount > 99 ? '99+' : unreadCount.toString()

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress?.()
    }, 500)
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  const handlePointerCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  return (
    <div
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => { e.preventDefault(); onLongPress?.() }}
      className="flex flex-row items-center w-full min-h-[72px] px-[16px] py-[12px] bg-[#141414] border-b border-[#1F1F1F] active:bg-[#1E1E1E] cursor-pointer"
      style={computedOverride.tile}
    >
      {/* Left Section - Avatar */}
      <div className="relative flex-shrink-0 w-[48px] h-[48px] mr-3">
        <div
          className={`flex items-center justify-center w-full h-full rounded-full ${
            isOnline ? 'ring-[2px] ring-[#22C55E]' : ''
          }`}
          style={{ backgroundColor: avatarColor, ...computedOverride.avatar }}
        >
          <span
            className="text-[16px] font-semibold text-[#F3F4F6]"
            style={computedOverride.avatarText}
          >
            {avatarInitials}
          </span>
        </div>
        {isOnline && (
          <div
            className="absolute bottom-0 right-0 w-[10px] h-[10px] bg-[#22C55E] rounded-full"
            style={computedOverride.onlineIndicator}
          />
        )}
      </div>

      {/* Middle Section - Content */}
      <div className="flex flex-col flex-1 min-w-0 mr-3 gap-[3px]">
        <div
          className="truncate text-[15px] font-semibold text-[#E8E8E8]"
          style={computedOverride.name}
        >
          {name}
        </div>
        <div
          className="truncate text-[13px] font-normal text-[#8A8A8A]"
          style={computedOverride.preview}
        >
          {lastMessage}
        </div>
      </div>

      {/* Right Section - Meta */}
      <div className="flex flex-col items-end gap-[6px]">
        <div
          className="text-[11px] font-normal text-[#8A8A8A]"
          style={computedOverride.timestamp}
        >
          {lastMessageTime}
        </div>
        {unreadCount > 0 && (
          <div
            className="flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#3B82F6] px-[6px] text-white text-[11px] font-bold"
            style={computedOverride.badge}
          >
            {displayUnreadCount}
          </div>
        )}
      </div>
    </div>
  )
}

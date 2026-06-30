import type { CSSProperties } from 'react'
import type {
  ContactStyleOverride,
  MessageBubbleStyleOverride,
  MessageConditionRule,
  UIOverrideState,
} from '@/types'

export function evaluateContactStyle(
  contactName: string,
  unreadCount: number,
  uiState: Pick<UIOverrideState, 'perContact' | 'globalTile'>
): ContactStyleOverride {
  // global tile style may contain both tile-level css AND inner element slots
  const rawGlobal = unreadCount > 0 ? uiState.globalTile.unread : uiState.globalTile.read

  // known inner element slot names
  const innerSlots = ['name', 'preview', 'timestamp', 'avatar', 'avatarText', 'badge', 'onlineIndicator']

  const globalTileLevel: Record<string, any> = {}
  const globalInner: Record<string, any> = {}

  if (rawGlobal) {
    for (const [key, value] of Object.entries(rawGlobal)) {
      if (innerSlots.includes(key)) {
        globalInner[key] = value
      } else {
        globalTileLevel[key] = value
      }
    }
  }

  const globalOverride: ContactStyleOverride = {
    tile: globalTileLevel,
    ...globalInner,
  }

  // step 2 — get per-contact override by contact name
  const contactOverride: ContactStyleOverride =
    uiState.perContact[contactName] ?? {}

  // step 3 — merge. per-contact wins over global.
  // for nested style objects (like tile), do a deep merge so partial
  // overrides don't wipe each other out
  return {
    tile: { ...globalOverride.tile, ...contactOverride.tile },
    avatar: { ...globalOverride.avatar, ...contactOverride.avatar },
    avatarText: { ...globalOverride.avatarText, ...contactOverride.avatarText },
    name: { ...globalOverride.name, ...contactOverride.name },
    preview: { ...globalOverride.preview, ...contactOverride.preview },
    timestamp: { ...globalOverride.timestamp, ...contactOverride.timestamp },
    badge: { ...globalOverride.badge, ...contactOverride.badge },
    onlineIndicator: { ...globalOverride.onlineIndicator, ...contactOverride.onlineIndicator },
  }
}

export function evaluateMessageStyle(
  content: string,
  isSent: boolean,
  isRead: boolean,
  conditions: MessageConditionRule[]
): MessageBubbleStyleOverride {
  const merged: MessageBubbleStyleOverride = {}

  for (const rule of conditions) {
    let matches = false

    const { field, operator, value } = rule.condition

    if (field === 'content') {
      const contentLower = content.toLowerCase()
      const valueLower = String(value).toLowerCase()
      if (operator === 'includes') matches = contentLower.includes(valueLower)
      if (operator === 'equals') matches = contentLower === valueLower
      if (operator === 'startsWith') matches = contentLower.startsWith(valueLower)
    }

    if (field === 'isSent') {
      matches = isSent === value
    }

    if (field === 'isRead') {
      matches = isRead === value
    }

    if (matches) {
      // deep merge each slot so partial style overrides don't wipe other slots
      merged.wrapper = { ...merged.wrapper, ...rule.style.wrapper }
      merged.bubble = { ...merged.bubble, ...rule.style.bubble }
      merged.text = { ...merged.text, ...rule.style.text }
      merged.timestamp = { ...merged.timestamp, ...rule.style.timestamp }
      merged.readReceipt = { ...merged.readReceipt, ...rule.style.readReceipt }
    }
  }

  return merged
}

export function mergeStyleOverride(
  storeComputed: ContactStyleOverride,
  propOverride: ContactStyleOverride | undefined
): ContactStyleOverride {
  if (!propOverride) return storeComputed
  return {
    tile: { ...storeComputed.tile, ...propOverride.tile },
    avatar: { ...storeComputed.avatar, ...propOverride.avatar },
    avatarText: { ...storeComputed.avatarText, ...propOverride.avatarText },
    name: { ...storeComputed.name, ...propOverride.name },
    preview: { ...storeComputed.preview, ...propOverride.preview },
    timestamp: { ...storeComputed.timestamp, ...propOverride.timestamp },
    badge: { ...storeComputed.badge, ...propOverride.badge },
    onlineIndicator: { ...storeComputed.onlineIndicator, ...propOverride.onlineIndicator },
  }
}

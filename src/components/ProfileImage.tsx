'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { getCachedMediaUri, cacheRemoteMedia } from '@/lib/mediaCache'

export interface ProfileImageProps {
  // AI-facing prop names (what the system prompt teaches — url, initials, color)
  url?: string | null
  initials?: string
  color?: string
  // Internal/legacy prop names used by the app's own components
  avatarUrl?: string | null
  contactInitials?: string
  contactAvatarColor?: string
  size?: number
}

export function ProfileImage(props: ProfileImageProps) {
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.profileImage ?? null

  // Resolve effective values — accept either the AI-facing names or the legacy names
  const effectiveAvatarUrl = props.url ?? props.avatarUrl ?? null
  const effectiveInitials = props.initials ?? props.contactInitials ?? '?'
  const effectiveColor = props.color ?? props.contactAvatarColor ?? '#2563EB'

  // Resolve the avatar to an on-device cached copy so it renders offline. Online,
  // we show the remote URL immediately and quietly cache it for next time; if a
  // cached file already exists we prefer it (and it survives with no network).
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(effectiveAvatarUrl)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setResolvedAvatar(effectiveAvatarUrl)
      if (!effectiveAvatarUrl) return
      const cached = await getCachedMediaUri(effectiveAvatarUrl)
      if (!cancelled && cached) setResolvedAvatar(cached)
      cacheRemoteMedia(effectiveAvatarUrl, 'image').catch(() => {})
    }
    run()
    return () => { cancelled = true }
  }, [effectiveAvatarUrl])

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

  return (
    <RenderifyHost
      code={source}
      storeActions={{
        ...props,
        // Always expose the canonical names the profileImage source reads —
        // regardless of which prop names the caller used (url/initials/color or the legacy ones)
        avatarUrl: resolvedAvatar,
        contactInitials: effectiveInitials,
        contactAvatarColor: effectiveColor,
        size: props.size,
        useComponentState,
      }}
    />
  )
}

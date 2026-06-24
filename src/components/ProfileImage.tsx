'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { getCachedMediaUri, cacheRemoteMedia } from '@/lib/mediaCache'

export interface ProfileImageProps {
  avatarUrl: string | null
  contactInitials: string
  contactAvatarColor: string
  size?: number
}

export function ProfileImage(props: ProfileImageProps) {
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.profileImage ?? null

  // Resolve the avatar to an on-device cached copy so it renders offline. Online,
  // we show the remote URL immediately and quietly cache it for next time; if a
  // cached file already exists we prefer it (and it survives with no network).
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(props.avatarUrl)
  useEffect(() => {
    let cancelled = false
    const url = props.avatarUrl
    const run = async () => {
      setResolvedAvatar(url)
      if (!url) return
      const cached = await getCachedMediaUri(url)
      if (!cancelled && cached) setResolvedAvatar(cached)
      cacheRemoteMedia(url, 'image').catch(() => {})
    }
    run()
    return () => { cancelled = true }
  }, [props.avatarUrl])

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
      storeActions={{ ...props, avatarUrl: resolvedAvatar, useComponentState }}
    />
  )
}

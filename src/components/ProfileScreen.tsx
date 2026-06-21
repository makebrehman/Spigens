'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { updateAvatar } from '@/lib/avatarUpload'
import { ProfileImage } from '@/components/ProfileImage'
import { BackButton } from '@/components/BackButton'

export interface ProfileScreenProps {
  onBack: () => void
  isTab?: boolean
  onOpenSettings?: () => void
}

export function ProfileScreen(props: ProfileScreenProps) {
  const { onBack, isTab } = props
  const profile = useAuthStore(state => state.profile)
  const user = useAuthStore(state => state.user)
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.profileScreen ?? null
  const [uploading, setUploading] = useState(false)

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

  const onSave = async (displayName: string, bio: string, newUsername: string) => {
    if (!user?.id) return
    useUIStore.getState().setComponentState('profileSaveError', null)
    const updates: any = { display_name: displayName.trim(), bio: bio.trim() }
    const trimmedUsername = newUsername.toLowerCase().trim()
    if (trimmedUsername && trimmedUsername !== profile?.username) {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', trimmedUsername).neq('id', user.id).maybeSingle()
      if (existing) {
        useUIStore.getState().setComponentState('profileSaveError', 'Username already taken')
        return
      }
      updates.username = trimmedUsername
    }
    supabase.from('profiles').update(updates).eq('id', user.id).then(({ error }: any) => {
      if (error) {
        console.error('Failed to save profile:', error)
        useUIStore.getState().setComponentState('profileSaveError', 'Failed to save')
        return
      }
      useAuthStore.getState().loadProfile(user.id)
    })
  }

  const onChangeAvatar = (file: File) => {
    if (!user?.id) return
    setUploading(true)
    updateAvatar(user.id, file).then((url) => {
      setUploading(false)
      if (url) { useAuthStore.getState().loadProfile(user.id) }
    })
  }

  const onLogout = () => {
    useAuthStore.getState().signOut()
  }

  const onOpenSettings = (props as any).onOpenSettings

  const checkUsername = async (usernameToCheck: string): Promise<string> => {
    if (!user?.id) return 'idle'
    const trimmed = usernameToCheck.toLowerCase().trim()
    if (!trimmed || trimmed.length < 2) return 'too_short'
    if (trimmed === profile?.username) return 'current'
    const { data } = await supabase
      .from('profiles').select('id').eq('username', trimmed).neq('id', user.id).maybeSingle()
    return data ? 'taken' : 'available'
  }

  const initials = (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase() || '?'

  return (
    <RenderifyHost
      code={source}
      storeActions={{
        displayName: profile?.display_name || '',
        bio: profile?.bio || '',
        username: profile?.username || '',
        initialDisplayName: profile?.display_name || '',
        initialBio: profile?.bio || '',
        initialUsername: profile?.username || '',
        avatarUrl: profile?.avatar_url || null,
        avatarInitials: initials,
        avatarColor: '#2563EB',
        onSave,
        onChangeAvatar,
        uploading,
        onLogout,
        onOpenSettings: onOpenSettings || null,
        onBack,
        checkUsername,
        ProfileImage,
        BackButton,
        useComponentState,
        isTab: isTab ?? false,
      }}
    />
  )
}

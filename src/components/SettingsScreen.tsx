'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStore } from '@/stores/networkStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'

interface SettingsScreenProps {
  onBack: () => void
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.settingsScreen ?? null
  const user = useAuthStore(state => state.user)
  const profile = useAuthStore(state => state.profile)
  const networkIsOnline = useNetworkStore(state => state.isOnline)

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

  // Seed notification toggle from localStorage; clear transient list state on unmount.
  useEffect(() => {
    let v = true
    try {
      const stored = localStorage.getItem('spigen_notifications_enabled')
      if (stored !== null) v = stored === 'true'
    } catch {}
    useUIStore.getState().setComponentState('settingsNotifsEnabled', v)
    return () => {
      useUIStore.getState().setComponentState('settingsBlocked', [])
      useUIStore.getState().setComponentState('settingsBlockedError', null)
      useUIStore.getState().setComponentState('settingsBlockedLoading', false)
      useUIStore.getState().setComponentState('settingsUnblockSuccess', null)
    }
  }, [])

  // Keep profile data in componentState so GenUI sources can access it via useComponentState.
  useEffect(() => {
    useUIStore.getState().setComponentState('settingsProfile', profile ?? null)
    useUIStore.getState().setComponentState('settingsUser', user ?? null)
  }, [profile, user])

  const onToggleNotifs = () => {
    const cur = (useUIStore.getState().componentState as any)?.settingsNotifsEnabled ?? true
    const next = !cur
    try { localStorage.setItem('spigen_notifications_enabled', String(next)) } catch {}
    useUIStore.getState().setComponentState('settingsNotifsEnabled', next)
  }

  const onLoadBlocked = async () => {
    useUIStore.getState().setComponentState('settingsBlockedLoading', true)
    useUIStore.getState().setComponentState('settingsBlockedError', null)
    try {
      const { data: rows, error } = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      const ids = (rows || []).map((r: any) => r.blocked_id)
      const profMap: Record<string, any> = {}
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', ids)
        ;(profs || []).forEach((p: any) => { profMap[p.id] = p })
      }
      const list = (rows || []).map((r: any) => {
        const p = profMap[r.blocked_id] || {}
        return { blockId: r.id, id: r.blocked_id, name: p.display_name || p.username || 'Unknown', username: p.username || null, avatarUrl: p.avatar_url || null }
      })
      useUIStore.getState().setComponentState('settingsBlocked', list)
    } catch {
      useUIStore.getState().setComponentState('settingsBlockedError', 'Failed to load blocked users')
    } finally {
      useUIStore.getState().setComponentState('settingsBlockedLoading', false)
    }
  }

  const onUnblock = async (blockId: string, userId: string) => {
    const cur = ((useUIStore.getState().componentState as any)?.settingsBlocked ?? []) as any[]
    const snapshot = cur.find(b => b.blockId === blockId)
    useUIStore.getState().setComponentState('settingsBlocked', cur.filter(b => b.blockId !== blockId))
    const { error } = await supabase.from('blocks').delete().eq('id', blockId)
    if (error && snapshot) {
      const now = ((useUIStore.getState().componentState as any)?.settingsBlocked ?? []) as any[]
      useUIStore.getState().setComponentState('settingsBlocked', [...now, snapshot])
    } else {
      useUIStore.getState().setComponentState('settingsUnblockSuccess', userId)
      setTimeout(() => useUIStore.getState().setComponentState('settingsUnblockSuccess', null), 1500)
    }
  }

  const onLogout = async () => {
    await useAuthStore.getState().signOut()
  }

  const onDeleteAccount = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return { error: 'Account deletion failed. Please try again.' }
    try { await supabase.auth.signOut() } catch {}
    useAuthStore.setState({ user: null, profile: null, isAuthenticated: false, privateKey: null } as any)
    return { error: null }
  }

  const onChangePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message || 'Failed to change password.' }
    return { error: null }
  }

  return (
    <RenderifyHost
      code={source}
      storeActions={{
        onBack,
        useComponentState,
        onToggleNotifs,
        onLoadBlocked,
        onUnblock,
        onLogout,
        onDeleteAccount,
        onChangePassword,
        profile,
        user,
        networkIsOnline,
      }}
    />
  )
}

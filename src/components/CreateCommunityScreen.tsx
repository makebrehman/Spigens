'use client'
import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { uploadCommunityImage } from '@/lib/avatarUpload'
import { BackButton } from './BackButton'
export interface CreateCommunityScreenProps {
  onBack: () => void
  onCreated: (community: any) => void
}
export function CreateCommunityScreen(props: CreateCommunityScreenProps) {
  const { onBack, onCreated } = props
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const pendingImageFileRef = useRef<File | null>(null)
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.createCommunityScreen ?? null
  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(() => (useUIStore.getState().componentState as Record<string,any>)?.[key] ?? defaultValue)
    useEffect(() => { const unsub = useUIStore.subscribe((state: any, prevState: any) => { const next = state.componentState?.[key]; const prev = prevState.componentState?.[key]; if (next !== prev) setValue(next ?? defaultValue) }); return unsub }, [key, defaultValue])
    return [value, (newVal: any) => { if (typeof newVal === 'function') { setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r }) } else { setValue(newVal); useUIStore.getState().setComponentState(key, newVal) } }] as [any, (v: any) => void]
  }
  const onCreate = async (name: string, description: string, type: string) => {
    useUIStore.getState().setComponentState('createCommunityError', null)
    const { data, error } = await supabase.rpc('create_community', { p_name: name, p_description: description, p_type: type })
    if (error) { useUIStore.getState().setComponentState('createCommunityError', error.message); return }
    let avatarUrl: string | null = null
    if (pendingImageFileRef.current) {
      avatarUrl = await uploadCommunityImage(data, pendingImageFileRef.current).catch((err: any) => { console.error('Image upload failed:', err); return null })
    }
    const communityObj = {
      id: data,
      name: name.trim(),
      description: description.trim() || null,
      type: type,
      member_count: 1,
      avatar_url: avatarUrl,
      created_at: new Date().toISOString(),
      isMember: true,
      userRole: 'owner',
    }
    onCreated(communityObj)
  }
  return <RenderifyHost code={source} storeActions={{ onBack, onCreate, onPickImage: (file: File) => { pendingImageFileRef.current = file; setPendingImageFile(file) }, BackButton, useComponentState }} />
}

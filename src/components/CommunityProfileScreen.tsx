'use client'
import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { RenderifyHost } from '@/components/RenderifyHost'
import { supabase } from '@/lib/supabase'
import { uploadCommunityImage } from '@/lib/avatarUpload'
import { ProfileImage } from '@/components/ProfileImage'
import { BackButton } from '@/components/BackButton'
export interface CommunityProfileScreenProps {
  communityId: string
  communityName?: string
  communityType?: string
  communityDescription?: string | null
  communityAvatarUrl?: string | null
  memberCount?: number
  userRole?: string | null
  isMember: boolean
  onBack: () => void
  onCommunityDeleted?: () => void
  onStartDMWithUser?: (userId: string, displayName?: string, username?: string, avatarUrl?: string | null) => void
  onViewMemberProfile?: (userId: string, displayName?: string, username?: string, avatarUrl?: string | null) => void
  onLeaveAndExit?: () => void
  inviteMessageId?: string
  onOpenCommunity?: (communityId: string, name: string, type: string, memberCount: number, avatarUrl: string | null) => void
}
export function CommunityProfileScreen(props: CommunityProfileScreenProps) {
  const { communityId, communityName, communityType, communityDescription, communityAvatarUrl, memberCount: memberCountProp, userRole, isMember: initialIsMember, onBack, onCommunityDeleted, onStartDMWithUser, onViewMemberProfile, onLeaveAndExit, inviteMessageId, onOpenCommunity } = props
  const currentUserId = useAuthStore(state => state.user?.id)
  const profile = useAuthStore(state => state.profile)
  const componentSources = useUIStore(state => state.componentSources)
  const source = componentSources?.communityProfileScreen ?? null
  const [isMember, setIsMember] = useState(initialIsMember)
  const [memberCount, setMemberCount] = useState(memberCountProp || 0)
  useEffect(() => {
    useUIStore.getState().setComponentState('communityProfileIsMember', isMember)
    return () => { useUIStore.getState().setComponentState('communityProfileIsMember', false) }
  }, [isMember])
  const [communityImageUploading, setCommunityImageUploading] = useState(false)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const showSuccess = (msg: string) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 2000) }
  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(() => (useUIStore.getState().componentState as Record<string,any>)?.[key] ?? defaultValue)
    useEffect(() => { const unsub = useUIStore.subscribe((state: any, prevState: any) => { const next = state.componentState?.[key]; const prev = prevState.componentState?.[key]; if (next !== prev) setValue(next ?? defaultValue) }); return unsub }, [key, defaultValue])
    return [value, (newVal: any) => { if (typeof newVal === 'function') { setValue((prev: any) => { const r = newVal(prev); useUIStore.getState().setComponentState(key, r); return r }) } else { setValue(newVal); useUIStore.getState().setComponentState(key, newVal) } }] as [any, (v: any) => void]
  }
  const loadPendingRequests = async () => {
    if ((userRole !== 'owner' && userRole !== 'admin') || communityType !== 'protected') return
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select('user_id, joined_at, profiles!community_members_user_id_fkey(display_name, username, avatar_url)')
        .eq('community_id', communityId)
        .eq('status', 'pending')
        .order('joined_at', { ascending: true })
      if (error) throw error
      useUIStore.getState().setComponentState('pendingRequests', (data || []).map((r: any) => ({
        user_id: r.user_id,
        display_name: r.profiles?.display_name,
        username: r.profiles?.username,
        avatar_url: r.profiles?.avatar_url,
      })))
    } catch {
      // non-critical, silently skip
    }
  }
  useEffect(() => {
    supabase.from('communities').select('*').eq('id', communityId).single().then(({ data }: any) => { if (data) useUIStore.getState().setComponentState('communityProfileData', data) })
    supabase.from('community_members').select('user_id, role, profiles(display_name, username, avatar_url)').eq('community_id', communityId).eq('status', 'active').limit(30).then(({ data }: any) => {
      if (data) useUIStore.getState().setComponentState('communityProfileMembers', data.map((m: any) => ({ user_id: m.user_id, role: m.role, display_name: m.profiles?.display_name, username: m.profiles?.username, avatar_url: m.profiles?.avatar_url })))
      loadPendingRequests()
    })
    return () => { useUIStore.getState().setComponentState('communityProfileData', null); useUIStore.getState().setComponentState('communityProfileMembers', []); useUIStore.getState().setComponentState('pendingRequests', []) }
  }, [communityId])
  const onUpdateCommunityImage = async (file: File) => {
    setCommunityImageUploading(true)
    const url = await uploadCommunityImage(communityId, file)
    setCommunityImageUploading(false)
    if (url) { const c = useUIStore.getState().componentState?.communityProfileData; if (c) useUIStore.getState().setComponentState('communityProfileData', { ...c, avatar_url: url }) }
  }
  const onJoin = async () => {
    if (!currentUserId) return
    const { error } = await supabase.from('community_members').upsert(
      { community_id: communityId, user_id: currentUserId, role: 'member', status: 'active' },
      { onConflict: 'community_id,user_id' }
    )
    if (error) { useUIStore.getState().setComponentState('communityProfileError', 'Failed to join. Please try again.'); return }
    const joinName = profile?.display_name || profile?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: joinName + ' joined', message_type: 'system' })
    setIsMember(true)
    setMemberCount((prev: number) => prev + 1)
    showSuccess('Joined!')
    const commData = useUIStore.getState().componentState?.communityProfileData as any
    if (commData) useUIStore.getState().setComponentState('communityProfileData', { ...commData, member_count: (commData.member_count || 0) + 1 })
    if (inviteMessageId) {
      supabase.from('messages').select('metadata').eq('id', inviteMessageId).single()
        .then(({ data: msgData }: any) => {
          supabase.from('messages').update({ metadata: { ...(msgData?.metadata || {}), usedAt: new Date().toISOString(), usedBy: currentUserId } }).eq('id', inviteMessageId).then(() => {})
        })
    }
  }
  const onRequest = async () => {
    if (!currentUserId) return
    const { error } = await supabase.from('community_members').upsert(
      { community_id: communityId, user_id: currentUserId, role: 'member', status: 'pending' },
      { onConflict: 'community_id,user_id' }
    )
    if (error) { useUIStore.getState().setComponentState('communityProfileError', 'Failed to send request. Please try again.'); return }
    showSuccess('Request sent!')
  }
  const onApproveRequest = async (userId: string, displayName: string) => {
    const { error } = await supabase.from('community_members').update({ status: 'active' }).eq('community_id', communityId).eq('user_id', userId)
    if (error) { console.error('Failed to approve request:', error); return }
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: (displayName || 'Someone') + ' joined', message_type: 'system' })
    setMemberCount((prev: number) => prev + 1)
    const commData = useUIStore.getState().componentState?.communityProfileData as any
    if (commData) useUIStore.getState().setComponentState('communityProfileData', { ...commData, member_count: (commData.member_count || 0) + 1 })
    const curReqs = useUIStore.getState().componentState?.pendingRequests as any[] || []
    useUIStore.getState().setComponentState('pendingRequests', curReqs.filter((r: any) => r.user_id !== userId))
  }
  const onRejectRequest = async (userId: string) => {
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
    const curReqs = useUIStore.getState().componentState?.pendingRequests as any[] || []
    useUIStore.getState().setComponentState('pendingRequests', curReqs.filter((r: any) => r.user_id !== userId))
  }
  const onLeave = async () => {
    if (!currentUserId) return
    const leaveName = profile?.display_name || profile?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: leaveName + ' left', message_type: 'system' })
    const { error } = await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', currentUserId)
    if (error) { useUIStore.getState().setComponentState('communityProfileError', 'Failed to leave. Please try again.'); return }
    setIsMember(false)
    setMemberCount((prev: number) => Math.max(0, prev - 1))
    useUIStore.getState().setComponentState('communityProfileIsMember', false)
    const commLeaveData = useUIStore.getState().componentState?.communityProfileData as any
    if (commLeaveData) useUIStore.getState().setComponentState('communityProfileData', { ...commLeaveData, member_count: Math.max(0, (commLeaveData.member_count || 1) - 1) })
    const curMembers = useUIStore.getState().componentState?.communityProfileMembers as any[] || []
    useUIStore.getState().setComponentState('communityProfileMembers', curMembers.filter((m: any) => m.user_id !== currentUserId))
    if (communityType === 'private') { onLeaveAndExit?.() }
  }
  const onRemoveMember = async (userId: string, userName: string) => {
    await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: userName + ' was removed', message_type: 'system', metadata: { removedUserId: userId } })
    setMemberCount((prev: number) => Math.max(0, prev - 1))
    const commRemoveData = useUIStore.getState().componentState?.communityProfileData as any
    if (commRemoveData) useUIStore.getState().setComponentState('communityProfileData', { ...commRemoveData, member_count: Math.max(0, (commRemoveData.member_count || 1) - 1) })
    const curMembersR = useUIStore.getState().componentState?.communityProfileMembers as any[] || []
    useUIStore.getState().setComponentState('communityProfileMembers', curMembersR.filter((m: any) => m.user_id !== userId))
    const kickCh = supabase.channel('community-kick-' + communityId)
    kickCh.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await kickCh.send({ type: 'broadcast', event: 'member_removed', payload: { userId } })
        supabase.removeChannel(kickCh)
      }
    })
    const members = (useUIStore.getState().componentState?.communityProfileMembers || []) as any[]
    useUIStore.getState().setComponentState('communityProfileMembers', members.filter((m: any) => m.user_id !== userId))
    const data = useUIStore.getState().componentState?.communityProfileData as any
    if (data) useUIStore.getState().setComponentState('communityProfileData', { ...data, member_count: Math.max(0, (data.member_count || 1) - 1) })
  }
  const onDeleteCommunity = async () => {
    const { error } = await supabase.from('communities').delete().eq('id', communityId)
    if (error) { useUIStore.getState().setComponentState('communityProfileError', 'Failed to delete community. Please try again.'); return }
    if (onCommunityDeleted) onCommunityDeleted()
  }
  const onTransferOwnership = async (newOwnerId: string, newOwnerName: string) => {
    if (!currentUserId) return
    await supabase.from('community_members').update({ role: 'owner' }).eq('community_id', communityId).eq('user_id', newOwnerId)
    await supabase.from('community_members').update({ role: 'member' }).eq('community_id', communityId).eq('user_id', currentUserId)
    const transferrerName = profile?.display_name || profile?.username || 'Someone'
    await supabase.from('community_messages').insert({ community_id: communityId, sender_id: currentUserId, content: transferrerName + ' made ' + newOwnerName + ' the new Admin', message_type: 'system' })
    onBack()
  }

  const searchUsersToInvite = async (query: string) => {
    if (!query || query.trim().length < 2) { useUIStore.getState().setComponentState('inviteSearchResults', []); return }
    const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url').ilike('username', `%${query.trim()}%`).neq('id', currentUserId).limit(8)
    useUIStore.getState().setComponentState('inviteSearchResults', data || [])
  }
  const onInviteUser = async (targetUserId: string) => {
    if (!currentUserId) return
    const { data: convId, error } = await supabase.rpc('find_or_create_dm_conversation', { other_user_id: targetUserId })
    if (!convId || error) { console.error('Failed to get conversation for invite:', error); return }
    const communityData = useUIStore.getState().componentState?.communityProfileData as any
    await supabase.from('messages').insert({
      conversation_id: convId, sender_id: currentUserId,
      message_type: 'invite',
      content: 'Community invite: ' + communityName,
      metadata: { communityId, communityName, communityType, avatarUrl: communityData?.avatar_url || communityAvatarUrl || null, memberCount: communityData?.member_count || memberCount, description: communityData?.description || communityDescription || null }
    })
    useUIStore.getState().setComponentState('inviteSearchResults', [])
    useUIStore.getState().setComponentState('inviteQuery', '')
    useUIStore.getState().setComponentState('lastInvitedUserId', targetUserId)
    setTimeout(() => useUIStore.getState().setComponentState('lastInvitedUserId', null), 2500)
  }
  const onSaveEdit = async (name: string, description: string) => {
    if (pendingImageFile) {
      setCommunityImageUploading(true)
      const url = await uploadCommunityImage(communityId, pendingImageFile)
      setCommunityImageUploading(false)
      setPendingImageFile(null)
      useUIStore.getState().setComponentState('communityPendingPreviewUrl', null)
      if (url) {
        const c = useUIStore.getState().componentState?.communityProfileData as any
        if (c) useUIStore.getState().setComponentState('communityProfileData', { ...c, avatar_url: url })
      }
    }
    const { error } = await supabase.from('communities').update({ name: name.trim(), description: description.trim() || null }).eq('id', communityId)
    if (error) { useUIStore.getState().setComponentState('communityProfileError', 'Failed to save changes. Please try again.'); return }
    const data = useUIStore.getState().componentState?.communityProfileData as any
    if (data) useUIStore.getState().setComponentState('communityProfileData', { ...data, name: name.trim(), description: description.trim() || null })
  }
  return (
    <>
    {successToast && (
      <div style={{ position: 'fixed', left: '50%', bottom: 'calc(80px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 220, background: '#16a34a', color: '#fff', padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        ✓ {successToast}
      </div>
    )}
    <RenderifyHost
      code={source}
      storeActions={{
        communityId, communityName: communityName || '', communityType: communityType || 'public',
        communityDescription: communityDescription || null, communityAvatarUrl: communityAvatarUrl || null,
        memberCount: memberCount || 0, userRole: userRole || null, isMember,
        currentUserId: currentUserId || null,
        onUpdateCommunityImage, onJoin, onRequest, onLeave,
        onRemoveMember, onDeleteCommunity, onTransferOwnership, onSaveEdit,
        searchUsersToInvite,
        onInviteUser,
        onApproveRequest,
        onRejectRequest,
        onOpenCommunity,
        imageUploading: communityImageUploading,
        onPickPendingImage: (file: File) => { setPendingImageFile(file); useUIStore.getState().setComponentState('communityPendingPreviewUrl', URL.createObjectURL(file)) },
        onCancelEdit: () => { setPendingImageFile(null); useUIStore.getState().setComponentState('communityPendingPreviewUrl', null) },
        onStartDMWithUser: (userId: string, displayName?: string, username?: string, avatarUrl?: string | null) => onStartDMWithUser?.(userId, displayName, username, avatarUrl),
        onViewMemberProfile: (userId: string, displayName?: string, username?: string, avatarUrl?: string | null) => onViewMemberProfile?.(userId, displayName, username, avatarUrl),
        onBack, ProfileImage, BackButton, useComponentState,
        joinSuccess: successToast === 'Joined!',
        requestSent: successToast === 'Request sent!',
      }}
    />
    </>
  )
}

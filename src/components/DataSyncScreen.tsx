'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { loadConversations } from '@/lib/loadConversations'
import {
  cacheContacts,
  cacheMessages,
  cacheCommunityList,
  cacheCommunityMessages,
  cacheCommunityMembers,
  cacheProfile,
} from '@/lib/offlineCache'
import { markInitialSyncDone, hasInitialSyncDone } from '@/stores/authStore'
import { cacheRemoteMedia } from '@/lib/mediaCache'
import { toLocalMessage, type LocalMessage } from '@/lib/messageShape'
import type { Contact } from '@/types'

// Warm the on-device media cache with a bounded number of parallel downloads, so
// sign-in stays responsive while photos/avatars become available offline.
async function warmMediaCache(urls: string[], kind: string, concurrency = 4): Promise<void> {
  const unique = Array.from(new Set(urls.filter(Boolean)))
  let i = 0
  const worker = async () => {
    while (i < unique.length) {
      const u = unique[i++]
      try { await cacheRemoteMedia(u, kind) } catch { /* best-effort */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker))
}

interface Props {
  userId: string
  privateKey: string | null
  isOnline: boolean
  onDone: () => void
}

export function DataSyncScreen({ userId, privateKey, isOnline, onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('connecting...')

  useEffect(() => {
    if (!isOnline) { onDone(); return }

    let active = true

    const sync = async () => {
      try {
        // Already fully synced once on this device (e.g. this screen remounted
        // mid-flight) — don't re-download, just release the screen.
        if (await hasInitialSyncDone(userId)) { onDone(); return }

        // Step 1 — conversations (0 → 25 %)
        setLabel('fetching your chats...')
        setProgress(5)

        const conversations = await loadConversations(userId, privateKey)
        if (!active) return
        setProgress(25)

        const contacts: Contact[] = conversations.map(c => ({
          id: c.otherProfile.id,
          name: c.otherProfile.display_name || c.otherProfile.username || 'Unknown',
          avatarInitials: (c.otherProfile.display_name || c.otherProfile.username || '?')[0].toUpperCase(),
          avatarColor: '#555',
          avatarUrl: c.otherProfile.avatar_url,
          lastMessage: c.lastMessage,
          lastMessageTime: new Date(c.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: 0,
          isOnline: false,
          conversationId: c.conversationId,
          rawProfile: c.otherProfile,
        }))
        if (contacts.length) await cacheContacts(userId, contacts)

        // Cache each chat partner's profile too, so their profile screen works offline.
        for (const c of conversations) {
          if (c.otherProfile?.id) {
            try { await cacheProfile(c.otherProfile.id, c.otherProfile) } catch { /* non-fatal */ }
          }
        }

        // Step 2 — last 50 messages for every conversation (25 → 65 %)
        setLabel('syncing messages...')
        const imageUrls: string[] = []
        for (let i = 0; i < conversations.length; i++) {
          if (!active) return
          const conv = conversations[i]
          const { data } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, encrypted_content, message_type, metadata, status, reply_to, created_at, updated_at, deleted_at')
            .eq('conversation_id', conv.conversationId)
            .order('created_at', { ascending: false })
            .limit(50)
          if (data?.length) {
            const otherPublicKey = conv.otherProfile?.public_key
            const contactName = conv.otherProfile?.display_name || conv.otherProfile?.username || 'Unknown'
            const ordered = [...data].reverse()
            const local: LocalMessage[] = []
            for (const row of ordered) {
              local.push(toLocalMessage(row, {
                currentUserId: userId,
                otherPublicKey,
                myPrivateKey: privateKey,
                contactName,
                prev: local,
              }))
            }
            await cacheMessages(conv.conversationId, local)
            for (const m of local) {
              if (m.messageType === 'image' && typeof m.content === 'string' && m.content.startsWith('http')) {
                imageUrls.push(m.content)
              }
            }
          }
          setProgress(25 + Math.round(((i + 1) / Math.max(conversations.length, 1)) * 40))
        }

        // Step 3 — communities (65 → 80 %)
        setLabel('loading communities...')
        setProgress(67)

        const [commRes, memRes] = await Promise.all([
          supabase.from('communities').select('*').order('name'),
          supabase.from('community_members')
            .select('community_id, role, status')
            .eq('user_id', userId)
            .eq('status', 'active'),
        ])
        if (!active) return

        const allComms = commRes.data || []
        const roleById: Record<string, string> = {}
        ;(memRes.data || []).forEach((m: any) => { roleById[m.community_id] = m.role })
        const myIds = new Set(Object.keys(roleById))
        const myComms = allComms
          .filter((c: any) => myIds.has(c.id))
          .map((c: any) => ({ ...c, isMember: true, userRole: roleById[c.id] || 'member' }))
        if (myComms.length) await cacheCommunityList(userId, myComms)
        setProgress(80)

        // Step 4 — last 50 messages for every community (80 → 97 %)
        setLabel('syncing community chats...')
        for (let i = 0; i < myComms.length; i++) {
          if (!active) return
          const { data } = await supabase
            .from('community_messages')
            .select('id, community_id, sender_id, content, message_type, metadata, created_at, reply_to, deleted_at, profiles!sender_id(display_name, username, avatar_url)')
            .eq('community_id', myComms[i].id)
            .order('created_at', { ascending: false })
            .limit(50)
          if (data?.length) {
            const formatted = [...data].reverse().map((row: any) => {
              const sp = row.profiles
              const name = sp?.display_name || sp?.username || 'Unknown'
              return {
                id: row.id,
                content: row.content || '',
                messageType: row.message_type || 'text',
                senderId: row.sender_id,
                senderName: name,
                senderAvatar: sp?.avatar_url ?? null,
                senderInitials: (sp?.display_name || sp?.username || '?').charAt(0).toUpperCase(),
                timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: row.created_at,
                isMine: row.sender_id === userId,
                isDeleted: !!row.deleted_at,
                replyTo: row.reply_to || null,
              }
            })
            await cacheCommunityMessages(myComms[i].id, formatted)
          }
          const { data: mem } = await supabase
            .from('community_members')
            .select('user_id, role, profiles(display_name, username, avatar_url)')
            .eq('community_id', myComms[i].id)
            .eq('status', 'active')
            .limit(100)
          if (mem?.length) {
            await cacheCommunityMembers(myComms[i].id, mem.map((m: any) => ({
              user_id: m.user_id, role: m.role,
              display_name: (m.profiles as any)?.display_name, username: (m.profiles as any)?.username, avatar_url: (m.profiles as any)?.avatar_url,
            })))
          }
          setProgress(80 + Math.round(((i + 1) / Math.max(myComms.length, 1)) * 17))
        }

        if (!active) return

        let ownAvatar: string | null = null
        try {
          const { data: me } = await supabase.from('profiles').select('*').eq('id', userId).single()
          if (me) { await cacheProfile(userId, me); ownAvatar = (me as any).avatar_url ?? null }
        } catch { /* offline / non-fatal */ }

        const avatarUrls = [
          ...(ownAvatar ? [ownAvatar] : []),
          ...contacts.map(c => c.avatarUrl).filter((u): u is string => !!u),
          ...myComms.map((c: any) => c.avatar_url).filter((u: any): u is string => !!u),
        ]
        void warmMediaCache(avatarUrls, 'image')
        void warmMediaCache(imageUrls.slice(-30), 'image')

        await markInitialSyncDone(userId)
        setProgress(100)
        setLabel('ready!')
        setTimeout(() => onDone(), 600)
      } catch {
        onDone()
      }
    }

    sync()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      height: '100vh', width: '100%', background: '#050505',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit', overflow: 'hidden',
    }}>
      <img
        src="/spigens_logo.png"
        alt="Spigens"
        style={{ width: 72, height: 72, borderRadius: 20, objectFit: 'cover', marginBottom: '18px' }}
      />

      <div style={{ fontSize: '10px', letterSpacing: '5px', color: 'rgba(255,255,255,0.16)', marginBottom: '5px' }}>
        spigens
      </div>

      <div style={{ fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.10)', marginBottom: '44px' }}>
        end-to-end encrypted
      </div>

      <div style={{ width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '13px' }}>
        <div style={{
          width: '100%', height: '3px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '999px', overflow: 'hidden',
        }}>
          <motion.div
            style={{ height: '100%', background: 'rgba(255,255,255,0.52)', borderRadius: '999px' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
          />
        </div>

        <div style={{
          fontSize: '10px', letterSpacing: '1.5px',
          color: 'rgba(255,255,255,0.20)', textAlign: 'center',
        }}>
          {label}
        </div>
      </div>
    </div>
  )
}

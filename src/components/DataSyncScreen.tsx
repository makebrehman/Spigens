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
} from '@/lib/offlineCache'
import type { Contact } from '@/types'

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
          rawProfile: c.otherProfile,
        }))
        if (contacts.length) cacheContacts(userId, contacts)

        // Step 2 — last 50 messages for every conversation (25 → 65 %)
        setLabel('syncing messages...')
        for (let i = 0; i < conversations.length; i++) {
          if (!active) return
          const { data } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, encrypted_content, message_type, metadata, status, reply_to, created_at, updated_at, deleted_at')
            .eq('conversation_id', conversations[i].conversationId)
            .order('created_at', { ascending: false })
            .limit(50)
          if (data?.length) cacheMessages(conversations[i].conversationId, [...data].reverse())
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
        const myIds = new Set((memRes.data || []).map((m: any) => m.community_id as string))
        const myComms = allComms.filter((c: any) => myIds.has(c.id))
        if (myComms.length) cacheCommunityList(userId, myComms)
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
          if (data?.length) cacheCommunityMessages(myComms[i].id, [...data].reverse())
          setProgress(80 + Math.round(((i + 1) / Math.max(myComms.length, 1)) * 17))
        }

        if (!active) return
        setProgress(100)
        setLabel('ready!')
        setTimeout(() => { if (active) onDone() }, 600)
      } catch {
        if (active) onDone()
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

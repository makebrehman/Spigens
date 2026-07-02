'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useContactStore } from '@/stores/contactStore'
import { supabase } from '@/lib/supabase'
import { upsertMessage, upsertCachedReaction, deleteCachedReaction } from '@/lib/offlineCache'
import { toLocalMessage } from '@/lib/messageShape'
import { flushPendingPreviews } from '@/lib/previewQueue'
import { CHAT_SERVER_SYNC } from '@/lib/chatSync'

/**
 * App-level Supabase Realtime subscription (one per signed-in user).
 *
 * Handles:
 *  - DM messages INSERT → decrypt using the sender's public key (from contactStore)
 *    → write to SQLite → dbEvents fires → ChatScreen local-first effect re-renders.
 *  - Reaction INSERT / UPDATE / DELETE → write to SQLite → dbEvents fires
 *    → reactions re-render whether the relevant chat is currently open or not.
 *
 * Replaces the per-chat INSERT listeners that ChatScreen previously had, so data
 * lands in SQLite even when the relevant chat is not open (true background sync).
 * RLS on the database ensures the channel only receives events the user is
 * authorized to see.
 */
export function useAppRealtime() {
  const currentUserId = useAuthStore(state => state.user?.id)

  useEffect(() => {
    if (!CHAT_SERVER_SYNC) return // temp: live-receive paused; chat renders from local SQLite only
    if (!currentUserId) return

    const channel = supabase.channel('app-realtime-' + currentUserId)

      // ── New DM message arrives ────────────────────────────────────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const row = payload.new as any
        const { user, privateKey } = useAuthStore.getState()
        const uid = user?.id
        if (!uid || row.sender_id === uid) return // own messages already handled optimistically

        // Look up the sender in the contact list to get their public key for decryption
        const contact = useContactStore.getState().contacts
          .find(c => c.conversationId === row.conversation_id)
        if (!contact) return // conversation not yet in contact list — skip

        const msg = toLocalMessage(row, {
          currentUserId: uid,
          otherPublicKey: contact.rawProfile?.public_key ?? null,
          myPrivateKey: privateKey ?? null,
          contactName: contact.name,
          prev: [], // no prior context needed for background receipt
        })
        msg.status = row.status === 'sent' ? 'delivered' : row.status
        await upsertMessage(row.conversation_id, msg).catch(() => {})
      })

      // ── Reaction added or emoji swapped ──────────────────────────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, async (payload) => {
        const row = payload.new as any
        if (!row.conversation_id || !row.message_id || !row.user_id) return
        await upsertCachedReaction(row.message_id, row.user_id, row.conversation_id, row.emoji).catch(() => {})
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reactions' }, async (payload) => {
        const row = payload.new as any
        if (!row.conversation_id || !row.message_id || !row.user_id) return
        await upsertCachedReaction(row.message_id, row.user_id, row.conversation_id, row.emoji).catch(() => {})
      })

      // ── Reaction removed ──────────────────────────────────────────────────
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, async (payload) => {
        const row = payload.old as any
        if (!row.conversation_id || !row.message_id || !row.user_id) return
        await deleteCachedReaction(row.message_id, row.user_id, row.conversation_id).catch(() => {})
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  // Retry any link previews that previously failed but whose 1-hour back-off has
  // now expired. Runs once on sign-in; the queue processor handles throttling.
  useEffect(() => {
    if (!currentUserId) return
    flushPendingPreviews().catch(() => {})
  }, [currentUserId])
}

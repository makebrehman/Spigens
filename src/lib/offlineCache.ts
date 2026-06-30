// Single source of truth for local persistence.
// On native (Android/iOS): backed by SQLite via localDb.ts
// On web/dev: falls back to localStorage transparently.

import { dbRun, dbQuery, clearDbForUser, isUsingFallback } from '@/lib/localDb'
import { emitDb, topics } from '@/lib/dbEvents'
import { clearMediaCache } from '@/lib/mediaCache'
import type { LocalMessage } from '@/lib/messageShape'
import type { LinkPreviewData } from '@/lib/linkPreview'

// ── localStorage fallback helpers (web/dev only) ─────────────────────────────

const P = 'spigens_c_'

function lsSave(key: string, data: unknown): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(P + key, JSON.stringify(data)) } catch { /* storage full */ }
}

function lsLoad<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(P + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function cacheProfile(userId: string, profile: any): Promise<void> {
  if (isUsingFallback()) { lsSave(`profile_${userId}`, profile); return }
  // Store the WHOLE profile row as JSON in `data` (so bio and every other field
  // survive offline), alongside the broken-out columns we query/sort on.
  await dbRun(
    `INSERT OR REPLACE INTO profiles (id, username, display_name, avatar_url, public_key, is_online, last_seen, updated_at, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, profile.username ?? null, profile.display_name ?? null, profile.avatar_url ?? null,
     profile.public_key ?? null, profile.is_online ? 1 : 0, profile.last_seen ?? null, profile.updated_at ?? null,
     JSON.stringify(profile)]
  )
}

export async function getCachedProfile(userId: string): Promise<any | null> {
  if (isUsingFallback()) return lsLoad<any>(`profile_${userId}`)
  const rows = await dbQuery<any>('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId])
  const row = rows[0]
  if (!row) return null
  // Prefer the full JSON snapshot; fall back to the columns for rows written before
  // the `data` column existed.
  if (row.data) {
    try { return JSON.parse(row.data) } catch { /* fall through to columns */ }
  }
  return row
}

// ── Contacts ─────────────────────────────────────────────────────────────────

// Replace the whole contact list (callers always pass the full ordered set), then
// announce the change so the home feed re-reads SQLite and re-renders.
export async function cacheContacts(userId: string, contacts: any[]): Promise<void> {
  if (isUsingFallback()) {
    lsSave(`contacts_${userId}`, contacts)
  } else {
    await dbRun('DELETE FROM contacts')
    for (let i = 0; i < contacts.length; i++) {
      await dbRun('INSERT OR REPLACE INTO contacts (id, pos, data) VALUES (?, ?, ?)',
        [contacts[i].id, i, JSON.stringify(contacts[i])])
    }
  }
  emitDb(topics.contacts())
}

export async function getCachedContacts(userId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`contacts_${userId}`)
  const rows = await dbQuery<{ data: string }>('SELECT data FROM contacts ORDER BY pos ASC')
  if (!rows.length) return null
  return rows.map(r => JSON.parse(r.data))
}

// Optimistically update a single contact's last message and move them to the top of the feed
export async function updateCachedContactMessage(userId: string, contactId: string, lastMessage: string, lastMessageTime: string): Promise<void> {
  const contacts = await getCachedContacts(userId)
  if (!contacts) return

  const idx = contacts.findIndex((c: any) => c.id === contactId)
  if (idx > -1) {
    const contact = contacts[idx]
    contact.lastMessage = lastMessage
    contact.lastMessageTime = lastMessageTime
    
    // Move to the top (index 0)
    contacts.splice(idx, 1)
    contacts.unshift(contact)
    
    // Write back to cache which emits topics.contacts()
    await cacheContacts(userId, contacts)
  }
}

// ── DM Messages ──────────────────────────────────────────────────────────────

// Persist canonical LocalMessage rows for a conversation, then announce the change
// so any screen showing this conversation re-reads SQLite and re-renders.
export async function cacheMessages(conversationId: string, messages: LocalMessage[]): Promise<void> {
  if (isUsingFallback()) {
    lsSave(`msgs_${conversationId}`, messages)
  } else {
    for (const m of messages) {
      await dbRun(
        `INSERT OR REPLACE INTO dm_messages (id, conversation_id, created_at, data) VALUES (?, ?, ?, ?)`,
        [m.id, conversationId, m.createdAt ?? null, JSON.stringify(m)]
      )
    }
  }
  emitDb(topics.messages(conversationId))
}

export async function getCachedMessages(conversationId: string): Promise<LocalMessage[] | null> {
  if (isUsingFallback()) return lsLoad<LocalMessage[]>(`msgs_${conversationId}`)
  const rows = await dbQuery<{ data: string }>(
    'SELECT data FROM dm_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  )
  if (!rows.length) return null
  return rows.map(r => JSON.parse(r.data) as LocalMessage)
}

export async function getCachedMessagesPage(
  conversationId: string,
  opts: { limit?: number; beforeCreatedAt?: string | null } = {},
): Promise<LocalMessage[] | null> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 100))
  const before = opts.beforeCreatedAt ?? null
  if (isUsingFallback()) {
    const all = lsLoad<LocalMessage[]>(`msgs_${conversationId}`) ?? []
    const filtered = before ? all.filter(m => (m.createdAt || '') < before) : all
    const page = filtered.slice(-limit)
    return page.length ? page : null
  }
  const rows = before
    ? await dbQuery<{ data: string }>(
        'SELECT data FROM dm_messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
        [conversationId, before, limit]
      )
    : await dbQuery<{ data: string }>(
        'SELECT data FROM dm_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
        [conversationId, limit]
      )
  if (!rows.length) return null
  return rows.reverse().map(r => JSON.parse(r.data) as LocalMessage)
}

export async function upsertMessage(conversationId: string, msg: LocalMessage): Promise<void> {
  await cacheMessages(conversationId, [msg])
}

// Remove a single message (e.g. a failed optimistic send) and announce the change.
export async function deleteCachedMessage(conversationId: string, id: string): Promise<void> {
  if (isUsingFallback()) {
    const list = (lsLoad<LocalMessage[]>(`msgs_${conversationId}`) ?? []).filter(m => m.id !== id)
    lsSave(`msgs_${conversationId}`, list)
  } else {
    await dbRun('DELETE FROM dm_messages WHERE id = ?', [id])
  }
  emitDb(topics.messages(conversationId))
}

// ── Message Reactions ─────────────────────────────────────────────────────────

// Replace all cached reactions for a conversation (called after a server fetch).
export async function cacheReactions(
  conversationId: string,
  rows: Array<{ message_id: string; user_id: string; emoji: string }>
): Promise<void> {
  if (isUsingFallback()) {
    lsSave(`reactions_${conversationId}`, rows)
  } else {
    await dbRun('DELETE FROM message_reactions WHERE conversation_id = ?', [conversationId])
    for (const r of rows) {
      await dbRun(
        'INSERT OR REPLACE INTO message_reactions (message_id, user_id, conversation_id, emoji) VALUES (?, ?, ?, ?)',
        [r.message_id, r.user_id, conversationId, r.emoji]
      )
    }
  }
  emitDb(topics.reactions(conversationId))
}

// Load reactions grouped by message_id: { [messageId]: [{ user_id, emoji }, ...] }
export async function getCachedReactions(
  conversationId: string
): Promise<Record<string, Array<{ user_id: string; emoji: string }>>> {
  if (isUsingFallback()) {
    const rows = lsLoad<Array<{ message_id: string; user_id: string; emoji: string }>>(`reactions_${conversationId}`) ?? []
    const out: Record<string, Array<{ user_id: string; emoji: string }>> = {}
    rows.forEach(r => {
      if (!out[r.message_id]) out[r.message_id] = []
      out[r.message_id].push({ user_id: r.user_id, emoji: r.emoji })
    })
    return out
  }
  const rows = await dbQuery<{ message_id: string; user_id: string; emoji: string }>(
    'SELECT message_id, user_id, emoji FROM message_reactions WHERE conversation_id = ?',
    [conversationId]
  )
  const out: Record<string, Array<{ user_id: string; emoji: string }>> = {}
  rows.forEach(r => {
    if (!out[r.message_id]) out[r.message_id] = []
    out[r.message_id].push({ user_id: r.user_id, emoji: r.emoji })
  })
  return out
}

// Insert or replace one reaction (used on toggle-on and realtime INSERT/UPDATE).
export async function upsertCachedReaction(
  messageId: string, userId: string, conversationId: string, emoji: string
): Promise<void> {
  if (isUsingFallback()) {
    const rows = lsLoad<Array<{ message_id: string; user_id: string; emoji: string }>>(`reactions_${conversationId}`) ?? []
    const filtered = rows.filter(r => !(r.message_id === messageId && r.user_id === userId))
    lsSave(`reactions_${conversationId}`, [...filtered, { message_id: messageId, user_id: userId, emoji }])
  } else {
    await dbRun(
      'INSERT OR REPLACE INTO message_reactions (message_id, user_id, conversation_id, emoji) VALUES (?, ?, ?, ?)',
      [messageId, userId, conversationId, emoji]
    )
  }
  emitDb(topics.reactions(conversationId))
}

// Remove one reaction (used on toggle-off and realtime DELETE).
export async function deleteCachedReaction(messageId: string, userId: string, conversationId: string): Promise<void> {
  if (!isUsingFallback()) {
    await dbRun('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?', [messageId, userId])
  }
  emitDb(topics.reactions(conversationId))
}

// ── Pending Reactions (offline → online sync) ─────────────────────────────────

export interface PendingReaction {
  messageId: string
  userId: string
  conversationId: string
  emoji: string
  action: 'add' | 'remove'
}

// Queue a reaction toggle for when the user reconnects.
// INSERT OR REPLACE means toggling twice (add → remove) collapses to the final state.
export async function savePendingReaction(r: PendingReaction): Promise<void> {
  if (isUsingFallback()) return
  await dbRun(
    `INSERT OR REPLACE INTO pending_reactions (message_id, user_id, conversation_id, emoji, action, queued_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [r.messageId, r.userId, r.conversationId, r.emoji, r.action, new Date().toISOString()]
  )
}

export async function getPendingReactions(): Promise<PendingReaction[]> {
  if (isUsingFallback()) return []
  const rows = await dbQuery<any>('SELECT * FROM pending_reactions ORDER BY queued_at ASC')
  return rows.map(r => ({
    messageId: r.message_id,
    userId: r.user_id,
    conversationId: r.conversation_id,
    emoji: r.emoji,
    action: r.action as 'add' | 'remove',
  }))
}

export async function clearPendingReaction(messageId: string, userId: string): Promise<void> {
  if (isUsingFallback()) return
  await dbRun('DELETE FROM pending_reactions WHERE message_id = ? AND user_id = ?', [messageId, userId])
}

// ── Pending Read Receipts ─────────────────────────────────────────────────────

// Queue a "mark conversation as read" update for when we come back online.
// Uses INSERT OR REPLACE so repeated opens while offline collapse to one row.
export async function queueReadReceipt(conversationId: string): Promise<void> {
  if (isUsingFallback()) return
  await dbRun(
    'INSERT OR REPLACE INTO pending_read_receipts (conversation_id, queued_at) VALUES (?, ?)',
    [conversationId, new Date().toISOString()]
  )
}

export async function getPendingReadReceipts(): Promise<string[]> {
  if (isUsingFallback()) return []
  const rows = await dbQuery<{ conversation_id: string }>('SELECT conversation_id FROM pending_read_receipts')
  return rows.map(r => r.conversation_id)
}

export async function clearReadReceipt(conversationId: string): Promise<void> {
  if (isUsingFallback()) return
  await dbRun('DELETE FROM pending_read_receipts WHERE conversation_id = ?', [conversationId])
}

// ── Community List ────────────────────────────────────────────────────────────

export async function cacheCommunityList(userId: string, list: any[]): Promise<void> {
  if (isUsingFallback()) {
    lsSave(`community_list_${userId}`, list)
  } else {
    await dbRun('DELETE FROM community_list')
    for (const c of list) {
      await dbRun(
        `INSERT OR REPLACE INTO community_list (id, name, description, type, avatar_url, member_count, user_role, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name ?? null, c.description ?? null, c.type ?? 'public',
         c.avatar_url ?? null, c.member_count ?? 0, c.userRole ?? c.user_role ?? null,
         JSON.stringify(c)]
      )
    }
  }
  emitDb(topics.communities())
}

export async function getCachedCommunityList(userId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`community_list_${userId}`)
  const rows = await dbQuery<any>('SELECT raw_data FROM community_list ORDER BY name')
  if (!rows.length) return null
  return rows.map(r => JSON.parse(r.raw_data))
}

// ── Community Messages ────────────────────────────────────────────────────────

// Store canonical (formatMsg-shaped) community messages as JSON blobs, then announce.
export async function cacheCommunityMessages(communityId: string, messages: any[]): Promise<void> {
  if (isUsingFallback()) {
    lsSave(`cmsgs_${communityId}`, messages)
  } else {
    for (const m of messages) {
      await dbRun(
        `INSERT OR REPLACE INTO community_messages (id, community_id, created_at, data) VALUES (?, ?, ?, ?)`,
        [m.id, communityId, m.createdAt ?? m.created_at ?? null, JSON.stringify(m)]
      )
    }
  }
  emitDb(topics.communityMessages(communityId))
}

export async function getCachedCommunityMessages(communityId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`cmsgs_${communityId}`)
  const rows = await dbQuery<{ data: string }>(
    'SELECT data FROM community_messages WHERE community_id = ? ORDER BY created_at ASC',
    [communityId]
  )
  if (!rows.length) return null
  return rows.map(r => JSON.parse(r.data))
}

export async function upsertCommunityMessage(communityId: string, msg: any): Promise<void> {
  await cacheCommunityMessages(communityId, [msg])
}

export async function deleteCachedCommunityMessage(communityId: string, id: string): Promise<void> {
  if (isUsingFallback()) {
    const list = (lsLoad<any[]>(`cmsgs_${communityId}`) ?? []).filter(m => m.id !== id)
    lsSave(`cmsgs_${communityId}`, list)
  } else {
    await dbRun('DELETE FROM community_messages WHERE id = ?', [id])
  }
  emitDb(topics.communityMessages(communityId))
}

// ── Community Members ─────────────────────────────────────────────────────────

// Replace the cached member list for a community. Stored so the community-profile
// member list works offline AND so "mutual communities" can be derived locally.
export async function cacheCommunityMembers(communityId: string, members: any[]): Promise<void> {
  if (isUsingFallback()) { lsSave(`cmembers_${communityId}`, members); return }
  await dbRun('DELETE FROM community_members WHERE community_id = ?', [communityId])
  for (const m of members) {
    if (!m?.user_id) continue
    await dbRun('INSERT OR REPLACE INTO community_members (community_id, user_id, data) VALUES (?, ?, ?)',
      [communityId, m.user_id, JSON.stringify(m)])
  }
}

export async function getCachedCommunityMembers(communityId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`cmembers_${communityId}`)
  const rows = await dbQuery<{ data: string }>('SELECT data FROM community_members WHERE community_id = ?', [communityId])
  if (!rows.length) return null
  return rows.map(r => JSON.parse(r.data))
}

// Community ids (among the ones we've cached members for — i.e. our own) where the
// given user is a member. Used to compute mutual communities entirely locally.
export async function getCachedCommunityIdsForMember(userId: string): Promise<string[]> {
  if (isUsingFallback()) return []
  const rows = await dbQuery<{ community_id: string }>(
    'SELECT DISTINCT community_id FROM community_members WHERE user_id = ?', [userId])
  return rows.map(r => r.community_id)
}

// ── Pending DM Messages ───────────────────────────────────────────────────────

export interface PendingMsg {
  id: string
  conversationId: string | null
  otherUserId: string
  content: string
  encryptedContent: string | null
  replyToId: string | null
  createdAt: string
  messageType?: string
  metadata?: any | null
}

export async function savePendingMessage(userId: string, msg: PendingMsg): Promise<void> {
  if (isUsingFallback()) {
    const key = P + `pending_${userId}`
    try {
      const existing: PendingMsg[] = JSON.parse(localStorage.getItem(key) || '[]')
      existing.push(msg)
      localStorage.setItem(key, JSON.stringify(existing))
    } catch { /* ignore */ }
    return
  }
  await dbRun(
    `INSERT OR REPLACE INTO pending_messages (id, conversation_id, other_user_id, content, encrypted_content, reply_to_id, created_at, message_type, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.conversationId ?? null, msg.otherUserId, msg.content,
     msg.encryptedContent ?? null, msg.replyToId ?? null, msg.createdAt, msg.messageType ?? 'text',
     msg.metadata == null ? null : JSON.stringify(msg.metadata)]
  )
}

export async function getPendingMessages(userId: string): Promise<PendingMsg[]> {
  if (isUsingFallback()) {
    const key = P + `pending_${userId}`
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  }
  const rows = await dbQuery<any>('SELECT * FROM pending_messages ORDER BY created_at ASC')
  return rows.map(r => ({
    id: r.id, conversationId: r.conversation_id, otherUserId: r.other_user_id,
    content: r.content, encryptedContent: r.encrypted_content,
    replyToId: r.reply_to_id, createdAt: r.created_at, messageType: r.message_type,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }))
}

export async function removePendingMessage(userId: string, msgId: string): Promise<void> {
  if (isUsingFallback()) {
    const key = P + `pending_${userId}`
    try {
      const existing: PendingMsg[] = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify(existing.filter(m => m.id !== msgId)))
    } catch { /* ignore */ }
    return
  }
  await dbRun('DELETE FROM pending_messages WHERE id = ?', [msgId])
}

// ── Pending Community Messages ────────────────────────────────────────────────

export interface PendingCommunityMsg {
  id: string
  communityId: string
  content: string
  replyToId: string | null
  createdAt: string
  metadata?: any | null
}

export async function savePendingCommunityMessage(userId: string, msg: PendingCommunityMsg): Promise<void> {
  if (isUsingFallback()) {
    const key = P + `comm_pending_${userId}`
    try {
      const existing: PendingCommunityMsg[] = JSON.parse(localStorage.getItem(key) || '[]')
      existing.push(msg)
      localStorage.setItem(key, JSON.stringify(existing))
    } catch { /* ignore */ }
    return
  }
  await dbRun(
    `INSERT OR REPLACE INTO pending_community_messages (id, community_id, content, reply_to_id, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.communityId, msg.content, msg.replyToId ?? null, msg.createdAt,
     msg.metadata == null ? null : JSON.stringify(msg.metadata)]
  )
}

export async function getPendingCommunityMessages(userId: string): Promise<PendingCommunityMsg[]> {
  if (isUsingFallback()) {
    const key = P + `comm_pending_${userId}`
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  }
  const rows = await dbQuery<any>('SELECT * FROM pending_community_messages ORDER BY created_at ASC')
  return rows.map(r => ({
    id: r.id, communityId: r.community_id, content: r.content,
    replyToId: r.reply_to_id, createdAt: r.created_at,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }))
}

export async function removePendingCommunityMessage(userId: string, msgId: string): Promise<void> {
  if (isUsingFallback()) {
    const key = P + `comm_pending_${userId}`
    try {
      const existing: PendingCommunityMsg[] = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify(existing.filter(m => m.id !== msgId)))
    } catch { /* ignore */ }
    return
  }
  await dbRun('DELETE FROM pending_community_messages WHERE id = ?', [msgId])
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function clearUserCache(userId: string): Promise<void> {
  // SQLite
  await clearDbForUser(userId)

  // On-device media files (downloaded photos/avatars)
  try { await clearMediaCache() } catch { /* non-fatal */ }

  // localStorage (both native fallback keys and any legacy keys)
  if (typeof window === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (
        k.startsWith(P) ||
        k.startsWith('reactions_') ||
        k === `spigens_pk_${userId}` ||
        k === `spigens_archived_${userId}` ||
        k === `spigens_pinned_${userId}` ||
        k === `spigens_muted_${userId}`
      ) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
    try { sessionStorage.removeItem(`spigens_synced_${userId}`) } catch { /* ignore */ }
  } catch { /* ignore */ }
}

// ── Link Preview Cache (URL-keyed, survives sessions) ─────────────────────────
// Stores open-graph preview data keyed by the normalized URL. Completely separate
// from message metadata so the same link previewed in two different conversations
// only fetches once. Status lifecycle: 'ready' (rich data, long TTL) → re-fetched
// after expiry. 'failed' (fetch error, short back-off TTL) → retried after expiry.

const LP_READY_TTL_MS  = 7 * 24 * 60 * 60 * 1000 // 7 days
const LP_FAILED_TTL_MS =      60 * 60 * 1000       // 1 hour back-off before retry

export async function getCachedPreviewByUrl(url: string): Promise<LinkPreviewData | null> {
  if (isUsingFallback()) {
    const entry = lsLoad<{ data: LinkPreviewData; expiresAt: string }>(`lp_${url}`)
    if (!entry) return null
    if (new Date(entry.expiresAt) <= new Date()) return null
    return entry.data
  }
  const rows = await dbQuery<any>(
    'SELECT * FROM link_preview_cache WHERE url = ? AND expires_at > ? LIMIT 1',
    [url, new Date().toISOString()]
  )
  const row = rows[0]
  if (!row) return null
  return {
    url: row.url,
    normalizedUrl: row.url,
    hostname: row.hostname,
    title: row.title ?? null,
    description: row.description ?? null,
    image: row.image ?? null,
    siteName: row.site_name ?? null,
    fetchedAt: row.fetched_at,
    status: row.status as 'ready' | 'failed' | 'fallback',
  }
}

export async function setCachedPreviewByUrl(
  url: string,
  preview: LinkPreviewData,
  ttlMs = LP_READY_TTL_MS,
): Promise<void> {
  const fetchedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()
  if (isUsingFallback()) {
    lsSave(`lp_${url}`, { data: preview, expiresAt })
    return
  }
  await dbRun(
    `INSERT OR REPLACE INTO link_preview_cache
       (url, title, description, image, site_name, hostname, status, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      url,
      preview.title ?? null,
      preview.description ?? null,
      preview.image ?? null,
      preview.siteName ?? null,
      preview.hostname,
      preview.status,
      fetchedAt,
      expiresAt,
    ]
  )
}

export async function markPreviewPending(url: string): Promise<void> {
  let hostname = url
  try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch { /* ok */ }
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + LP_FAILED_TTL_MS).toISOString()
  if (isUsingFallback()) {
    const entry: { data: LinkPreviewData; expiresAt: string } = {
      data: { url, normalizedUrl: url, hostname, title: null, description: null, image: null, siteName: null, fetchedAt: now, status: 'failed' },
      expiresAt,
    }
    lsSave(`lp_${url}`, entry)
    return
  }
  await dbRun(
    `INSERT OR REPLACE INTO link_preview_cache
       (url, hostname, status, fetched_at, expires_at)
     VALUES (?, ?, 'failed', ?, ?)`,
    [url, hostname, now, expiresAt]
  )
}

// Returns normalized URLs whose last fetch FAILED and whose back-off window has
// now expired — i.e. they are eligible for a retry attempt.
export async function getPendingPreviewUrls(): Promise<string[]> {
  if (isUsingFallback()) return []
  const rows = await dbQuery<{ url: string }>(
    `SELECT url FROM link_preview_cache WHERE status = 'failed' AND expires_at <= ?`,
    [new Date().toISOString()]
  )
  return rows.map(r => r.url)
}

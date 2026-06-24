// Single source of truth for local persistence.
// On native (Android/iOS): backed by SQLite via localDb.ts
// On web/dev: falls back to localStorage transparently.

import { dbRun, dbQuery, clearDbForUser, isUsingFallback } from '@/lib/localDb'
import { emitDb, topics } from '@/lib/dbEvents'
import type { LocalMessage } from '@/lib/messageShape'

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
  await dbRun(
    `INSERT OR REPLACE INTO profiles (id, username, display_name, avatar_url, public_key, is_online, last_seen, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, profile.username ?? null, profile.display_name ?? null, profile.avatar_url ?? null,
     profile.public_key ?? null, profile.is_online ? 1 : 0, profile.last_seen ?? null, profile.updated_at ?? null]
  )
}

export async function getCachedProfile(userId: string): Promise<any | null> {
  if (isUsingFallback()) return lsLoad<any>(`profile_${userId}`)
  const rows = await dbQuery<any>('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId])
  return rows[0] ?? null
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export async function cacheContacts(userId: string, contacts: any[]): Promise<void> {
  if (isUsingFallback()) { lsSave(`contacts_${userId}`, contacts); return }
  for (const c of contacts) {
    await dbRun(
      `INSERT OR REPLACE INTO contacts (id, conversation_id, name, avatar_url, last_message, last_message_time, unread_count, raw_profile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.conversationId ?? null, c.name ?? null, c.avatarUrl ?? null,
       c.lastMessage ?? null, c.lastMessageTime ?? null, c.unreadCount ?? 0,
       c.rawProfile ? JSON.stringify(c.rawProfile) : null]
    )
  }
}

export async function getCachedContacts(userId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`contacts_${userId}`)
  const rows = await dbQuery<any>('SELECT * FROM contacts ORDER BY last_message_time DESC')
  if (!rows.length) return null
  return rows.map(r => ({
    ...r,
    avatarUrl: r.avatar_url,
    lastMessageTime: r.last_message_time,
    lastMessage: r.last_message,
    unreadCount: r.unread_count ?? 0,
    rawProfile: r.raw_profile ? JSON.parse(r.raw_profile) : null,
  }))
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

// ── Community List ────────────────────────────────────────────────────────────

export async function cacheCommunityList(userId: string, list: any[]): Promise<void> {
  if (isUsingFallback()) { lsSave(`community_list_${userId}`, list); return }
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

export async function getCachedCommunityList(userId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`community_list_${userId}`)
  const rows = await dbQuery<any>('SELECT raw_data FROM community_list ORDER BY name')
  if (!rows.length) return null
  return rows.map(r => JSON.parse(r.raw_data))
}

// ── Community Messages ────────────────────────────────────────────────────────

export async function cacheCommunityMessages(communityId: string, messages: any[]): Promise<void> {
  if (isUsingFallback()) { lsSave(`cmsgs_${communityId}`, messages); return }
  for (const m of messages) {
    const profiles = m.profiles ?? {}
    await dbRun(
      `INSERT OR REPLACE INTO community_messages
       (id, community_id, sender_id, content, message_type, metadata, created_at, reply_to, deleted_at, sender_name, sender_username, sender_avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, communityId, m.sender_id ?? null, m.content ?? null,
       m.message_type ?? 'text',
       m.metadata ? (typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata)) : null,
       m.created_at ?? null, m.reply_to ?? null, m.deleted_at ?? null,
       profiles.display_name ?? m.sender_name ?? null,
       profiles.username ?? m.sender_username ?? null,
       profiles.avatar_url ?? m.sender_avatar ?? null]
    )
  }
}

export async function getCachedCommunityMessages(communityId: string): Promise<any[] | null> {
  if (isUsingFallback()) return lsLoad<any[]>(`cmsgs_${communityId}`)
  const rows = await dbQuery<any>(
    'SELECT * FROM community_messages WHERE community_id = ? ORDER BY created_at ASC',
    [communityId]
  )
  if (!rows.length) return null
  return rows.map(r => ({
    ...r,
    message_type: r.message_type,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    profiles: { display_name: r.sender_name, username: r.sender_username, avatar_url: r.sender_avatar },
  }))
}

export async function upsertCommunityMessage(communityId: string, msg: any): Promise<void> {
  await cacheCommunityMessages(communityId, [msg])
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
    `INSERT OR REPLACE INTO pending_messages (id, conversation_id, other_user_id, content, encrypted_content, reply_to_id, created_at, message_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.conversationId ?? null, msg.otherUserId, msg.content,
     msg.encryptedContent ?? null, msg.replyToId ?? null, msg.createdAt, msg.messageType ?? 'text']
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
    `INSERT OR REPLACE INTO pending_community_messages (id, community_id, content, reply_to_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [msg.id, msg.communityId, msg.content, msg.replyToId ?? null, msg.createdAt]
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

  // localStorage (both native fallback keys and any legacy keys)
  if (typeof window === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (
        k.startsWith(P) ||
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

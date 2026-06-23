const P = 'spigens_c_'

function save(key: string, data: unknown): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(P + key, JSON.stringify(data)) } catch { /* storage full */ }
}

function load<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(P + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}

export function cacheMessages(conversationId: string, messages: unknown[]): void {
  save(`msgs_${conversationId}`, messages)
}

export function getCachedMessages(conversationId: string): unknown[] | null {
  return load<unknown[]>(`msgs_${conversationId}`)
}

export function cacheContacts(userId: string, contacts: unknown[]): void {
  save(`contacts_${userId}`, contacts)
}

export function getCachedContacts(userId: string): unknown[] | null {
  return load<unknown[]>(`contacts_${userId}`)
}

export function cacheCommunityMessages(communityId: string, messages: unknown[]): void {
  save(`cmsgs_${communityId}`, messages)
}

export function getCachedCommunityMessages(communityId: string): unknown[] | null {
  return load<unknown[]>(`cmsgs_${communityId}`)
}

interface PendingMsg {
  id: string
  conversationId: string | null
  otherUserId: string
  content: string
  encryptedContent: string | null
  replyToId: string | null
  createdAt: string
  messageType?: string
}

function pendingKey(userId: string) { return P + `pending_${userId}` }

export function savePendingMessage(userId: string, msg: PendingMsg): void {
  if (typeof window === 'undefined') return
  try {
    const existing: PendingMsg[] = JSON.parse(localStorage.getItem(pendingKey(userId)) || '[]')
    existing.push(msg)
    localStorage.setItem(pendingKey(userId), JSON.stringify(existing))
  } catch { /* ignore */ }
}

export function getPendingMessages(userId: string): PendingMsg[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(pendingKey(userId)) || '[]') } catch { return [] }
}

export function removePendingMessage(userId: string, msgId: string): void {
  if (typeof window === 'undefined') return
  try {
    const existing: PendingMsg[] = JSON.parse(localStorage.getItem(pendingKey(userId)) || '[]')
    localStorage.setItem(pendingKey(userId), JSON.stringify(existing.filter(m => m.id !== msgId)))
  } catch { /* ignore */ }
}

interface PendingCommunityMsg {
  id: string
  communityId: string
  content: string
  replyToId: string | null
  createdAt: string
}

function commPendingKey(userId: string) { return P + `comm_pending_${userId}` }

export function savePendingCommunityMessage(userId: string, msg: PendingCommunityMsg): void {
  if (typeof window === 'undefined') return
  try {
    const existing: PendingCommunityMsg[] = JSON.parse(localStorage.getItem(commPendingKey(userId)) || '[]')
    existing.push(msg)
    localStorage.setItem(commPendingKey(userId), JSON.stringify(existing))
  } catch { /* ignore */ }
}

export function getPendingCommunityMessages(userId: string): PendingCommunityMsg[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(commPendingKey(userId)) || '[]') } catch { return [] }
}

export function removePendingCommunityMessage(userId: string, msgId: string): void {
  if (typeof window === 'undefined') return
  try {
    const existing: PendingCommunityMsg[] = JSON.parse(localStorage.getItem(commPendingKey(userId)) || '[]')
    localStorage.setItem(commPendingKey(userId), JSON.stringify(existing.filter(m => m.id !== msgId)))
  } catch { /* ignore */ }
}

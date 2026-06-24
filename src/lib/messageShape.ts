// The ONE canonical, decrypted, display-ready shape for a DM message.
//
// Both producers (DataSyncScreen's bulk download AND ChatScreen's live load/
// realtime) convert raw Supabase rows into this shape via toLocalMessage(), and
// this exact object is what gets stored in local SQLite (as a JSON blob) and read
// back for rendering. Because we persist the derived fields (isSent, timestamp,
// content already decrypted, replyTo, isDeleted), nothing is lost on the round
// trip and the cache never needs the private key again to display a message.

import { decryptMessage } from '@/lib/encryption'

export interface LocalMessage {
  id: string
  content: string
  messageType: string
  metadata: any | null
  timestamp: string        // formatted HH:MM for display
  createdAt: string        // ISO — the canonical sort/order key
  isSent: boolean
  isRead: boolean
  status: string
  replyTo: { id: string; content: string; senderLabel: string } | null
  isDeleted: boolean
}

export interface ToLocalMessageCtx {
  currentUserId: string | null | undefined
  otherPublicKey: string | null | undefined
  myPrivateKey: string | null | undefined
  contactName: string
  /** already-converted messages, used to resolve reply_to previews */
  prev: LocalMessage[]
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Convert a raw Supabase `messages` row into the canonical LocalMessage. */
export function toLocalMessage(row: any, ctx: ToLocalMessageCtx): LocalMessage {
  let content = ''
  if (row.deleted_at) {
    content = ''
  } else if (row.encrypted_content && ctx.myPrivateKey && ctx.otherPublicKey) {
    content = decryptMessage(row.encrypted_content, ctx.otherPublicKey, ctx.myPrivateKey) ?? row.content ?? '🔒 encrypted'
  } else {
    content = row.content ?? ''
  }

  const isSent = row.sender_id === ctx.currentUserId

  let replyTo: LocalMessage['replyTo'] = null
  if (row.reply_to) {
    const orig = ctx.prev.find(m => m.id === row.reply_to)
    if (orig) {
      replyTo = { id: row.reply_to, content: orig.content, senderLabel: orig.isSent ? 'You' : ctx.contactName }
    }
  }

  return {
    id: row.id,
    content,
    messageType: row.message_type || 'text',
    metadata: row.metadata ?? null,
    timestamp: fmtTime(row.created_at),
    createdAt: row.created_at,
    isSent,
    isRead: true,
    status: row.status,
    replyTo,
    isDeleted: !!row.deleted_at,
  }
}

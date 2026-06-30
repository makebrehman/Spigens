// The ONE canonical, decrypted, display-ready shape for a DM message.
//
// Both producers (DataSyncScreen's bulk download AND ChatScreen's live load/
// realtime) convert raw Supabase rows into this shape via toLocalMessage(), and
// this exact object is what gets stored in local SQLite (as a JSON blob) and read
// back for rendering. Because we persist the derived fields (isSent, timestamp,
// content already decrypted, replyTo, isDeleted), nothing is lost on the round
// trip and the cache never needs the private key again to display a message.

import { decryptMessage } from '@/lib/encryption'

// Media messages carry sensitive display bits in metadata: a blur/poster preview
// (metadata.thumb) and, for documents, the original filename (metadata.name). Both
// are encrypted exactly like the message body (and flagged enc:true), so here — the
// one place raw rows become display-ready — we decrypt them back into plain values.
// Non-sensitive fields (dur, size, w, h) ride along in plaintext. Older rows with a
// plaintext thumb (no enc flag) pass through unchanged.
function decryptMeta(metadata: any, ctx: ToLocalMessageCtx): any {
  if (!metadata || !metadata.enc) return metadata
  const canDecrypt = !!(ctx.myPrivateKey && ctx.otherPublicKey)
  const out: any = { ...metadata, enc: false }
  if (metadata.thumb) {
    out.thumb = canDecrypt ? (decryptMessage(metadata.thumb, ctx.otherPublicKey!, ctx.myPrivateKey!) ?? null) : null
  }
  if (metadata.name) {
    out.name = canDecrypt ? (decryptMessage(metadata.name, ctx.otherPublicKey!, ctx.myPrivateKey!) ?? null) : null
  }
  if (metadata.linkPreview) {
    if (!canDecrypt) {
      out.linkPreview = null
    } else if (typeof metadata.linkPreview === 'string') {
      const plain = decryptMessage(metadata.linkPreview, ctx.otherPublicKey!, ctx.myPrivateKey!)
      try { out.linkPreview = plain ? JSON.parse(plain) : null } catch { out.linkPreview = null }
    }
  }
  return out
}

// Short, human label for a message used as a reply preview (so replying to a photo
// shows "📷 Photo", not a raw storage URL).
export function messagePreview(m: { messageType: string; content: string; metadata?: any | null }): string {
  switch (m.messageType) {
    case 'image': return '📷 Photo'
    case 'video': return '🎥 Video'
    case 'audio': return '🎙️ Voice message'
    case 'file': return m.metadata && m.metadata.name ? '📄 ' + m.metadata.name : '📄 Document'
    case 'contact': {
      try { const c = JSON.parse(m.content); return '👤 ' + (c.name || 'Contact') } catch { return '👤 Contact' }
    }
    default: return m.content
  }
}

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
      const preview = orig.messageType && orig.messageType !== 'text' ? messagePreview(orig) : orig.content
      replyTo = { id: row.reply_to, content: preview, senderLabel: orig.isSent ? 'You' : ctx.contactName }
    }
  }

  return {
    id: row.id,
    content,
    messageType: row.message_type || 'text',
    metadata: row.deleted_at ? null : decryptMeta(row.metadata ?? null, ctx),
    timestamp: fmtTime(row.created_at),
    createdAt: row.created_at,
    isSent,
    isRead: true,
    status: row.status,
    replyTo,
    isDeleted: !!row.deleted_at,
  }
}

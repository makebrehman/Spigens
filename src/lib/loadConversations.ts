import { supabase } from '@/lib/supabase'
import { decryptMessage } from '@/lib/encryption'

// Chat-list preview label for non-text messages, so a shared photo shows "📷 Photo"
// in the tile instead of the raw image URL.
function mediaPreviewLabel(type: string): string | null {
  switch (type) {
    case 'image': return '📷 Photo'
    case 'video': return '🎥 Video'
    case 'audio': return '🎤 Voice message'
    case 'file': return '📎 File'
    case 'invite': return '📩 Community invite'
    default: return null
  }
}

export async function loadConversations(currentUserId: string, myPrivateKey: string | null) {
  const { data: myParticipants, error: myError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId)

  if (myError || !myParticipants?.length) return []

  const myConversationIds = myParticipants.map(r => r.conversation_id)

  const { data: otherParticipants, error: otherError } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id,
      user_id,
      profiles:user_id ( id, username, display_name, avatar_url, is_online, public_key, last_seen, bio )
    `)
    .in('conversation_id', myConversationIds)
    .neq('user_id', currentUserId)

  if (otherError || !otherParticipants) return []

  const results: any[] = []

  for (const p of otherParticipants) {
    const profile = p.profiles as any
    if (!profile) continue

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, sender_id, content, encrypted_content, message_type, created_at, deleted_at')
      .eq('conversation_id', p.conversation_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (msgError || !messages?.length) continue

    const last = messages[0]
    let preview = ''

    const mediaLabel = last.message_type ? mediaPreviewLabel(last.message_type) : null
    if (last.deleted_at) {
      preview = 'Message deleted'
    } else if (mediaLabel) {
      // Media message — show a label, never the raw URL.
      preview = mediaLabel
    } else if (last.encrypted_content && myPrivateKey && profile.public_key) {
      preview = decryptMessage(last.encrypted_content, profile.public_key, myPrivateKey) ?? '🔒 encrypted'
    } else {
      preview = last.content ?? ''
    }

    results.push({
      conversationId: p.conversation_id,
      otherProfile: profile,
      lastMessage: preview,
      lastMessageTime: last.created_at,
    })
  }

  results.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
  return results
}

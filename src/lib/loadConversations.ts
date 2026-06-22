import { supabase } from '@/lib/supabase'
import { decryptMessage } from '@/lib/encryption'

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
      profiles:user_id ( id, username, display_name, avatar_url, is_online, public_key, last_seen )
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
      .select('id, sender_id, content, encrypted_content, created_at, deleted_at')
      .eq('conversation_id', p.conversation_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (msgError || !messages?.length) continue

    const last = messages[0]
    let preview = ''

    if (last.deleted_at) {
      preview = 'Message deleted'
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

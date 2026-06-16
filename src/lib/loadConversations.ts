import { supabase } from '@/lib/supabase'
import { loadPrivateKey, decryptMessage } from '@/lib/encryption'
import type { Contact } from '@/types'

export async function loadConversations(currentUserId: string, myPublicKey: string) {
  const privateKey = loadPrivateKey()
  
  // 1. Get all conversation ids the user is in
  const { data: myParticipants, error: myError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId)

  if (myError) {
    console.error('Failed to load user conversations:', myError)
    return []
  }

  if (!myParticipants || myParticipants.length === 0) {
    return []
  }

  const myConversationIds = myParticipants.map(row => row.conversation_id)

  // 2. For each conversation, find the OTHER participant
  const { data: otherParticipants, error: otherError } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id,
      user_id,
      profiles:user_id ( id, username, display_name, avatar_url, is_online, public_key, last_seen )
    `)
    .in('conversation_id', myConversationIds)
    .neq('user_id', currentUserId)

  if (otherError || !otherParticipants) {
    console.error('Failed to load other participants:', otherError)
    return []
  }

  const results: any[] = []

  for (const p of otherParticipants) {
    const profile = p.profiles as any
    if (!profile) continue

    // 3. Get the LAST message
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', p.conversation_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (msgError) {
      console.error('Failed to load last message:', msgError)
      continue
    }

    if (!messages || messages.length === 0) {
      // skip 0-message conversations
      continue
    }

    const lastMsg = messages[0]
    let decryptedContent = ''

    try {
      if (lastMsg.sender_id === currentUserId) {
         const dec = await decryptMessage(lastMsg.encrypted_content_sender, myPublicKey, privateKey)
         decryptedContent = dec ?? '🔒 unable to decrypt'
      } else {
         const dec = await decryptMessage(lastMsg.encrypted_content, profile.public_key || '', privateKey)
         decryptedContent = dec ?? '🔒 unable to decrypt'
      }
    } catch(e) {
      decryptedContent = '🔒 message'
    }

    results.push({
      conversationId: p.conversation_id,
      otherProfile: profile,
      lastMessage: decryptedContent,
      lastMessageTime: lastMsg.created_at,
    })
  }

  // Sort most recent first
  results.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

  return results
}

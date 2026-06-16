'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MessageBubble } from './MessageBubble'
import { DateSeparator } from './DateSeparator'
import { ComposerBar } from './ComposerBar'
import { BackButton } from './BackButton'
import { ProfileImage } from './ProfileImage'
import { ChatName } from './ChatName'
import { OnlineStatus } from './OnlineStatus'
import { RenderifyHost } from '@/components/RenderifyHost'
import { useMessageStore } from '@/stores/messageStore'
import { useUIStore } from '@/stores/uiStore'
import { useContactStore } from '@/stores/contactStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { encryptMessage, decryptMessage, loadPrivateKey } from '@/lib/encryption'

const EMPTY_MESSAGES: any[] = []

export interface ChatScreenProps {
  contactId?: string
  otherUserId?: string
  otherUserPublicKey?: string
  avatarUrl?: string
  contactName: string
  contactInitials: string
  contactAvatarColor?: string
  isOnline: boolean
  lastSeen?: string
  onBack?: () => void
}

export function ChatScreen(props: ChatScreenProps) {
  const { contactId, otherUserId, otherUserPublicKey, avatarUrl, contactName, contactInitials, contactAvatarColor, isOnline, lastSeen, onBack } = props

  const storeMessages = useMessageStore(state => (contactId ? state.messagesByContact[contactId] : undefined)) ?? EMPTY_MESSAGES
  
  useEffect(() => {
    if (contactId) {
      useUIStore.getState().setComponentState('chatMessages', storeMessages)
    }
  }, [contactId, storeMessages])

  const attachConfig = useUIStore(state => state.behaviorConfig.attachButton)
  const componentSources = useUIStore(state => state.componentSources)
  const chatScreenSource = componentSources?.chatScreen ?? null
  const bottomSheetSource = componentSources?.bottomSheet ?? null

  const [showAttachSheet, setShowAttachSheet] = useState(false)

  // Real messaging state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [realMessages, setRealMessages] = useState<any[]>([])

  const currentUserId = useAuthStore(state => state.user?.id)
  const myPublicKey = useAuthStore(state => state.profile?.public_key)

  // Step 1: Resolve conversationId by user-pair (read-only)
  useEffect(() => {
    if (!otherUserId || !currentUserId) return
    setRealMessages([])
    useUIStore.getState().setComponentState('chatMessages', [])
    const resolveConversation = async () => {
      // 1. Get current user's conversation ids
      const { data: myUserParticipants, error: myError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId)

      if (myError || !myUserParticipants || myUserParticipants.length === 0) {
        setConversationId(null)
        return
      }

      const myIds = myUserParticipants.map(row => row.conversation_id)

      // 2. Find which of those also has otherUserId
      const { data: sharedParticipants, error: sharedError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUserId)
        .in('conversation_id', myIds)
        .limit(1)

      if (!sharedError && sharedParticipants && sharedParticipants.length > 0) {
        setConversationId(sharedParticipants[0].conversation_id)
      } else {
        setConversationId(null)
      }
    }
    resolveConversation()
  }, [otherUserId, currentUserId])

  // Step 2: Load and decrypt messages
  useEffect(() => {
    if (!conversationId || !currentUserId || !myPublicKey) return

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, encrypted_content, encrypted_content_sender, created_at, status')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error || !data) {
        console.error('Failed to load messages:', error)
        return
      }

      try {
        const privateKey = loadPrivateKey()
        const decryptedMessages = await Promise.all(data.map(async (row) => {
          let content = ''
          const isSent = row.sender_id === currentUserId
          if (isSent) {
            const dec = await decryptMessage(row.encrypted_content_sender, myPublicKey, privateKey)
            content = dec ?? '🔒 unable to decrypt'
          } else {
            const dec = await decryptMessage(row.encrypted_content, otherUserPublicKey || '', privateKey)
            content = dec ?? '🔒 unable to decrypt'
          }
          
          return {
            id: row.id,
            content,
            timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: row.created_at,
            isSent,
            isRead: true,
            status: row.status,
          }
        }))

        // Sync loaded messages to component state for the compiled chat component
        useUIStore.getState().setComponentState('chatMessages', decryptedMessages)
        setRealMessages(decryptedMessages)
      } catch (e) {
        console.error('Decryption failed for history:', e)
      }
    }
    loadMessages()

    if (!conversationId) return

    const channel = supabase
      .channel('messages:' + conversationId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, async (payload) => {
         const row = payload.new as any
         // skip own messages
         if (row.sender_id === currentUserId) return

         if (row.status === 'sent') {
           supabase.from('messages').update({ status: 'delivered' }).eq('id', row.id).then()
         }

         const privateKey = loadPrivateKey()
         let content = ''
         try {
           const dec = await decryptMessage(row.encrypted_content, otherUserPublicKey || '', privateKey)
           content = dec ?? '🔒 unable to decrypt'
         } catch(e) {
           content = '🔒 unable to decrypt'
         }

         const msg = {
           id: row.id,
           content,
           timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           createdAt: row.created_at,
           isSent: false,
           isRead: true,
           status: row.status === 'sent' ? 'delivered' : row.status,
         }

         setRealMessages(prev => {
            if (prev.some(m => m.id === row.id)) return prev;
            const next = [...prev, msg];
            queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next));
            return next;
         })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, (payload) => {
         const row = payload.new as any
         if (row.sender_id === currentUserId) {
            setRealMessages(prev => {
               const idx = prev.findIndex(m => m.id === row.id)
               if (idx === -1) return prev
               if (prev[idx].status === row.status) return prev
               const next = [...prev]
               next[idx] = { ...next[idx], status: row.status }
               queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', next));
               return next;
            })
         }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, myPublicKey, otherUserPublicKey])

  // on open: clear unread badge and mark received messages as read
  useEffect(() => {
    if (contactId) {
      useContactStore.getState().clearUnread(contactId)
      useMessageStore.getState().markAllRead(contactId)
    }
  }, [contactId])

  // mark messages read and update last_read_at
  useEffect(() => {
    if (!conversationId || !currentUserId) return
    const unreadReceived = realMessages.some(m => !m.isSent && m.status !== 'read')
    if (unreadReceived) {
      supabase.from('messages')
        .update({ status: 'read' })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .neq('status', 'read')
        .then()
        
      supabase.from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId)
        .then()
    }
  }, [conversationId, currentUserId, realMessages])

  // useComponentState: persistent state for compiled components, survives re-renders
  function useComponentState(key: string, defaultValue: any) {
    const [value, setValue] = useState(
      () => (useUIStore.getState().componentState as Record<string, any>)?.[key] ?? defaultValue
    )
    // subscribe to store changes — re-renders this component when another component writes to this key
    useEffect(() => {
      const unsub = useUIStore.subscribe((state: any, prevState: any) => {
        const next = state.componentState?.[key]
        const prev = prevState.componentState?.[key]
        if (next !== prev) setValue(next ?? defaultValue)
      })
      return unsub
    }, [key, defaultValue])
    return [value, (newVal: any) => {
      if (typeof newVal === 'function') {
        setValue((prev: any) => {
          const r = newVal(prev)
          useUIStore.getState().setComponentState(key, r)
          return r
        })
      } else {
        setValue(newVal)
        useUIStore.getState().setComponentState(key, newVal)
      }
    }] as [any, (v: any) => void]
  }

  const chatScreenScope = {
    contactId,
    otherUserId,
    otherUserPublicKey,
    avatarUrl,
    contactName,
    contactInitials,
    contactAvatarColor,
    isOnline,
    lastSeen,
    messages: otherUserId ? realMessages : storeMessages,
    MessageBubble,
    DateSeparator,
    ComposerBar,
    BackButton,
    ProfileImage,
    ChatName,
    OnlineStatus,
    onBack: () => onBack?.(),
    onAttach: () => setShowAttachSheet(true),
    sendMessage: async (content: string) => {
      if (contactId) {
        useMessageStore.getState().sendMessage(contactId, content)
        return
      }

      if (otherUserId && currentUserId && myPublicKey && otherUserPublicKey) {
        let cid = conversationId
        if (!cid) {
          const { data, error } = await supabase.rpc('get_or_create_conversation', {
            p_user_a: currentUserId,
            p_user_b: otherUserId
          })
          if (data) {
            cid = data
            setConversationId(data)
          } else {
            console.error('Failed to get or create conversation on send:', error)
            return
          }
        }
        
        try {
          const privateKey = loadPrivateKey()
          const recipientCopy = await encryptMessage(content, otherUserPublicKey, privateKey)
          const senderCopy = await encryptMessage(content, myPublicKey, privateKey)

          if (!recipientCopy || !senderCopy) {
             throw new Error('Encryption failed')
          }

          // Optimistic update
          const tempId = `temp-${Date.now()}`
          const newMsg = {
             id: tempId,
             content,
             timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             createdAt: new Date().toISOString(),
             isSent: true,
             isRead: true,
             status: 'sent',
          }
          
          setRealMessages(prev => {
            const nextMessages = [...prev, newMsg]
            queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', nextMessages))
            return nextMessages
          })

          const { data: result, error } = await supabase.from('messages').insert({
             conversation_id: cid,
             sender_id: currentUserId,
             encrypted_content: recipientCopy,
             encrypted_content_sender: senderCopy,
             status: 'sent'
          }).select('id, created_at').single()

          console.log('[IDSWAP DEBUG] insert result:', result, 'error:', error)

          if (error) {
             console.error('Failed to insert message:', error)
             setRealMessages(prev => {
               const failedMessages = prev.map(m => m.id === tempId ? { ...m, content: '🔒 failed to send' } : m)
               queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', failedMessages))
               return failedMessages
             })
          } else if (result) {
             console.log('[IDSWAP DEBUG] swapping temp', tempId, '-> real', result.id)
             setRealMessages(prev => {
               const nextMessages = prev.map(m => m.id === tempId ? { ...m, id: result.id, createdAt: result.created_at } : m)
               queueMicrotask(() => useUIStore.getState().setComponentState('chatMessages', nextMessages))
               return nextMessages
             })
          }
        } catch (e) {
          console.error('Error in send', e)
        }
      }
    },
    useComponentState,
  }

  return (
    <>
      <RenderifyHost code={chatScreenSource} storeActions={chatScreenScope} />
      {attachConfig?.popup && showAttachSheet && createPortal(
        <RenderifyHost
          code={bottomSheetSource}
          storeActions={{
            sheetId: 'attachSheet',
            title: attachConfig.popup.title,
            options: attachConfig.popup.options,
            onClose: () => setShowAttachSheet(false),
            onOptionSelect: (option: any) => {
              console.log('attach option selected:', option.label)
              setShowAttachSheet(false)
            },
          }}
        />,
        document.body
      )}
    </>
  )
}

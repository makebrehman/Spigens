import { create } from 'zustand'
import type { Message } from '@/types'
import { useContactStore } from '@/stores/contactStore'

interface MessageStoreState {
  messagesByContact: Record<string, Message[]>
  getMessagesForContact: (contactId: string) => Message[]
  sendMessage: (contactId: string, content: string) => void
  markAllRead: (contactId: string) => void
}

export const useMessageStore = create<MessageStoreState>()((set, get) => ({
  messagesByContact: {},

  getMessagesForContact: (contactId) => {
    return get().messagesByContact[contactId] ?? []
  },

  sendMessage: (contactId, content) => {
    if (!content.trim()) return
    const now = new Date()
    const timestamp = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const message: Message = {
      id: `${contactId}-${Date.now()}`,
      contactId,
      content: content.trim(),
      timestamp,
      isSent: true,
      isRead: false,
    }
    set((state) => ({
      messagesByContact: {
        ...state.messagesByContact,
        [contactId]: [...(state.messagesByContact[contactId] ?? []), message],
      },
    }))
    // update the contact tile's last message preview
    useContactStore.getState().updateLastMessage(contactId, content.trim(), timestamp)
  },

  markAllRead: (contactId) =>
    set((state) => ({
      messagesByContact: {
        ...state.messagesByContact,
        [contactId]: (state.messagesByContact[contactId] ?? []).map(m =>
          m.isSent ? m : { ...m, isRead: true }
        ),
      },
    })),
}))

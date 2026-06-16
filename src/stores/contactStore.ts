import { create } from 'zustand'
import type { Contact } from '@/types'

interface ContactStoreState {
  contacts: Contact[]
  setContacts: (contacts: Contact[]) => void
  selectedContactId: string | null
  setSelectedContactId: (id: string | null) => void
  getSelectedContact: () => Contact | null
  clearUnread: (contactId: string) => void
  updateLastMessage: (contactId: string, lastMessage: string, lastMessageTime: string) => void
  onlineUserIds: Set<string>
  setOnlineUserIds: (ids: Set<string>) => void
}

export const useContactStore = create<ContactStoreState>()((set, get) => ({
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  selectedContactId: null,

  onlineUserIds: new Set<string>(),
  setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),

  setSelectedContactId: (id) => set({ selectedContactId: id }),

  getSelectedContact: () => {
    const { contacts, selectedContactId } = get()
    return contacts.find(c => c.id === selectedContactId) ?? null
  },

  clearUnread: (contactId) =>
    set((state) => ({
      contacts: state.contacts.map(c =>
        c.id === contactId ? { ...c, unreadCount: 0 } : c
      ),
    })),

  updateLastMessage: (contactId, lastMessage, lastMessageTime) =>
    set((state) => ({
      contacts: state.contacts.map(c =>
        c.id === contactId ? { ...c, lastMessage, lastMessageTime } : c
      ),
    })),
}))

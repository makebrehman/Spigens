import { create } from 'zustand'
import type { Contact } from '@/types'
import { MOCK_CONTACTS } from '@/data/mockData'

interface ContactStoreState {
  contacts: Contact[]
  selectedContactId: string | null
  setSelectedContactId: (id: string | null) => void
  getSelectedContact: () => Contact | null
  clearUnread: (contactId: string) => void
  updateLastMessage: (contactId: string, lastMessage: string, lastMessageTime: string) => void
}

export const useContactStore = create<ContactStoreState>()((set, get) => ({
  contacts: MOCK_CONTACTS,
  selectedContactId: null,

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

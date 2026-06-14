import type { Contact, Message } from '@/types'

export const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Priya Sharma', avatarInitials: 'PS', avatarColor: '#7C3AED', lastMessage: 'are you coming tonight?', lastMessageTime: '9:41 AM', unreadCount: 3, isOnline: true },
  { id: '2', name: 'Zain Malik', avatarInitials: 'ZM', avatarColor: '#2563EB', lastMessage: 'sent a photo', lastMessageTime: '9:30 AM', unreadCount: 0, isOnline: true },
  { id: '3', name: 'Aisha Raza', avatarInitials: 'AR', avatarColor: '#059669', lastMessage: 'ok sure see you then', lastMessageTime: 'yesterday', unreadCount: 1, isOnline: false },
  { id: '4', name: 'Dev Anand', avatarInitials: 'DA', avatarColor: '#DC2626', lastMessage: 'haha yeah exactly', lastMessageTime: 'yesterday', unreadCount: 0, isOnline: false },
  { id: '5', name: 'Sara Khan', avatarInitials: 'SK', avatarColor: '#D97706', lastMessage: 'the meeting is at 3', lastMessageTime: 'tuesday', unreadCount: 7, isOnline: true },
  { id: '6', name: 'Omar Farooq', avatarInitials: 'OF', avatarColor: '#0891B2', lastMessage: 'did you check the doc?', lastMessageTime: 'monday', unreadCount: 0, isOnline: false },
  { id: '7', name: 'Nadia Hussain', avatarInitials: 'NH', avatarColor: '#BE185D', lastMessage: 'hello!', lastMessageTime: 'sunday', unreadCount: 0, isOnline: true },
  { id: '8', name: 'Hamza Ali', avatarInitials: 'HA', avatarColor: '#4F46E5', lastMessage: 'will call you later', lastMessageTime: 'saturday', unreadCount: 2, isOnline: false },
  { id: '9', name: 'Fatima Zahra', avatarInitials: 'FZ', avatarColor: '#065F46', lastMessage: 'thanks for the update', lastMessageTime: 'friday', unreadCount: 0, isOnline: true },
  { id: '10', name: 'Bilal Sheikh', avatarInitials: 'BS', avatarColor: '#7C3AED', lastMessage: 'sounds good to me', lastMessageTime: 'thursday', unreadCount: 0, isOnline: false },
]

export const MOCK_MESSAGES_BY_CONTACT: Record<string, Message[]> = {
  '1': [
    { id: '1-1', contactId: '1', content: 'hey, are you free tonight?', timestamp: '9:20 AM', isSent: false, isRead: true },
    { id: '1-2', contactId: '1', content: "yeah should be, what's up?", timestamp: '9:21 AM', isSent: true, isRead: true },
    { id: '1-3', contactId: '1', content: "we're all going to the rooftop cafe", timestamp: '9:22 AM', isSent: false, isRead: true },
    { id: '1-4', contactId: '1', content: 'oh nice, what time?', timestamp: '9:25 AM', isSent: true, isRead: true },
    { id: '1-5', contactId: '1', content: 'around 8, is that ok?', timestamp: '9:26 AM', isSent: false, isRead: true },
    { id: '1-6', contactId: '1', content: "perfect, i'll be there", timestamp: '9:30 AM', isSent: true, isRead: true },
    { id: '1-7', contactId: '1', content: 'amazing! see you then', timestamp: '9:31 AM', isSent: false, isRead: true },
    { id: '1-8', contactId: '1', content: 'are you coming tonight?', timestamp: '9:41 AM', isSent: false, isRead: false },
  ],
  '2': [
    { id: '2-1', contactId: '2', content: 'check out this photo', timestamp: '9:28 AM', isSent: false, isRead: true },
    { id: '2-2', contactId: '2', content: 'nice shot!', timestamp: '9:30 AM', isSent: true, isRead: true },
  ],
  '3': [
    { id: '3-1', contactId: '3', content: 'are we still on for tomorrow?', timestamp: 'yesterday', isSent: true, isRead: true },
    { id: '3-2', contactId: '3', content: 'ok sure see you then', timestamp: 'yesterday', isSent: false, isRead: false },
  ],
  '4': [
    { id: '4-1', contactId: '4', content: 'bro did you watch the game last night', timestamp: 'yesterday', isSent: false, isRead: true },
    { id: '4-2', contactId: '4', content: 'yeah it was insane', timestamp: 'yesterday', isSent: true, isRead: true },
    { id: '4-3', contactId: '4', content: 'that last minute goal tho', timestamp: 'yesterday', isSent: false, isRead: true },
    { id: '4-4', contactId: '4', content: 'haha yeah exactly', timestamp: 'yesterday', isSent: false, isRead: true },
  ],
  '5': [
    { id: '5-1', contactId: '5', content: 'hey can we reschedule the standup', timestamp: 'tuesday', isSent: false, isRead: true },
    { id: '5-2', contactId: '5', content: 'sure, when works for you', timestamp: 'tuesday', isSent: true, isRead: true },
    { id: '5-3', contactId: '5', content: 'the meeting is at 3', timestamp: 'tuesday', isSent: false, isRead: false },
    { id: '5-4', contactId: '5', content: 'can you prepare the slides', timestamp: 'tuesday', isSent: false, isRead: false },
    { id: '5-5', contactId: '5', content: 'and bring the q3 report', timestamp: 'tuesday', isSent: false, isRead: false },
    { id: '5-6', contactId: '5', content: 'client wants an update today', timestamp: 'tuesday', isSent: false, isRead: false },
    { id: '5-7', contactId: '5', content: 'also send the budget doc', timestamp: 'tuesday', isSent: false, isRead: false },
    { id: '5-8', contactId: '5', content: 'before 2pm please', timestamp: 'tuesday', isSent: false, isRead: false },
    { id: '5-9', contactId: '5', content: 'almost forgot — bring laptop', timestamp: 'tuesday', isSent: false, isRead: false },
  ],
  '6': [
    { id: '6-1', contactId: '6', content: 'i shared the project brief with you', timestamp: 'monday', isSent: false, isRead: true },
    { id: '6-2', contactId: '6', content: 'got it, will review', timestamp: 'monday', isSent: true, isRead: true },
    { id: '6-3', contactId: '6', content: 'did you check the doc?', timestamp: 'monday', isSent: false, isRead: true },
  ],
  '7': [
    { id: '7-1', contactId: '7', content: 'long time no talk!', timestamp: 'sunday', isSent: true, isRead: true },
    { id: '7-2', contactId: '7', content: 'hello!', timestamp: 'sunday', isSent: false, isRead: true },
  ],
  '8': [
    { id: '8-1', contactId: '8', content: 'are you free to talk?', timestamp: 'saturday', isSent: true, isRead: true },
    { id: '8-2', contactId: '8', content: 'in a meeting right now', timestamp: 'saturday', isSent: false, isRead: true },
    { id: '8-3', contactId: '8', content: 'will call you later', timestamp: 'saturday', isSent: false, isRead: false },
    { id: '8-4', contactId: '8', content: 'ping me when you are done', timestamp: 'saturday', isSent: false, isRead: false },
  ],
  '9': [
    { id: '9-1', contactId: '9', content: 'just pushed the new build', timestamp: 'friday', isSent: true, isRead: true },
    { id: '9-2', contactId: '9', content: 'saw the release notes', timestamp: 'friday', isSent: false, isRead: true },
    { id: '9-3', contactId: '9', content: 'thanks for the update', timestamp: 'friday', isSent: false, isRead: true },
  ],
  '10': [
    { id: '10-1', contactId: '10', content: "let's catch up this weekend", timestamp: 'thursday', isSent: true, isRead: true },
    { id: '10-2', contactId: '10', content: 'saturday works for me', timestamp: 'thursday', isSent: false, isRead: true },
    { id: '10-3', contactId: '10', content: 'how about the usual place', timestamp: 'thursday', isSent: true, isRead: true },
    { id: '10-4', contactId: '10', content: 'sounds good to me', timestamp: 'thursday', isSent: false, isRead: true },
  ],
}

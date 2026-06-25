// In-memory mirrors of the last messages read from SQLite, so chat/community screens
// render instantly — even on a cold app start, because the home/community lists
// pre-warm these from the local DB before the user opens anything. These are NOT the
// source of truth (SQLite is); they're just a synchronous, hot read-through cache.

import type { LocalMessage } from '@/lib/messageShape'

export const dmMirror = new Map<string, LocalMessage[]>()   // key: otherUserId
export const communityMirror = new Map<string, any[]>()      // key: communityId

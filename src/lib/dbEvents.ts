// Tiny local-DB change notifier ("the notify step").
//
// Native SQLite (@capacitor-community/sqlite) has no reactive query/observer,
// so we publish a change signal ourselves: every write to the local DB calls
// emitDb(topic); every screen that renders DB data subscribes to that topic and
// re-reads SQLite when it fires. This is what turns "DB write" into "UI update"
// and lets the database be the single source of truth (architecture A).
//
// Topics are plain strings, conventionally "<entity>:<id>", e.g.
//   messages:<conversationId>, contacts, communities, community_messages:<communityId>
// Subscribe to '*' to hear every change.

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()

/** Subscribe to a topic. Returns an unsubscribe function. */
export function subscribeDb(topic: string, fn: Listener): () => void {
  let set = listeners.get(topic)
  if (!set) { set = new Set(); listeners.set(topic, set) }
  set.add(fn)
  return () => { set!.delete(fn); if (set!.size === 0) listeners.delete(topic) }
}

/** Announce that `topic` changed. Fires that topic's listeners plus any '*' listeners. */
export function emitDb(topic: string): void {
  const fire = (set: Set<Listener> | undefined) => {
    if (!set) return
    // copy so a listener that unsubscribes during dispatch can't corrupt iteration
    for (const fn of [...set]) { try { fn() } catch (e) { console.error('[dbEvents] listener error', e) } }
  }
  fire(listeners.get(topic))
  if (topic !== '*') fire(listeners.get('*'))
}

/** Topic helpers — keep producers and consumers using identical strings. */
export const topics = {
  messages: (conversationKey: string) => `messages:${conversationKey}`,
  contacts: () => 'contacts',
  communities: () => 'communities',
  communityMessages: (communityId: string) => `community_messages:${communityId}`,
}

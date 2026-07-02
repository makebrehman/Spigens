// ── TEMPORARY dev switch (chat open-freeze work) ─────────────────────────────
// While this is false, the chat detail screen does NOT talk to the server on open:
//   - no on-open Supabase fetch of messages or reactions (which was re-writing the
//     whole 50-row page to SQLite every open — the main freeze cause), and
//   - no realtime live-receive of new messages/reactions.
// The chat renders purely from local SQLite + the in-memory mirror. SENDING still
// works (optimistic local write + Supabase delivery) — only the server-driven
// *sync into the open screen* is paused.
//
// This is intentionally a single flag so we can flip server sync back on in one
// place once the local SQLite layer is sorted out. Do NOT ship this as `false`
// to production — it disables receiving new messages.
export const CHAT_SERVER_SYNC: boolean = false

// Also temporary: the home screen pre-warms EVERY conversation's messages+reactions
// into the in-memory mirror on load. That fires a DB read per conversation, and those
// reads collide with (and queue ahead of) the read for the chat you actually open,
// on the single SQLite connection. Off until the local DB layer is sorted; the chat's
// own local-first read still warms the mirror for the conversation you open.
export const CHAT_PREWARM: boolean = false

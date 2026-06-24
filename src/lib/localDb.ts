'use client'

import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'spigens_local'
const DB_VERSION = 1

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  public_key TEXT,
  is_online INTEGER DEFAULT 0,
  last_seen TEXT,
  updated_at TEXT
);

-- Contacts stored as one JSON blob per row (full display-ready Contact). The pos
-- column preserves the server ordering (most-recent first) so the list never scrambles.
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  pos INTEGER,
  data TEXT
);

-- DM messages are stored as one canonical JSON blob per row (see messageShape.ts).
-- Only the columns we query on (id, conversation_id, created_at) are broken out;
-- the full decrypted, display-ready LocalMessage lives in the data column. This avoids the
-- old lossy fixed-column schema that dropped derived fields (isSent/timestamp).
CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  created_at TEXT,
  data TEXT
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conv ON dm_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS community_list (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  type TEXT DEFAULT 'public',
  avatar_url TEXT,
  member_count INTEGER DEFAULT 0,
  user_role TEXT,
  raw_data TEXT
);

-- Community messages stored as one canonical JSON blob per row (formatMsg shape).
CREATE TABLE IF NOT EXISTS community_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  created_at TEXT,
  data TEXT
);
CREATE INDEX IF NOT EXISTS idx_comm_msgs ON community_messages(community_id, created_at);

CREATE TABLE IF NOT EXISTS pending_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  other_user_id TEXT,
  content TEXT,
  encrypted_content TEXT,
  reply_to_id TEXT,
  created_at TEXT,
  message_type TEXT DEFAULT 'text'
);

CREATE TABLE IF NOT EXISTS pending_community_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT,
  content TEXT,
  reply_to_id TEXT,
  created_at TEXT
);
`

let _db: SQLiteDBConnection | null = null
let _initPromise: Promise<void> | null = null
let _usingFallback = false

// ── SQLite helpers ───────────────────────────────────────────────────────────

async function openSQLite(): Promise<void> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  // Consistency check (required by the plugin on some platforms)
  const { result: consistent } = await sqlite.checkConnectionsConsistency()
  const { result: exists } = await sqlite.isConnection(DB_NAME, false)

  let db: SQLiteDBConnection
  if (consistent && exists) {
    db = await sqlite.retrieveConnection(DB_NAME, false)
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)
  }

  await db.open()

  // Create / migrate tables
  for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.run(stmt + ';')
  }

  _db = db
}

// ── Fallback: localStorage shim (web / dev) ─────────────────────────────────
// Used when Capacitor native is not available.

const LS_PREFIX = 'spigens_c_'
function lsKey(k: string) { return LS_PREFIX + k }

const fallback = {
  async run(_sql: string, _params?: any[]): Promise<void> { /* no-op — callers use upsert helpers */ },
  async query<T = any>(sql: string, _params?: any[]): Promise<T[]> {
    // Minimal SELECT parsing: we key off the table name and return full blobs.
    // This is only used in dev/web and is intentionally simple.
    return [] as T[]
  },
}

// ── Public DB interface ──────────────────────────────────────────────────────

export async function initLocalDb(): Promise<void> {
  if (_initPromise) return _initPromise
  _initPromise = (async () => {
    if (!Capacitor.isNativePlatform()) {
      // Web / Storybook / dev build only — there is no native SQLite in a browser,
      // so fall back to the localStorage shim. This branch never runs on device.
      _usingFallback = true
      return
    }
    // NATIVE (Android / iOS): use real native SQLite ONLY. Never silently demote to
    // localStorage ("the typical cache") on a device — that hides data loss and is
    // exactly what we don't want. Retry transient init failures a few times instead.
    const MAX_ATTEMPTS = 3
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await openSQLite()
        return // native SQLite is live — _usingFallback stays false
      } catch (e) {
        console.warn(`[localDb] native SQLite init failed (attempt ${attempt}/${MAX_ATTEMPTS})`, e)
        if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, 400 * attempt))
      }
    }
    // Persistent failure on device: keep _usingFallback === false so reads/writes
    // stay on the SQLite path (writes no-op, reads return empty) rather than routing
    // to localStorage. The device uses native SQLite or no cache at all — never the
    // typical browser cache. A later initLocalDb() retry can still bring SQLite up.
    _initPromise = null
    console.error('[localDb] native SQLite unavailable after retries — offline cache disabled (NOT falling back to localStorage)')
  })()
  return _initPromise
}

export function isUsingFallback() { return _usingFallback }

// True only when genuine native SQLite is open and serving reads/writes.
// Useful for diagnostics / a settings "storage: native SQLite" indicator.
export function isNativeSqliteActive() { return !_usingFallback && _db !== null }

/** Run a write statement (INSERT / UPDATE / DELETE). */
export async function dbRun(sql: string, params: any[] = []): Promise<void> {
  if (_usingFallback) return
  if (!_db) { console.warn('[localDb] dbRun called before init'); return }
  await _db.run(sql, params)
}

/** Run a read statement and return rows. */
export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (_usingFallback) return []
  if (!_db) { console.warn('[localDb] dbQuery called before init'); return [] }
  const { values } = await _db.query(sql, params)
  return (values ?? []) as T[]
}

/** Delete all user data from every table (called on logout). */
export async function clearDbForUser(_userId: string): Promise<void> {
  if (_usingFallback) return
  for (const t of ['dm_messages', 'community_messages', 'contacts', 'community_list', 'profiles', 'pending_messages', 'pending_community_messages']) {
    await dbRun(`DELETE FROM ${t}`)
  }
}

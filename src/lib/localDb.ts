'use client'

import { Capacitor } from '@capacitor/core'
import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

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
  updated_at TEXT,
  data TEXT
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

-- Community members (per community), so the community-profile member list and
-- "mutual communities" can be computed locally instead of from the server.
CREATE TABLE IF NOT EXISTS community_members (
  community_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data TEXT,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comm_members_user ON community_members(user_id);

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

-- On-device media cache index (see mediaCache.ts). The bytes live as real files
-- on the Filesystem; this table just maps a remote URL → the local file path so
-- full-res images/avatars render offline and survive app restarts. If the file is
-- later deleted from the device, the row is dropped and the media re-downloads.
CREATE TABLE IF NOT EXISTS media_cache (
  url TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  kind TEXT,
  size INTEGER DEFAULT 0,
  created_at TEXT,
  last_access TEXT
);
`

let _db: SQLiteDBConnection | null = null
let _initPromise: Promise<void> | null = null
let _usingFallback = false
let _lastInitError: string | null = null
let _lastInitStep = 'idle'
let _errorStep = ''
let _initAttempts = 0
let _stepListener: ((step: string) => void) | null = null

function _setStep(step: string) {
  _lastInitStep = step
  _stepListener?.(step)
}

/** Register a callback that fires on every init step change (for live splash diagnostics). */
export function onInitProgress(cb: (step: string) => void) { _stepListener = cb }

// ── SQLite helpers ───────────────────────────────────────────────────────────

async function openSQLite(): Promise<void> {
  // Dynamic import so the module evaluates here — after the Capacitor native
  // bridge has registered plugins — not at static bundle-load time when the
  // bridge may not be ready yet (causing CapacitorSQLite to resolve to null).
  const { SQLiteConnection, CapacitorSQLite } = await import('@capacitor-community/sqlite')

  // If the package export is still null (bridge wasn't ready during module eval),
  // fall back to Capacitor.Plugins which is populated by the bridge at startup.
  const bridgePlugin = (globalThis as any)?.Capacitor?.Plugins?.CapacitorSQLite
  const pluginImpl = CapacitorSQLite ?? bridgePlugin

  if (!pluginImpl) {
    throw new Error(
      `CapacitorSQLite null — pkg=${typeof CapacitorSQLite} bridge=${typeof bridgePlugin}`
    )
  }

  // Log what we got so _errorStep captures it if the next call fails
  _setStep(`got plugin: pkg=${typeof CapacitorSQLite} bridge=${typeof bridgePlugin}`)

  // Some @capacitor-community/sqlite v8.x Android builds require an explicit
  // folder-init call before the first connection; the native load() may not do
  // it automatically. Best-effort — swallow if the method doesn't exist or if
  // the folder was already created.
  if (Capacitor.getPlatform() === 'android') {
    _setStep('createNCDatabaseFolder')
    try { await (pluginImpl as any).createNCDatabaseFolder() } catch { /* ok */ }
  }

  const sqlite = new SQLiteConnection(pluginImpl)

  _setStep('checkConnectionsConsistency')
  const { result: consistent } = await sqlite.checkConnectionsConsistency()
  _setStep('isConnection')
  const { result: exists } = await sqlite.isConnection(DB_NAME, false)

  let db: SQLiteDBConnection
  if (consistent && exists) {
    _setStep('retrieveConnection')
    db = await sqlite.retrieveConnection(DB_NAME, false)
  } else {
    // If the native layer has a stale connection (e.g. app was killed or updated
    // mid-session), consistent=false but exists=true. Calling createConnection in
    // that state throws "connection already exists". Clear all native connections
    // first so we can create a clean one.
    if (!consistent) {
      _setStep('closeAllConnections')
      try { await sqlite.closeAllConnections() } catch { /* best-effort */ }
    }
    _setStep('createConnection')
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)
  }

  _setStep('open')
  await db.open()

  _setStep('execute schema')
  const ddl = SCHEMA.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  await db.execute(ddl)

  _setStep('execute migrations')
  // Lightweight, idempotent column migrations (added after v1). execute() throws if
  // the column already exists on upgraded installs — expected, so we swallow it.
  const migrations = [
    `ALTER TABLE profiles ADD COLUMN data TEXT;`,
  ]
  for (const m of migrations) {
    try { await db.execute(m) } catch { /* column already present — fine */ }
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
      _initAttempts = attempt
      _setStep(`Attempt ${attempt}/${MAX_ATTEMPTS}...`)
      try {
        await openSQLite()
        _setStep('Ready')
        return // native SQLite is live — _usingFallback stays false
      } catch (e) {
        _errorStep = _lastInitStep  // capture the method-call name that threw
        _lastInitError = String((e as any)?.message ?? e)
        _setStep(`Attempt ${attempt} failed: ${_lastInitError}`)
        console.warn(`[localDb] native SQLite init failed (attempt ${attempt}/${MAX_ATTEMPTS})`, e)
        if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, 400 * attempt))
      }
    }
    // Persistent failure on device: keep _usingFallback === false so reads/writes
    // stay on the SQLite path (writes no-op, reads return empty) rather than routing
    // to localStorage. The device uses native SQLite or no cache at all — never the
    // typical browser cache. A later initLocalDb() retry can still bring SQLite up.
    _setStep('Failed after all retries')
    _initPromise = null
    console.error('[localDb] native SQLite unavailable after retries — offline cache disabled (NOT falling back to localStorage)')
  })()
  return _initPromise
}

export function isUsingFallback() { return _usingFallback }

// True only when genuine native SQLite is open and serving reads/writes.
export function isNativeSqliteActive() { return !_usingFallback && _db !== null }

export function getInitDiagnostics() {
  return {
    isNative: Capacitor.isNativePlatform(),
    pluginAvailable: Capacitor.isPluginAvailable('CapacitorSQLite'),
    pluginInBridge: !!(globalThis as any)?.Capacitor?.Plugins?.CapacitorSQLite,
    sqliteActive: !_usingFallback && _db !== null,
    usingFallback: _usingFallback,
    attempts: _initAttempts,
    lastStep: _lastInitStep,
    errorStep: _errorStep,
    lastError: _lastInitError,
  }
}

// ── Diagnostics (temporary, for debugging offline storage on-device) ──────────

export function getLocalDbDiagnostics() {
  return {
    native: Capacitor.isNativePlatform(),
    sqlitePluginAvailable: Capacitor.isPluginAvailable('CapacitorSQLite'),
    filesystemPluginAvailable: Capacitor.isPluginAvailable('Filesystem'),
    sqliteActive: !_usingFallback && _db !== null,
    usingFallback: _usingFallback,
    dbOpen: _db !== null,
    lastInitError: _lastInitError,
  }
}

// Row counts per table. -1 means the query failed / the DB isn't serving reads.
export async function getTableCounts(): Promise<Record<string, number>> {
  const tables = ['profiles', 'contacts', 'community_list', 'dm_messages', 'community_messages', 'community_members', 'media_cache']
  const out: Record<string, number> = {}
  for (const t of tables) {
    try {
      if (_usingFallback || !_db) { out[t] = -1; continue }
      const { values } = await _db.query(`SELECT COUNT(*) AS c FROM ${t};`)
      out[t] = Number((values?.[0] as any)?.c ?? -1)
    } catch { out[t] = -1 }
  }
  return out
}

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
  for (const t of ['dm_messages', 'community_messages', 'community_members', 'contacts', 'community_list', 'profiles', 'pending_messages', 'pending_community_messages', 'media_cache']) {
    await dbRun(`DELETE FROM ${t}`)
  }
}

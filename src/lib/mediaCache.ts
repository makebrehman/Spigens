'use client'

// On-device media cache.
//
// Full-resolution chat media and avatars are downloaded once and stored as real
// files on the device (Capacitor Filesystem), tracked in the `media_cache` SQLite
// table. Rendering reads the local file via Capacitor.convertFileSrc, so images
// show instantly and keep working fully offline. If a cached file is later deleted
// from the device, stat() fails and we transparently treat it as "not cached" — the
// remote URL still lives in the message, so the media is re-downloadable.
//
// Web / dev (non-native): there is no Filesystem, so every call is a transparent
// passthrough of the remote URL (the browser already caches it). Caching is a no-op.

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { dbRun, dbQuery, isUsingFallback } from '@/lib/localDb'

const DIR = Directory.Data
const ROOT = 'media_cache'

function isNative() {
  return Capacitor.isNativePlatform()
}

// Small, fast, deterministic filename from a URL (djb2). Across the handful of
// media URLs a user accumulates, collisions are astronomically unlikely; we also
// keep the original extension so the file stays self-describing.
function hashUrl(url: string): string {
  let h = 5381
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function extFor(url: string, kind?: string): string {
  const clean = url.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  const tail = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''
  if (tail && tail.length <= 5 && /^[a-z0-9]+$/.test(tail)) return tail
  if (kind === 'image') return 'jpg'
  if (kind === 'video') return 'mp4'
  if (kind === 'audio') return 'webm'
  return 'bin'
}

function relPathFor(url: string, kind?: string): string {
  return `${ROOT}/${hashUrl(url)}.${extFor(url, kind)}`
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => {
      const s = (r.result as string) || ''
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Turn a stored relative path into a webview-displayable src.
async function displaySrc(relPath: string): Promise<string | null> {
  try {
    const { uri } = await Filesystem.getUri({ directory: DIR, path: relPath })
    return Capacitor.convertFileSrc(uri)
  } catch {
    return null
  }
}

async function fileExists(relPath: string): Promise<boolean> {
  try {
    await Filesystem.stat({ directory: DIR, path: relPath })
    return true
  } catch {
    return false
  }
}

async function ensureRootDir(): Promise<void> {
  try {
    await Filesystem.mkdir({ directory: DIR, path: ROOT, recursive: true })
  } catch {
    // Already exists (mkdir throws when the dir is present) — fine.
  }
}

/**
 * Local displayable URI for a remote URL if (and only if) it is cached on disk.
 * Returns null when not cached or when the file was removed from the device.
 * On web/dev, returns the remote URL unchanged (the browser handles caching).
 */
export async function getCachedMediaUri(remoteUrl: string | null | undefined): Promise<string | null> {
  if (!remoteUrl) return null
  if (!isNative()) return remoteUrl
  if (isUsingFallback()) return null
  const rows = await dbQuery<{ path: string }>('SELECT path FROM media_cache WHERE url = ? LIMIT 1', [remoteUrl])
  const rel = rows[0]?.path
  if (!rel) return null
  if (!(await fileExists(rel))) {
    // Deleted from the device — drop the stale row so the UI offers a re-download.
    await dbRun('DELETE FROM media_cache WHERE url = ?', [remoteUrl]).catch(() => {})
    return null
  }
  await dbRun('UPDATE media_cache SET last_access = ? WHERE url = ?', [new Date().toISOString(), remoteUrl]).catch(() => {})
  return displaySrc(rel)
}

async function recordCache(remoteUrl: string, relPath: string, kind: string | undefined, size: number): Promise<void> {
  const now = new Date().toISOString()
  await dbRun(
    `INSERT OR REPLACE INTO media_cache (url, path, kind, size, created_at, last_access) VALUES (?, ?, ?, ?, ?, ?)`,
    [remoteUrl, relPath, kind ?? null, size, now, now]
  ).catch(() => {})
}

/**
 * Store an already-in-hand blob (e.g. the sender's just-uploaded file) under a
 * remote-URL key, so the sender keeps an offline copy without re-downloading.
 */
export async function cacheLocalBlob(remoteUrl: string, blob: Blob, kind?: string): Promise<string | null> {
  if (!isNative() || isUsingFallback()) return null
  try {
    await ensureRootDir()
    const rel = relPathFor(remoteUrl, kind)
    const b64 = await blobToBase64(blob)
    await Filesystem.writeFile({ directory: DIR, path: rel, data: b64 })
    await recordCache(remoteUrl, rel, kind, blob.size)
    return displaySrc(rel)
  } catch {
    return null
  }
}

/** Download a remote URL and store it on disk. Returns a displayable local URI. */
export async function cacheRemoteMedia(remoteUrl: string | null | undefined, kind?: string): Promise<string | null> {
  if (!remoteUrl) return null
  if (!isNative()) return remoteUrl
  if (isUsingFallback()) return remoteUrl
  const existing = await getCachedMediaUri(remoteUrl)
  if (existing) return existing
  try {
    const res = await fetch(remoteUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return await cacheLocalBlob(remoteUrl, blob, kind)
  } catch {
    return null
  }
}

/**
 * Best available src for a remote URL: the cached local file if present;
 * otherwise download + cache when online; otherwise null (caller shows a
 * re-download CTA). Pass { download: false } to look up only, never fetch.
 */
export async function resolveMedia(
  remoteUrl: string | null | undefined,
  kind?: string,
  opts?: { download?: boolean },
): Promise<string | null> {
  if (!remoteUrl) return null
  if (!isNative()) return remoteUrl
  const cached = await getCachedMediaUri(remoteUrl)
  if (cached) return cached
  if (opts?.download === false) return null
  return cacheRemoteMedia(remoteUrl, kind)
}

export async function isMediaCached(remoteUrl: string | null | undefined): Promise<boolean> {
  if (!remoteUrl) return false
  if (!isNative()) return true
  return (await getCachedMediaUri(remoteUrl)) !== null
}

/** Wipe every cached media file + row (called on logout). */
export async function clearMediaCache(): Promise<void> {
  if (!isNative() || isUsingFallback()) return
  try { await Filesystem.rmdir({ directory: DIR, path: ROOT, recursive: true }) } catch { /* nothing to remove */ }
  await dbRun('DELETE FROM media_cache').catch(() => {})
}

'use client'

// Background link-preview queue — the single fetch path for both DMs and communities.
//
// Architecture:
//   1. fetchPreview(url)      — await-able, cache-first, Edge Function on miss.
//   2. queuePreviewFetch(url) — fire-and-forget, deduped, throttled (200 ms between
//                               requests). Calls fetchPreview internally and notifies
//                               all waiting subscribers when done.
//   3. flushPendingPreviews() — called on app start to retry URLs whose last fetch
//                               failed but whose 1-hour back-off window has now passed.
//
// Privacy note: URLs are sent to the user's own Supabase Edge Function (server proxy)
// for fetching. This matches WhatsApp's model — the server fetches on behalf of the
// client, benefits from a shared TTL cache in the link_previews table, and avoids
// direct client-to-Microlink calls that burn a per-IP rate limit quota.

import {
  normalizePreviewUrl,
  fetchServerLinkPreview,
  type LinkPreviewData,
} from '@/lib/linkPreview'
import {
  getCachedPreviewByUrl,
  setCachedPreviewByUrl,
  markPreviewPending,
  getPendingPreviewUrls,
} from '@/lib/offlineCache'

// ── In-memory dedup map: normalized URL → set of pending subscribers ──────────
type Subscriber = (preview: LinkPreviewData) => void
const pending = new Map<string, Set<Subscriber>>()
let processing = false

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the preview for `url`, using the URL-keyed local cache first.
 * Falls back to the Supabase Edge Function (server proxy) on cache miss.
 * Saves the result (or marks failure) in the local cache.
 * Returns null on failure without throwing.
 */
export async function fetchPreview(url: string): Promise<LinkPreviewData | null> {
  const key = normalizePreviewUrl(url)
  const cached = await getCachedPreviewByUrl(key)
  if (cached?.status === 'ready') return cached

  try {
    const preview = await fetchServerLinkPreview(key)
    if (preview?.status === 'ready') {
      await setCachedPreviewByUrl(key, preview).catch(() => {})
      return preview
    }
    await markPreviewPending(key).catch(() => {})
    return null
  } catch {
    await markPreviewPending(key).catch(() => {})
    return null
  }
}

/**
 * Queue a non-blocking background preview fetch.
 * If multiple callers enqueue the same URL before it resolves, they all receive
 * the same result via their `onResult` callback.
 * Respects a 200 ms inter-request delay to avoid hammering the Edge Function.
 */
export function queuePreviewFetch(url: string, onResult: Subscriber): () => void {
  const key = normalizePreviewUrl(url)

  // Fast path: already cached in the URL store — call back synchronously on next tick.
  getCachedPreviewByUrl(key).then(cached => {
    if (cached?.status === 'ready') {
      onResult(cached)
      return
    }
    // Enqueue for background fetch.
    if (!pending.has(key)) pending.set(key, new Set())
    pending.get(key)!.add(onResult)
    if (!processing) scheduleNext()
  }).catch(() => {
    if (!pending.has(key)) pending.set(key, new Set())
    pending.get(key)!.add(onResult)
    if (!processing) scheduleNext()
  })

  // Return a cancel handle so callers can remove their callback on unmount.
  return () => { pending.get(key)?.delete(onResult) }
}

/**
 * Retry all URLs that previously failed but whose back-off window has expired.
 * Called once on app start from useAppRealtime.ts.
 */
export async function flushPendingPreviews(): Promise<void> {
  const urls = await getPendingPreviewUrls().catch(() => [] as string[])
  for (const url of urls) {
    if (!pending.has(url)) pending.set(url, new Set())
  }
  if (!processing && pending.size > 0) scheduleNext()
}

// ── Internal queue processor ──────────────────────────────────────────────────

function scheduleNext() {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(processNext, { timeout: 2000 })
  } else {
    setTimeout(processNext, 50)
  }
}

async function processNext() {
  if (processing || pending.size === 0) return
  const [key, subscribers] = pending.entries().next().value as [string, Set<Subscriber>]
  pending.delete(key)
  processing = true

  try {
    const preview = await fetchPreview(key)
    if (preview) subscribers.forEach(cb => { try { cb(preview) } catch { /* ignore */ } })
  } catch { /* fetchPreview never throws, but guard anyway */ } finally {
    processing = false
    if (pending.size > 0) setTimeout(processNext, 200) // 200 ms throttle
  }
}

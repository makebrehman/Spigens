'use client'

import { useState, useEffect } from 'react'

const PREFIX = 'spigens_icon_'

// in-memory cache for the current session
const iconCache = new Map<string, string>()
// track in-flight requests to avoid duplicate fetches
const pendingFetches = new Map<string, Promise<string | null>>()

function saveIconToStorage(name: string, svg: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(PREFIX + name, svg) } catch { /* storage full */ }
}

function loadIconFromStorage(name: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(PREFIX + name) } catch { return null }
}

/**
 * fetches a lucide icon's raw svg markup by name.
 * 3-tier lookup: memory → localStorage → network (unpkg).
 * returns null if the icon doesn't exist or fetch fails (offline + not cached).
 */
export async function fetchLucideIcon(name: string): Promise<string | null> {
  if (!name) return null

  const clean = name.trim().toLowerCase()

  // 1. memory cache
  if (iconCache.has(clean)) return iconCache.get(clean)!

  // 2. localStorage cache (survives page reloads and offline sessions)
  const stored = loadIconFromStorage(clean)
  if (stored) {
    iconCache.set(clean, stored)
    return stored
  }

  // 3. in-flight dedup
  if (pendingFetches.has(clean)) return pendingFetches.get(clean)!

  const fetchPromise = (async () => {
    try {
      const url = `https://unpkg.com/lucide-static@latest/icons/${clean}.svg`
      const res = await fetch(url)
      if (!res.ok) return null
      let svg = await res.text()
      svg = svg.replace(/stroke="[^"]*"/g, 'stroke="currentColor"')
      iconCache.set(clean, svg)
      saveIconToStorage(clean, svg)
      return svg
    } catch {
      return null
    } finally {
      pendingFetches.delete(clean)
    }
  })()

  pendingFetches.set(clean, fetchPromise)
  return fetchPromise
}

// Core chrome icons we always want available offline (back/send/etc.), in case the
// source scan misses them or runs before sources hydrate.
const CORE_ICONS = [
  'arrow-left', 'chevron-left', 'chevron-right', 'arrow-up', 'arrow-right',
  'send', 'send-horizontal', 'search', 'plus', 'x', 'check', 'check-check',
  'paperclip', 'mic', 'smile', 'image', 'camera', 'file', 'file-text', 'trash-2',
  'copy', 'corner-up-left', 'more-vertical', 'more-horizontal', 'settings', 'users',
  'user', 'user-round', 'phone', 'video', 'reply', 'forward', 'download', 'play',
  'pause', 'music', 'bell-off', 'pin', 'archive',
]

/**
 * Warm lucide icons into the offline (localStorage) cache so they render with no
 * network. Scans GenUI component sources for icon names + the CORE list. Online-only,
 * best-effort; over-matching is harmless (a non-existent icon just returns null).
 */
export async function warmIconsFromSources(sources: Record<string, string> | null | undefined): Promise<void> {
  const names = new Set<string>(CORE_ICONS)
  if (sources) {
    const re = /name\s*[:=]\s*["'`]([a-z][a-z0-9-]{1,40})["'`]/g
    for (const src of Object.values(sources)) {
      if (typeof src !== 'string') continue
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) names.add(m[1])
    }
  }
  const list = [...names].slice(0, 200)
  let i = 0
  const worker = async () => {
    while (i < list.length) { const n = list[i++]; try { await fetchLucideIcon(n) } catch { /* ignore */ } }
  }
  await Promise.all(Array.from({ length: Math.min(6, list.length) }, worker))
}

/**
 * react hook to use a lucide icon by name.
 * initialises synchronously from cache so there is no flash on reload.
 */
export function useLucideIcon(name: string | undefined): string | null {
  const [svg, setSvg] = useState<string | null>(() => {
    if (!name) return null
    const clean = name.trim().toLowerCase()
    return iconCache.get(clean) ?? loadIconFromStorage(clean) ?? null
  })

  useEffect(() => {
    if (!name) { setSvg(null); return }
    let active = true
    fetchLucideIcon(name).then(result => { if (active) setSvg(result) })
    return () => { active = false }
  }, [name])

  return svg
}

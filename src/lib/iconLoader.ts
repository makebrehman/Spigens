'use client'

import { useState, useEffect } from 'react'

// cache fetched icon svg markup by name
const iconCache = new Map<string, string>()
// track in-flight requests to avoid duplicate fetches
const pendingFetches = new Map<string, Promise<string | null>>()

/**
 * fetches a lucide icon's raw svg markup by name.
 * e.g. fetchLucideIcon("heart") -> "<svg ...>...</svg>"
 * returns null if the icon doesn't exist (404) or fetch fails.
 */
export async function fetchLucideIcon(name: string): Promise<string | null> {
  if (!name) return null

  const clean = name.trim().toLowerCase()

  // return cached if available
  if (iconCache.has(clean)) {
    return iconCache.get(clean)!
  }

  // return in-flight promise if already fetching
  if (pendingFetches.has(clean)) {
    return pendingFetches.get(clean)!
  }

  const fetchPromise = (async () => {
    try {
      const url = `https://unpkg.com/lucide-static@latest/icons/${clean}.svg`
      const res = await fetch(url)
      if (!res.ok) {
        return null // icon doesn't exist
      }
      let svg = await res.text()
      // ensure the svg uses currentColor so it can be styled
      svg = svg.replace(/stroke="[^"]*"/g, 'stroke="currentColor"')
      iconCache.set(clean, svg)
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

/**
 * react hook to use a lucide icon by name.
 * returns the svg markup string, or null while loading / if not found.
 */
export function useLucideIcon(name: string | undefined): string | null {
  const [svg, setSvg] = useState<string | null>(
    name ? iconCache.get(name.trim().toLowerCase()) ?? null : null
  )

  useEffect(() => {
    if (!name) {
      setTimeout(() => setSvg(null), 0)
      return
    }
    let active = true
    fetchLucideIcon(name).then(result => {
      if (active) setSvg(result)
    })
    return () => { active = false }
  }, [name])

  return svg
}

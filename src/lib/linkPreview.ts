'use client'

// Shared link-preview fetch used by both DM and community text bubbles.
// Static export → no server, so OG metadata is fetched client-side via a
// CORS-enabled service. Results are cached in-memory for the session.

export const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

const previewCache = new Map<string, any>()

export async function fetchLinkPreview(url: string): Promise<any> {
  if (previewCache.has(url)) return previewCache.get(url)
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
    const json = await res.json()
    if (json?.status !== 'success' || !json.data) return null
    const d = json.data
    let hostname = ''
    try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch {}
    const preview = {
      url,
      title: d.title || null,
      description: d.description || null,
      image: d.image?.url || d.logo?.url || null,
      siteName: d.publisher || null,
      hostname,
    }
    if (preview.title) previewCache.set(url, preview)
    return preview
  } catch {
    return null
  }
}

// The first non-media, non-blob link in a text body (the one we preview).
export function firstPreviewableUrl(text: string | null | undefined): string | null {
  if (!text) return null
  const matches = text.match(URL_REGEX)
  if (!matches?.length) return null
  const first = matches[0]
  if (first.includes('supabase.co/storage') || first.startsWith('blob:')) return null
  return first
}

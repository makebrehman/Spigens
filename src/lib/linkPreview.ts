'use client'

import { supabase } from '@/lib/supabase'

// Shared link-preview helpers used by DM and community text bubbles.
// DMs keep preview fetching client-side so shared URLs do not get sent to our
// server. Community messages can use the Supabase Edge Function / shared cache.

export const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

export interface LinkPreviewData {
  url: string
  normalizedUrl: string
  hostname: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  fetchedAt: string | null
  status: 'ready' | 'failed' | 'fallback'
}

const previewCache = new Map<string, LinkPreviewData>()

export function normalizePreviewUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    u.hash = ''
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = ''
    }
    return u.toString()
  } catch {
    return rawUrl
  }
}

export function buildFallbackLinkPreview(url: string): LinkPreviewData {
  const normalizedUrl = normalizePreviewUrl(url)
  let hostname = ''
  try { hostname = new URL(normalizedUrl).hostname.replace(/^www\./, '') } catch { hostname = normalizedUrl }
  return {
    url,
    normalizedUrl,
    hostname,
    title: null,
    description: null,
    image: null,
    siteName: null,
    fetchedAt: null,
    status: 'fallback',
  }
}

export function normalizeLinkPreview(input: any, fallbackUrl?: string): LinkPreviewData | null {
  const url = typeof input?.url === 'string' ? input.url : fallbackUrl
  if (!url) return null
  const fallback = buildFallbackLinkPreview(url)
  return {
    url,
    normalizedUrl: typeof input?.normalizedUrl === 'string' ? input.normalizedUrl : fallback.normalizedUrl,
    hostname: typeof input?.hostname === 'string' && input.hostname ? input.hostname : fallback.hostname,
    title: typeof input?.title === 'string' && input.title ? input.title : null,
    description: typeof input?.description === 'string' && input.description ? input.description : null,
    image: typeof input?.image === 'string' && input.image ? input.image : null,
    siteName: typeof input?.siteName === 'string' && input.siteName ? input.siteName : null,
    fetchedAt: typeof input?.fetchedAt === 'string' ? input.fetchedAt : null,
    status: input?.status === 'ready' || input?.status === 'failed' || input?.status === 'fallback' ? input.status : fallback.status,
  }
}

export async function fetchClientLinkPreview(url: string): Promise<LinkPreviewData | null> {
  const cacheKey = normalizePreviewUrl(url)
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey) ?? null
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
    const json = await res.json()
    if (json?.status !== 'success' || !json.data) return null
    const d = json.data
    const fallback = buildFallbackLinkPreview(url)
    const preview: LinkPreviewData = {
      url,
      normalizedUrl: fallback.normalizedUrl,
      hostname: fallback.hostname,
      title: d.title || null,
      description: d.description || null,
      image: d.image?.url || d.logo?.url || null,
      siteName: d.publisher || null,
      fetchedAt: new Date().toISOString(),
      status: 'ready',
    }
    if (preview.title || preview.description || preview.image) previewCache.set(cacheKey, preview)
    return preview
  } catch {
    return null
  }
}

export async function fetchServerLinkPreview(url: string): Promise<LinkPreviewData | null> {
  const cacheKey = normalizePreviewUrl(url)
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey) ?? null
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } })
    if (error || !data) return fetchClientLinkPreview(url)
    const preview = normalizeLinkPreview(data.preview ?? data, url)
    if (preview) previewCache.set(cacheKey, preview)
    return preview
  } catch {
    return fetchClientLinkPreview(url)
  }
}

// Backwards-compatible alias for any remaining imports.
export const fetchLinkPreview = fetchClientLinkPreview

// The first non-media, non-blob link in a text body (the one we preview).
export function firstPreviewableUrl(text: string | null | undefined): string | null {
  if (!text) return null
  const matches = text.match(URL_REGEX)
  if (!matches?.length) return null
  const first = matches[0]
  if (first.includes('supabase.co/storage') || first.startsWith('blob:')) return null
  return first
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type PreviewStatus = 'ready' | 'failed'

interface Preview {
  url: string
  normalizedUrl: string
  hostname: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  fetchedAt: string
  status: PreviewStatus
}

const DAY_MS = 24 * 60 * 60 * 1000
const READY_TTL_MS = 7 * DAY_MS
const FAILED_TTL_MS = DAY_MS

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeUrl(input: string): { originalUrl: string; normalizedUrl: string; hostname: string } {
  const u = new URL(input)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) links can be previewed')
  u.hash = ''
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = ''
  const hostname = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!hostname || isBlockedHost(hostname)) throw new Error('This host cannot be previewed')
  return { originalUrl: input, normalizedUrl: u.toString(), hostname }
}

function isBlockedHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true
  if (hostname === '0.0.0.0') return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split('.').map(Number)
    const [a, b] = parts
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }
  if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) return true
  return false
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function absoluteUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const u = new URL(value, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function metaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
    const m = html.match(re)
    if (m?.[1]) return m[1]
    const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
    const r = html.match(reverse)
    if (r?.[1]) return r[1]
  }
  return null
}

async function fetchViaMicrolink(url: string, hostname: string): Promise<Omit<Preview, 'normalizedUrl' | 'fetchedAt' | 'status'> | null> {
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.status !== 'success' || !data.data) return null
  const d = data.data
  return {
    url,
    hostname,
    title: cleanText(d.title, 180),
    description: cleanText(d.description, 280),
    image: absoluteUrl(d.image?.url || d.logo?.url, url),
    siteName: cleanText(d.publisher, 80),
  }
}

async function fetchViaHtml(url: string, hostname: string): Promise<Omit<Preview, 'normalizedUrl' | 'fetchedAt' | 'status'> | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 7000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'SpigensLinkPreview/1.0' },
    })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.includes('text/html')) return null
    const html = (await res.text()).slice(0, 250_000)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return {
      url,
      hostname,
      title: cleanText(metaContent(html, ['og:title', 'twitter:title']) || titleMatch?.[1], 180),
      description: cleanText(metaContent(html, ['og:description', 'description', 'twitter:description']), 280),
      image: absoluteUrl(metaContent(html, ['og:image', 'twitter:image']), url),
      siteName: cleanText(metaContent(html, ['og:site_name']), 80),
    }
  } finally {
    clearTimeout(timer)
  }
}

function rowToPreview(row: any): Preview {
  return {
    url: row.original_url,
    normalizedUrl: row.normalized_url,
    hostname: row.hostname,
    title: row.title,
    description: row.description,
    image: row.image_url,
    siteName: row.site_name,
    fetchedAt: row.fetched_at,
    status: row.status,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'expected POST' }, 405)

  try {
    const { url } = await req.json()
    if (typeof url !== 'string' || !url.trim()) return json({ error: 'url is required' }, 400)

    const normalized = normalizeUrl(url.trim())
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: cached } = await supabase
      .from('link_previews')
      .select('*')
      .eq('normalized_url', normalized.normalizedUrl)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cached) return json({ preview: rowToPreview(cached), cached: true })

    const fetchedAt = new Date()
    let previewData = await fetchViaMicrolink(normalized.normalizedUrl, normalized.hostname)
    if (!previewData) previewData = await fetchViaHtml(normalized.normalizedUrl, normalized.hostname)

    const status: PreviewStatus = previewData && (previewData.title || previewData.description || previewData.image) ? 'ready' : 'failed'
    const row = {
      normalized_url: normalized.normalizedUrl,
      original_url: normalized.originalUrl,
      hostname: normalized.hostname,
      title: status === 'ready' ? previewData?.title ?? null : null,
      description: status === 'ready' ? previewData?.description ?? null : null,
      image_url: status === 'ready' ? previewData?.image ?? null : null,
      site_name: status === 'ready' ? previewData?.siteName ?? null : null,
      status,
      fetched_at: fetchedAt.toISOString(),
      expires_at: new Date(fetchedAt.getTime() + (status === 'ready' ? READY_TTL_MS : FAILED_TTL_MS)).toISOString(),
    }

    const { data: saved, error } = await supabase
      .from('link_previews')
      .upsert(row, { onConflict: 'normalized_url' })
      .select('*')
      .single()

    if (error) throw error
    return json({ preview: rowToPreview(saved), cached: false })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400)
  }
})

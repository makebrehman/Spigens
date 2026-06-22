import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, any>()

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json(null, { status: 400 })

  if (cache.has(url)) return NextResponse.json(cache.get(url))

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Spigens/1.0; +https://spigens.app)' },
      signal: AbortSignal.timeout(5000),
    })
    const html = await res.text()

    const getOg = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
             || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`, 'i'))
      return m?.[1]?.trim() || null
    }
    const getMeta = (name: string) => {
      const m = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
             || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i'))
      return m?.[1]?.trim() || null
    }

    const title = getOg('title') || getMeta('twitter:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null
    const description = getOg('description') || getMeta('description') || null
    const image = getOg('image') || getMeta('twitter:image') || null
    const siteName = getOg('site_name') || null
    let hostname = ''
    try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch {}

    const preview = { url, title, description, image, siteName, hostname }
    cache.set(url, preview)
    return NextResponse.json(preview)
  } catch {
    return NextResponse.json(null)
  }
}

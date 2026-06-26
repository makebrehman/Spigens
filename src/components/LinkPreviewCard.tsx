'use client'

import { useEffect, useState } from 'react'
import { fetchLinkPreview } from '@/lib/linkPreview'

// A link preview that ALWAYS renders something: a basic card (favicon + site +
// the URL) shows immediately for any link, and it's quietly upgraded with the
// page image / title / description if the (best-effort, free) preview service
// responds. So a link is never just dead text — it's a tappable card.

export interface LinkPreviewCardProps {
  url: string
  isSent: boolean
  /** Left inset for received bubbles (e.g. past a sender avatar). Defaults to 16. */
  leftInset?: number
}

export function LinkPreviewCard({ url, isSent, leftInset = 16 }: LinkPreviewCardProps) {
  const [meta, setMeta] = useState<any>(null)

  useEffect(() => {
    let active = true
    setMeta(null)
    fetchLinkPreview(url).then(p => { if (active && p?.title) setMeta(p) })
    return () => { active = false }
  }, [url])

  let hostname = ''
  try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch { hostname = url }

  const open = () => { try { window.open(url, '_blank', 'noopener,noreferrer') } catch { /* ignore */ } }

  return (
    <div
      onClick={open}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        margin: isSent ? '2px 16px 6px auto' : `2px auto 6px ${leftInset}px`,
        maxWidth: 280,
        background: isSent ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isSent ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {meta?.image && (
        <img
          src={meta.image}
          alt=""
          style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`}
            alt=""
            width={16}
            height={16}
            style={{ borderRadius: 3, flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta?.siteName || hostname}
          </span>
        </div>
        {meta?.title && (
          <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600, lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
            {meta.title}
          </div>
        )}
        {meta?.description && (
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
            {meta.description}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>
      </div>
    </div>
  )
}

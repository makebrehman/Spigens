'use client'

import { buildFallbackLinkPreview, normalizeLinkPreview, type LinkPreviewData } from '@/lib/linkPreview'

export interface LinkPreviewCardProps {
  url: string
  isSent: boolean
  preview?: LinkPreviewData | null
  /** Left inset for received bubbles (e.g. past a sender avatar). Defaults to 16. */
  leftInset?: number
  embedded?: boolean
}

export function LinkPreviewCard({ url, isSent, preview, leftInset = 16, embedded = false }: LinkPreviewCardProps) {
  const meta = normalizeLinkPreview(preview, url) ?? buildFallbackLinkPreview(url)
  const hostname = meta.hostname || url

  const open = () => { try { window.open(url, '_blank', 'noopener,noreferrer') } catch { /* ignore */ } }

  return (
    <div
      onClick={open}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        margin: embedded ? '8px 0 2px' : (isSent ? '2px 16px 6px auto' : `2px auto 6px ${leftInset}px`),
        maxWidth: embedded ? '100%' : 280,
        width: embedded ? '100%' : undefined,
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
            {meta.siteName || hostname}
          </span>
        </div>
        {meta.title && (
          <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600, lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
            {meta.title}
          </div>
        )}
        {meta.description && (
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
            {meta.description}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>
      </div>
    </div>
  )
}

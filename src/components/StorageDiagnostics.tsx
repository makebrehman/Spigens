'use client'

// TEMPORARY on-device diagnostic for the local SQLite store. Renders a tiny badge
// (bottom-left) that shows whether native SQLite is actually registered, open, and
// holding rows — so we can see the database's real state on the phone instead of
// guessing. Remove once offline storage is confirmed working.

import { useState, useEffect, useCallback } from 'react'
import { getLocalDbDiagnostics, getTableCounts } from '@/lib/localDb'

export function StorageDiagnostics() {
  const [open, setOpen] = useState(false)
  const [diag, setDiag] = useState<ReturnType<typeof getLocalDbDiagnostics> | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  const refresh = useCallback(async () => {
    setDiag(getLocalDbDiagnostics())
    setCounts(await getTableCounts())
  }, [])

  useEffect(() => { const t = setTimeout(refresh, 800); return () => clearTimeout(t) }, [refresh])

  const ok = !!diag?.sqliteActive
  const badge = ok ? '#16a34a' : '#dc2626'

  return (
    <div style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 99999, fontFamily: 'monospace' }}>
      {!open ? (
        <button
          onClick={() => { setOpen(true); refresh() }}
          style={{ background: badge, color: '#fff', border: 'none', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
        >
          DB {ok ? '✓' : '✗'}
        </button>
      ) : (
        <div style={{ background: 'rgba(0,0,0,0.93)', color: '#e5e7eb', border: `1px solid ${badge}`, borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 1.5, maxWidth: 290, boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ color: badge }}>SQLite diagnostics</b>
            <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>✕</span>
          </div>
          {diag && (
            <div>
              <div>native platform: <b>{String(diag.native)}</b></div>
              <div>sqlite plugin registered: <b style={{ color: diag.sqlitePluginAvailable ? '#16a34a' : '#dc2626' }}>{String(diag.sqlitePluginAvailable)}</b></div>
              <div>filesystem plugin: <b style={{ color: diag.filesystemPluginAvailable ? '#16a34a' : '#dc2626' }}>{String(diag.filesystemPluginAvailable)}</b></div>
              <div>sqlite open: <b>{String(diag.dbOpen)}</b></div>
              <div>sqlite active: <b style={{ color: diag.sqliteActive ? '#16a34a' : '#dc2626' }}>{String(diag.sqliteActive)}</b></div>
              <div>using localStorage fallback: <b>{String(diag.usingFallback)}</b></div>
              {diag.lastInitError && <div style={{ color: '#f87171', wordBreak: 'break-word', marginTop: 4 }}>init error: {diag.lastInitError}</div>}
            </div>
          )}
          {counts && (
            <div style={{ marginTop: 6, borderTop: '1px solid #374151', paddingTop: 6 }}>
              <div style={{ color: '#9ca3af', marginBottom: 2 }}>row counts (-1 = DB not serving):</div>
              {Object.entries(counts).map(([k, v]) => (
                <div key={k}>{k}: <b style={{ color: v < 0 ? '#dc2626' : v === 0 ? '#eab308' : '#16a34a' }}>{v}</b></div>
              ))}
            </div>
          )}
          <button
            onClick={refresh}
            style={{ marginTop: 8, background: '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}
          >
            refresh
          </button>
        </div>
      )}
    </div>
  )
}

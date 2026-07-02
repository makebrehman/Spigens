'use client'

import { useEffect, useState } from 'react'
import { PERF_HUD, perfSnapshot } from '@/lib/perfHud'

// Dev-only live readout pinned bottom-right. Polls the profiler every 200ms and
// shows the open-timeline, render counts, and the actual freeze duration.
export function PerfHud() {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!PERF_HUD) return
    const id = setInterval(() => tick(n => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  if (!PERF_HUD) return null
  const s = perfSnapshot()

  return (
    <div style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 2147483647,
      maxWidth: 240, maxHeight: '55vh', overflowY: 'auto',
      background: 'rgba(0,0,0,0.82)', color: '#d1fae5',
      font: '10px/1.35 ui-monospace, monospace', padding: '8px 10px',
      borderRadius: 8, border: '1px solid #10b981', pointerEvents: 'none',
      whiteSpace: 'pre',
    }}>
      <div style={{ color: '#6ee7b7', fontWeight: 700, marginBottom: 4 }}>PERF · chat open</div>
      {s.marks.map(m => (
        <div key={m.label}>
          <span style={{ color: '#fca5a5' }}>+{m.at.toFixed(0)}</span>
          <span style={{ color: '#6b7280' }}> Δ{m.dt.toFixed(0)} </span>
          {m.label}
        </div>
      ))}
      <div style={{ marginTop: 5, borderTop: '1px solid #374151', paddingTop: 4 }}>
        {Object.entries(s.counts).map(([k, v]) => (
          <div key={k}><span style={{ color: '#93c5fd' }}>{v}</span>{'  '}{k}</div>
        ))}
      </div>
      {Object.keys(s.timings).length > 0 && (
        <div style={{ marginTop: 5, borderTop: '1px solid #374151', paddingTop: 4 }}>
          {Object.entries(s.timings)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div key={k}><span style={{ color: '#fbbf24' }}>{v.toFixed(0)}ms</span>{'  '}{k}</div>
            ))}
        </div>
      )}
      <div style={{ marginTop: 5, borderTop: '1px solid #374151', paddingTop: 4, color: '#fde68a' }}>
        <div>longest freeze: <b style={{ color: '#f87171' }}>{s.longestStall.toFixed(0)}ms</b></div>
        <div>total frozen: <b style={{ color: '#f87171' }}>{s.totalStall.toFixed(0)}ms</b></div>
      </div>
    </div>
  )
}

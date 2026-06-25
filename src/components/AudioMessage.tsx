'use client'

import { useMemo, useRef, useState } from 'react'

// WhatsApp-style voice / audio player: round play-pause button, a tappable
// waveform that doubles as the seek bar, and a running time. Playback is fully
// local — `src` is a downloaded file URI (or null while it's still being fetched).
// Nothing streams from the network here.

export interface AudioMessageProps {
  src: string | null
  isSent: boolean
  /** Known duration in seconds (from message metadata), used before playback starts. */
  duration?: number
  /** True while the file is downloading to the device. */
  resolving?: boolean
  /** Called when the user taps play but the file isn't on the device yet. */
  onRetry?: () => void
}

// Deterministic pseudo-waveform: stable bar heights derived from a seed string, so
// the same message always renders the same shape (no decoding the audio needed).
function makeBars(count: number, seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0
    const v = (Math.abs(h) % 100) / 100 // 0..1
    out.push(0.25 + v * 0.75) // keep a visible minimum height
  }
  return out
}

function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s || 0))
  const m = Math.floor(t / 60)
  const ss = String(t % 60).padStart(2, '0')
  return `${m}:${ss}`
}

export function AudioMessage({ src, isSent, duration = 0, resolving, onRetry }: AudioMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveRef = useRef<HTMLDivElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  // Prefer the real duration read off the file once it loads; fall back to the
  // duration carried in the message metadata (shown before playback / while offline).
  const [loadedDur, setLoadedDur] = useState(0)
  const dur = loadedDur || duration || 0

  const bars = useMemo(() => makeBars(38, src || `seed${duration}`), [src, duration])
  const pct = dur > 0 ? Math.min(1, cur / dur) : 0

  const accent = isSent ? '#bfdbfe' : '#60a5fa'
  const accentTrack = isSent ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)'
  const btnBg = isSent ? '#ffffff' : '#2563eb'
  const btnFg = isSent ? '#1d4ed8' : '#ffffff'

  const togglePlay = () => {
    if (!src) { onRetry?.(); return }
    const a = audioRef.current
    if (!a) return
    if (playing) a.pause()
    else a.play().catch(() => {})
  }

  const seekToRatio = (ratio: number) => {
    const a = audioRef.current
    if (!a || !dur) return
    const r = Math.max(0, Math.min(1, ratio))
    a.currentTime = r * dur
    setCur(r * dur)
  }

  const onWavePointer = (e: React.PointerEvent) => {
    e.stopPropagation()
    const el = waveRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    seekToRatio((e.clientX - rect.left) / rect.width)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 232, maxWidth: '100%' }}>
      <button
        onClick={togglePlay}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: 'none',
          background: btnBg, color: btnFg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
      >
        {resolving && !src ? (
          <svg width="18" height="18" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke={btnFg} strokeWidth="5" strokeLinecap="round" strokeDasharray="80 50">
              <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
            </circle>
          </svg>
        ) : !src ? (
          // Not on device yet — show a download glyph.
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={btnFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ) : playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill={btnFg}>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill={btnFg}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          ref={waveRef}
          onPointerDown={onWavePointer}
          style={{ display: 'flex', alignItems: 'center', gap: 2, height: 26, cursor: src ? 'pointer' : 'default' }}
        >
          {bars.map((bh, i) => {
            const filled = i / bars.length <= pct
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.round(bh * 100)}%`,
                  minWidth: 2,
                  borderRadius: 2,
                  background: filled ? accent : accentTrack,
                  transition: 'background 0.1s linear',
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 11, color: isSent ? 'rgba(255,255,255,0.7)' : 'rgba(156,163,175,0.95)' }}>
            {fmt(playing || cur > 0 ? cur : dur)}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src || undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d) && d > 0) setLoadedDur(d)
        }}
        onEmptied={() => { setPlaying(false); setCur(0) }}
        onEnded={() => { setPlaying(false); setCur(0) }}
        style={{ display: 'none' }}
      />
    </div>
  )
}

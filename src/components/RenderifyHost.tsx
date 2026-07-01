'use client'

import * as React from 'react'
import { compileJSX } from '@/lib/renderify'

// --- error boundary (must be a class component) ---
interface BoundaryProps {
  children: React.ReactNode
  onError: (error: string) => void
  fallback: React.ReactNode
}
interface BoundaryState {
  hasError: boolean
}

class RenderErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Compiled component code closes over scope values at the moment it's built — a plain
// value (isOnline, a status string, a display name) baked in at compile time stays
// frozen even after the real value changes, unless something forces a recompile.
// This builds a cheap fingerprint of storeActions' primitive values so RenderifyHost
// can detect "something actually changed" and recompile automatically, without every
// call site having to manually manage a scopeKey. Functions are skipped (they already
// read live data at call time). Objects/arrays are skipped too — callers commonly
// rebuild a fresh wrapper object every render regardless of whether the content
// actually changed, which would force a needless recompile on every single render;
// values that need to stay fresh at that level should go through useComponentState,
// or the caller can pass an explicit scopeKey (see ChatScreen's per-conversation use).
// `stableKeys` lets a caller mark specific scope fields as "known to update via
// useComponentState already" (or otherwise not worth an auto-refresh) so a change to
// just that field doesn't force a full recompile/remount of the generated component.
// The raw value still stays in storeActions — this only affects whether it counts
// toward the auto-refresh fingerprint below — so anything (default or custom-saved
// source) that reads it directly out of scope keeps working exactly as before.
function primitiveScopeFingerprint(storeActions: Record<string, any>, stableKeys?: Set<string>): string {
  const parts: string[] = []
  for (const key of Object.keys(storeActions).sort()) {
    if (stableKeys?.has(key)) continue
    const value = storeActions[key]
    const t = typeof value
    if (t === 'string' || t === 'number' || t === 'boolean' || value === null || value === undefined) {
      parts.push(`${key}:${String(value)}`)
    }
  }
  return parts.join('|')
}

// --- the host ---
interface RenderifyHostProps {
  code: string | null
  storeActions?: Record<string, any>
  scopeKey?: string | number | null
  stableKeys?: string[]
}

export function RenderifyHost({ code, storeActions = {}, scopeKey = null, stableKeys }: RenderifyHostProps) {
  const [renderError, setRenderError] = React.useState<string | null>(null)

  // reset error when code changes
  React.useEffect(() => {
    setTimeout(() => setRenderError(null), 0)
  }, [code])

  const autoRefreshKey = primitiveScopeFingerprint(storeActions, stableKeys ? new Set(stableKeys) : undefined)

  // Rebind when scopeKey changes (e.g. a different chat conversation), or when a
  // primitive scope value changes (e.g. isOnline flips) — while keeping the
  // transformed source cached in renderify.tsx.
  const compiled = React.useMemo(
    () => code ? compileJSX(code, storeActions) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, scopeKey, autoRefreshKey]
  )

  if (!code) return null

  const { Component, error: compileError } = compiled!

  if (compileError) {
    console.log('RENDERIFY COMPILE ERROR:', compileError)
    console.log('RENDERIFY CODE THAT FAILED:', code)
  }

  const fallback = (
    <div style={{
      padding: '12px',
      margin: '8px',
      borderRadius: '8px',
      background: '#2a1215',
      border: '1px solid #7f1d1d',
      color: '#fca5a5',
      fontSize: '12px',
    }}>
      couldn&apos;t render this element
      {renderError && (
        <div style={{ marginTop: '6px', color: '#f87171', fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {renderError}
        </div>
      )}
    </div>
  )

  if (compileError) {
    return (
      <div style={{
        padding: '12px', margin: '8px', borderRadius: '8px',
        background: '#2a1215', border: '1px solid #7f1d1d',
        color: '#fca5a5', fontSize: '11px',
      }}>
        couldn&apos;t build this custom element
        <div style={{ marginTop: '6px', color: '#f87171', fontSize: '10px', fontFamily: 'monospace' }}>
          {compileError}
        </div>
      </div>
    )
  }

  if (!Component) return null

  return (
    <RenderErrorBoundary onError={setRenderError} fallback={fallback}>
      {renderError ? fallback : <Component />}
    </RenderErrorBoundary>
  )
}

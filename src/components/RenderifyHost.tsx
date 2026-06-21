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

// --- the host ---
interface RenderifyHostProps {
  code: string | null
  storeActions?: Record<string, any>
}

export function RenderifyHost({ code, storeActions = {} }: RenderifyHostProps) {
  const [renderError, setRenderError] = React.useState<string | null>(null)

  // reset error when code changes
  React.useEffect(() => {
    setTimeout(() => setRenderError(null), 0)
  }, [code])

  // memoize compilation — only recompile when code actually changes.
  // storeActions is intentionally excluded from deps because it is stable from the caller.
  // this prevents the compiled component from remounting on every parent re-render,
  // which would wipe its internal useState values.
  const compiled = React.useMemo(
    () => code ? compileJSX(code, storeActions) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code]
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

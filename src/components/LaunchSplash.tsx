'use client'

interface DbDiag {
  isNative: boolean
  pluginAvailable: boolean
  pluginInBridge: boolean
  sqliteActive: boolean
  usingFallback: boolean
  attempts: number
  lastStep: string
  errorStep: string
  lastError: string | null
}

interface LaunchSplashProps {
  dbStatus?: 'initializing' | 'ready' | 'failed'
  dbStep?: string
  dbDiag?: DbDiag | null
}

export function LaunchSplash({ dbStatus = 'initializing', dbStep = '', dbDiag = null }: LaunchSplashProps) {
  const dotColor =
    dbStatus === 'ready'  ? '#4ade80' :
    dbStatus === 'failed' ? '#f87171' :
                            'rgba(255,255,255,0.35)'

  const statusLabel =
    dbStatus === 'ready'  ? 'Local storage ready' :
    dbStatus === 'failed' ? 'Local storage unavailable' :
                            'Setting up local storage...'

  const statusColor =
    dbStatus === 'ready'  ? 'rgba(74,222,128,0.85)' :
    dbStatus === 'failed' ? 'rgba(248,113,113,0.85)' :
                            'rgba(255,255,255,0.45)'

  return (
    <div style={{
      height: '100vh', width: '100%', background: '#050505',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', boxSizing: 'border-box',
    }}>
      <img
        src="/spigens_logo.png"
        alt="Spigens"
        style={{ width: 72, height: 72, borderRadius: 20, objectFit: 'cover', marginBottom: '18px' }}
      />
      <div style={{ fontSize: '10px', letterSpacing: '5px', color: 'rgba(255,255,255,0.16)', marginBottom: '5px' }}>
        spigens
      </div>
      <div style={{ fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.10)', marginBottom: '40px' }}>
        end-to-end encrypted
      </div>

      {/* Status dot + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '20px' }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
          transition: 'background 0.3s ease',
        }} />
        <span style={{ fontSize: '11px', color: statusColor, letterSpacing: '0.3px' }}>
          {statusLabel}
        </span>
      </div>

      {/* Live step (always shown while initializing or on failure) */}
      {(dbStatus === 'initializing' || dbStatus === 'failed') && dbStep ? (
        <div style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.3)',
          marginBottom: dbStatus === 'failed' ? '20px' : 0,
          textAlign: 'center', maxWidth: 280,
        }}>
          {dbStep}
        </div>
      ) : null}

      {/* Full diagnostic panel — only on failure */}
      {dbStatus === 'failed' && dbDiag ? (
        <div style={{
          width: '100%', maxWidth: 320,
          background: 'rgba(248,113,113,0.06)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 10, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <DiagRow label="Native platform" value={dbDiag.isNative ? 'Yes' : 'No (web)'} ok={dbDiag.isNative} />
          <DiagRow label="Plugin available" value={dbDiag.pluginAvailable ? 'Yes' : 'No'} ok={dbDiag.pluginAvailable} />
          <DiagRow label="Plugin in bridge" value={dbDiag.pluginInBridge ? 'Yes' : 'No'} ok={dbDiag.pluginInBridge} />
          <DiagRow label="SQLite active"    value={dbDiag.sqliteActive ? 'Yes' : 'No'}    ok={dbDiag.sqliteActive} />
          <DiagRow label="Attempts made"    value={String(dbDiag.attempts || 0)}           ok={false} neutral />
          <DiagRow label="Failed at call"   value={dbDiag.errorStep || '—'}               ok={false} neutral />
          {dbDiag.lastError ? (
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(248,113,113,0.15)' }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Error</div>
              <div style={{ fontSize: '10px', color: 'rgba(248,113,113,0.8)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                {dbDiag.lastError}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DiagRow({ label, value, ok, neutral }: { label: string; value: string; ok: boolean; neutral?: boolean }) {
  const valueColor = neutral ? 'rgba(255,255,255,0.45)' : ok ? 'rgba(74,222,128,0.8)' : 'rgba(248,113,113,0.8)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '10px', color: valueColor, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

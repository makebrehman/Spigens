'use client'

interface LaunchSplashProps {
  dbStatus?: 'initializing' | 'ready' | 'failed'
}

export function LaunchSplash({ dbStatus = 'initializing' }: LaunchSplashProps) {
  const dotColor =
    dbStatus === 'ready'  ? '#4ade80' :
    dbStatus === 'failed' ? '#f87171' :
                            'rgba(255,255,255,0.35)'

  const label =
    dbStatus === 'ready'  ? 'Local storage ready' :
    dbStatus === 'failed' ? 'Local storage unavailable' :
                            'Setting up local storage...'

  const labelColor =
    dbStatus === 'ready'  ? 'rgba(74,222,128,0.85)' :
    dbStatus === 'failed' ? 'rgba(248,113,113,0.85)' :
                            'rgba(255,255,255,0.45)'

  return (
    <div style={{
      height: '100vh', width: '100%', background: '#050505',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <img
        src="/spigens_logo.png"
        alt="Spigens"
        style={{ width: 72, height: 72, borderRadius: 20, objectFit: 'cover', marginBottom: '18px' }}
      />
      <div style={{ fontSize: '10px', letterSpacing: '5px', color: 'rgba(255,255,255,0.16)', marginBottom: '5px' }}>
        spigens
      </div>
      <div style={{ fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.10)', marginBottom: '48px' }}>
        end-to-end encrypted
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          transition: 'background 0.3s ease',
        }} />
        <span style={{ fontSize: '11px', color: labelColor, letterSpacing: '0.3px' }}>
          {label}
        </span>
      </div>
    </div>
  )
}

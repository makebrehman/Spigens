'use client'

export function LaunchSplash() {
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
      <div style={{ fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.10)' }}>
        end-to-end encrypted
      </div>
    </div>
  )
}

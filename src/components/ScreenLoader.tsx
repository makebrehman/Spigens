'use client'

import { motion } from 'motion/react'

// A plain React loading overlay (NOT a GenUI component). Screens render this on top
// of their GenUI source while their data is still resolving, so the source's
// empty state ("no messages yet" / "no communities") never shows during the load
// gap. It covers the viewport and disappears the moment data is ready.
export function ScreenLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: '#0A0A0A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '2.5px solid rgba(255,255,255,0.12)',
          borderTopColor: 'rgba(255,255,255,0.7)',
        }}
      />
    </div>
  )
}

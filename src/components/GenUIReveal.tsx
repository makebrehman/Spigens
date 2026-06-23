'use client'

import { useEffect } from 'react'

// A brief, premium "the new UI has arrived" moment: a soft gradient light sweeps
// across and momentarily takes over the screen, then slides away to reveal the
// freshly-restyled app underneath. Plays once, then calls onDone.
export function GenUIReveal({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1150)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes genui-reveal-sweep {
          0%   { transform: translateX(-118%) skewX(-12deg); }
          42%  { transform: translateX(0%) skewX(-12deg); }
          58%  { transform: translateX(0%) skewX(-12deg); }
          100% { transform: translateX(118%) skewX(-12deg); }
        }
        @keyframes genui-reveal-core {
          0%   { opacity: 0; transform: scale(0.6); }
          40%  { opacity: 1; transform: scale(1); }
          62%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.18); }
        }
      `}</style>

      {/* sweeping light */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '170%',
          background:
            'linear-gradient(115deg, rgba(37,99,235,0) 0%, #2563EB 22%, #06B6D4 42%, #22D3EE 52%, #10B981 68%, rgba(16,185,129,0) 100%)',
          filter: 'blur(2px)',
          animation: 'genui-reveal-sweep 1.15s cubic-bezier(0.66, 0, 0.2, 1) forwards',
        }}
      />

      {/* centered logo pulse during the hold */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'genui-reveal-core 1.15s ease forwards',
        }}
      >
        <img
          src="/spigens_logo.png"
          alt=""
          style={{ width: 76, height: 76, borderRadius: 20, boxShadow: '0 0 50px rgba(255,255,255,0.55)' }}
        />
      </div>
    </div>
  )
}

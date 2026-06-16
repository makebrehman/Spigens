import { useEffect } from 'react'

export function useVolumeKeyTrigger(onTrigger: () => void) {
  useEffect(() => {
    // listener 1 — native android event via capacitor bridge
    const handleVolumeEvent = () => {
      onTrigger()
    }
    window.addEventListener('volumeBothPressed', handleVolumeEvent)

    // listener 2 — keyboard shortcut fallback for browser testing
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyG') {
        e.preventDefault()
        onTrigger()
      }
    }
    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('volumeBothPressed', handleVolumeEvent)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [onTrigger])
}

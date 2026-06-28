import { create } from 'zustand'

interface NetworkState {
  isOnline: boolean
  setOnline: (v: boolean) => void
}

// Start optimistic on web (navigator.onLine is reliable there).
// On native Android/iOS we start true as well — the Capacitor Network plugin
// will correct this with real OS-level status inside the useEffect in page.tsx
// before any network-dependent gate is evaluated.
export const useNetworkStore = create<NetworkState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ isOnline: v }),
}))

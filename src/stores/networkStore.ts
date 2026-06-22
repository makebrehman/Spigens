import { create } from 'zustand'

interface NetworkState {
  isOnline: boolean
  setOnline: (v: boolean) => void
}

export const useNetworkStore = create<NetworkState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ isOnline: v }),
}))

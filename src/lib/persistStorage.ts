import { Preferences } from '@capacitor/preferences'
import type { StateStorage } from 'zustand/middleware'

export const capacitorStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key: name })
      return value ?? null
    } catch {
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key: name, value })
    } catch {
      // fail silently — don't crash the app on storage error
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await Preferences.remove({ key: name })
    } catch {
      // fail silently
    }
  },
}

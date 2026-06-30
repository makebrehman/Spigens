import { create } from 'zustand'

export type AppScreen =
  | 'auth'
  | 'home'
  | 'chat'
  | 'profile'
  | 'contact-profile'
  | 'community'
  | 'community-list'
  | 'create-community'
  | 'discover'
  | 'settings'
  | 'data-sync'

// GenUI is completely disabled on these screens
const LOCKED_SCREENS: AppScreen[] = ['auth']

export interface Route {
  id: string
  name: AppScreen
  params?: Record<string, any>
}

interface NavState {
  stack: Route[]
  navigateTo: (name: AppScreen, params?: Record<string, any>) => void
  goBack: () => void
  replace: (name: AppScreen, params?: Record<string, any>) => void
  isGenUIEnabled: () => boolean
}

export const useNavStore = create<NavState>()((set, get) => ({
  stack: [{ id: 'auth-0', name: 'auth' }],

  navigateTo: (name, params = {}) => {
    set((state) => ({
      stack: [...state.stack, { id: `${name}-${Date.now()}`, name, params }]
    }))
  },

  goBack: () => {
    set((state) => {
      if (state.stack.length <= 1) return state
      return {
        stack: state.stack.slice(0, -1)
      }
    })
  },

  replace: (name, params = {}) => {
    set((state) => ({
      stack: [...state.stack.slice(0, -1), { id: `${name}-${Date.now()}`, name, params }]
    }))
  },

  isGenUIEnabled: () => {
    const stack = get().stack
    if (stack.length === 0) return false
    const currentScreen = stack[stack.length - 1].name
    return !LOCKED_SCREENS.includes(currentScreen)
  },
}))

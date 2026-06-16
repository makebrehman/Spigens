import { create } from 'zustand'

export type AppScreen =
  | 'auth'
  | 'home'
  | 'chat'
  | 'profile'
  | 'community'
  | 'community-list'
  | 'settings'

// GenUI is completely disabled on these screens
const LOCKED_SCREENS: AppScreen[] = ['auth']

interface NavState {
  screen: AppScreen
  params: Record<string, any>
  history: AppScreen[]
  navigateTo: (screen: AppScreen, params?: Record<string, any>) => void
  goBack: () => void
  isGenUIEnabled: () => boolean
}

export const useNavStore = create<NavState>()((set, get) => ({
  screen: 'auth',
  params: {},
  history: [],

  navigateTo: (screen, params = {}) => {
    const current = get().screen
    set((state) => ({
      screen,
      params,
      history: [...state.history, current].slice(-20),
    }))
  },

  goBack: () => {
    const history = get().history
    if (history.length === 0) return
    const previous = history[history.length - 1]
    set((state) => ({
      screen: previous,
      params: {},
      history: state.history.slice(0, -1),
    }))
  },

  isGenUIEnabled: () => !LOCKED_SCREENS.includes(get().screen),
}))

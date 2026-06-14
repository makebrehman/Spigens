import type { AppAction } from '@/types'

export interface ActionHandlers {
  openChat?: () => void
  openLongPressSheet?: () => void
  openAttachSheet?: () => void
  toggleSearch?: () => void
  navigateBack?: () => void
}

export function dispatchAction(action: AppAction | undefined, handlers: ActionHandlers): void {
  switch (action) {
    case 'open-chat':
      handlers.openChat?.()
      break
    case 'open-longPressSheet':
      handlers.openLongPressSheet?.()
      break
    case 'open-attachSheet':
      handlers.openAttachSheet?.()
      break
    case 'toggle-search':
      handlers.toggleSearch?.()
      break
    case 'navigate-back':
      handlers.navigateBack?.()
      break
    case 'none':
    case undefined:
    default:
      // do nothing
      break
  }
}

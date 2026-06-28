// Native push notifications via FCM (@capacitor/push-notifications).
//
// On native (Android/iOS) the WebView does NOT support Web Push, so the browser
// path in pushNotifications.ts cannot work there. This module registers the device
// with FCM, captures the device token, stores it server-side (device_tokens table)
// and wires the foreground/tap listeners. The backend sends to these tokens via FCM.
//
// The plugin is imported dynamically so the web bundle never evaluates native code.

import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

// Updated on every call so the token listener always upserts under the current
// account (handles sign-out → sign-in as a different user on the same device).
let currentUserId: string | null = null
let listenersBound = false
let lastToken: string | null = null

export async function registerNativePush(userId: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  currentUserId = userId

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Android 13+ shows the runtime POST_NOTIFICATIONS prompt here.
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return false

    if (!listenersBound) {
      listenersBound = true

      // Android 8+ requires a channel for notifications to be displayed.
      if (Capacitor.getPlatform() === 'android') {
        try {
          await PushNotifications.createChannel({
            id: 'messages',
            name: 'Messages',
            description: 'New message notifications',
            importance: 5,   // HIGH — heads-up
            visibility: 1,   // PUBLIC
            vibration: true,
          })
        } catch { /* already exists */ }
      }

      // Device token issued → persist it for the current user.
      PushNotifications.addListener('registration', async (token) => {
        lastToken = token.value
        if (!currentUserId) return
        try {
          // SECURITY DEFINER RPC: upserts by token and (re)assigns it to the current
          // user, so switching accounts on one device moves the token cleanly.
          await supabase.rpc('register_device_token', {
            p_token: token.value,
            p_platform: Capacitor.getPlatform(),
          })
        } catch (e) {
          console.error('Failed to store device token:', e)
        }
      })

      PushNotifications.addListener('registrationError', (err) => {
        console.error('FCM registration error:', err)
      })

      // Foreground receipt: the local-first realtime already refreshes the UI.
      PushNotifications.addListener('pushNotificationReceived', () => { /* no-op */ })

      // Notification tapped: dispatch a DOM event so page.tsx can navigate to the
      // relevant chat or community without coupling this module to React state.
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const d = (action.notification.data ?? {}) as Record<string, string>
        if (d.type && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('push-notification-tap', { detail: d }))
        }
      })
    }

    await PushNotifications.register()
    return true
  } catch (err) {
    console.error('Native push registration failed:', err)
    return false
  }
}

// Best-effort: drop this device's token on sign-out so a signed-out account stops
// receiving pushes on a shared device.
export async function unregisterNativePush(): Promise<void> {
  const token = lastToken
  currentUserId = null
  if (!Capacitor.isNativePlatform()) return
  try {
    if (token) await supabase.from('device_tokens').delete().eq('token', token)
  } catch { /* ignore */ }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.removeAllListeners()
    listenersBound = false
  } catch { /* ignore */ }
}

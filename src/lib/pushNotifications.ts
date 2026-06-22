import { supabase } from '@/lib/supabase'

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (err) {
    console.error('Service worker registration failed:', err)
    return null
  }
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) return false

  try {
    const reg = await navigator.serviceWorker.ready
    let subscription = await reg.pushManager.getSubscription()

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: (json.keys as any)?.p256dh ?? '',
      auth: (json.keys as any)?.auth ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (error) console.error('Failed to store push subscription:', error)
    return !error
  } catch (err) {
    console.error('Push subscription failed:', err)
    return false
  }
}

export async function requestPushPermission(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  return subscribeToPush(userId)
}

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  generateKeyPair,
  storePrivateKey,
  loadPrivateKey,
  deriveWrappingKey,
  wrapPrivateKey,
  unwrapPrivateKey,
} from '@/lib/encryption'
import type { Database } from '@/lib/supabase'
import { uploadPendingAvatar } from '@/lib/avatarUpload'
import { cacheProfile, getCachedProfile, clearUserCache } from '@/lib/offlineCache'
import { unregisterNativePush } from '@/lib/nativePush'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: { id: string; email: string } | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  privateKey: string | null
  _tempPassword: string | null

  initialize: () => Promise<void>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  completeProfile: (username: string, displayName: string) => Promise<{ error: string | null }>
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null; userId?: string }>
  sendPasswordResetCode: (email: string) => Promise<{ error: string | null }>
  verifyPasswordResetCode: (email: string, code: string, newPassword: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsVerification?: boolean }>
  signOut: () => Promise<void>
  loadProfile: (userId: string) => Promise<void>
}

function getLocalAuthSession(): { userId: string; email: string } | null {
  if (typeof window === 'undefined') return null
  try {
    let raw: string | null = null
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (url) {
      const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/)
      if (match) raw = localStorage.getItem(`sb-${match[1]}-auth-token`)
    }
    if (!raw) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) { raw = localStorage.getItem(k); break }
      }
    }
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const user = parsed?.user
    if (!user?.id || !user?.email) return null
    return { userId: user.id, email: user.email }
  } catch { return null }
}

async function restorePrivateKey(
  userId: string,
  password: string,
  encryptedBlob: string | null,
): Promise<string | null> {
  if (encryptedBlob) {
    const wk = await deriveWrappingKey(password, userId)
    const pk = await unwrapPrivateKey(encryptedBlob, wk)
    if (pk) {
      storePrivateKey(pk, userId)
      return pk
    }
  }

  const local = loadPrivateKey(userId)
  if (local) {
    try {
      const wk = await deriveWrappingKey(password, userId)
      const blob = await wrapPrivateKey(local, wk)
      await supabase.from('profiles').update({ encrypted_private_key: blob }).eq('id', userId)
    } catch { /* non-fatal */ }
    return local
  }

  return null
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  privateKey: null,
  _tempPassword: null,

  initialize: async () => {
    set({ isLoading: true })
    try {
      let userId: string | null = null
      let email: string | null = null

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) { userId = session.user.id; email = session.user.email! }
      } catch { /* offline — fall through */ }

      // Offline fallback: read the session token Supabase stored in localStorage
      if (!userId) {
        const local = getLocalAuthSession()
        if (local) { userId = local.userId; email = local.email }
      }

      if (userId && email) {
        // Never let a failed network load short-circuit the cached fallback + the
        // isAuthenticated set below — that's what was kicking offline users to the
        // sign-in screen on reopen.
        try { await get().loadProfile(userId) } catch { /* offline */ }
        let profile = get().profile
        // If network load failed (offline), fall back to cached profile
        if (!profile) {
          try { profile = await getCachedProfile(userId) as Profile | null } catch { /* ignore */ }
          if (profile) set({ profile })
        }
        const localPk = loadPrivateKey(userId)
        set({
          user: { id: userId, email },
          isAuthenticated: !!profile?.username,
          privateKey: profile?.username ? localPk : null,
        })
      }
    } finally {
      set({ isLoading: false })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try { await get().loadProfile(session.user.id) } catch { /* offline */ }
        let profile = get().profile
        if (!profile) {
          try { profile = await getCachedProfile(session.user.id) as Profile | null } catch { /* ignore */ }
          if (profile) set({ profile })
        }
        const localPk = loadPrivateKey(session.user.id)
        set({
          user: { id: session.user.id, email: session.user.email! },
          isAuthenticated: !!profile?.username,
          privateKey: profile?.username ? localPk : null,
        })
      } else if (event === 'SIGNED_OUT') {
        // A SIGNED_OUT while offline is almost always a failed background token
        // refresh, not a real sign-out (our signOut() runs online). Ignore it so an
        // offline user is never kicked to the auth screen.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return
        set({ user: null, profile: null, isAuthenticated: false, privateKey: null, _tempPassword: null })
      }
    })
  },

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: error.message }
      if (!data.user) return { error: 'Sign up failed' }
      // Stash the password so completeProfile() can wrap the freshly-generated
      // private key and back it up to the server (encrypted_private_key) — exactly
      // like the sign-in path does. Without this the new account's key would live
      // only in localStorage and be lost permanently on uninstall/reinstall,
      // making all past E2E messages undecryptable.
      set({ _tempPassword: password })
      return { error: null, needsConfirmation: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  completeProfile: async (username, displayName) => {
    try {
      const user = get().user
      if (!user) return { error: 'Not signed in' }
      const password = get()._tempPassword

      const { publicKey, privateKey } = generateKeyPair()

      let encryptedPrivateKey: string | null = null
      if (password) {
        try {
          const wk = await deriveWrappingKey(password, user.id)
          encryptedPrivateKey = await wrapPrivateKey(privateKey, wk)
        } catch { /* non-fatal */ }
      }

      const { error: profileError } = await supabase.from('profiles').update({
        username: username.toLowerCase().trim(),
        display_name: displayName.trim(),
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
        is_online: true,
      }).eq('id', user.id)

      if (profileError) return { error: profileError.message }

      storePrivateKey(privateKey, user.id)
      set({ privateKey, _tempPassword: null })

      try { await uploadPendingAvatar(user.id) } catch { /* non-fatal */ }

      await get().loadProfile(user.id)
      set({ isAuthenticated: true })
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  verifyEmailCode: async (email, code) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) return { error: error.message }
      if (!data.user) return { error: 'Verification failed' }
      await get().loadProfile(data.user.id)
      return { error: null, userId: data.user.id }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  sendPasswordResetCode: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) return { error: error.message }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  verifyPasswordResetCode: async (email, code, newPassword) => {
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
      if (verifyError) return { error: verifyError.message }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) return { error: updateError.message }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const local = loadPrivateKey(user.id)
        const keyToWrap = local ?? generateKeyPair().privateKey
        const publicKeyToStore = local ? get().profile?.public_key : generateKeyPair().publicKey

        try {
          const wk = await deriveWrappingKey(newPassword, user.id)
          const blob = await wrapPrivateKey(keyToWrap, wk)
          const updates: Record<string, string> = { encrypted_private_key: blob }
          if (!local && publicKeyToStore) updates.public_key = publicKeyToStore
          await supabase.from('profiles').update(updates).eq('id', user.id)
          storePrivateKey(keyToWrap, user.id)
          set({ privateKey: keyToWrap })
        } catch { /* non-fatal */ }
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes('not confirmed') || error.message.toLowerCase().includes('email_not_confirmed')) {
          return { error: null, needsVerification: true }
        }
        return { error: error.message }
      }
      if (!data.user) return { error: 'Sign in failed' }

      await get().loadProfile(data.user.id)
      const profile = get().profile

      let privateKey: string | null = null

      if (profile?.username) {
        privateKey = await restorePrivateKey(data.user.id, password, profile.encrypted_private_key ?? null)
        set({ _tempPassword: null })
      } else {
        set({ _tempPassword: password })
      }

      if (profile?.public_key) {
        await supabase.rpc('set_user_online', { p_user_id: data.user.id, p_online: true })
        try { await uploadPendingAvatar(data.user.id) } catch { /* non-fatal */ }
      }

      // Signal page.tsx to show the post-login DataSyncScreen exactly once
      if (typeof window !== 'undefined' && profile?.username) {
        localStorage.setItem('spigens_just_signed_in', data.user.id)
      }

      set({
        user: { id: data.user.id, email: data.user.email! },
        isAuthenticated: !!profile?.username,
        privateKey,
      })

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  signOut: async () => {
    const user = get().user
    if (user) {
      await supabase.rpc('set_user_online', { p_user_id: user.id, p_online: false })
      await unregisterNativePush() // drop this device's FCM token so it stops getting pushes
      await clearUserCache(user.id)
    }
    await supabase.auth.signOut()
    set({ user: null, profile: null, isAuthenticated: false, privateKey: null, _tempPassword: null })
  },

  loadProfile: async (userId: string) => {
    // Must never throw: when offline the Supabase call rejects, and callers
    // (especially initialize) rely on falling back to the cached profile.
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) { set({ profile: data }); await cacheProfile(userId, data) }
    } catch { /* offline — caller falls back to getCachedProfile */ }
  },
}))

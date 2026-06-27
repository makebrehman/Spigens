import { create } from 'zustand'
import { Preferences } from '@capacitor/preferences'
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

// Per-user marker that the one-time post-login full download has completed at least
// once on this device. Persisted (not just in memory) so an interrupted first sync
// resumes on the next launch instead of being silently skipped, and a completed one
// never re-blocks the user. Cleared on sign-out (which also wipes the local cache).
// Stored in Capacitor Preferences (native app container) so it is wiped on uninstall.
function initialSyncDoneKey(userId: string) { return `spigens_initial_sync_done_${userId}` }

export async function hasInitialSyncDone(userId: string): Promise<boolean> {
  try { const { value } = await Preferences.get({ key: initialSyncDoneKey(userId) }); return value === '1' } catch { return false }
}

export async function markInitialSyncDone(userId: string): Promise<void> {
  try { await Preferences.set({ key: initialSyncDoneKey(userId), value: '1' }) } catch { }
}

async function clearInitialSyncDone(userId: string): Promise<void> {
  try { await Preferences.remove({ key: initialSyncDoneKey(userId) }) } catch { }
}

// Durable, app-owned record of the signed-in identity. Written whenever an
// authenticated session is established; read as the most robust offline fallback in
// initialize(); cleared only on a real, user-initiated sign-out. This is what keeps an
// offline reopen from depending on Supabase's session token.
// Stored in Capacitor Preferences (native app container) so it is wiped on uninstall.
const AUTH_SNAPSHOT_KEY = 'spigens_auth_user'

interface AuthSnapshot {
  id: string
  email: string
  username: string | null
  profile: Profile | null
}

async function saveAuthSnapshot(snap: AuthSnapshot): Promise<void> {
  try { await Preferences.set({ key: AUTH_SNAPSHOT_KEY, value: JSON.stringify(snap) }) } catch { }
}

async function loadAuthSnapshot(): Promise<AuthSnapshot | null> {
  try {
    const { value } = await Preferences.get({ key: AUTH_SNAPSHOT_KEY })
    return value ? (JSON.parse(value) as AuthSnapshot) : null
  } catch { return null }
}

async function clearAuthSnapshot(): Promise<void> {
  try { await Preferences.remove({ key: AUTH_SNAPSHOT_KEY }) } catch { }
}

// True only while our own signOut() is running. Supabase also emits SIGNED_OUT when a
// background token refresh fails (offline / flaky network); those must never wipe auth.
let explicitSignOut = false

interface AuthState {
  user: { id: string; email: string } | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  privateKey: string | null
  _tempPassword: string | null
  needsInitialSync: boolean

  initialize: () => Promise<void>
  clearNeedsInitialSync: () => void
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  completeProfile: (username: string, displayName: string) => Promise<{ error: string | null }>
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null; userId?: string }>
  sendPasswordResetCode: (email: string) => Promise<{ error: string | null }>
  verifyPasswordResetCode: (email: string, code: string, newPassword: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsVerification?: boolean }>
  signOut: () => Promise<void>
  loadProfile: (userId: string) => Promise<void>
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
  needsInitialSync: false,

  clearNeedsInitialSync: () => set({ needsInitialSync: false }),

  initialize: async () => {
    set({ isLoading: true })
    try {
      let userId: string | null = null
      let email: string | null = null

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) { userId = session.user.id; email = session.user.email! }
      } catch { /* offline — fall through */ }

      // Offline fallback: our own durable snapshot in Capacitor Preferences.
      // Supabase's own token is also in Preferences (via the custom storage adapter),
      // so getSession() above should already cover the online case. The snapshot is
      // the safest fallback when the token has expired or Supabase is unreachable.
      const snapshot = await loadAuthSnapshot()
      if (!userId && snapshot) { userId = snapshot.id; email = snapshot.email }

      if (userId && email) {
        try { await get().loadProfile(userId) } catch { /* offline */ }
        let profile = get().profile
        if (!profile) {
          try { profile = await getCachedProfile(userId) as Profile | null } catch { /* ignore */ }
          if (!profile && snapshot?.id === userId) profile = snapshot.profile
          if (profile) set({ profile })
        }
        const username = profile?.username ?? (snapshot?.id === userId ? snapshot.username : null)
        const authed = !!username
        const localPk = loadPrivateKey(userId)
        const syncDone = await hasInitialSyncDone(userId)
        set({
          user: { id: userId, email },
          isAuthenticated: authed,
          privateKey: authed ? localPk : null,
          needsInitialSync: authed && !syncDone,
        })
        if (authed) await saveAuthSnapshot({ id: userId, email, username, profile: profile ?? snapshot?.profile ?? null })
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
        const syncDone = await hasInitialSyncDone(session.user.id)
        set({
          user: { id: session.user.id, email: session.user.email! },
          isAuthenticated: !!profile?.username,
          privateKey: profile?.username ? localPk : null,
          needsInitialSync: !!profile?.username && !syncDone,
        })
        if (profile?.username) {
          await saveAuthSnapshot({ id: session.user.id, email: session.user.email!, username: profile.username, profile })
        }
      } else if (event === 'SIGNED_OUT') {
        // Only a real, user-initiated signOut() should clear auth state. Supabase also
        // emits SIGNED_OUT when a background token refresh fails (offline / flaky network,
        // including when navigator.onLine wrongly reports true) — ignoring those is what
        // keeps an offline user from being kicked to the sign-in screen.
        if (!explicitSignOut) return
        set({ user: null, profile: null, isAuthenticated: false, privateKey: null, _tempPassword: null, needsInitialSync: false })
      }
    })
  },

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: error.message }
      if (!data.user) return { error: 'Sign up failed' }
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
      await clearInitialSyncDone(user.id)
      set({ isAuthenticated: true, needsInitialSync: true })
      const newProfile = get().profile
      if (newProfile?.username) {
        await saveAuthSnapshot({ id: user.id, email: user.email, username: newProfile.username, profile: newProfile })
      }
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

      if (profile?.username) await clearInitialSyncDone(data.user.id)

      set({
        user: { id: data.user.id, email: data.user.email! },
        isAuthenticated: !!profile?.username,
        privateKey,
        needsInitialSync: !!profile?.username,
      })

      if (profile?.username) {
        await saveAuthSnapshot({ id: data.user.id, email: data.user.email!, username: profile.username, profile })
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  signOut: async () => {
    explicitSignOut = true
    try {
      const user = get().user
      if (user) {
        await supabase.rpc('set_user_online', { p_user_id: user.id, p_online: false })
        await unregisterNativePush()
        await clearUserCache(user.id)
        await clearInitialSyncDone(user.id)
      }
      await clearAuthSnapshot()
      await supabase.auth.signOut()
      set({ user: null, profile: null, isAuthenticated: false, privateKey: null, _tempPassword: null, needsInitialSync: false })
    } finally {
      explicitSignOut = false
    }
  },

  loadProfile: async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) { set({ profile: data }); await cacheProfile(userId, data) }
    } catch { /* offline — caller falls back to getCachedProfile */ }
  },
}))

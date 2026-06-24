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

// Per-user marker that the one-time post-login full download has completed at least
// once on this device. Persisted (not just in memory) so an interrupted first sync
// resumes on the next launch instead of being silently skipped, and a completed one
// never re-blocks the user. Cleared on sign-out (which also wipes the local cache).
function initialSyncDoneKey(userId: string) { return `spigens_initial_sync_done_${userId}` }

export function hasInitialSyncDone(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(initialSyncDoneKey(userId)) === '1' } catch { return false }
}

export function markInitialSyncDone(userId: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(initialSyncDoneKey(userId), '1') } catch { /* ignore */ }
}

function clearInitialSyncDone(userId: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(initialSyncDoneKey(userId)) } catch { /* ignore */ }
}

// Durable, app-owned record of the signed-in identity. Written whenever an
// authenticated session is established; read as the most robust offline fallback in
// initialize(); cleared only on a real, user-initiated sign-out. This is what keeps an
// offline reopen from depending on Supabase's session token (which can be chunked, or
// discarded by a failed offline refresh) or on the local DB being open.
const AUTH_SNAPSHOT_KEY = 'spigens_auth_user'

interface AuthSnapshot {
  id: string
  email: string
  username: string | null
  profile: Profile | null
}

function saveAuthSnapshot(snap: AuthSnapshot): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(snap)) } catch { /* ignore */ }
}

function loadAuthSnapshot(): AuthSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as AuthSnapshot) : null
  } catch { return null }
}

function clearAuthSnapshot(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(AUTH_SNAPSHOT_KEY) } catch { /* ignore */ }
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

      // Offline fallback 1: read the session token Supabase stored in localStorage.
      if (!userId) {
        const local = getLocalAuthSession()
        if (local) { userId = local.userId; email = local.email }
      }

      // Offline fallback 2 (most robust): our own durable snapshot. Independent of
      // Supabase's token format — which may be chunked, or cleared by a failed offline
      // refresh — so a logged-in user is recovered even when the token is gone.
      const snapshot = loadAuthSnapshot()
      if (!userId && snapshot) { userId = snapshot.id; email = snapshot.email }

      if (userId && email) {
        // Never let a failed network load short-circuit the cached fallback + the
        // isAuthenticated set below — that's what was kicking offline users to the
        // sign-in screen on reopen.
        try { await get().loadProfile(userId) } catch { /* offline */ }
        let profile = get().profile
        // If network load failed (offline), fall back to the cached profile, then to the
        // snapshot's copy if even the local DB read came back empty.
        if (!profile) {
          try { profile = await getCachedProfile(userId) as Profile | null } catch { /* ignore */ }
          if (!profile && snapshot?.id === userId) profile = snapshot.profile
          if (profile) set({ profile })
        }
        // Username is the gate for "authenticated". Resolve it from the live/cached
        // profile, falling back to the snapshot, so neither a dead token nor a closed DB
        // can wrongly log an offline user out.
        const username = profile?.username ?? (snapshot?.id === userId ? snapshot.username : null)
        const authed = !!username
        const localPk = loadPrivateKey(userId)
        set({
          user: { id: userId, email },
          isAuthenticated: authed,
          privateKey: authed ? localPk : null,
          // Re-run the post-login download if a previous first sync never finished.
          needsInitialSync: authed && !hasInitialSyncDone(userId),
        })
        // Keep the durable snapshot fresh (and create it for users who signed in before
        // this record existed).
        if (authed) saveAuthSnapshot({ id: userId, email, username, profile: profile ?? snapshot?.profile ?? null })
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
          needsInitialSync: !!profile?.username && !hasInitialSyncDone(session.user.id),
        })
        if (profile?.username) {
          saveAuthSnapshot({ id: session.user.id, email: session.user.email!, username: profile.username, profile })
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
      // New account: run the post-login DataSyncScreen too (fast for a fresh account,
      // but keeps the flow uniform and writes the "sync done" marker).
      clearInitialSyncDone(user.id)
      set({ isAuthenticated: true, needsInitialSync: true })
      const newProfile = get().profile
      if (newProfile?.username) {
        saveAuthSnapshot({ id: user.id, email: user.email, username: newProfile.username, profile: newProfile })
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

      // A successful sign-in always means a fresh full download: sign-out wipes the
      // local cache, so clear the "sync done" marker and flag that the post-login
      // DataSyncScreen must run.
      if (profile?.username) clearInitialSyncDone(data.user.id)

      set({
        user: { id: data.user.id, email: data.user.email! },
        isAuthenticated: !!profile?.username,
        privateKey,
        needsInitialSync: !!profile?.username,
      })

      // Persist the durable identity snapshot so future offline reopens never depend on
      // Supabase's token surviving.
      if (profile?.username) {
        saveAuthSnapshot({ id: data.user.id, email: data.user.email!, username: profile.username, profile })
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  signOut: async () => {
    explicitSignOut = true // let the SIGNED_OUT handler know this one is real
    try {
      const user = get().user
      if (user) {
        await supabase.rpc('set_user_online', { p_user_id: user.id, p_online: false })
        await unregisterNativePush() // drop this device's FCM token so it stops getting pushes
        await clearUserCache(user.id)
        clearInitialSyncDone(user.id) // next sign-in must do a fresh full download
      }
      clearAuthSnapshot() // forget the durable identity — this is a real, user-initiated sign-out
      await supabase.auth.signOut()
      set({ user: null, profile: null, isAuthenticated: false, privateKey: null, _tempPassword: null, needsInitialSync: false })
    } finally {
      // Always release the sentinel, even if a network call above threw — otherwise a
      // later background SIGNED_OUT could be mistaken for a real sign-out.
      explicitSignOut = false
    }
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

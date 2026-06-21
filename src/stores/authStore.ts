import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { generateKeyPair, storePrivateKey, loadPrivateKey, clearPrivateKey } from '@/lib/encryption'
import type { Database } from '@/lib/supabase'
import { uploadPendingAvatar, compressAvatar } from '@/lib/avatarUpload'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: { id: string; email: string } | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  privateKey: string | null

  initialize: () => Promise<void>
  signUp: (email: string, password: string) => Promise<{ error: string | null, needsConfirmation?: boolean }>
  completeProfile: (username: string, displayName: string) => Promise<{ error: string | null }>
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null, userId?: string }>
  sendPasswordResetCode: (email: string) => Promise<{ error: string | null }>
  verifyPasswordResetCode: (email: string, code: string, newPassword: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null, needsVerification?: boolean }>
  signOut: () => Promise<void>
  loadProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  privateKey: null,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await get().loadProfile(session.user.id)
        const profile = get().profile
        const privateKey = loadPrivateKey()
        
        set({
          user: { id: session.user.id, email: session.user.email! },
          isAuthenticated: !!profile?.username,
          privateKey: profile?.username ? privateKey : null,
        })
      }
    } finally {
      set({ isLoading: false })
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await get().loadProfile(session.user.id)
        const profile = get().profile
        const privateKey = loadPrivateKey()

        set({
          user: { id: session.user.id, email: session.user.email! },
          isAuthenticated: !!profile?.username,
          privateKey: profile?.username ? privateKey : null,
        })
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, isAuthenticated: false, privateKey: null })
      }
    })
  },

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password
      })
      if (error) return { error: error.message }
      if (!data.user) return { error: 'Sign up failed' }

      // Do NOT set authenticated since email confirmation is required
      return { error: null, needsConfirmation: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  },

  completeProfile: async (username, displayName) => {
    try {
      const user = get().user
      if (!user) return { error: 'Not signed in' }

      const { publicKey, privateKey } = generateKeyPair()

      const { error: profileError } = await supabase.from('profiles').update({
        username: username.toLowerCase().trim(),
        display_name: displayName.trim(),
        public_key: publicKey,
        is_online: true
      }).eq('id', user.id)

      if (profileError) return { error: profileError.message }

      storePrivateKey(privateKey)
      set({ privateKey })

      try {
        await uploadPendingAvatar(user.id)
      } catch (err) {
        console.error('Avatar upload failed:', err)
      }

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

      const privateKey = loadPrivateKey()

      // Mark online
      if (profile?.public_key) {
        await supabase.rpc('set_user_online', { p_user_id: data.user.id, p_online: true })
        // Try uploading any pending avatar. Does not break signIn on failure.
        try {
          await uploadPendingAvatar(data.user.id)
        } catch (err) {
          console.error('Deferred avatar upload failed:', err)
        }
      }

      set({
        user: { id: data.user.id, email: data.user.email! },
        isAuthenticated: !!profile?.username,
        privateKey: profile?.username ? privateKey : null,
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
    }
    await supabase.auth.signOut()
    set({ user: null, profile: null, isAuthenticated: false, privateKey: null })
  },

  loadProfile: async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) set({ profile: data })
  },
}))

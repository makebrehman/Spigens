import { createClient } from '@supabase/supabase-js'

// Fallback placeholders keep createClient from throwing during static build
// (output: 'export' causes Next.js to process imports server-side at build time).
// The real values are always present at runtime on the client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string
          bio: string | null
          avatar_url: string | null
          public_key: string
          encrypted_private_key: string | null
          is_online: boolean
          last_seen: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      conversations: {
        Row: { id: string; created_at: string; updated_at: string }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      conversation_participants: {
        Row: { conversation_id: string; user_id: string; last_read_at: string }
        Insert: { conversation_id: string; user_id: string }
        Update: { last_read_at?: string }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string | null
          encrypted_content: string | null
          status: 'sending' | 'sent' | 'delivered' | 'read'
          reply_to: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string
          encrypted_content?: string
          status?: string
          reply_to?: string
          created_at?: string
        }
        Update: { status?: string; deleted_at?: string }
      }
      communities: {
        Row: {
          id: string
          name: string
          description: string | null
          type: 'public' | 'protected' | 'private'
          avatar_url: string | null
          created_by: string
          member_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['communities']['Row'], 'id' | 'created_at' | 'updated_at' | 'member_count'>
        Update: Partial<Omit<Database['public']['Tables']['communities']['Insert'], 'created_by'>>
      }
      community_members: {
        Row: {
          id: string
          community_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          status: 'active' | 'pending' | 'banned'
          joined_at: string
        }
        Insert: { community_id: string; user_id: string; role?: string; status?: string }
        Update: { role?: string; status?: string }
      }
      community_messages: {
        Row: {
          id: string
          community_id: string
          sender_id: string
          content: string
          reply_to: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: { community_id: string; sender_id: string; content: string; reply_to?: string }
        Update: { content?: string; deleted_at?: string }
      }
    }
  }
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useContactStore } from '@/stores/contactStore'
import { ProfileImage } from './ProfileImage'

type Mode = 'communities' | 'friends'

export interface DiscoverScreenProps {
  onBack: () => void
  /** Open a DM with a discovered user (page wires this to the chat screen). */
  onOpenChat: (user: any) => void
}

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#16A34A']
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function DiscoverScreen({ onBack, onOpenChat }: DiscoverScreenProps) {
  const currentUserId = useAuthStore(state => state.user?.id)
  const profile = useAuthStore(state => state.profile)

  const [mode, setMode] = useState<Mode>('communities')
  const [communities, setCommunities] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [loadingC, setLoadingC] = useState(true)
  const [loadingF, setLoadingF] = useState(true)
  const [cIdx, setCIdx] = useState(0)
  const [fIdx, setFIdx] = useState(0)
  const [exitDir, setExitDir] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<any>(null)

  const flashToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }

  // ── Load communities to discover (public + protected, not yet a member) ──
  useEffect(() => {
    let active = true
    const run = async () => {
      if (!currentUserId) return
      setLoadingC(true)
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from('communities').select('id, name, description, type, avatar_url, member_count').in('type', ['public', 'protected']).order('created_at', { ascending: false }).limit(100),
        supabase.from('community_members').select('community_id').eq('user_id', currentUserId),
      ])
      if (!active) return
      const mineIds = new Set((mine || []).map((m: any) => m.community_id))
      setCommunities((all || []).filter((c: any) => !mineIds.has(c.id)))
      setLoadingC(false)
    }
    run()
    return () => { active = false }
  }, [currentUserId])

  // ── Load friends to discover (people you're not chatting with) ──
  useEffect(() => {
    let active = true
    const run = async () => {
      if (!currentUserId) return
      setLoadingF(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, public_key, bio, is_online, last_seen')
        .neq('id', currentUserId)
        .limit(60)
      if (!active) return
      const contactIds = new Set(useContactStore.getState().contacts.map(c => c.id))
      setFriends((data || []).filter((p: any) => !contactIds.has(p.id)))
      setLoadingF(false)
    }
    run()
    return () => { active = false }
  }, [currentUserId])

  const cards = mode === 'communities' ? communities : friends
  const idx = mode === 'communities' ? cIdx : fIdx
  const loading = mode === 'communities' ? loadingC : loadingF
  const current = cards[idx] ?? null

  const advance = () => { if (mode === 'communities') setCIdx(i => i + 1); else setFIdx(i => i + 1) }

  const joinCommunity = async (c: any) => {
    if (!currentUserId) return
    if (c.type === 'protected') {
      await supabase.from('community_members').insert({ community_id: c.id, user_id: currentUserId, role: 'member', status: 'pending' })
      flashToast('Request sent')
    } else {
      await supabase.from('community_members').insert({ community_id: c.id, user_id: currentUserId, role: 'member', status: 'active' })
      const joinName = profile?.display_name || profile?.username || 'Someone'
      supabase.from('community_messages').insert({ community_id: c.id, sender_id: currentUserId, content: joinName + ' joined', message_type: 'system' }).then()
      flashToast('Joined ' + (c.name || 'community'))
    }
  }

  const doSwipe = (dir: number) => {
    if (!current) return
    setExitDir(dir)
    if (mode === 'communities') {
      if (dir > 0) joinCommunity(current)
      advance()
    } else {
      if (dir > 0) { onOpenChat(current); return } // open DM to send the first message
      advance()
    }
  }

  const isCommunities = mode === 'communities'

  const cardVariants = {
    enter: { y: 360, opacity: 0, scale: 0.94 },
    center: { y: 0, opacity: 1, scale: 1, x: 0, rotate: 0 },
    exit: (d: number) => ({ x: d * 640, opacity: 0, rotate: d * 14, transition: { duration: 0.28 } }),
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden' }}>
      {/* Non-prominent header row: back (left) + centered toggle. No bar/background. */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px', flexShrink: 0 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', WebkitTapHighlightColor: 'transparent' }}>
          <ChevronLeft size={26} />
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 3, gap: 2 }}>
            {(['communities', 'friends'] as Mode[]).map(m => {
              const on = mode === m
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 18px',
                    fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
                    background: on ? '#2563EB' : 'transparent',
                    color: on ? '#fff' : 'rgba(255,255,255,0.55)',
                    transition: 'background 0.2s, color 0.2s', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {m === 'communities' ? 'Communities' : 'Friends'}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Card area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 18px 28px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</div>
        ) : !current ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 40 }}>{isCommunities ? '🎉' : '👋'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
              {isCommunities ? "You're all caught up" : 'No new people right now'}
            </div>
            <div style={{ fontSize: 13 }}>{isCommunities ? 'No more communities to discover.' : 'Check back later.'}</div>
          </div>
        ) : (
          <AnimatePresence initial={false} custom={exitDir}>
            <motion.div
              key={(isCommunities ? 'c:' : 'f:') + current.id}
              custom={exitDir}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.65}
              onDragEnd={(_e, info) => {
                if (info.offset.x > 110 || info.velocity.x > 600) doSwipe(1)
                else if (info.offset.x < -110 || info.velocity.x < -600) doSwipe(-1)
              }}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              whileTap={{ cursor: 'grabbing' }}
              style={{
                position: 'absolute', width: '100%', maxWidth: 400, cursor: 'grab',
                background: 'linear-gradient(180deg, #1a1a1a 0%, #121212 100%)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {isCommunities ? <CommunityCardBody c={current} /> : <FriendCardBody f={current} />}

              <div style={{ display: 'flex', gap: 12, padding: '4px 20px 22px' }}>
                <button
                  onClick={() => doSwipe(-1)}
                  style={{ flex: 1, padding: '13px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                >
                  Skip
                </button>
                <button
                  onClick={() => doSwipe(1)}
                  style={{ flex: 1, padding: '13px', borderRadius: 999, border: 'none', background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                >
                  {isCommunities ? (current.type === 'protected' ? 'Request' : 'Join') : 'Message'}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flexShrink: 0, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
        Swipe right to {isCommunities ? 'join' : 'message'} · left to skip
      </div>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' as const, color, background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '3px 10px' }}>
      {children}
    </span>
  )
}

function CommunityCardBody({ c }: { c: any }) {
  const initials = (c.name || '?').charAt(0).toUpperCase()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '34px 24px 18px', textAlign: 'center' }}>
      <div style={{ width: 104, height: 104, borderRadius: 26, background: c.avatar_url ? '#000' : colorFor(c.id), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        {c.avatar_url
          ? <img src={c.avatar_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          : <span style={{ fontSize: 44, fontWeight: 800, color: '#fff' }}>{initials}</span>}
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', marginTop: 18, lineHeight: 1.2 }}>{c.name}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Badge color={c.type === 'protected' ? '#fbbf24' : '#34d399'}>{c.type === 'protected' ? 'Protected' : 'Public'}</Badge>
        <Badge color="#93c5fd">{(c.member_count || 0) + ' member' + ((c.member_count || 0) === 1 ? '' : 's')}</Badge>
      </div>
      {c.description ? (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 16, lineHeight: 1.5, maxWidth: 320 }}>{c.description}</div>
      ) : (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 16, fontStyle: 'italic' }}>No description</div>
      )}
      {c.type === 'protected' && (
        <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.85)', marginTop: 14 }}>Swiping right sends a join request</div>
      )}
    </div>
  )
}

function FriendCardBody({ f }: { f: any }) {
  const name = f.display_name || f.username || 'User'
  const initials = (name.charAt(0) || '?').toUpperCase()
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '34px 24px 18px', textAlign: 'center' }}>
      <div style={{ width: 116, height: 116, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <ProfileImage avatarUrl={f.avatar_url ?? null} contactInitials={initials} contactAvatarColor={colorFor(f.id)} size={116} />
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', marginTop: 18, lineHeight: 1.2 }}>{name}</div>
      {f.username ? <div style={{ fontSize: 14, color: '#60a5fa', marginTop: 4 }}>@{f.username}</div> : null}
      <div style={{ marginTop: 12 }}>
        <Badge color={f.is_online ? '#34d399' : 'rgba(255,255,255,0.45)'}>{f.is_online ? 'Online' : 'Offline'}</Badge>
      </div>
      {f.bio ? (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 16, lineHeight: 1.5, maxWidth: 320 }}>{f.bio}</div>
      ) : (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 16, fontStyle: 'italic' }}>No bio yet</div>
      )}
      <div style={{ fontSize: 12, color: 'rgba(96,165,250,0.85)', marginTop: 14 }}>Swipe right to start a chat</div>
    </div>
  )
}

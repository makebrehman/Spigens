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
  onOpenChat: (user: any) => void
}

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#16A34A']
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// Single source of truth for the Public / Protected / Private pill — same colours
// and labels the rest of the app uses (community list / profile).
const PILL: Record<string, { c: string; bg: string; label: string }> = {
  public: { c: '#22C55E', bg: 'rgba(34,197,94,0.1)', label: 'Public' },
  protected: { c: '#EAB308', bg: 'rgba(234,179,8,0.1)', label: 'Protected' },
  private: { c: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Private' },
}
function TypePill({ type }: { type: string }) {
  const s = PILL[type] || PILL.public
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: s.bg, color: s.c, letterSpacing: 0.3 }}>
      {s.label}
    </span>
  )
}

function MiniAvatar({ url, name, id, size = 26 }: { url?: string | null; name: string; id: string; size?: number }) {
  const initial = (name?.charAt(0) || '?').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: colorFor(id), display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #141414' }}>
      {url
        ? <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        : <span style={{ fontSize: size * 0.42, fontWeight: 700, color: '#fff' }}>{initial}</span>}
    </div>
  )
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

  // Extra info shown on cards
  const [owners, setOwners] = useState<Record<string, any>>({})              // communityId -> owner profile
  const [friendsInCommunity, setFriendsInCommunity] = useState<Record<string, any[]>>({}) // communityId -> my contacts who are members
  const [commonCommunities, setCommonCommunities] = useState<Record<string, any[]>>({})    // friendId -> communities we both belong to

  const flashToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }

  // ── Communities to discover (public + protected, not joined) + their admin and
  //    which of YOUR friends are already in them (public only) ──
  useEffect(() => {
    let active = true
    const run = async () => {
      if (!currentUserId) return
      setLoadingC(true)
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from('communities').select('id, name, description, type, avatar_url, member_count, created_by').in('type', ['public', 'protected']).order('created_at', { ascending: false }).limit(100),
        supabase.from('community_members').select('community_id').eq('user_id', currentUserId),
      ])
      if (!active) return
      const mineIds = new Set((mine || []).map((m: any) => m.community_id))
      const list = (all || []).filter((c: any) => !mineIds.has(c.id))
      setCommunities(list)
      setLoadingC(false)

      // Admins (owners)
      const ownerIds = [...new Set(list.map((c: any) => c.created_by).filter(Boolean))]
      if (ownerIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ownerIds)
        if (active && profs) {
          const m: Record<string, any> = {}
          list.forEach((c: any) => { const p = profs.find((x: any) => x.id === c.created_by); if (p) m[c.id] = p })
          setOwners(m)
        }
      }

      // Your friends already in the PUBLIC communities. RLS hides member rows for
      // communities you're not in, so this goes through a SECURITY DEFINER RPC that
      // only ever reveals public-community membership for the ids you pass.
      const contactIds = useContactStore.getState().contacts.map(c => c.id)
      const publicIds = list.filter((c: any) => c.type === 'public').map((c: any) => c.id)
      if (contactIds.length && publicIds.length) {
        const { data: rows } = await supabase.rpc('get_public_community_friends', { p_community_ids: publicIds, p_user_ids: contactIds })
        if (active && rows) {
          const byComm: Record<string, any[]> = {}
          ;(rows as any[]).forEach((r: any) => {
            (byComm[r.community_id] = byComm[r.community_id] || []).push({ id: r.user_id, name: r.display_name || r.username || 'Friend', avatarUrl: r.avatar_url })
          })
          setFriendsInCommunity(byComm)
        }
      }
    }
    run()
    return () => { active = false }
  }, [currentUserId])

  // ── Friends to discover (not already chatting) + communities you BOTH belong to ──
  useEffect(() => {
    let active = true
    const run = async () => {
      if (!currentUserId) return
      setLoadingF(true)
      const [{ data }, { data: myCm }] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, avatar_url, public_key, bio, is_online, last_seen').neq('id', currentUserId).limit(60),
        supabase.from('community_members').select('community_id').eq('user_id', currentUserId).eq('status', 'active'),
      ])
      if (!active) return
      const contactIds = new Set(useContactStore.getState().contacts.map(c => c.id))
      const list = (data || []).filter((p: any) => !contactIds.has(p.id))
      setFriends(list)
      setLoadingF(false)

      const mySet = new Set((myCm || []).map((m: any) => m.community_id))
      const fIds = list.map((f: any) => f.id)
      if (fIds.length && mySet.size) {
        const { data: fcm } = await supabase.from('community_members').select('user_id, community_id, communities(id, name, type, avatar_url)').in('user_id', fIds).eq('status', 'active')
        if (active && fcm) {
          const byFriend: Record<string, any[]> = {}
          fcm.forEach((row: any) => {
            if (!mySet.has(row.community_id) || !row.communities) return
            ;(byFriend[row.user_id] = byFriend[row.user_id] || []).push(row.communities)
          })
          setCommonCommunities(byFriend)
        }
      }
    }
    run()
    return () => { active = false }
  }, [currentUserId])

  const cards = mode === 'communities' ? communities : friends
  const idx = mode === 'communities' ? cIdx : fIdx
  const loading = mode === 'communities' ? loadingC : loadingF
  const current = cards[idx] ?? null
  const remaining = cards.length - idx

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
      if (dir > 0) { onOpenChat(current); return }
      advance()
    }
  }

  const isCommunities = mode === 'communities'

  const cardVariants = {
    enter: { y: 380, opacity: 0, scale: 0.92 },
    center: { y: 0, opacity: 1, scale: 1, x: 0, rotate: 0 },
    exit: (d: number) => ({ x: d * 680, opacity: 0, rotate: d * 12, transition: { duration: 0.3 } }),
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden' }}>
      {/* Non-prominent header: back (left) + centered toggle. No bar / background. */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 6px', flexShrink: 0 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', WebkitTapHighlightColor: 'transparent' }}>
          <ChevronLeft size={26} />
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 3, gap: 2 }}>
            {(['communities', 'friends'] as Mode[]).map(m => {
              const on = mode === m
              return (
                <button key={m} onClick={() => setMode(m)}
                  style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 18px', fontSize: 13, fontWeight: 600, letterSpacing: 0.2, background: on ? '#2563EB' : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,0.55)', transition: 'background 0.2s, color 0.2s', WebkitTapHighlightColor: 'transparent' }}>
                  {m === 'communities' ? 'Communities' : 'Friends'}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Card area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '10px 20px 18px', minHeight: 0 }}>
        {loading ? (
          <div style={{ alignSelf: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</div>
        ) : !current ? (
          <div style={{ alignSelf: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 40 }}>{isCommunities ? '🎉' : '👋'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{isCommunities ? "You're all caught up" : 'No new people right now'}</div>
            <div style={{ fontSize: 13 }}>{isCommunities ? 'No more communities to discover.' : 'Check back later.'}</div>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', maxWidth: 440, alignSelf: 'stretch' }}>
            {/* Stacked "more cards" peeking behind */}
            {remaining > 2 && (
              <div style={{ position: 'absolute', inset: 0, transform: 'scale(0.9) translateY(26px)', transformOrigin: 'top center', background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 26, zIndex: 0 }} />
            )}
            {remaining > 1 && (
              <div style={{ position: 'absolute', inset: 0, transform: 'scale(0.95) translateY(13px)', transformOrigin: 'top center', background: '#181818', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 26, zIndex: 1 }} />
            )}

            <AnimatePresence initial={false} custom={exitDir}>
              <motion.div
                key={(isCommunities ? 'c:' : 'f:') + current.id}
                custom={exitDir}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDragEnd={(_e, info) => {
                  if (info.offset.x > 110 || info.velocity.x > 650) doSwipe(1)
                  else if (info.offset.x < -110 || info.velocity.x < -650) doSwipe(-1)
                }}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                style={{
                  position: 'absolute', inset: 0, zIndex: 2, cursor: 'grab',
                  background: 'linear-gradient(180deg, #1c1c1c 0%, #111 100%)',
                  border: '1px solid rgba(255,255,255,0.09)', borderRadius: 26,
                  boxShadow: '0 24px 70px rgba(0,0,0,0.7)', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                  {isCommunities
                    ? <CommunityCardBody c={current} admin={owners[current.id]} friendsHere={current.type === 'public' ? (friendsInCommunity[current.id] || []) : []} />
                    : <FriendCardBody f={current} common={commonCommunities[current.id] || []} />}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', zIndex: 5 }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flexShrink: 0, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12.5, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', paddingTop: 2 }}>
        Swipe right to {isCommunities ? 'join' : 'message'} · left to skip
      </div>
    </div>
  )
}

function Hero({ children }: { children: React.ReactNode }) {
  // Full-width square hero, with even side padding ("some spacing"), centred.
  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: 340, position: 'relative' }}>{children}</div>
    </div>
  )
}

function CommunityCardBody({ c, admin, friendsHere }: { c: any; admin: any; friendsHere: any[] }) {
  const initials = (c.name || '?').charAt(0).toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Hero>
        <div style={{ width: '100%', height: '100%', borderRadius: 28, background: c.avatar_url ? '#000' : colorFor(c.id), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {c.avatar_url
            ? <img src={c.avatar_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            : <span style={{ fontSize: 88, fontWeight: 800, color: '#fff' }}>{initials}</span>}
        </div>
      </Hero>

      <div style={{ padding: '18px 22px 22px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{c.name}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <TypePill type={c.type} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{(c.member_count || 0) + ' member' + ((c.member_count || 0) === 1 ? '' : 's')}</span>
        </div>
        {c.description ? (
          <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.62)', marginTop: 14, lineHeight: 1.55 }}>{c.description}</div>
        ) : null}

        {admin && (
          <InfoRow label="Admin">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MiniAvatar url={admin.avatar_url} name={admin.display_name || admin.username || '?'} id={admin.id} />
              <span style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500 }}>{admin.display_name || admin.username}</span>
            </div>
          </InfoRow>
        )}

        {c.type === 'public' && friendsHere.length > 0 && (
          <InfoRow label={friendsHere.length === 1 ? '1 friend here' : friendsHere.length + ' friends here'}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex' }}>
                {friendsHere.slice(0, 5).map((f, i) => (
                  <div key={f.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <MiniAvatar url={f.avatarUrl} name={f.name} id={f.id} size={28} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 10 }}>
                {friendsHere.slice(0, 2).map(f => f.name).join(', ')}{friendsHere.length > 2 ? ` +${friendsHere.length - 2}` : ''}
              </span>
            </div>
          </InfoRow>
        )}
      </div>
    </div>
  )
}

function FriendCardBody({ f, common }: { f: any; common: any[] }) {
  const name = f.display_name || f.username || 'User'
  const initials = (name.charAt(0) || '?').toUpperCase()
  // de-dup communities
  const seen = new Set<string>()
  const commonUnique = common.filter(c => c && !seen.has(c.id) && seen.add(c.id))
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Hero>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
          <ProfileImage avatarUrl={f.avatar_url ?? null} contactInitials={initials} contactAvatarColor={colorFor(f.id)} size={340} />
        </div>
      </Hero>

      <div style={{ padding: '18px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{name}</div>
          {f.is_online && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
        </div>
        {f.username ? <div style={{ fontSize: 14, color: '#60a5fa', marginTop: 4 }}>@{f.username}</div> : null}
        {f.bio ? (
          <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.62)', marginTop: 14, lineHeight: 1.55 }}>{f.bio}</div>
        ) : null}

        {commonUnique.length > 0 ? (
          <InfoRow label={commonUnique.length === 1 ? '1 community in common' : commonUnique.length + ' communities in common'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {commonUnique.slice(0, 4).map(cc => (
                <div key={cc.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MiniAvatar url={cc.avatar_url} name={cc.name || '?'} id={cc.id} size={26} />
                  <span style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cc.name}</span>
                  <TypePill type={cc.type} />
                </div>
              ))}
            </div>
          </InfoRow>
        ) : null}
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.3, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

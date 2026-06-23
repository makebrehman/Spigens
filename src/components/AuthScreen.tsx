'use client'

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { supabase } from '@/lib/supabase'
import { compressAvatar, stashPendingAvatar } from '@/lib/avatarUpload'

type Mode = 'signin' | 'signup' | 'profile' | 'forgot' | 'verify'
type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'authed'

const S_GRID = [
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,0,0,0,1,1,0],
  [0,1,0,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0],
  [0,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,1,1,0],
  [0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,1,0],
  [0,1,0,0,0,0,1,1,0],
  [0,1,1,0,0,0,1,1,0],
  [0,0,1,1,1,1,1,0,0],
]

type SHandle = { setCheckState: (s: CheckState) => void }

const AnimatedS = forwardRef<SHandle, {}>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<CheckState>('idle')
  const resultTimeRef = useRef(0)

  useImperativeHandle(ref, () => ({
    setCheckState: (s) => {
      stateRef.current = s
      if (s === 'available' || s === 'taken') resultTimeRef.current = performance.now()
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const CELL = 13
    const padX = (W - S_GRID[0].length * CELL) / 2
    const padY = (H - S_GRID.length * CELL) / 2

    type P = {
      x: number; y: number; sx: number; sy: number
      bx: number; by: number; phase: number
      rot: number; rotSpd: number; sz: number
    }

    const ps: P[] = []
    S_GRID.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (!cell) return
        const tx = padX + ci * CELL + CELL / 2
        const ty = padY + ri * CELL + CELL / 2
        const a = Math.random() * Math.PI * 2
        ps.push({
          x: W / 2 + Math.cos(a) * 60,
          y: H / 2 + Math.sin(a) * 60,
          sx: tx, sy: ty, bx: 0, by: 0,
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
          rotSpd: (Math.random() - 0.5) * 0.05,
          sz: 2 + Math.random() * 1.5,
        })
      })
    })

    // box targets — square border
    const n = ps.length, cx = W / 2, cy = H / 2, bs = 56
    ps.forEach((p, i) => {
      const f = i / n, per = bs * 4, pos = f * per
      if (pos < bs)        { p.bx = cx - bs / 2 + pos;        p.by = cy - bs / 2 }
      else if (pos < bs*2) { p.bx = cx + bs / 2;              p.by = cy - bs / 2 + (pos - bs) }
      else if (pos < bs*3) { p.bx = cx + bs / 2 - (pos-bs*2); p.by = cy + bs / 2 }
      else                 { p.bx = cx - bs / 2;               p.by = cy + bs / 2 - (pos-bs*3) }
    })

    let t = 0, raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      t += 0.018
      const st = stateRef.current
      const isBox = st === 'checking' || st === 'authed'
      const resultAge = (performance.now() - resultTimeRef.current) / 1000
      const showFlash = (st === 'available' || st === 'taken') && resultAge < 1.2
      const boxAngle = isBox ? t * 0.9 : 0

      ps.forEach(p => {
        let tx2: number, ty2: number
        if (isBox) {
          const dx = p.bx - cx, dy = p.by - cy
          const c = Math.cos(boxAngle), s = Math.sin(boxAngle)
          tx2 = cx + dx * c - dy * s
          ty2 = cy + dx * s + dy * c
        } else {
          tx2 = p.sx; ty2 = p.sy
        }
        const ease = isBox ? 0.07 : 0.04
        p.x += (tx2 - p.x) * ease
        p.y += (ty2 - p.y) * ease
        p.rot += isBox ? 0.09 : p.rotSpd

        const wave = Math.sin(t * (isBox ? 2.2 : 1) + p.phase)
        const dX = isBox ? 0 : Math.sin(t * 0.7 + p.phase) * 1.3
        const dY = isBox ? 0 : Math.cos(t * 0.5 + p.phase) * 1.3
        const opacity = 0.38 + wave * (isBox ? 0.5 : 0.35)
        const sz = p.sz + wave * 0.6

        let r = 255, g = 255, b = 255
        if (showFlash) {
          const f2 = 1 - resultAge / 1.2
          if (st === 'available') { g = 255; r = Math.round(255 * (1 - f2 * 0.7)); b = Math.round(255 * (1 - f2 * 0.5)) }
          if (st === 'taken')     { r = 255; g = Math.round(255 * (1 - f2 * 0.8)); b = Math.round(255 * (1 - f2 * 0.8)) }
        }

        ctx.save()
        ctx.translate(p.x + dX, p.y + dY)
        ctx.rotate(p.rot)
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`
        ctx.fillRect(-sz, -sz * 0.3, sz * 2, sz * 0.6)
        ctx.restore()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} width={200} height={200} style={{ display: 'block' }} />
})
AnimatedS.displayName = 'AnimatedS'

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

const baseInput: React.CSSProperties = {
  width: '100%', padding: '12px 18px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '999px', color: '#e8e8e8',
  fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
  letterSpacing: '0.2px', transition: 'border-color 0.25s',
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function EmailField({ value, onChange, onKeyDown }: {
  value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const [touched, setTouched] = useState(false)
  const valid = isValidEmail(value)
  const borderColor = touched && value
    ? valid ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.35)'
    : 'rgba(255,255,255,0.08)'
  return (
    <input type="email" placeholder="email" value={value} autoComplete="email"
      onChange={e => onChange(e.target.value)}
      onBlur={() => setTouched(true)}
      onKeyDown={onKeyDown}
      style={{ ...baseInput, borderColor }}
    />
  )
}

function PwdField({ value, onChange, onKeyDown, placeholder = 'password' }: {
  value: string; onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} placeholder={placeholder} value={value}
        autoComplete="current-password"
        onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
        style={{ ...baseInput, paddingRight: '42px' }}
      />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', padding: '4px' }}>
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

function UsernameField({ value, onChange, status }: {
  value: string; onChange: (v: string) => void
  status: 'idle' | 'checking' | 'available' | 'taken'
}) {
  const bc = status === 'available' ? 'rgba(34,197,94,0.45)'
    : status === 'taken' ? 'rgba(239,68,68,0.35)'
    : 'rgba(255,255,255,0.08)'
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input placeholder="username" value={value} autoComplete="username"
          onChange={e => onChange(e.target.value.replace(/[^a-z0-9_.]/g, '').toLowerCase())}
          style={{ ...baseInput, paddingRight: '42px', borderColor: bc, transition: 'border-color 0.3s' }}
        />
        {status !== 'idle' && (
          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center' }}>
            {status === 'checking' && (
              <div style={{ width: '13px', height: '13px', borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,0.15)',
                borderTopColor: 'rgba(255,255,255,0.6)',
                animation: 'spin 0.7s linear infinite' }}
              />
            )}
            {status === 'available' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            )}
            {status === 'taken' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </div>
        )}
      </div>
      <AnimatePresence>
        {status === 'available' && (
          <motion.div initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: '10px', color: '#22c55e', padding: '3px 18px', letterSpacing: '0.3px' }}>
            username is available
          </motion.div>
        )}
        {status === 'taken' && (
          <motion.div initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: '10px', color: '#ef4444', padding: '3px 18px', letterSpacing: '0.3px' }}>
            username already taken
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PlainField({ placeholder, value, onChange }: {
  placeholder: string; value: string; onChange: (v: string) => void
}) {
  return <input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={baseInput} />
}

function AvatarPicker({ onChange }: { onChange: (f: File) => void }) {
  const iRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <div onClick={() => { if (!loading) iRef.current?.click() }}
        style={{ width: '64px', height: '64px', borderRadius: '50%',
          background: preview ? 'transparent' : 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: loading ? 'default' : 'pointer', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <div style={{ width: '18px', height: '18px', borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.15)',
            borderTopColor: 'rgba(255,255,255,0.6)',
            animation: 'spin 0.7s linear infinite' }}
          />
        ) : preview ? (
          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.2)' }}>+</span>
        )}
        <input ref={iRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return
            onChange(f)
            setLoading(true)
            try {
              const compressedBlob = await compressAvatar(f)
              await stashPendingAvatar(compressedBlob)
              const r = new FileReader()
              r.onload = ev => setPreview(ev.target?.result as string)
              r.readAsDataURL(compressedBlob)
            } catch (err) {
              console.error('Failed to compress or stash avatar', err)
            } finally {
              setLoading(false)
            }
          }}
        />
      </div>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3px' }}>
        {loading ? 'processing...' : preview ? 'tap to change' : 'add photo'}
      </span>
    </div>
  )
}

function PrimaryBtn({ id, children, onClick, loading, success }: {
  id?: string; children: React.ReactNode; onClick: () => void; loading: boolean; success?: boolean
}) {
  return (
    <motion.button layoutId={id} onClick={onClick} disabled={loading || success}
      style={{ width: '100%', padding: '12px',
        background: success ? '#22c55e' : loading ? 'rgba(255,255,255,0.05)' : '#fff',
        color: success ? '#fff' : loading ? '#444' : '#000',
        border: 'none', borderRadius: '999px',
        fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px',
        cursor: (loading || success) ? 'default' : 'pointer', fontFamily: 'inherit',
        transition: 'background 0.2s, color 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40px' }}>
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div key="success" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring' }} style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>
        ) : loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '14px', height: '14px', border: '2px solid rgba(128,128,128,0.3)', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </motion.div>
        ) : (
          <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center' }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function LinkBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.22)', fontSize: '11px',
        cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.3px', padding: '3px 8px' }}>
      {children}
    </button>
  )
}

function Err({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      style={{ padding: '7px 16px',
        background: 'rgba(239,68,68,0.07)',
        border: '1px solid rgba(239,68,68,0.14)',
        borderRadius: '999px', color: '#fca5a5',
        fontSize: '11px', textAlign: 'center', letterSpacing: '0.2px' }}>
      {msg}
    </motion.div>
  )
}

function Info({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      style={{ padding: '7px 16px',
        background: 'rgba(34,197,94,0.07)',
        border: '1px solid rgba(34,197,94,0.14)',
        borderRadius: '999px', color: '#86efac',
        fontSize: '11px', textAlign: 'center', letterSpacing: '0.2px' }}>
      {msg}
    </motion.div>
  )
}

const slides = {
  enter: (d: number) => ({ x: d > 0 ? '105%' : '-105%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? '-105%' : '105%', opacity: 0 }),
}
const sp = { type: 'spring' as const, stiffness: 360, damping: 34 }

export function AuthScreen() {
  const sRef = useRef<SHandle>(null)
  const [mode, setMode] = useState<Mode>('signin')
  const [dir, setDir] = useState(1)
  const [leaving, setLeaving] = useState(false)

  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [forgotStep, setForgotStep] = useState<1 | 2>(1)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uStatus, setUStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle')

  const [codeSentAt, setCodeSentAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!codeSentAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [codeSentAt])

  const expiryLeft = codeSentAt ? Math.max(0, 300 - Math.floor((now - codeSentAt) / 1000)) : 0
  const resendLeft = codeSentAt ? Math.max(0, 60 - Math.floor((now - codeSentAt) / 1000)) : 0
  const isExpired = codeSentAt !== null && expiryLeft === 0

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const { signIn, signUp, completeProfile, verifyEmailCode, sendPasswordResetCode, verifyPasswordResetCode } = useAuthStore()
  const { navigateTo } = useNavStore()

  // debounced username check
  useEffect(() => {
    if (mode !== 'profile' || !username || username.length < 3) {
      setTimeout(() => setUStatus('idle'), 0); sRef.current?.setCheckState('idle'); return
    }
    setUStatus('checking'); sRef.current?.setCheckState('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
      const s = data ? 'taken' : 'available'
      setUStatus(s); sRef.current?.setCheckState(s)
    }, 650)
    return () => clearTimeout(t)
  }, [username, mode])

  const go = useCallback((next: Mode, d: number) => {
    setDir(d); setMode(next); setError(null); setInfo(null); setForgotStep(1); setCodeSentAt(null)
  }, [])

  const hk = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') fn() }

  const doSignIn = async () => {
    if (!email || !pwd) { setError('fill in all fields'); return }
    if (!isValidEmail(email)) { setError('enter a valid email'); return }
    setLoading(true); setError(null); setSuccess(false)
    try {
      const { error, needsVerification } = await signIn(email.trim(), pwd)
      if (needsVerification) {
        setLoading(false)
        go('verify', 1)
        if (resendLeft === 0) {
          const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
          if (!resendError) {
            setCodeSentAt(Date.now())
          }
        }
        setInfo('please verify your email — we sent you a new code')
        return
      }
      if (error) { setError(error); setLoading(false); return }
      
      const profile = useAuthStore.getState().profile
      if (!profile?.username) {
        setSuccess(true)
        setTimeout(() => {
          setLoading(false)
          setSuccess(false)
          go('profile', 1)
        }, 500)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setLeaving(true); sRef.current?.setCheckState('authed')
        setTimeout(() => navigateTo('home'), 1200)
      }, 500)
    } catch { setLoading(false) }
  }

  const doSignUpCall = async () => {
    if (!email || !pwd || !confirm) { setError('fill in all fields'); return }
    if (!isValidEmail(email)) { setError('enter a valid email'); return }
    if (pwd !== confirm) { setError('passwords do not match'); return }
    if (pwd.length < 8) { setError('password must be 8+ characters'); return }
    setLoading(true); setError(null); setSuccess(false)
    try {
      const { error, needsConfirmation } = await signUp(email.trim(), pwd)
      if (error) { setError(error); setLoading(false); return }
      setSuccess(true)
      setTimeout(() => {
        setLoading(false)
        setSuccess(false)
        if (needsConfirmation) {
          go('verify', 1)
          setCodeSentAt(Date.now())
        }
      }, 1000)
    } catch { setLoading(false) }
  }

  const doCreate = async () => {
    if (!displayName || !username) { setError('fill in all fields'); return }
    if (uStatus === 'taken') { setError('choose a different username'); return }
    if (uStatus === 'checking') { setError('wait for username check'); return }
    setLoading(true); setError(null); setSuccess(false)
    try {
      const { error } = await completeProfile(username, displayName)
      if (error) { setError(error); setLoading(false); return }
      
      setSuccess(true)
      setTimeout(() => {
        setLoading(false)
        setSuccess(false)
        setLeaving(true); sRef.current?.setCheckState('authed')
        setTimeout(() => navigateTo('home'), 1200)
      }, 1000)
    } catch { setLoading(false) }
  }

  const doVerifyEmail = async () => {
    if (!code || code.length !== 6) { setError('enter the 6-digit code'); return }
    setLoading(true); setError(null); setInfo(null); setSuccess(false)
    const { error } = await verifyEmailCode(email.trim(), code.trim())
    if (error) { setError(error); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => {
      setLoading(false)
      setSuccess(false)
      go('profile', 1)
    }, 1000)
  }

  const doResendVerify = async () => {
    if (resendLeft > 0) return
    setError(null); setInfo(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    if (error) setError(error.message)
    else {
      setInfo('code sent')
      setCodeSentAt(Date.now())
    }
  }

  const doResendReset = async () => {
    if (resendLeft > 0) return
    setError(null); setInfo(null)
    const { error } = await sendPasswordResetCode(email.trim())
    if (error) setError(error)
    else {
      setInfo('code sent')
      setCodeSentAt(Date.now())
    }
  }

  const doForgot = async () => {
    if (!email) { setError('enter your email'); return }
    if (!isValidEmail(email)) { setError('enter a valid email'); return }
    setLoading(true); setError(null); setInfo(null); setSuccess(false)
    const { error } = await sendPasswordResetCode(email.trim())
    if (error) { setError(error); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => {
        setLoading(false)
        setSuccess(false)
        setForgotStep(2)
        setCode('')
        setPwd('')
        setCodeSentAt(Date.now())
    }, 600)
  }

  const doResetPassword = async () => {
    if (!code || code.length !== 6) { setError('enter the 6-digit code'); return }
    if (!pwd || pwd.length < 6) { setError('password must be at least 6 characters'); return }
    setLoading(true); setError(null); setInfo(null); setSuccess(false)
    const { error } = await verifyPasswordResetCode(email.trim(), code.trim(), pwd)
    if (error) { setError(error); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => {
      setLoading(false)
      setSuccess(false)
      go('signin', -1)
      setInfo('password updated — please sign in')
    }, 1000)
  }

  const showEmail = mode !== 'profile'
  const showPwd   = mode === 'signin' || mode === 'signup'

  return (
    <div style={{ height: '100vh', width: '100%', background: '#050505',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontFamily: 'inherit' }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.22); }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 100px #111 inset !important;
          -webkit-text-fill-color: #e8e8e8 !important;
        }
      `}</style>

      {/* brand */}
      <div style={{ fontSize: '10px', letterSpacing: '5px', color: 'rgba(255,255,255,0.16)', marginBottom: '4px' }}>
        spigens
      </div>

      {/* animated S — never moves */}
      <AnimatedS ref={sRef} />

      {/* tagline */}
      <div style={{ fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.12)',
        marginTop: '-4px', marginBottom: '24px' }}>
        end-to-end encrypted
      </div>

      {/* form */}
      <motion.div
        animate={leaving ? { y: '100vh', opacity: 0 } : { y: 0, opacity: 1 }}
        transition={leaving ? { duration: 0.42, ease: 'easeIn' } : { duration: 0 }}
        style={{ width: '100%', maxWidth: '288px', padding: '0 4px', boxSizing: 'border-box' }}
      >
        <LayoutGroup>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>

            {/* shared email — stays in DOM, repositions with layout */}
            {showEmail && (
              <motion.div layout layoutId="slot-email" transition={sp}>
                <EmailField value={email} onChange={setEmail} onKeyDown={showPwd ? undefined : hk(doForgot)} />
              </motion.div>
            )}

            {/* shared password — stays in signin + signup */}
            {showPwd && (
              <motion.div layout layoutId="slot-pwd" transition={sp}>
                <PwdField value={pwd} onChange={setPwd} />
              </motion.div>
            )}

            {/* mode-specific content slides in/out */}
            <AnimatePresence mode="popLayout" custom={dir}>
              <motion.div
                key={mode}
                custom={dir}
                variants={slides}
                initial="enter"
                animate="center"
                exit="exit"
                transition={sp}
                style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}
              >
                {mode === 'signin' && (
                  <>
                    {error && <Err msg={error} />}
                    {info && <Info msg={info} />}
                    <PrimaryBtn id="auth-btn" onClick={doSignIn} loading={loading} success={success}>sign in</PrimaryBtn>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                      <LinkBtn onClick={() => go('signup', 1)}>create account</LinkBtn>
                      <LinkBtn onClick={() => go('forgot', 1)}>forgot password?</LinkBtn>
                    </div>
                  </>
                )}

                {mode === 'signup' && (
                  <>
                    <PwdField value={confirm} onChange={setConfirm} placeholder="confirm password" />
                    {error && <Err msg={error} />}
                    <PrimaryBtn id="auth-btn" onClick={doSignUpCall} loading={loading} success={success}>create account →</PrimaryBtn>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <LinkBtn onClick={() => go('signin', -1)}>already have an account</LinkBtn>
                    </div>
                  </>
                )}

                {mode === 'profile' && (
                  <>
                    <AvatarPicker onChange={setAvatarFile} />
                    <PlainField placeholder="display name" value={displayName} onChange={setDisplayName} />
                    <UsernameField value={username} onChange={setUsername} status={uStatus} />
                    {error && <Err msg={error} />}
                    <PrimaryBtn id="auth-btn" onClick={doCreate} loading={loading} success={success}>create account</PrimaryBtn>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <LinkBtn onClick={() => go('signup', -1)}>← back</LinkBtn>
                    </div>
                  </>
                )}

                {mode === 'forgot' && (
                  <>
                    {forgotStep === 1 ? (
                      <>
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)',
                          fontSize: '11px', lineHeight: 1.7, letterSpacing: '0.2px' }}>
                          enter your email and we&apos;ll send a 6-digit code
                        </div>
                        {error && <Err msg={error} />}
                        {info && <Info msg={info} />}
                        <PrimaryBtn id="auth-btn" onClick={doForgot} loading={loading} success={success}>send reset code</PrimaryBtn>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <LinkBtn onClick={() => go('signin', -1)}>← back to sign in</LinkBtn>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)',
                          fontSize: '15px', lineHeight: 1.7, letterSpacing: '0.2px', marginBottom: '8px' }}>
                          enter the 6-digit code sent to<br/>
                          <span style={{ color: '#fff' }}>{email}</span>
                        </div>
                        <input type="text" placeholder="------" value={code}
                          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          style={{ ...baseInput, textAlign: 'center', letterSpacing: '8px', fontSize: '18px' }} />
                        <PwdField value={pwd} onChange={setPwd} placeholder="new password" />
                        {error && <Err msg={error} />}
                        {info && <Info msg={info} />}
                        <PrimaryBtn id="auth-btn" onClick={doResetPassword} loading={loading} success={success}>reset password</PrimaryBtn>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <LinkBtn onClick={doResendReset}>resend code</LinkBtn>
                          <LinkBtn onClick={() => go('signin', -1)}>← back to sign in</LinkBtn>
                        </div>
                      </>
                    )}
                  </>
                )}

                {mode === 'verify' && (
                  <>
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)',
                      fontSize: '15px', lineHeight: 1.7, letterSpacing: '0.2px', marginBottom: '8px' }}>
                      enter the 6-digit code sent to<br/>
                      <span style={{ color: '#fff' }}>{email}</span>
                    </div>
                    <input type="text" placeholder="------" value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={{ ...baseInput, textAlign: 'center', letterSpacing: '8px', fontSize: '18px' }} />
                    {error && <Err msg={error} />}
                    {info && <Info msg={info} />}
                    <PrimaryBtn id="auth-btn" onClick={doVerifyEmail} loading={loading} success={success}>verify</PrimaryBtn>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <LinkBtn onClick={doResendVerify}>resend code</LinkBtn>
                      <LinkBtn onClick={() => go('signin', -1)}>← back to sign in</LinkBtn>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  )
}

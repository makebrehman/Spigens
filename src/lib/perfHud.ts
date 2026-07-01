// ── Dev-only chat-open profiler ───────────────────────────────────────────
// Throwaway instrumentation to find what blocks the chat detail screen on open.
// Renders a small live readout (see PerfHud.tsx) in the bottom-right corner and
// mirrors everything to the console (visible in `adb logcat` / chrome://inspect).
// Flip PERF_HUD to false (or remove the file) to disable everything.

export const PERF_HUD = true

type Mark = { label: string; at: number; dt: number }

interface Session {
  t0: number
  marks: Mark[]
  counts: Record<string, number>
  longestStall: number   // longest single main-thread freeze (ms)
  totalStall: number     // sum of all freezes > STALL_MS (ms)
  lastMarkAt: number
}

const STALL_MS = 50          // gaps bigger than this count as "the UI was frozen"
const FRAME_BUDGET = 1000 / 60

let session: Session = blank()
let rafId: number | null = null
let lastFrame = 0

function blank(): Session {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return { t0: now, marks: [], counts: {}, longestStall: 0, totalStall: 0, lastMarkAt: now }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

// Detects main-thread freezes: requestAnimationFrame cannot fire while JS is
// blocking, so a large gap between frames == that many ms the UI ignored the user.
function stallLoop() {
  const t = now()
  const gap = t - lastFrame
  if (gap > STALL_MS) {
    const blocked = gap - FRAME_BUDGET
    if (blocked > session.longestStall) session.longestStall = blocked
    session.totalStall += blocked
  }
  lastFrame = t
  rafId = requestAnimationFrame(stallLoop)
}

/** Begin a fresh profiling session (call once per chat open). */
export function perfStart() {
  if (!PERF_HUD) return
  session = blank()
  lastFrame = now()
  if (rafId == null && typeof requestAnimationFrame !== 'undefined') {
    rafId = requestAnimationFrame(stallLoop)
  }
  console.log('[PERF] ── chat open: session start ──')
}

/** Record a named phase (e.g. "local messages shown"). Only the first call for a
 *  given label is kept, so effects that run repeatedly don't spam the timeline. */
export function perfMark(label: string) {
  if (!PERF_HUD) return
  if (session.marks.some(m => m.label === label)) return
  const at = now() - session.t0
  const dt = at - (session.lastMarkAt - session.t0)
  session.lastMarkAt = now()
  session.marks.push({ label, at, dt })
  console.log(`[PERF] ${label.padEnd(26)} +${at.toFixed(0)}ms  (Δ${dt.toFixed(0)}ms)`)
}

/** Increment a counter (e.g. how many times a bubble rendered). */
export function perfCount(label: string) {
  if (!PERF_HUD) return
  session.counts[label] = (session.counts[label] ?? 0) + 1
}

export function perfSnapshot(): Session {
  return session
}

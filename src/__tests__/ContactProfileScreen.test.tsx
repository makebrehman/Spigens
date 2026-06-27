/**
 * ContactProfileScreen — exhaustive test suite.
 *
 * Coverage:
 *  - Initial render: prop fallbacks shown immediately
 *  - Profile load: SQLite cache hit/miss, server refresh, offline/error, race (unmount before response)
 *  - componentState lifecycle: set on load, cleaned on unmount, cleared on userId change
 *  - Mutual communities: local SQLite intersection, server refresh
 *  - Block sheet: open/close/confirm/alsoReport/error/busy/toast timing
 *  - Report sheet: open/close/all 5 reasons/success+error toast/auto-dismiss
 *  - Navigation: onBack, onStartChat, onOpenCommunity wiring through storeActions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ── Hoisted shared mock state ─────────────────────────────────────────────────
// vi.hoisted runs before all imports and vi.mock factories.

const {
  componentState,
  subscribers,
  mockSetComponentState,
  mockUIStoreSubscribe,
  useUIStore,
  mockCurrentUserId,
} = vi.hoisted(() => {
  const componentState: Record<string, any> = {}
  const subscribers: Array<(next: any, prev: any) => void> = []

  const mockSetComponentState = vi.fn((key: string, value: any) => {
    const prev = { componentState: { ...componentState } }
    componentState[key] = value
    const next = { componentState: { ...componentState } }
    subscribers.forEach(cb => cb(next, prev))
  })

  const mockUIStoreSubscribe = vi.fn((cb: (n: any, p: any) => void) => {
    subscribers.push(cb)
    return () => {
      const i = subscribers.indexOf(cb)
      if (i !== -1) subscribers.splice(i, 1)
    }
  })

  const getState = () => ({
    componentState,
    setComponentState: mockSetComponentState,
    componentSources: {},
  })

  function hook(selector: any) {
    const state = {
      componentSources: { contactProfileScreen: 'MOCKED' },
      componentState,
    }
    return typeof selector === 'function' ? selector(state) : state
  }

  const useUIStore = Object.assign(hook, { getState, subscribe: mockUIStoreSubscribe })
  const mockCurrentUserId = { value: 'user-me' as string | null }

  return { componentState, subscribers, mockSetComponentState, mockUIStoreSubscribe, useUIStore, mockCurrentUserId }
})

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/stores/uiStore', () => ({ useUIStore }))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = { user: mockCurrentUserId.value ? { id: mockCurrentUserId.value } : null }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

const mockGetCachedProfile = vi.fn()
const mockCacheProfile = vi.fn()
const mockGetCachedCommunityList = vi.fn()
const mockGetCachedCommunityIdsForMember = vi.fn()

vi.mock('@/lib/offlineCache', () => ({
  getCachedProfile: (...a: any[]) => mockGetCachedProfile(...a),
  cacheProfile: (...a: any[]) => mockCacheProfile(...a),
  getCachedCommunityList: (...a: any[]) => mockGetCachedCommunityList(...a),
  getCachedCommunityIdsForMember: (...a: any[]) => mockGetCachedCommunityIdsForMember(...a),
}))

const mockSupabaseFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockSupabaseFrom(t) },
}))

vi.mock('@/components/ProfileImage', () => ({
  ProfileImage: ({ url }: any) => <img data-testid="profile-image" src={url} alt="avatar" />,
}))
vi.mock('@/components/BackButton', () => ({
  BackButton: ({ onPress }: any) => <button data-testid="back-button" onClick={onPress}>Back</button>,
}))

// RenderifyHost: bypass Babel compilation — surface storeActions as testable DOM nodes.
vi.mock('@/components/RenderifyHost', () => ({
  RenderifyHost: ({ code, storeActions = {} }: { code: string | null; storeActions?: Record<string, any> }) => {
    if (!code) return <div data-testid="renderify-no-source" />
    const {
      displayName, username, bio, isOnline, mutualCommunities,
      onStartChat, onBack, onOpenCommunity, onBlockClick, onReportClick,
    } = storeActions
    return (
      <div data-testid="genui-root">
        <span data-testid="display-name">{displayName}</span>
        <span data-testid="username">{username}</span>
        <span data-testid="bio">{bio ?? ''}</span>
        <span data-testid="is-online">{String(isOnline)}</span>
        <span data-testid="mutual-count">{mutualCommunities?.length ?? 0}</span>
        <button data-testid="start-chat" onClick={onStartChat ?? undefined}>Chat</button>
        <button data-testid="go-back" onClick={onBack ?? undefined}>Back</button>
        <button
          data-testid="open-community"
          onClick={() => onOpenCommunity?.('cid', 'CommunityName', 'public', 12, null)}
        >Open</button>
        <button data-testid="block-btn" onClick={onBlockClick ?? undefined}>Block</button>
        <button data-testid="report-btn" onClick={onReportClick ?? undefined}>Report</button>
      </div>
    )
  },
}))

import { ContactProfileScreen } from '@/components/ContactProfileScreen'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildChain(resolveWith: { data?: any; error?: any }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveWith),
    then: (resolve: any) => Promise.resolve(resolveWith).then(resolve),
  }
}

const DEFAULTS = {
  userId: 'user-contact',
  displayName: 'Jane Doe',
  username: 'janedoe',
  avatarUrl: 'https://example.com/avatar.jpg',
  onBack: vi.fn(),
  onStartChat: vi.fn(),
  onOpenCommunity: vi.fn(),
  onBlocked: vi.fn(),
}

function renderScreen(overrides: Partial<typeof DEFAULTS> = {}) {
  return render(<ContactProfileScreen {...DEFAULTS} {...overrides} />)
}

/** After block sheet opens, return the confirm "Block" button (not the genui trigger). */
function getBlockConfirmButton() {
  const sheetCard = screen.getByText(/Block (Jane Doe|this person|John Smith)\?/).parentElement!
  return within(sheetCard).getByRole('button', { name: /^Block$/i })
}

/** After block sheet opens, return the overlay (parent of the card). */
function getBlockOverlay() {
  const sheetCard = screen.getByText(/Block (Jane Doe|this person|John Smith)\?/).parentElement!
  return sheetCard.parentElement!
}

// ── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  mockCurrentUserId.value = 'user-me'
  Object.keys(componentState).forEach(k => delete componentState[k])
  subscribers.length = 0

  mockGetCachedProfile.mockResolvedValue(null)
  mockCacheProfile.mockResolvedValue(undefined)
  mockGetCachedCommunityList.mockResolvedValue(null)
  mockGetCachedCommunityIdsForMember.mockResolvedValue([])

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'blocks' || table === 'reports') {
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }
    return buildChain({ data: null })
  })

  ;[DEFAULTS.onBack, DEFAULTS.onStartChat, DEFAULTS.onOpenCommunity, DEFAULTS.onBlocked]
    .forEach(fn => (fn as any).mockClear())
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════════

describe('initial render — prop fallbacks', () => {
  it('renders genui root immediately without waiting for async data', async () => {
    renderScreen()
    expect(screen.getByTestId('genui-root')).toBeInTheDocument()
    await act(async () => {}) // flush pending microtasks cleanly
  })

  it('shows displayName from props before any profile loads', async () => {
    renderScreen()
    expect(screen.getByTestId('display-name').textContent).toBe('Jane Doe')
    await act(async () => {})
  })

  it('shows username from props before any profile loads', async () => {
    renderScreen()
    expect(screen.getByTestId('username').textContent).toBe('janedoe')
    await act(async () => {})
  })

  it('isOnline is false before profile loads', async () => {
    renderScreen()
    expect(screen.getByTestId('is-online').textContent).toBe('false')
    await act(async () => {})
  })

  it('mutual-count is 0 before communities load', async () => {
    renderScreen()
    expect(screen.getByTestId('mutual-count').textContent).toBe('0')
    await act(async () => {})
  })
})

describe('profile load — SQLite cache', () => {
  it('updates display-name from cache hit', async () => {
    mockGetCachedProfile.mockResolvedValue({ display_name: 'Cached Jane', username: 'cached', bio: null, is_online: true })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('display-name').textContent).toBe('Cached Jane'))
  })

  it('sets bio from cache', async () => {
    mockGetCachedProfile.mockResolvedValue({ display_name: 'Jane', username: 'j', bio: 'Hello!', is_online: false })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('bio').textContent).toBe('Hello!'))
  })

  it('sets isOnline from cache', async () => {
    mockGetCachedProfile.mockResolvedValue({ display_name: 'Jane', username: 'j', bio: null, is_online: true })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('is-online').textContent).toBe('true'))
  })

  it('calls getCachedProfile with the correct userId', async () => {
    renderScreen({ userId: 'specific-123' })
    await waitFor(() => expect(mockGetCachedProfile).toHaveBeenCalledWith('specific-123'))
  })

  it('sets contactProfileData in componentState from cache hit', async () => {
    const cached = { display_name: 'Cache', username: 'c', bio: null, is_online: false }
    mockGetCachedProfile.mockResolvedValue(cached)
    renderScreen()
    await waitFor(() => expect(componentState['contactProfileData']).toEqual(cached))
  })

  it('does not set contactProfileData when cache is null', async () => {
    renderScreen()
    await waitFor(() => expect(mockGetCachedProfile).toHaveBeenCalled())
    await act(async () => {})
    expect(componentState['contactProfileData']).toBeUndefined()
  })
})

describe('profile load — server refresh', () => {
  it('populates display-name from server when cache is empty', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return buildChain({ data: { display_name: 'Server Jane', username: 'sj', bio: '', is_online: false } })
      }
      return buildChain({ data: [] })
    })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('display-name').textContent).toBe('Server Jane'))
  })

  it('server data overwrites stale cache', async () => {
    mockGetCachedProfile.mockResolvedValue({ display_name: 'Old', username: 'old', bio: '', is_online: false })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return buildChain({ data: { display_name: 'Fresh', username: 'fresh', bio: 'New bio', is_online: true } })
      }
      return buildChain({ data: [] })
    })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('display-name').textContent).toBe('Fresh'))
    expect(screen.getByTestId('bio').textContent).toBe('New bio')
  })

  it('calls cacheProfile with server data to persist locally', async () => {
    const server = { id: 'user-contact', display_name: 'Fresh', username: 'fresh', bio: '' }
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return buildChain({ data: server })
      return buildChain({ data: [] })
    })
    renderScreen()
    await waitFor(() => expect(mockCacheProfile).toHaveBeenCalledWith('user-contact', server))
  })

  it('does not update state after unmount (race condition safety)', async () => {
    let resolve!: (v: any) => void
    const pending = new Promise(r => { resolve = r })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(), then: (cb: any) => pending.then(cb) }
      }
      return buildChain({ data: [] })
    })
    const { unmount } = renderScreen()
    unmount()
    await act(async () => { resolve({ data: { display_name: 'Ghost' } }) })
    // cleanup sets contactProfileData to null; it must NOT be overwritten with Ghost
    expect(componentState['contactProfileData']).toBeNull()
  })

  it('sets contactProfileData to null when component unmounts (cleanup)', async () => {
    componentState['contactProfileData'] = { display_name: 'Stale' }
    const { unmount } = renderScreen()
    await act(async () => { unmount() })
    expect(componentState['contactProfileData']).toBeNull()
  })
})

describe('profile load — offline / error', () => {
  it('shows cached profile even when server call rejects', async () => {
    mockGetCachedProfile.mockResolvedValue({ display_name: 'Offline Jane', username: 'offline', bio: '', is_online: false })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(), then: (_: any, rej: any) => Promise.reject(new Error('offline')).catch(rej ?? (() => {})) }
      }
      return buildChain({ data: [] })
    })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('display-name').textContent).toBe('Offline Jane'))
  })
})

describe('mutual communities — local SQLite', () => {
  it('shows intersection count from local cache', async () => {
    mockGetCachedCommunityList.mockResolvedValue([{ id: 'c1', name: 'Dev' }, { id: 'c2', name: 'Gaming' }])
    mockGetCachedCommunityIdsForMember.mockResolvedValue(['c1', 'c99'])
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('mutual-count').textContent).toBe('1'))
  })

  it('shows 0 when no overlap exists', async () => {
    mockGetCachedCommunityList.mockResolvedValue([{ id: 'c1' }])
    mockGetCachedCommunityIdsForMember.mockResolvedValue(['c99'])
    renderScreen()
    await waitFor(() => expect(mockGetCachedCommunityIdsForMember).toHaveBeenCalled())
    expect(screen.getByTestId('mutual-count').textContent).toBe('0')
  })

  it('treats null community list as empty (no crash)', async () => {
    mockGetCachedCommunityList.mockResolvedValue(null)
    mockGetCachedCommunityIdsForMember.mockResolvedValue(['c1'])
    renderScreen()
    await waitFor(() => expect(mockGetCachedCommunityList).toHaveBeenCalled())
    expect(screen.getByTestId('mutual-count').textContent).toBe('0')
  })

  it('sets contactMutualCommunities in componentState', async () => {
    mockGetCachedCommunityList.mockResolvedValue([{ id: 'shared', name: 'Shared' }])
    mockGetCachedCommunityIdsForMember.mockResolvedValue(['shared'])
    renderScreen()
    await waitFor(() => {
      expect(componentState['contactMutualCommunities']).toHaveLength(1)
      expect(componentState['contactMutualCommunities'][0].name).toBe('Shared')
    })
  })

  it('resets contactMutualCommunities to [] on unmount', async () => {
    componentState['contactMutualCommunities'] = [{ id: 'c1' }]
    const { unmount } = renderScreen()
    await act(async () => { unmount() })
    expect(componentState['contactMutualCommunities']).toEqual([])
  })

  it('skips effect when currentUserId is absent', async () => {
    mockCurrentUserId.value = null
    renderScreen()
    await act(async () => {})
    expect(mockGetCachedCommunityList).not.toHaveBeenCalled()
  })
})

describe('mutual communities — server refresh', () => {
  it('updates from server when local cache is empty', async () => {
    mockGetCachedCommunityList.mockResolvedValue(null)
    mockGetCachedCommunityIdsForMember.mockResolvedValue([])
    const theirData = [{ community_id: 'c1', communities: { id: 'c1', name: 'Server Comm', avatar_url: null, type: 'public' } }]
    const myData = [{ community_id: 'c1' }]
    let callNo = 0
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return buildChain({ data: null })
      if (table === 'community_members') { callNo++; return buildChain({ data: callNo === 1 ? theirData : myData }) }
      return buildChain({ data: [] })
    })
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('mutual-count').textContent).toBe('1'))
  })
})

describe('userId prop change', () => {
  it('re-fetches profile when userId changes', async () => {
    const { rerender } = renderScreen({ userId: 'user-A' })
    await waitFor(() => expect(mockGetCachedProfile).toHaveBeenCalledWith('user-A'))
    mockGetCachedProfile.mockClear()
    rerender(<ContactProfileScreen {...DEFAULTS} userId="user-B" />)
    await waitFor(() => expect(mockGetCachedProfile).toHaveBeenCalledWith('user-B'))
  })

  it('clears contactProfileData when userId changes', async () => {
    componentState['contactProfileData'] = { display_name: 'Old' }
    const { rerender } = renderScreen({ userId: 'user-A' })
    rerender(<ContactProfileScreen {...DEFAULTS} userId="user-B" />)
    await waitFor(() => expect(componentState['contactProfileData']).toBeNull())
  })
})

// ── Block sheet ───────────────────────────────────────────────────────────────

describe('block sheet', () => {
  it('is hidden on initial render', async () => {
    renderScreen()
    expect(screen.queryByText(/Block Jane Doe\?/)).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('opens when onBlockClick fires', async () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    expect(screen.getByText('Block Jane Doe?')).toBeInTheDocument()
    await act(async () => {})
  })

  it('uses the correct contact name in the sheet', async () => {
    renderScreen({ displayName: 'John Smith' })
    fireEvent.click(screen.getByTestId('block-btn'))
    expect(screen.getByText('Block John Smith?')).toBeInTheDocument()
    await act(async () => {})
  })

  it('falls back to "this person" when displayName is not available', async () => {
    renderScreen({ displayName: undefined })
    fireEvent.click(screen.getByTestId('block-btn'))
    expect(screen.getByText(/Block this person\?/i)).toBeInTheDocument()
    await act(async () => {})
  })

  it('closes when Cancel is clicked', async () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(within(screen.getByText('Block Jane Doe?').parentElement!).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText('Block Jane Doe?')).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('closes when overlay background is clicked (outside card)', async () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    const overlay = getBlockOverlay()
    fireEvent.click(overlay)
    expect(screen.queryByText('Block Jane Doe?')).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('does NOT close when clicking inside the card', async () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    const card = screen.getByText('Block Jane Doe?').parentElement!
    fireEvent.click(card)
    expect(screen.getByText('Block Jane Doe?')).toBeInTheDocument()
    await act(async () => {})
  })

  it('alsoReport checkbox starts unchecked', async () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    await act(async () => {})
  })

  it('alsoReport checkbox can be toggled', async () => {
    const user = userEvent.setup()
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    await user.click(screen.getByRole('checkbox'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    await act(async () => {})
  })

  it('resets alsoReport to false when sheet is reopened', async () => {
    const user = userEvent.setup()
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    await user.click(screen.getByRole('checkbox'))
    fireEvent.click(within(screen.getByText('Block Jane Doe?').parentElement!).getByRole('button', { name: /cancel/i }))
    fireEvent.click(screen.getByTestId('block-btn'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    await act(async () => {})
  })

  it('calls blocks.insert with correct ids', async () => {
    const blockInsert = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: blockInsert }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    await waitFor(() => expect(blockInsert).toHaveBeenCalledWith({ blocker_id: 'user-me', blocked_id: 'user-contact' }))
  })

  it('also inserts a report when alsoReport is checked', async () => {
    const blockInsert = vi.fn().mockResolvedValue({ error: null })
    const reportInsert = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: blockInsert }
      if (table === 'reports') return { insert: reportInsert }
      return buildChain({ data: null })
    })
    const user = userEvent.setup()
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    await user.click(screen.getByRole('checkbox'))
    fireEvent.click(getBlockConfirmButton())
    await waitFor(() => expect(reportInsert).toHaveBeenCalledWith({ reporter_id: 'user-me', reported_id: 'user-contact', reason: 'Blocked user' }))
  })

  it('does NOT insert a report when alsoReport is unchecked', async () => {
    const blockInsert = vi.fn().mockResolvedValue({ error: null })
    const reportInsert = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: blockInsert }
      if (table === 'reports') return { insert: reportInsert }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    await waitFor(() => expect(blockInsert).toHaveBeenCalled())
    expect(reportInsert).not.toHaveBeenCalled()
  })

  it('shows ✓ Blocked toast on success', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    await waitFor(() => expect(screen.getByText('✓ Blocked')).toBeInTheDocument())
  })

  it('calls onBlocked 1 s after the success toast', async () => {
    vi.useFakeTimers()
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return buildChain({ data: null })
    })
    const onBlocked = vi.fn()
    renderScreen({ onBlocked })
    // Open the sheet, then confirm — runAllTimersAsync flushes the insert Promise
    // AND advances past the 1000 ms onBlocked setTimeout in one shot.
    act(() => { fireEvent.click(screen.getByTestId('block-btn')) })
    await act(async () => {
      fireEvent.click(getBlockConfirmButton())
      await vi.runAllTimersAsync()
    })
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })

  it('falls back to onBack when onBlocked is not provided', async () => {
    vi.useFakeTimers()
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return buildChain({ data: null })
    })
    const onBack = vi.fn()
    render(<ContactProfileScreen userId="user-contact" displayName="Jane" username="jane" onBack={onBack} />)
    act(() => { fireEvent.click(screen.getByTestId('block-btn')) })
    await act(async () => {
      fireEvent.click(getBlockConfirmButton())
      await vi.runAllTimersAsync()
    })
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows error toast and keeps sheet open on block failure', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    await waitFor(() => expect(screen.getByText('Failed to block. Please try again.')).toBeInTheDocument())
    expect(screen.getByText('Block Jane Doe?')).toBeInTheDocument()
  })

  it('error toast auto-dismisses after 2600 ms', async () => {
    vi.useFakeTimers()
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockResolvedValue({ error: { message: 'err' } }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))

    await act(async () => {
      fireEvent.click(getBlockConfirmButton())
      await Promise.resolve()
    })

    expect(screen.getByText('Failed to block. Please try again.')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2700) })
    expect(screen.queryByText('Failed to block. Please try again.')).not.toBeInTheDocument()
  })

  it('shows busy indicator (…) while request is in-flight', async () => {
    let resolve!: (v: any) => void
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockReturnValue(new Promise(r => { resolve = r })) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    expect(screen.getByRole('button', { name: '…' })).toBeInTheDocument()
    await act(async () => { resolve({ error: null }) })
  })

  it('Cancel button is disabled while block is in-flight', async () => {
    let resolve!: (v: any) => void
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockReturnValue(new Promise(r => { resolve = r })) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    const cancelBtn = within(screen.getByText('Block Jane Doe?').parentElement!).getByRole('button', { name: /cancel/i })
    expect(cancelBtn).toBeDisabled()
    await act(async () => { resolve({ error: null }) })
  })

  it('overlay click does NOT close sheet while busy', async () => {
    let resolve!: (v: any) => void
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockReturnValue(new Promise(r => { resolve = r })) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    fireEvent.click(getBlockOverlay())
    expect(screen.getByText('Block Jane Doe?')).toBeInTheDocument()
    await act(async () => { resolve({ error: null }) })
  })
})

// ── Report sheet ──────────────────────────────────────────────────────────────

describe('report sheet', () => {
  it('is hidden on initial render', async () => {
    renderScreen()
    expect(screen.queryByText('Report account')).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('opens when onReportClick fires', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    expect(screen.getByText('Report account')).toBeInTheDocument()
  })

  it('shows all 5 reason buttons', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    ;['Spam or scam', 'Harassment or bullying', 'Inappropriate content', 'Pretending to be someone', 'Something else']
      .forEach(r => expect(screen.getByText(r)).toBeInTheDocument())
  })

  it('closes when Cancel is clicked', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText('Report account')).not.toBeInTheDocument()
  })

  it('closes on overlay click', () => {
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    const reportCard = screen.getByText('Report account').parentElement!
    const reportOverlay = reportCard.parentElement!
    fireEvent.click(reportOverlay)
    expect(screen.queryByText('Report account')).not.toBeInTheDocument()
  })

  const REASONS = ['Spam or scam', 'Harassment or bullying', 'Inappropriate content', 'Pretending to be someone', 'Something else']
  REASONS.forEach(reason => {
    it(`submits report with reason: "${reason}"`, async () => {
      const reportInsert = vi.fn().mockResolvedValue({ error: null })
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'reports') return { insert: reportInsert }
        return buildChain({ data: null })
      })
      renderScreen()
      fireEvent.click(screen.getByTestId('report-btn'))
      fireEvent.click(screen.getByText(reason))
      await waitFor(() => expect(reportInsert).toHaveBeenCalledWith({ reporter_id: 'user-me', reported_id: 'user-contact', reason }))
    })
  })

  it('shows success toast after report', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'reports') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    fireEvent.click(screen.getByText('Spam or scam'))
    await waitFor(() => expect(screen.getByText('Thanks — our team will review this.')).toBeInTheDocument())
  })

  it('shows error toast when report fails', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'reports') return { insert: vi.fn().mockResolvedValue({ error: { message: 'fail' } }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    fireEvent.click(screen.getByText('Spam or scam'))
    await waitFor(() => expect(screen.getByText('Failed to submit report. Please try again.')).toBeInTheDocument())
  })

  it('closes sheet after submission (success)', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'reports') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    fireEvent.click(screen.getByText('Spam or scam'))
    await waitFor(() => expect(screen.queryByText('Report account')).not.toBeInTheDocument())
  })

  it('closes sheet after submission (failure)', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'reports') return { insert: vi.fn().mockResolvedValue({ error: { message: 'fail' } }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))
    fireEvent.click(screen.getByText('Spam or scam'))
    await waitFor(() => expect(screen.queryByText('Report account')).not.toBeInTheDocument())
  })

  it('success toast auto-dismisses after 2600 ms', async () => {
    vi.useFakeTimers()
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'reports') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('report-btn'))

    await act(async () => {
      fireEvent.click(screen.getByText('Spam or scam'))
      await Promise.resolve()
    })

    expect(screen.getByText('Thanks — our team will review this.')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2700) })
    expect(screen.queryByText('Thanks — our team will review this.')).not.toBeInTheDocument()
  })
})

// ── Navigation callbacks ──────────────────────────────────────────────────────

describe('navigation callbacks', () => {
  it('onBack fires when go-back is clicked', async () => {
    const onBack = vi.fn()
    renderScreen({ onBack })
    fireEvent.click(screen.getByTestId('go-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    await act(async () => {})
  })

  it('onStartChat fires when start-chat is clicked', async () => {
    const onStartChat = vi.fn()
    renderScreen({ onStartChat })
    fireEvent.click(screen.getByTestId('start-chat'))
    expect(onStartChat).toHaveBeenCalledTimes(1)
    await act(async () => {})
  })

  it('onOpenCommunity is called with correct args', async () => {
    const onOpenCommunity = vi.fn()
    renderScreen({ onOpenCommunity })
    fireEvent.click(screen.getByTestId('open-community'))
    expect(onOpenCommunity).toHaveBeenCalledWith('cid', 'CommunityName', 'public', 12, null)
    await act(async () => {})
  })

  it('start-chat click with null onStartChat does not throw', async () => {
    render(<ContactProfileScreen userId="u" displayName="J" username="j" onBack={vi.fn()} />)
    expect(() => fireEvent.click(screen.getByTestId('start-chat'))).not.toThrow()
    await act(async () => {})
  })
})

// ── Toast lifecycle ───────────────────────────────────────────────────────────

describe('toast lifecycle', () => {
  it('no toast visible on initial mount', async () => {
    renderScreen()
    expect(screen.queryByText('✓ Blocked')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed to block. Please try again.')).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('only one toast is shown at a time', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'blocks') return { insert: vi.fn().mockResolvedValue({ error: { message: 'err' } }) }
      return buildChain({ data: null })
    })
    renderScreen()
    fireEvent.click(screen.getByTestId('block-btn'))
    fireEvent.click(getBlockConfirmButton())
    await waitFor(() => screen.getByText('Failed to block. Please try again.'))
    // Only one toast container
    const toasts = screen.getAllByText(/Failed to block|✓ Blocked|Thanks/)
    expect(toasts).toHaveLength(1)
  })
})

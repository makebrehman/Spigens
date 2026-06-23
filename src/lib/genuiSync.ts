import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'
import type { GenUIVersion } from '@/stores/uiStore'

// Cross-device persistence for GenUI customizations.
// Server (Supabase) is the source of truth: loaded on login, saved on every change.
// This is platform-agnostic and runs identically inside the mobile WebView.

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Pull the user's saved state + version timeline from the server and apply it.
export async function loadGenUIFromServer(userId: string): Promise<boolean> {
  try {
    const [stateRes, versionsRes] = await Promise.all([
      supabase.from('genui_states').select('snapshot').eq('user_id', userId).maybeSingle(),
      supabase
        .from('genui_versions')
        .select('id, name, snapshot, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ])

    const versions: GenUIVersion[] = (versionsRes.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      snapshot: r.snapshot,
    }))

    const snapshot = (stateRes.data as any)?.snapshot ?? null
    useUIStore.getState().hydrateFromServer(snapshot, versions)
    return true
  } catch (err) {
    console.error('GenUI load from server failed:', err)
    return false
  }
}

// Debounced upsert of the current customization state (the "live" snapshot).
export function saveGenUIToServer(userId: string): void {
  if (!userId) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      const snapshot = useUIStore.getState().getSnapshot()
      await supabase
        .from('genui_states')
        .upsert(
          { user_id: userId, snapshot, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
    } catch (err) {
      console.error('GenUI save to server failed:', err)
    }
  }, 800)
}

// Persist a single new version (append-only). Caps server history at 100 per user.
export async function saveVersionToServer(userId: string, version: GenUIVersion): Promise<void> {
  if (!userId) return
  try {
    await supabase.from('genui_versions').insert({
      id: version.id,
      user_id: userId,
      name: version.name,
      snapshot: version.snapshot,
      created_at: version.createdAt,
    })

    // Bound storage: keep newest 100, delete anything older.
    const { data: extra } = await supabase
      .from('genui_versions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(100, 1000)
    if (extra && extra.length) {
      await supabase.from('genui_versions').delete().in('id', extra.map((r: any) => r.id))
    }
  } catch (err) {
    console.error('GenUI version save failed:', err)
  }
}

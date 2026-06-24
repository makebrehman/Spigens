// Supabase Edge Function: fan out a new message to recipients' FCM device tokens.
//
// Triggered by a Postgres AFTER INSERT webhook on `messages` and
// `community_messages` (see db/push_triggers.sql). For each new message it finds
// the recipients, looks up their rows in `device_tokens`, and sends an FCM
// HTTP v1 notification.
//
// SECRETS (set via `supabase secrets set ...`, never committed):
//   FCM_SERVICE_ACCOUNT  — the full Firebase service-account JSON (one line)
//   PUSH_WEBHOOK_SECRET  — shared secret the DB trigger sends in x-push-secret
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

interface ServiceAccount {
  project_id: string
  private_key: string
  client_email: string
  token_uri: string
}

// ── Google OAuth token (cached in-memory across invocations) ─────────────────
let cachedToken: { value: string; exp: number } | null = null

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claims}`

  const key = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error('FCM token exchange failed: ' + JSON.stringify(json))
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) }
  return cachedToken.value
}

// ── FCM send ─────────────────────────────────────────────────────────────────
async function sendToToken(
  projectId: string, accessToken: string, token: string,
  title: string, body: string, data: Record<string, string>,
): Promise<{ ok: boolean; remove?: boolean }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: { priority: 'HIGH', notification: { channel_id: 'messages' } },
      },
    }),
  })
  if (res.ok) return { ok: true }
  const err = await res.text()
  // Token no longer valid → caller should delete it.
  const remove = res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(err)
  console.error('FCM send failed', res.status, err)
  return { ok: false, remove }
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (secret && req.headers.get('x-push-secret') !== secret) {
      return new Response('forbidden', { status: 403 })
    }

    const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}') as ServiceAccount
    if (!sa.project_id) return new Response('FCM_SERVICE_ACCOUNT not set', { status: 500 })

    const { table, record } = await req.json()
    if (!record) return new Response('no record', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve recipient user ids + the notification text.
    let recipientIds: string[] = []
    let title = 'Spigens'
    let body = 'New message'
    const data: Record<string, string> = {}

    const senderId = record.sender_id as string
    const { data: sender } = await supabase
      .from('profiles').select('display_name, username').eq('id', senderId).maybeSingle()
    const senderName = sender?.display_name || sender?.username || 'Someone'

    if (table === 'messages') {
      // DM: the other participant(s) of the conversation. Content is E2E encrypted,
      // so the body stays generic on purpose.
      const { data: parts } = await supabase
        .from('conversation_participants').select('user_id')
        .eq('conversation_id', record.conversation_id).neq('user_id', senderId)
      recipientIds = (parts ?? []).map((p: any) => p.user_id)
      title = senderName
      body = 'New message'
      data.type = 'dm'
      data.conversationId = String(record.conversation_id ?? '')
      data.senderId = String(senderId ?? '')
    } else if (table === 'community_messages') {
      const { data: members } = await supabase
        .from('community_members').select('user_id')
        .eq('community_id', record.community_id).eq('status', 'active').neq('user_id', senderId)
      recipientIds = (members ?? []).map((m: any) => m.user_id)
      const { data: comm } = await supabase
        .from('communities').select('name').eq('id', record.community_id).maybeSingle()
      title = comm?.name || 'Community'
      const text = String(record.content ?? '')
      body = `${senderName}: ${text.length > 80 ? text.slice(0, 77) + '…' : text}`
      data.type = 'community'
      data.communityId = String(record.community_id ?? '')
    } else {
      return new Response('unhandled table', { status: 200 })
    }

    if (!recipientIds.length) return new Response('no recipients', { status: 200 })

    const { data: tokenRows } = await supabase
      .from('device_tokens').select('token').in('user_id', recipientIds)
    const tokens = (tokenRows ?? []).map((t: any) => t.token as string)
    if (!tokens.length) return new Response('no tokens', { status: 200 })

    const accessToken = await getAccessToken(sa)
    const stale: string[] = []
    await Promise.all(tokens.map(async (tok) => {
      const r = await sendToToken(sa.project_id, accessToken, tok, title, body, data)
      if (r.remove) stale.push(tok)
    }))
    if (stale.length) await supabase.from('device_tokens').delete().in('token', stale)

    return new Response(JSON.stringify({ sent: tokens.length - stale.length, pruned: stale.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('push-fanout error', e)
    return new Response('error: ' + (e instanceof Error ? e.message : String(e)), { status: 500 })
  }
})

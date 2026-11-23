// Companion-backend client. Every call is optional: if the backend
// (server/) is not running, the call fails fast and the app falls back
// to demo data / the local draft engine. No secrets ever live in the app.
import type { DemoChat } from './demoData'

export interface InboxResult {
  demo: boolean
  chats: DemoChat[]
}

export interface SendResult {
  ok: boolean
  demo: boolean
  note?: string
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

export async function fetchInbox(): Promise<InboxResult | null> {
  try {
    const res = await withTimeout(fetch('/api/telegram/inbox'), 2500)
    if (!res.ok) return null
    return (await res.json()) as InboxResult
  } catch {
    return null
  }
}

export async function sendReply(chatId: string, text: string): Promise<SendResult> {
  try {
    const res = await withTimeout(
      fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId, text }),
      }),
      4000,
    )
    if (!res.ok) return { ok: false, demo: true, note: `backend ${res.status}` }
    return (await res.json()) as SendResult
  } catch {
    // No backend: record the reply locally as a demo send.
    return { ok: true, demo: true, note: 'demo outbox (no backend)' }
  }
}

export async function fetchDrafts(message: string, sender: string): Promise<string[] | null> {
  try {
    const res = await withTimeout(
      fetch('/api/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, sender }),
      }),
      3000,
    )
    if (!res.ok) return null
    const j = await res.json()
    return Array.isArray(j.drafts) && j.drafts.length > 0 ? j.drafts : null
  } catch {
    return null
  }
}

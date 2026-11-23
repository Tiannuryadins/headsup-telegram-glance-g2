// Telegram Glance — companion backend (optional, no dependencies).
// The G2 app works without it (demo inbox + local draft engine + live
// CoinGecko prices fetched directly by the app). With it, the app talks
// to a real Telegram bot, real LLM drafts and real speech-to-text.
//
// Env (all optional):
//   TELEGRAM_BOT_TOKEN   BotFather token for a bot added to your chats
//   OPENROUTER_API_KEY   + OPENROUTER_MODEL (e.g. a free model) for LLM drafts
//   OPENAI_API_KEY       for Whisper speech-to-text (/api/stt)
//   PORT                 default 3001
//
// Never commit tokens. Never ship them in the app — they stay here.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3001)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? ''
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? ''

const demoInbox = JSON.parse(readFileSync(join(__dirname, 'demo-inbox.json'), 'utf8'))
const outbox = []

function json(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// Local draft engine (mirrors src/drafts.ts) — used when no LLM key set.
function localDrafts(message) {
  const msg = String(message ?? '').toLowerCase()
  if (/\burgent\b|asap|right now/.test(msg)) return ['On it now.', 'Looking into it right away.', 'Give me 5 minutes.']
  if (msg.includes('?')) {
    if (/\b(ship|send|push|deploy|release|merge)\b/.test(msg)) return ['Yes — shipping tonight.', 'Almost — 10 more minutes.', 'Let me check the build first.']
    if (/\b(price|btc|eth|sol|market)\b/.test(msg)) return ['Watching it — will update you.', 'Looks strong, holding for now.', 'Let me check the chart.']
    return ['Yes, that works.', 'Let me check and get back to you.', 'Not yet — I will update you soon.']
  }
  if (/\bthank|thanks\b/.test(msg)) return ['You are welcome!', 'Anytime!', 'Happy to help.']
  return ['Got it, thanks!', 'Sounds good.', 'I will take a look.']
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        telegram: Boolean(BOT_TOKEN),
        openrouter: Boolean(OPENROUTER_KEY),
        stt: Boolean(OPENAI_KEY),
        demoOutbox: outbox.length,
      })
    }

    if (req.method === 'GET' && url.pathname === '/api/telegram/inbox') {
      if (!BOT_TOKEN) return json(res, 200, { demo: true, chats: demoInbox.chats })
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=5`)
      const data = await r.json()
      const byChat = new Map()
      for (const u of data.result ?? []) {
        const m = u.message
        if (!m) continue
        const id = String(m.chat.id)
        if (!byChat.has(id)) {
          byChat.set(id, { id, name: m.chat.title ?? m.chat.first_name ?? 'Chat', unread: 0, messages: [] })
        }
        const chat = byChat.get(id)
        chat.messages.push({
          from: m.from?.first_name ?? 'Them',
          text: m.text ?? '(non-text message)',
          time: new Date((m.date ?? 0) * 1000).toTimeString().slice(0, 5),
        })
        chat.unread += 1
      }
      return json(res, 200, { demo: false, chats: [...byChat.values()] })
    }

    if (req.method === 'POST' && url.pathname === '/api/telegram/send') {
      const body = await readBody(req)
      if (!BOT_TOKEN) {
        outbox.push({ chatId: body.chatId, text: body.text, at: new Date().toISOString() })
        return json(res, 200, { ok: true, demo: true, note: 'demo outbox (no bot token)' })
      }
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: body.chatId, text: body.text }),
      })
      const data = await r.json()
      return json(res, r.ok ? 200 : 502, { ok: data.ok === true, demo: false, note: data.ok ? undefined : 'Telegram rejected the send' })
    }

    if (req.method === 'POST' && url.pathname === '/api/draft') {
      const body = await readBody(req)
      if (OPENROUTER_KEY && OPENROUTER_MODEL) {
        try {
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENROUTER_KEY}` },
            body: JSON.stringify({
              model: OPENROUTER_MODEL,
              messages: [
                { role: 'system', content: 'Draft 3 short chat replies (max 8 words each), one per line, no numbering, no quotes.' },
                { role: 'user', content: `Message from ${body.sender ?? 'someone'}: ${body.message ?? ''}` },
              ],
            }),
          })
          const data = await r.json()
          const text = data.choices?.[0]?.message?.content ?? ''
          const drafts = text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3)
          if (drafts.length) return json(res, 200, { drafts, source: 'openrouter' })
        } catch {
          // fall through to local engine
        }
      }
      return json(res, 200, { drafts: localDrafts(body.message), source: 'local' })
    }

    if (req.method === 'POST' && url.pathname === '/api/stt') {
      if (!OPENAI_KEY) return json(res, 501, { error: 'STT not configured — set OPENAI_API_KEY' })
      const chunks = []
      for await (const c of req) chunks.push(c)
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${OPENAI_KEY}`, 'content-type': req.headers['content-type'] ?? 'multipart/form-data' },
        body: Buffer.concat(chunks),
      })
      const data = await r.json()
      return json(res, r.ok ? 200 : 502, { text: data.text ?? '' })
    }

    return json(res, 404, { error: 'not found' })
  } catch (e) {
    return json(res, 500, { error: String(e?.message ?? e) })
  }
})

server.listen(PORT, () => {
  console.log(`Telegram Glance backend on http://localhost:${PORT}`)
  console.log(`  telegram: ${BOT_TOKEN ? 'live' : 'demo'} · drafts: ${OPENROUTER_KEY ? 'openrouter' : 'local'} · stt: ${OPENAI_KEY ? 'whisper' : 'not configured'}`)
})

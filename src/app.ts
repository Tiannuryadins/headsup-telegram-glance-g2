// Telegram Glance — app state machine.
// One full-screen text container (576x288, ~10 lines). Every screen is
// plain text so it stays readable on the monochrome green display.
// Input (glasses / ring / simulator / browser preview):
//   tap         cycle selection / next action
//   double-tap  confirm / open / send (on Home: exit)
//   swipe up    back        swipe down  forward / voice
// Voice: on the voice screen, tap starts/stops mic capture; the
// transcript comes from the backend STT (or typed input in preview mode).

import { DEMO_CHATS, type DemoChat } from './demoData'
import { draftReplies } from './drafts'
import { fetchPrices, formatPrice, type Price } from './prices'
import { fetchDrafts, fetchInbox, sendReply } from './telegram'

export type Screen = 'home' | 'chat' | 'draft' | 'voice' | 'crypto' | 'sent'
export type InputEvent = 'tap' | 'doubletap' | 'swipeUp' | 'swipeDown' | 'longpress' | 'longpressRelease'

const MAX_LINE = 44 // chars per line at 576px, 27px line height

// The G2 firmware font is a single fixed font: keep glasses text ASCII.
// Real Telegram messages can contain anything, so sanitize on render:
// map common punctuation to ASCII, drop the rest.
const GLASSES_MAP: Record<string, string> = {
  '—': '-',
  '–': '-',
  '…': '...',
  '·': '-',
  '•': '-',
  '●': '*',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '«': '"',
  '»': '"',
  '→': '>',
  '←': '<',
  '✓': 'v',
  '×': 'x',
}

export function toGlassesText(s: string): string {
  return [...s]
    .map((ch) => {
      if (ch.charCodeAt(0) < 128) return ch
      return GLASSES_MAP[ch] ?? ''
    })
    .join('')
}

function clampLines(text: string): string {
  return toGlassesText(text)
    .split('\n')
    .map((l) => (l.length > MAX_LINE ? l.slice(0, MAX_LINE - 1) + '...' : l))
    .slice(0, 10)
    .join('\n')
}

export class GlanceApp {
  onRender: (text: string) => void = () => {}
  onMic: (recording: boolean) => void = () => {}

  screen: Screen = 'home'
  chats: DemoChat[] = DEMO_CHATS
  demoMode = true
  prices: Price[] = []
  pricesState: 'loading' | 'live' | 'offline' = 'loading'
  selChat = 0
  selDraft = 0
  drafts: string[] = []
  sentText = ''
  sentChat = ''
  recording = false
  voiceTranscript = ''
  voiceNote = ''
  lastSendNote = ''

  async init(): Promise<void> {
    void this.loadInbox()
    void this.loadPrices()
    this.render()
  }

  private async loadInbox(): Promise<void> {
    const inbox = await fetchInbox()
    if (inbox && inbox.chats.length > 0) {
      this.chats = inbox.chats
      this.demoMode = inbox.demo
      this.render()
    }
  }

  async loadPrices(): Promise<void> {
    try {
      this.prices = await fetchPrices()
      this.pricesState = 'live'
    } catch {
      this.pricesState = this.prices.length > 0 ? 'live' : 'offline'
    }
    this.render()
  }

  get currentChat(): DemoChat {
    return this.chats[this.selChat] ?? this.chats[0]
  }

  get lastIncoming(): { from: string; text: string } {
    const msgs = this.currentChat.messages
    const incoming = [...msgs].reverse().find((m) => m.from !== 'You')
    return incoming ?? { from: '', text: '' }
  }

  // Drafts answer the last open question when there is one — a question
  // ("Ship it tonight?") matters more than the latest statement.
  get draftTarget(): { from: string; text: string } {
    const msgs = this.currentChat.messages
    const question = [...msgs]
      .reverse()
      .find((m) => m.from !== 'You' && m.text.includes('?'))
    return question ?? this.lastIncoming
  }

  async openChat(): Promise<void> {
    this.screen = 'chat'
    this.selDraft = 0
    this.drafts = draftReplies(this.draftTarget.text, this.draftTarget.from)
    this.render()
    const better = await fetchDrafts(this.draftTarget.text, this.draftTarget.from)
    if (better && this.screen === 'chat') {
      this.drafts = better
      this.render()
    }
  }

  // ---- rendering -------------------------------------------------------

  private unreadTotal(): number {
    return this.chats.reduce((n, c) => n + c.unread, 0)
  }

  private priceLine(): string {
    if (this.pricesState === 'loading') return 'Prices loading...'
    if (this.pricesState === 'offline') return 'Prices offline'
    // Home fits two coins; the Crypto screen lists all three.
    return this.prices.slice(0, 2).map(formatPrice).join('  ')
  }

  render(): void {
    this.onRender(clampLines(this.screenText()))
  }

  private screenText(): string {
    switch (this.screen) {
      case 'home': {
        const lines = [
          `TELEGRAM GLANCE${this.demoMode ? ' [DEMO]' : ''}`,
          `${this.unreadTotal()} unread - ${this.chats.length} chats`,
          '',
          ...this.chats.map((c, i) => {
            const last = [...c.messages].reverse().find((m) => m.from !== 'You')
            const mark = i === this.selChat ? '> ' : '  '
            return `${mark}${c.name} - ${c.unread}\n    "${last?.text ?? ''}"`
          }),
          '',
          this.priceLine(),
          'Tap next - down: open - up: crypto',
        ]
        return lines.join('\n')
      }
      case 'chat': {
        const c = this.currentChat
        const lines = [
          `${c.name} - ${c.unread} unread`,
          '',
          ...c.messages.slice(-3).map((m) => `${m.from}: ${m.text}`),
          '',
          `AI draft: "${this.drafts[this.selDraft] ?? ''}"`,
          'Tap: next draft - 2x: send',
          'Swipe up: back - down: voice',
        ]
        return lines.join('\n')
      }
      case 'draft': {
        const lines = [
          `Reply to ${this.currentChat.name}:`,
          '',
          ...this.drafts.map((d, i) => `(${i + 1}) ${d}`),
          '',
          'Tap: next - 2x: SEND',
          'Swipe up: back',
        ]
        return lines.join('\n')
      }
      case 'voice': {
        const lines = [
          `Voice reply — ${this.currentChat.name}`,
          '',
          this.recording
            ? 'Recording... release to stop'
            : this.voiceTranscript
              ? `"${this.voiceTranscript}"`
              : 'Hold to talk - tap toggles',
          this.voiceNote,
          '',
          'Hold: record - 2x: SEND',
          'Swipe up: back',
        ].filter((l) => l !== '')
        return lines.join('\n')
      }
      case 'crypto': {
        const lines = [
          `CRYPTO - CoinGecko ${this.pricesState === 'live' ? 'live' : this.pricesState}`,
          '',
          ...(this.prices.length > 0
            ? this.prices.map(formatPrice)
            : ['No prices yet — check network']),
          '',
          'Read-only - no trading',
          'Tap: refresh - swipe down: back',
        ]
        return lines.join('\n')
      }
      case 'sent': {
        const lines = [
          `Sent to ${this.sentChat}`,
          `"${this.sentText}"`,
          '',
          this.lastSendNote,
          '',
          'Tap: back home',
        ].filter((l) => l !== '')
        return lines.join('\n')
      }
    }
  }

  // ---- input -----------------------------------------------------------

  async handle(ev: InputEvent): Promise<void> {
    switch (this.screen) {
      case 'home':
        if (ev === 'tap') {
          this.selChat = (this.selChat + 1) % this.chats.length
          this.render()
        } else if (ev === 'swipeDown') {
          // Double-tap on Home is reserved for exit (Even Hub QA rule),
          // so swipe down opens the selected chat.
          await this.openChat()
        } else if (ev === 'swipeUp') {
          this.screen = 'crypto'
          this.render()
        }
        break
      case 'chat':
        if (ev === 'tap') {
          this.selDraft = (this.selDraft + 1) % Math.max(this.drafts.length, 1)
          this.render()
        } else if (ev === 'doubletap') {
          this.screen = 'draft'
          this.render()
        } else if (ev === 'swipeUp') {
          this.screen = 'home'
          this.render()
        } else if (ev === 'swipeDown') {
          this.screen = 'voice'
          this.voiceNote = ''
          this.render()
        }
        break
      case 'draft':
        if (ev === 'tap') {
          this.selDraft = (this.selDraft + 1) % Math.max(this.drafts.length, 1)
          this.render()
        } else if (ev === 'doubletap') {
          await this.send(this.drafts[this.selDraft] ?? '')
        } else if (ev === 'swipeUp') {
          this.screen = 'chat'
          this.render()
        }
        break
      case 'voice':
        if (ev === 'tap') {
          await this.toggleRecording()
        } else if (ev === 'longpress') {
          await this.startRecording()
        } else if (ev === 'longpressRelease') {
          await this.stopRecording()
        } else if (ev === 'doubletap') {
          if (this.voiceTranscript) await this.send(this.voiceTranscript)
        } else if (ev === 'swipeUp') {
          if (this.recording) await this.toggleRecording()
          this.screen = 'chat'
          this.render()
        }
        break
      case 'crypto':
        if (ev === 'tap') {
          this.pricesState = 'loading'
          this.render()
          await this.loadPrices()
        } else if (ev === 'swipeDown' || ev === 'doubletap') {
          this.screen = 'home'
          this.render()
        }
        break
      case 'sent':
        if (ev === 'tap' || ev === 'doubletap' || ev === 'swipeUp') {
          this.screen = 'home'
          this.render()
        }
        break
    }
  }

  /** True when a double-tap on Home should exit the app (root page rule). */
  shouldExitOnHomeDoubleTap(): boolean {
    return this.screen === 'home'
  }

  async startRecording(): Promise<void> {
    if (this.recording) return
    this.recording = true
    this.onMic(true)
    this.render()
  }

  async stopRecording(): Promise<void> {
    if (!this.recording) return
    this.recording = false
    this.onMic(false)
    if (!this.voiceTranscript) {
      this.voiceNote = 'No transcript — STT needs backend'
    }
    this.render()
  }

  async toggleRecording(): Promise<void> {
    if (this.recording) await this.stopRecording()
    else await this.startRecording()
  }

  /** Called by the preview companion page / STT callback with heard text. */
  setVoiceTranscript(text: string): void {
    this.voiceTranscript = text
    if (this.recording) {
      this.recording = false
      this.onMic(false)
    }
    this.voiceNote = ''
    this.render()
  }

  private async send(text: string): Promise<void> {
    if (!text) return
    const chat = this.currentChat
    const res = await sendReply(chat.id, text)
    this.sentText = text
    this.sentChat = chat.name
    this.lastSendNote = res.demo ? '(demo outbox — no backend)' : '(sent via Telegram)'
    chat.messages.push({ from: 'You', text, time: 'now' })
    chat.unread = 0
    this.voiceTranscript = ''
    this.screen = 'sent'
    this.render()
  }
}

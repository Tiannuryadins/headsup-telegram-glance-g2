// Browser preview: renders the 576x288 monochrome green canvas in the
// companion page so the app can be demoed and tested without glasses or
// the simulator (also powers the GitHub Pages demo).
// Controls: click = tap, double-click = double-tap, ArrowUp/Down = swipe,
// "V" focuses the voice-simulation input.
import type { GlanceApp } from './app'

export function runPreview(app: GlanceApp): void {
  const root = document.getElementById('app')
  if (!root) return

  root.innerHTML = `
    <div style="max-width:640px;margin:0 auto;padding:16px;font-family:system-ui,sans-serif">
      <h1 style="font-size:18px;margin:0 0 4px">Telegram Glance — G2 preview</h1>
      <p style="margin:0 0 12px;color:#666;font-size:13px">
        576×288 monochrome green canvas, as seen on Even G2. Click the
        canvas = tap · double-click = confirm · arrow keys = swipe.
      </p>
      <pre id="canvas" style="width:576px;max-width:100%;height:288px;margin:0;
        background:#0a1f0a;color:#7dff7d;font:16px/27px monospace;
        padding:4px 8px;box-sizing:border-box;white-space:pre-wrap;
        overflow:hidden;cursor:pointer;user-select:none">Loading…</pre>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button data-ev="tap">Tap</button>
        <button data-ev="doubletap">Double-tap</button>
        <button data-ev="swipeUp">Swipe ↑</button>
        <button data-ev="swipeDown">Swipe ↓</button>
      </div>
      <div style="margin-top:12px">
        <label style="font-size:13px">Simulate voice input (mic / STT stand-in):</label><br/>
        <input id="voice" type="text" placeholder="e.g. Yes, shipping tonight"
          style="width:320px;max-width:100%;padding:6px;margin-top:4px"/>
        <button id="voiceBtn">Use as voice reply</button>
      </div>
      <p id="status" style="font-size:13px;color:#666"></p>
    </div>`

  const canvas = document.getElementById('canvas')!
  const status = document.getElementById('status')!
  app.onRender = (text) => {
    canvas.textContent = text
  }
  app.onMic = (recording) => {
    status.textContent = recording ? '● Mic open (simulated)' : ''
  }

  const fire = (ev: 'tap' | 'doubletap' | 'swipeUp' | 'swipeDown') => void app.handle(ev)
  canvas.addEventListener('click', () => fire('tap'))
  canvas.addEventListener('dblclick', () => fire('doubletap'))
  document.querySelectorAll<HTMLButtonElement>('[data-ev]').forEach((b) => {
    b.addEventListener('click', () => fire(b.dataset.ev as 'tap' | 'doubletap' | 'swipeUp' | 'swipeDown'))
  })
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowUp') fire('swipeUp')
    if (e.key === 'ArrowDown') fire('swipeDown')
    if (e.key.toLowerCase() === 'v') document.getElementById('voice')?.focus()
  })
  const voiceInput = document.getElementById('voice') as HTMLInputElement
  document.getElementById('voiceBtn')!.addEventListener('click', () => {
    const t = voiceInput.value.trim()
    if (t) {
      app.setVoiceTranscript(t)
      voiceInput.value = ''
    }
  })

  void app.init()
}

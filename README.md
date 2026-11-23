# Telegram Glance — Telegram + crypto prices at a glance on Even G2

Entry for the **Heads Up: Even Realities Hackathon** (DoraHacks, 23–29 Nov 2026).
Built during the hackathon build week, 23 Nov 2026.

- **Track 1 (primary): Messaging & News** — Telegram unread digest, AI-drafted
  replies, voice replies, one-tap send. Targets 1st place per track ($1,250)
  **and** Best Telegram integration ($1,000).
- **Track 2 (secondary): Crypto & DeFi** — live BTC / ETH / SOL prices from
  CoinGecko (read-only) in the same glance flow: the crypto channels you
  follow, plus the prices they talk about.

**Live demo (no glasses needed):** https://tiannuryadins.github.io/headsup-telegram-glance-g2/
— the 576×288 green canvas renders in the browser; click = tap,
double-click = confirm, arrow keys = swipe.

## The problem

On smart glasses you cannot type, scroll a feed, or open your phone every
time Telegram buzzes. You need one glance — who messaged, what matters —
and one gesture to answer. Telegram Glance is that: unread chats, a short
AI-drafted reply, voice reply, and the crypto prices your groups are
talking about, all on the 576×288 monochrome G2 display.

## How it works

Screens (one full-screen text container, tap / double-tap / swipe):

| Screen | What it does |
|---|---|
| Home | Unread chats + last message preview + live BTC/ETH/SOL line |
| Chat | Last messages of the selected chat + current AI draft |
| Draft | 3 AI-drafted replies — tap cycles, double-tap sends |
| Voice | Hold to talk (`LONG_PRESS`, mic via `audioControl`), transcript becomes the reply; tap toggles as fallback |
| Crypto | Live CoinGecko prices + 24h change (read-only) |
| Sent | Confirmation of the sent reply |

Input: tap = next, double-tap = confirm/send (on Home: exit dialog, per
Even Hub QA rule), swipe up = back, swipe down = forward/voice. On Home,
swipe down opens the selected chat (double-tap is reserved for exit).

## Real data, no mocks in the demo path

- **Prices:** live from the CoinGecko public API (no key), fetched directly
  by the app, cached 60 s.
- **Telegram:** real mode via the companion backend (`server/`) which
  proxies the Telegram Bot API with a bot token you own. Without a token
  the app runs on a clearly-labelled **DEMO** inbox so the whole flow is
  still testable in the simulator.
- **Drafts:** a local intent-based draft engine ships in the app; the
  backend upgrades it to a real LLM (OpenRouter) when `OPENROUTER_API_KEY`
  is set.
- **Voice:** mic audio via the SDK (`audioControl`); speech-to-text via
  the backend Whisper endpoint when `OPENAI_API_KEY` is set. In the
  browser preview, typed text stands in for voice.

## Money safety

Read-only prices only. No trading, no orders, no user funds, no financial
advice. Telegram sends go through the user's own bot token on their own
server — no API keys are shipped in the app (the `app.json` network
whitelist only allows `api.coingecko.com` from the app itself).

## Run it

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run simulate     # Even Hub simulator (needs the glasses libs; see below)
npm run build        # tsc + vite build
npm run pack         # build + evenhub pack app.json dist -> .ehpk
```

Backend (optional, real Telegram + LLM drafts + STT):

```bash
TELEGRAM_BOT_TOKEN=... OPENROUTER_API_KEY=... OPENROUTER_MODEL=... \
OPENAI_API_KEY=... npm run server   # http://localhost:3001
```

Get a bot token free from [@BotFather](https://t.me/BotFather) and add the
bot to the chats you want to glance at. No other account is needed.

Simulator: `evenhub-simulator http://localhost:5173`. On a headless Linux
box the simulator needs `libwebkit2gtk-4.1-0` (`sudo apt-get install
libwebkit2gtk-4.1-0`) plus an X server — without them, use the browser
preview at `http://localhost:5173`, which renders the same 576×288 canvas.
Tip: if the simulator shows a solid green canvas with no text, restart it
with `--no-glow` — the glow post-processing fails under software rendering
(verified on this VM: `--no-glow` renders all screens correctly).

## Libraries & APIs used

- `@evenrealities/even_hub_sdk` 0.0.16 — Even Hub bridge (official)
- `@evenrealities/evenhub-cli` / `@evenrealities/evenhub-simulator` — tooling
- Vite + TypeScript (from the official `even-realities/evenhub-templates/minimal` template)
- CoinGecko public API (`/simple/price`) — read-only prices, no key
- Telegram Bot API (`getUpdates`, `sendMessage`) — via the companion backend only
- OpenRouter chat completions (optional, backend only) — LLM drafts
- OpenAI Whisper (optional, backend only) — speech-to-text

## What existed before 23 Nov 2026

Only the official Even Hub `minimal` starter template (Vite + TS + SDK
wiring and the "Hello from G2" counter). All app code — screens, draft
engine, price client, backend, preview mode — was written during the
hackathon build week (23 Nov 2026). No pre-existing app code was reused.

## Submission checklist

- [x] Public repo + README (this file)
- [x] Packaged `.ehpk` build (`out.ehpk`, built with `npm run pack`)
- [ ] Demo video ≤ 3 min (recorded by the builder — see `DEMO-VIDEO-SCRIPT.md`)
- [ ] Submit on DoraHacks before **Mon 30 Nov 2026, 02:59 WIB**
      (Sun 29 Nov 2026, 23:59 Dubai / 19:59 UTC)

## Feature requests for the API teams (max 5)

1. A `getUpdates`-style push channel for Telegram-style inboxes, so apps
   don't have to poll from a backend.
2. More than 8 non-image containers per screen for richer list layouts.
3. A simulator headless/CI mode (screenshot + scripted events) for
   automated testing without a display server.
4. An official free-tier speech-to-text endpoint for hackathon apps, so
   voice replies work without each team bringing Whisper keys.
5. Per-app unread badges on the glasses home screen, so a glanceable app
   can signal "3 unread" before it is even opened.

## License

MIT — see `LICENSE`.

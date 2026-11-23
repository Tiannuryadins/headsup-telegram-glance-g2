// Local AI reply-draft engine (no API key needed).
// Classifies the last incoming message and returns 3 short, glanceable
// drafts. The companion backend (server/) can upgrade this to a real LLM
// via OpenRouter when OPENROUTER_API_KEY is set — the app tries the
// backend first and falls back to this engine.

export function draftReplies(lastMessage: string, sender: string): string[] {
  const msg = lastMessage.toLowerCase()

  if (/\burgent\b|asap|right now|segera/.test(msg)) {
    return ['On it now.', 'Looking into it right away.', 'Give me 5 minutes.']
  }
  if (msg.includes('?')) {
    if (/\b(ship|send|push|deploy|release|merge)\b/.test(msg)) {
      return ['Yes — shipping tonight.', 'Almost — 10 more minutes.', 'Let me check the build first.']
    }
    if (/\b(price|btc|eth|sol|market|pump|dump)\b/.test(msg)) {
      return ['Watching it — will update you.', 'Looks strong, holding for now.', 'Let me check the chart.']
    }
    return ['Yes, that works.', 'Let me check and get back to you.', 'Not yet — I will update you soon.']
  }
  if (/\bthank|thanks|makasih|terima kasih\b/.test(msg)) {
    return ['You are welcome!', 'Anytime!', 'Happy to help.']
  }
  if (/\b(meeting|call|meet|zoom|jam berapa|kapan)\b/.test(msg)) {
    return ['See you then.', 'Works for me.', 'Can we move it 30 min later?']
  }
  if (/\b(good|great|nice|awesome|mantap|keren)\b/.test(msg)) {
    return ['Thanks!', 'Glad it helps.', 'Appreciate it!']
  }
  void sender
  return ['Got it, thanks!', 'Sounds good.', 'I will take a look.']
}

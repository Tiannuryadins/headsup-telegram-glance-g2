// Demo Telegram inbox used when no companion backend is configured.
// Clearly labelled DEMO in the UI and README — real mode talks to the
// backend (server/) which proxies the Telegram Bot API with a user token.
export interface DemoMessage {
  from: string
  text: string
  time: string
}

export interface DemoChat {
  id: string
  name: string
  unread: number
  messages: DemoMessage[]
}

export const DEMO_CHATS: DemoChat[] = [
  {
    id: 'dev-group',
    name: 'Dev Group',
    unread: 2,
    messages: [
      { from: 'Ayu', text: 'Ship it tonight?', time: '14:58' },
      { from: 'Budi', text: 'Build is green on CI', time: '15:01' },
      { from: 'You', text: 'On it — pushing now', time: '15:02' },
    ],
  },
  {
    id: 'crypto-news',
    name: 'Crypto News',
    unread: 1,
    messages: [
      { from: 'Channel', text: 'BTC breaks $98k on ETF flows', time: '14:40' },
      { from: 'Channel', text: 'ETH gas at yearly low', time: '13:15' },
    ],
  },
]

export const DEMO_MODE_LABEL = 'DEMO'

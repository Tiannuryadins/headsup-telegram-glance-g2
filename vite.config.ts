import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the built app also works as a GitHub Pages project site.
  base: './',
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Companion backend (server/) — Telegram Bot API + drafts + STT.
      // Falls back to demo data / local drafts when the backend is down.
      '/api': 'http://localhost:3001',
    },
  },
  build: { target: 'esnext' },
})

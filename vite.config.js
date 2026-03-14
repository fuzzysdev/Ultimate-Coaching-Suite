import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const APP_VERSION = '1.5.4'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://eoepplbrhqdryehuahql.supabase.co wss://eoepplbrhqdryehuahql.supabase.co",
        "img-src 'self' data:",
        "frame-ancestors 'none'",
        "form-action 'self'"
      ].join('; ')
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Ultimate Coaching Suite',
        short_name: 'UCS',
        description: 'A suite of apps for ultimate frisbee coaching',
        version: APP_VERSION,
        theme_color: '#0f1117',
        background_color: '#0f1117',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png',         sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png',         sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
        ]
      }
    })
  ]
})
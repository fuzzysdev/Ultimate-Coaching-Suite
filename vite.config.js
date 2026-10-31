import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const APP_VERSION = '1.5.29'

// vite-plugin-pwa injects the coaching-suite manifest link into EVERY html entry.
// scoreboard.html has its own manifest, so strip the injected one — otherwise
// "Add to Home Screen" on /scoreboard can install the coaching suite.
const scoreboardOwnManifest = () => ({
  name: 'scoreboard-own-manifest',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.filename.replace(/\\/g, '/').endsWith('/scoreboard.html')) return html
      return html.replace(/<link rel="manifest" href="\/manifest\.webmanifest">/g, '')
    },
  },
})

export default defineConfig(({ command }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  // Security headers are enforced in production via vercel.json.
  // Vite's dev server injects inline scripts for React Fast Refresh,
  // so no CSP headers are set here.

  build: {
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        scoreboard: resolve(__dirname, 'scoreboard.html'),
      }
    }
  },
  plugins: [
    react(),
    scoreboardOwnManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: command !== 'serve',
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // The SPA fallback serves index.html (coaching-suite manifest + title) for every
        // navigation. Keep /scoreboard out of it so it always gets scoreboard.html.
        navigateFallbackDenylist: [/^\/scoreboard/],
        runtimeCaching: [
          // Scoreboard page: network first, cached copy when offline
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/scoreboard'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'scoreboard-page',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
          // Cache Google Fonts so the app keeps its look with no connection
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Ultimate Coaching Suite',
        short_name: 'UCS',
        description: 'A suite of apps for ultimate frisbee coaching',
        version: APP_VERSION,
        theme_color: '#0f1117',
        background_color: '#0f1117',
        id: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png',         sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png',         sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
        ]
      }
    }),
    // Must come after VitePWA — both hooks run at order: 'post', in plugin order
    scoreboardOwnManifest(),
  ]
}))

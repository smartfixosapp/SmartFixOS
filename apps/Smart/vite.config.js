import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// Prevent browserslist from traversing parent dirs (macOS SIP/TCC EPERM)
process.env.BROWSERSLIST = 'chrome >= 87, safari >= 14, ios >= 14'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: false,
      selfDestroying: false,
      workbox: {
        cacheId: 'sfos-v6', // bumped to force SW cache invalidation after plan limits fix
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        runtimeCaching: [
          // Supabase API — Network First (datos siempre frescos)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
            },
          },
          // Funciones Deno — Network First
          {
            urlPattern: /^http:\/\/localhost:8686\/.*/i,
            handler: 'NetworkOnly',
          },
          // Imágenes / uploads — Cache First
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      '/fn': {
        target: 'http://127.0.0.1:8686',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fn/, '')
      }
    }
  },
  resolve: {
    // Ensure a single copy of React across all chunks (prevents Safari ESM interop issues)
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Ensure appwrite resolves from this app's node_modules (used by lib/appwrite-client.js)
      appwrite: path.resolve(__dirname, 'node_modules/appwrite'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules/')) return;
          // Framer Motion — heavy animation lib (~110KB), independent of React internals
          if (id.includes('/node_modules/framer-motion/')) return 'vendor-motion';
          // Date utilities — zero React deps, safe to isolate
          if (id.includes('/node_modules/date-fns/')) return 'vendor-dates';
          // Supabase client — large, standalone
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          // Everything else (React, react-dom, scheduler, lucide, etc.) → one stable vendor chunk
          // NOTE: Do NOT split React from its internal deps (scheduler, etc.) — causes circular chunks
          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'appwrite'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 
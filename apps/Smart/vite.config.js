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
      manifest: false, // usamos el manifest.json de /public
      selfDestroying: false,
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
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
          // React core — smallest, most stable, best to isolate
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Framer Motion — heavy animation lib (~100KB)
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-dates';
          }
          // Supabase client
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // Remaining node_modules → single vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['appwrite'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 
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
        cacheId: 'sfos-v13', // v13: revert to main-scroll + [overflow:clip] on root for sticky
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
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules/')) return;

          // ── Heavy libs que SOLO cargan en sus pages consumidoras ──
          // Estos son seguros: no comparten símbolos con React core,
          // se cargan dinámicamente y nunca corren en el critical path.
          if (id.includes('/node_modules/jspdf/')         ||
              id.includes('/node_modules/jspdf-autotable/')) return 'vendor-pdf';
          if (id.includes('/node_modules/recharts/'))     return 'vendor-charts';
          if (id.includes('/node_modules/@hello-pangea/dnd/')) return 'vendor-dnd';

          // ── Mid-size libs estables, sin deps circulares con React ──
          if (id.includes('/node_modules/framer-motion/')) return 'vendor-motion';
          if (id.includes('/node_modules/date-fns/'))      return 'vendor-dates';
          if (id.includes('/node_modules/@supabase/'))     return 'vendor-supabase';

          // ⚠️ NO splittear @radix-ui ni lucide-react — generan errores
          // de Temporal Dead Zone ("Cannot access 'X' before initialization")
          // por dependencias circulares con React internals. Pueden quedar
          // en el chunk vendor sin problema; el costo es que initial-bundle
          // sea ~150KB más grande, pero a cambio el app NO crashea al cargar.
          //
          // Histórico: ese era el error
          //   ReferenceError: Cannot access 'mt' before initialization.
          //   URL: vendor-radix-Cl8V-Y2f.js
          // que aparecía en iOS al separar @radix-ui/* en su propio chunk.

          // Default: React, react-dom, scheduler, react-router, radix, lucide
          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 
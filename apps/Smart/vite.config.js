import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Ensure appwrite resolves from this app's node_modules (used by lib/appwrite-client.js)
      appwrite: path.resolve(__dirname, 'node_modules/appwrite'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
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
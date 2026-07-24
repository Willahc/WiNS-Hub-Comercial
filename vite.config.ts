import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/demo/',
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:18084', changeOrigin: true } } },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('keycloak-js')) return 'vendor-keycloak'
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet'
        },
      },
    },
  },
})

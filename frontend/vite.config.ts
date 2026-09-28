import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:' + (process.env.BACKEND_PORT || '3001'),
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:' + (process.env.BACKEND_PORT || '3001'),
        ws: true,
      },
    },
  },
})

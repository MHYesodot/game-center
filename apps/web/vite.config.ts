import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        usePolling: true,
        interval: 250,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/realtime/v1/ws': {
          target: env.VITE_REALTIME_PROXY_TARGET ?? 'ws://127.0.0.1:8081',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})

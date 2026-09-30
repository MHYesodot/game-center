import { defineConfig } from '@playwright/test'

const isCi = process.env.CI === 'true'

export default defineConfig({
  testDir: './e2e/web',
  timeout: 60_000,
  retries: isCi ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4273',
    headless: true,
  },
  webServer: [
    {
      command: 'npm run db:prepare && npm --workspace @game-center/platform-api run build && node services/platform-api/dist/main.js',
      port: 3200,
      reuseExistingServer: false,
      env: {
        PORT: '3200',
        NODE_ENV: 'test',
        POSTGRES_URL: 'postgresql://gamecenter:gamecenter@localhost:5432/gamecenter',
        REDIS_URL: 'redis://localhost:6379',
        NATS_URL: 'nats://localhost:4222',
        CORS_ORIGIN: 'http://127.0.0.1:4273',
      },
    },
    {
      command: 'npm --workspace @game-center/web run dev -- --host 127.0.0.1 --port 4273',
      port: 4273,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: '/api',
        VITE_API_PROXY_TARGET: 'http://127.0.0.1:3200',
      },
    },
  ],
})
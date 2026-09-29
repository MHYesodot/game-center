import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/quality/**/*.spec.ts', 'services/platform-api/src/**/*.spec.ts'],
  },
})
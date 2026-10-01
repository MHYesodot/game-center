import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.docker.integration.spec.ts'],
    fileParallelism: false,
  },
})
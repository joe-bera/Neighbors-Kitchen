import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    env: {
      VITE_API_URL: 'http://api.test',
    },
  },
})

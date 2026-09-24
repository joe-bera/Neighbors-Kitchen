import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    // Forward API calls to the backend, so the browser only talks to one origin.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})

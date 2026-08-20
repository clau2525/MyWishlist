import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// GitHub Pages serves a project site from /<repo>/, so every asset URL needs
// that prefix. Set BASE_PATH in CI to match the repo name; the default keeps
// `npm run dev` and `npm run preview` working at the root.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use relative asset paths so the site works under
// GitHub Pages project subpaths (e.g., /<repo>/).
export default defineConfig({
  plugins: [react()],
  base: './',
})

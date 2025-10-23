import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If it's "news.ui" use '/news.ui/'.
export default defineConfig({
  plugins: [react()],
  base: '/news.ai/',
})

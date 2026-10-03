import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The app has a single page, so missing files 404 instead of returning
  // index.html (which crawlers would misread as robots.txt, llms.txt, etc.).
  appType: 'mpa',
})

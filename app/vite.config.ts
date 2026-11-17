import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file build so the prototype can be published/opened as one HTML page.
// Capacitor will later use the normal `dist/` output (single file is fine there too).
// minify: false keeps the shipped code readable for hand-off/debugging.
// base './' so the same build works at any path (GitHub Pages serves under /despensa/).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { minify: false },
})

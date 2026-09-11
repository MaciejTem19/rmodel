import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* The demo app under src/. It imports 'rvmodel' by name, the same way a consumer
   would, and the alias points that at the library source in lib/.
   The library build itself lives in vite.lib.config.ts. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      rvmodel: fileURLToPath(new URL('./lib/main.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-demo',
  },
})

import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* The library build: lib/main.ts in, dist/ out, React left alone.
   The demo app has its own config next door in vite.config.ts. */
export default defineConfig({
  plugins: [react()],
  /* public/ belongs to the demo app, not to the package. */
  publicDir: false,
  build: {
    lib: {
      entry: fileURLToPath(new URL('./lib/main.ts', import.meta.url)),
      name: 'RVModel',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'rvmodel.js' : 'rvmodel.cjs'),
    },
    rollupOptions: {
      /* React is the consumer's, not ours — see peerDependencies. */
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
    target: 'es2020',
    sourcemap: true,
    emptyOutDir: true,
  },
})

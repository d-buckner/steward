import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [solid(), wasm(), topLevelAwait()],
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  worker: {
    format: 'es'
  },
  base: './',
  optimizeDeps: {
    exclude: ['@automerge/automerge']
  },
  build: {
    target: 'esnext'
  }
})
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [solid(), wasm(), topLevelAwait()],
  server: {
    port: 3000
  },
  base: './',
  optimizeDeps: {
    exclude: ['@automerge/automerge']
  },
  build: {
    target: 'esnext'
  }
})
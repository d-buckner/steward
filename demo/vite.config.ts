import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { stewardWorkerPlugin } from '@d-buckner/steward/vite'

export default defineConfig({
  plugins: [
    solid(),
    wasm(),
    topLevelAwait(),
    stewardWorkerPlugin({
      debug: true
    })
  ],
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
    exclude: ['@automerge/automerge', 'glob', 'node:events', 'node:fs', 'node:path', '@d-buckner/steward']
  },
  ssr: {
    noExternal: []
  },
  define: {
    global: 'globalThis'
  },
  build: {
    target: 'esnext'
  }
})
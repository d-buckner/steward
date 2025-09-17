import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['test/**/*']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Steward',
      fileName: 'steward',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['@automerge/automerge'],
      output: {
        globals: {
          '@automerge/automerge': 'Automerge'
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
})
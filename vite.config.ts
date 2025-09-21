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
      external: [
        '@automerge/automerge',
        'fs',
        'path',
        'vite',
        'glob',
      ],
      output: {
        globals: {
          '@automerge/automerge': 'Automerge'
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    // Configure different environments for different test files
    environmentMatchGlobs: [
      // Use jsdom for React and Solid tests
      ['packages/react/**', 'jsdom'],
      ['packages/solid/**', 'jsdom'],
      // Use node for everything else
      ['**', 'node']
    ]
  }
})
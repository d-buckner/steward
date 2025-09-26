import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';


export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['test/**/*']
    })
  ],
  build: {
    lib: {
      entry: {
        steward: resolve(__dirname, 'src/index.ts'),
        'vite-plugin': resolve(__dirname, 'src/vite-plugin.ts')
      },
      name: 'Steward',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        '@automerge/automerge',
        'fs',
        'path',
        'node:fs',
        'node:path',
        'node:os',
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
    projects: [
      // React tests with jsdom environment
      {
        test: {
          environment: 'jsdom',
          include: ['packages/react/**/*.test.*']
        }
      },
      // All other tests with node environment
      {
        test: {
          environment: 'node',
          include: ['test/**/*.test.*', 'packages/collaboration/**/*.test.*'],
          exclude: ['packages/solid/**/*.test.*'] // Solid tests run from their own package
        }
      }
    ]
  }
});

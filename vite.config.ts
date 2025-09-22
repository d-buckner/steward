import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import solidPlugin from 'vite-plugin-solid';


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

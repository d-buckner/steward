import { defineConfig } from 'vite'
import { resolve } from 'path'
import solid from 'vite-plugin-solid'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    solid(),
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.*']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StewardSolid',
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['solid-js', '@d-buckner/steward'],
      output: {
        globals: {
          'solid-js': 'SolidJS',
          '@d-buckner/steward': 'Steward'
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['@testing-library/jest-dom']
  },
  esbuild: {
    target: 'node14'
  },
  define: {
    'process.env.NODE_ENV': '"development"'
  },
  ssr: {
    noExternal: ['@solidjs/testing-library']
  }
})
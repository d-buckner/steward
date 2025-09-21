import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.*']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StewardReact',
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['react', '@d-buckner/steward'],
      output: {
        globals: {
          react: 'React',
          '@d-buckner/steward': 'Steward'
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
})
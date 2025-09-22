import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';


export default defineConfig({
  plugins: [solidPlugin({
    solid: {
      generate: 'dom'
    }
  })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.js']
  },
  esbuild: {
    target: 'node14'
  }
});
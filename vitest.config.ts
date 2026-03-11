import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Use 'node' by default; renderer tests override with @vitest-environment jsdom docblock
    environment: 'node',
    environmentMatchGlobs: [
      ['src/test/renderer/**', 'jsdom']
    ],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/main/**', 'src/renderer/src/**']
    }
  },
  resolve: {
    alias: {
      // Allow importing main-process modules without Electron
      electron: resolve(__dirname, 'src/test/__mocks__/electron.ts')
    }
  }
})

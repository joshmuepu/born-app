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
    // songs.test.ts parses real .docx/.pdf fixtures via pdfjs-dist/mammoth;
    // under full-suite fork-pool CPU contention, that parsing's fork can
    // occasionally outlast the default 10s teardownTimeout, which kills the
    // worker and discards the whole file's results even though every test
    // in it already passed. Confirmed via isolated runs + an active-handle
    // check that nothing actually leaks — this is scheduling pressure under
    // concurrent forks, not a real hang.
    teardownTimeout: 30000,
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

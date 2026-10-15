// THROWAWAY: runs only the spike tests (*.spike.ts[x]); the repo's own vitest.config.ts is untouched.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
export default defineConfig({
  root,
  plugins: [react()],
  test: { globals: true, environment: 'node', include: ['spikes/media/tools/**/*.spike.{ts,tsx}'], setupFiles: ['src/test/setup.ts'] },
  resolve: { alias: { electron: resolve(root, 'src/test/__mocks__/electron.ts') } }
})

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // heicWorker runs picture conversion in a worker thread; it must be its own file next to index.js
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          heicWorker: resolve(__dirname, 'src/main/heicWorker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          projection: resolve(__dirname, 'src/renderer/projection.html'),
          stage: resolve(__dirname, 'src/renderer/stage.html'),
          audio: resolve(__dirname, 'src/renderer/audio.html')
        }
      }
    }
  }
})

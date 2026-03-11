/**
 * Minimal Electron mock for unit tests.
 * Replaces the 'electron' import in main-process modules that are tested in Node.
 */
import { vi } from 'vitest'

export const app = {
  getPath: vi.fn(() => ':memory:'),
  setName: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
  getName: vi.fn(() => 'born')
}

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn()
}

export const BrowserWindow = vi.fn(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  webContents: {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn()
  },
  on: vi.fn(),
  isDestroyed: vi.fn(() => false),
  focus: vi.fn(),
  close: vi.fn()
}))

export const screen = {
  getAllDisplays: vi.fn(() => [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]),
  getPrimaryDisplay: vi.fn(() => ({ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }))
}

export const dialog = {
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn()
}

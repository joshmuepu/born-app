/* Renders the whole operator window (App) in jsdom with a permissive electronAPI: every method the
 * shared setup does not define answers with a harmless default (subscriptions return an unsubscribe,
 * everything else resolves to null), so App-level keyboard behaviour can be tested end to end. */
import { render, act } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../../renderer/src/App'

const win = window as unknown as { electronAPI: Record<string, unknown> }
const original = win.electronAPI

export function installApi(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
  const base = original
  const made: Record<string, unknown> = {
    getDataRecoveryInfo: vi.fn(() => Promise.resolve({ sermons: { recovered: false }, library: { recovered: false } })),
    listDisplays: vi.fn(() => Promise.resolve({
      displays: [{ id: 1, label: 'Built-in Display', shortLabel: 'Built-in Display', name: null, isPrimary: true, isInternal: true }],
      namedDisplays: [], targetId: 1, targetName: null, isFallback: true, isOverride: false, missingOverrideName: null, ambiguous: false,
      hasExternal: false, stageTargetId: null, stageTargetName: null, stageIsWindowed: true, stageIsOverride: false,
      stageMissingOverrideName: null, stageAmbiguous: false, stageClashesProjection: false
    })),
    getAppVersion: vi.fn(() => Promise.resolve('1.13.1')),
    getTheme: vi.fn(() => Promise.resolve('dark')),
    getFontSize: vi.fn(() => Promise.resolve(48)),
    ...overrides
  }
  const api = new Proxy({} as Record<string, unknown>, {
    get(_t, name: string) {
      if (name in made) return made[name]
      if (name in base) return base[name]
      const listy = /^(get|search|list|load)/.test(name)
      made[name] = name.startsWith('on') ? vi.fn(() => () => {}) : vi.fn(() => Promise.resolve(listy ? [] : null))
      return made[name]
    }
  })
  win.electronAPI = api
  return made as Record<string, ReturnType<typeof vi.fn>>
}

export async function renderApp(): Promise<ReturnType<typeof render>> {
  let r!: ReturnType<typeof render>
  await act(async () => { r = render(<App />) })
  await act(async () => { await new Promise((res) => setTimeout(res, 0)) })
  return r
}

/** Press a key the way a person does: keydown on the focused element (or body), bubbling to window. */
export async function press(key: string, init: KeyboardEventInit = {}, target: Element | null = document.activeElement): Promise<void> {
  await act(async () => {
    ;(target ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  })
}

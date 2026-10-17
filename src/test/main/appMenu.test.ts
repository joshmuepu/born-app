import { describe, it, expect, vi } from 'vitest'
import { buildAppMenuTemplate } from '../../main/appMenu'

const labels = (t: ReturnType<typeof buildAppMenuTemplate>): string[] => t.flatMap((m) => (Array.isArray(m.submenu) ? m.submenu.map((i) => String(i.role ?? i.label ?? '')) : []))

describe('the application menu', () => {
  it('has no Reload, Developer Tools or Zoom in an installed app (a stray Ctrl+R must not reload the operator window, and browser zoom is shared with the projector)', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      const l = labels(buildAppMenuTemplate({ packaged: true, platform, appName: 'BORN', send: vi.fn() }))
      expect(l.join(' ')).not.toMatch(/reload|toggleDevTools|zoomIn|zoomOut|resetZoom|forceReload/i)
    }
  })
  it('has Reload and Developer Tools only in a development run, and still never Zoom', () => {
    const l = labels(buildAppMenuTemplate({ packaged: false, platform: 'darwin', appName: 'BORN', send: vi.fn() }))
    expect(l).toContain('reload'); expect(l).toContain('toggleDevTools'); expect(l.join(' ')).not.toMatch(/zoomIn|zoomOut/)
  })
  it('keeps Edit (copy / paste in the text fields), full screen and Quit, and Help goes to the app’s own screens', () => {
    const send = vi.fn()
    const t = buildAppMenuTemplate({ packaged: true, platform: 'win32', appName: 'BORN', send })
    const l = labels(t)
    for (const r of ['undo', 'cut', 'copy', 'paste', 'selectAll', 'togglefullscreen', 'quit']) expect(l).toContain(r)
    const help = t.find((m) => m.role === 'help')!.submenu as Array<{ label: string; click: () => void }>
    help.find((i) => i.label === 'Open the manual')!.click(); help.find((i) => i.label === 'Keyboard shortcuts')!.click()
    expect(send.mock.calls).toEqual([['help'], ['shortcuts']])
  })
})

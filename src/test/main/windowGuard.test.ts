import { describe, it, expect, vi } from 'vitest'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { appPageTest, guardWebContents, isSafeExternalUrl, ALLOWED_PERMISSIONS } from '../../main/windowGuard'
import { alertPayload, textInput } from '../../main/ipcInput'
import { clampFontSize } from '../../main/settings'
import { isHymnaryUrl } from '../../main/hymnary'
import { downloadedInstallerPath } from '../../main/updateCheck'

const renderer = join('/opt', 'born', 'out', 'renderer')
const page = (f: string): string => pathToFileURL(join(renderer, f)).href

describe('every window is guarded', () => {
  it('the app pages are its own .html files only', () => {
    const isApp = appPageTest(renderer)
    expect(isApp(page('index.html'))).toBe(true)
    expect(isApp(page('projection.html'))).toBe(true)
    expect(isApp('https://example.com/')).toBe(false)
    expect(isApp(pathToFileURL('/etc/passwd').href)).toBe(false)
    expect(isApp(page('../evil.html'))).toBe(false)
  })
  it('no new windows, and an app page never navigates away', () => {
    const handlers: Record<string, (e: { preventDefault(): void }, url: string) => void> = {}
    let open: ((d: { url: string }) => { action: string }) | null = null
    const wc = { getURL: () => page('projection.html'), setWindowOpenHandler: (fn: never) => { open = fn }, on: (ev: string, fn: never) => { handlers[ev] = fn } }
    guardWebContents(wc as never, appPageTest(renderer))
    expect(open!({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    const away = { preventDefault: vi.fn() }
    handlers['will-navigate'](away, pathToFileURL('/Users/x/Desktop/photo.jpg').href)
    expect(away.preventDefault).toHaveBeenCalled()
    const home = { preventDefault: vi.fn() }
    handlers['will-navigate'](home, page('index.html'))
    expect(home.preventDefault).not.toHaveBeenCalled()
  })
  it('only the permissions the app uses', () => {
    for (const p of ['geolocation', 'notifications', 'media', 'midi', 'usb', 'openExternal']) expect(ALLOWED_PERMISSIONS.has(p)).toBe(false)
    expect(ALLOWED_PERMISSIONS.has('clipboard-sanitized-write')).toBe(true)
  })
  it('help links open only web and mail addresses', () => {
    expect(isSafeExternalUrl('https://joshmuepu.com/born')).toBe(true)
    expect(isSafeExternalUrl('mailto:someone@example.com')).toBe(true)
    for (const u of ['file:///etc/passwd', 'smb://server/share', 'javascript:alert(1)', 'vscode://x', 'not a url', 42]) expect(isSafeExternalUrl(u)).toBe(false)
  })
  it('the hymn site reader loads only that site, over https', () => {
    expect(isHymnaryUrl('https://hymnary.org/text/amazing_grace')).toBe(true)
    expect(isHymnaryUrl('http://hymnary.org/text/x')).toBe(false)
    expect(isHymnaryUrl('https://hymnary.org.evil.example/text/x')).toBe(false)
    expect(isHymnaryUrl('file:///etc/passwd')).toBe(false)
  })
  it('the update step has no installer until this run downloaded one', () => {
    expect(downloadedInstallerPath()).toBeNull()
  })
})

describe('what the operator window sends is checked', () => {
  it('a bad Message payload is dropped, never thrown on', () => {
    for (const bad of [null, undefined, 42, {}, { message: 7 }, { message: '   ' }, '']) expect(alertPayload(bad)).toBeNull()
    expect(alertPayload('Please stand')).toEqual({ message: 'Please stand', target: 'congregation' })
    expect(alertPayload({ message: 'Please stand', target: 'stage' })).toEqual({ message: 'Please stand', target: 'stage' })
    expect(alertPayload({ message: 'x', target: 'elsewhere' })).toEqual({ message: 'x', target: 'congregation' })
  })
  it('a display name that is not text is no name', () => {
    expect(textInput(null)).toBe('')
    expect(textInput({ length: 3 })).toBe('')
    expect(textInput('  Left TV ')).toBe('Left TV')
  })
  it('projection text size is kept in range', () => {
    expect(clampFontSize(999)).toBe(8)
    expect(clampFontSize(-3)).toBe(1.5)
    expect(clampFontSize(4.5)).toBe(4.5)
    for (const bad of [Number.NaN, Infinity, '6', null]) expect(clampFontSize(bad)).toBeNull()
  })
})

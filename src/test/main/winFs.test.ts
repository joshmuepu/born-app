import { describe, it, expect } from 'vitest'
import { longPath, retryFs, isReservedWindowsName, safeFileName } from '../../main/winFs'

describe('longPath', () => {
  it('leaves short paths and other platforms alone', () => {
    expect(longPath('C:\\Users\\Jo Ann\\a.jpg', 'win32')).toBe('C:\\Users\\Jo Ann\\a.jpg')
    expect(longPath('/x/' + 'a'.repeat(300), 'darwin')).toBe('/x/' + 'a'.repeat(300))
  })
  it('prefixes long drive paths', () => {
    const p = 'C:\\' + 'folder\\'.repeat(40) + 'x.jpg'
    expect(longPath(p, 'win32')).toBe('\\\\?\\' + p)
  })
  it('prefixes long UNC paths', () => {
    const p = '\\\\server\\share\\' + 'folder\\'.repeat(40) + 'x.jpg'
    expect(longPath(p, 'win32')).toBe('\\\\?\\UNC\\server\\share\\' + 'folder\\'.repeat(40) + 'x.jpg')
  })
  it('does not double-prefix', () => {
    const p = '\\\\?\\C:\\' + 'folder\\'.repeat(40)
    expect(longPath(p, 'win32')).toBe(p)
  })
})

describe('retryFs', () => {
  const err = (code: string) => Object.assign(new Error(code), { code })
  it('retries transient Windows errors then succeeds', () => {
    let n = 0
    const waited: number[] = []
    const r = retryFs(() => { if (++n < 3) throw err('EBUSY'); return 'ok' }, { platform: 'win32', sleep: (m) => waited.push(m) })
    expect(r).toBe('ok'); expect(n).toBe(3); expect(waited).toEqual([50, 100])
  })
  it('gives up after the last delay and rethrows', () => {
    let n = 0
    expect(() => retryFs(() => { n++; throw err('EPERM') }, { platform: 'win32', sleep: () => {} })).toThrow('EPERM')
    expect(n).toBe(5)
  })
  it('never retries other errors, or on other platforms', () => {
    let n = 0
    expect(() => retryFs(() => { n++; throw err('ENOENT') }, { platform: 'win32', sleep: () => {} })).toThrow()
    expect(n).toBe(1)
    n = 0
    expect(() => retryFs(() => { n++; throw err('EBUSY') }, { platform: 'darwin', sleep: () => {} })).toThrow()
    expect(n).toBe(1)
  })
})

describe('reserved and unsafe names', () => {
  it('spots Windows device names', () => {
    for (const n of ['CON', 'nul.jpg', 'Com1.png', 'LPT9', 'aux.tar.gz', 'CON ']) expect(isReservedWindowsName(n)).toBe(true)
    for (const n of ['console.jpg', 'comet', 'Welcome.jpg', 'com10.jpg']) expect(isReservedWindowsName(n)).toBe(false)
  })
  it('makes safe names (separators, trailing dots/spaces, accents, emoji kept)', () => {
    expect(safeFileName('a/b\\c:d?.jpg')).toBe('a_b_c_d_.jpg')
    expect(safeFileName('photo. ')).toBe('photo')
    expect(safeFileName('NUL.png')).toBe('_NUL.png')
    expect(safeFileName('Café 🎉.jpg')).toBe('Café 🎉.jpg')
    expect(safeFileName('', 'x')).toBe('x')
    expect(safeFileName('x'.repeat(500)).length).toBe(120)
  })
})

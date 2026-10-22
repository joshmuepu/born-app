// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from '../../renderer/src/copyText'

const setClipboard = (c: unknown): void => { Object.defineProperty(navigator, 'clipboard', { value: c, configurable: true, writable: true }) }
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = '' })

describe('copyText — says it copied only when it did', () => {
  it('true when the clipboard accepts the text', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    setClipboard({ writeText })
    expect(await copyText('http://10.0.0.5:4316')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('http://10.0.0.5:4316')
  })
  it('when the clipboard refuses, falls back to a hidden-field copy, and is true only if that worked', async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) })
    document.execCommand = vi.fn(() => true)
    expect(await copyText('abc')).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull() // the hidden field is removed again
  })
  it('false when both the clipboard and the fallback fail — no false "Copied"', async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) })
    document.execCommand = vi.fn(() => false)
    expect(await copyText('abc')).toBe(false)
  })
  it('works with no clipboard API at all (fallback)', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn(() => true)
    expect(await copyText('abc')).toBe(true)
  })
  it('false (not a crash) when the fallback throws', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn(() => { throw new Error('blocked') })
    expect(await copyText('abc')).toBe(false)
  })
})

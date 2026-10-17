import { describe, it, expect } from 'vitest'
import { streamPageUrl, findAudioUrl, downloadFileName, downloadProblem } from '../../shared/tapeDownload'

describe('getting a tape from the publisher (on the operator’s click)', () => {
  it('builds the publisher’s page for a date code, and only for a date code', () => {
    expect(streamPageUrl('65-0418M')).toBe('https://branham.org/en/messagestream/ENG=65-0418M')
    expect(streamPageUrl(' 65-0116x ')).toBe('https://branham.org/en/messagestream/ENG=65-0116X')
    expect(streamPageUrl('47-0412')).toBe('https://branham.org/en/messagestream/ENG=47-0412')
    for (const bad of ['', 'abc', '65-0418M/../x', '65-0418M?x=1', 'http://evil', null as unknown as string]) expect(streamPageUrl(bad)).toBeNull()
  })
  it('takes the audio file from the page, only an https .m4a on the publisher’s CDN', () => {
    const page = '<a href="https://d21kl6o5a7faj0.cloudfront.net/repo/b21/abc123.m4a" title="x">'
    expect(findAudioUrl(page)).toBe('https://d21kl6o5a7faj0.cloudfront.net/repo/b21/abc123.m4a')
    expect(findAudioUrl('<a href="http://d21kl6o5a7faj0.cloudfront.net/x.m4a">')).toBeNull()
    expect(findAudioUrl('<a href="https://evil.example.com/x.m4a">')).toBeNull()
    expect(findAudioUrl('<a href="https://d21kl6o5a7faj0.cloudfront.net/x.pdf">')).toBeNull()
    expect(findAudioUrl('')).toBeNull()
  })
  it('saves it under the date code so BORN matches it to the sermon by itself', () => {
    expect(downloadFileName('65-0418m')).toBe('65-0418M.m4a')
  })
  it('says what went wrong in plain words and always offers the download page', () => {
    for (const k of ['offline', 'no-page', 'no-audio', 'http', 'short', 'disk', 'cancelled', 'unknown'] as const) {
      const t = downloadProblem(k, 503)
      expect(t.length).toBeGreaterThan(15)
      expect(t).not.toMatch(/fetch|undefined|TypeError|ECONN|ENOTFOUND/)
    }
    expect(downloadProblem('http', 503)).toContain('503')
    expect(downloadProblem('offline')).toContain('download page')
  })
})

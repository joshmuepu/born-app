import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { YouTubeHost, playerPage, type HostMessage } from '../../main/youtubeHost'
import { lookupYouTube } from '../../main/youtubeLookup'

describe('the local player host', () => {
  const host = new YouTubeHost()
  let port = 0
  beforeAll(async () => { port = await host.start() })
  afterAll(() => host.stop())

  it('listens on the loopback address only', () => {
    expect(host.origin).toBe(`http://127.0.0.1:${port}`)
  })
  it('serves the player page with a Referrer-Policy that identifies the app to YouTube (never no-referrer)', async () => {
    const res = await fetch(`${host.origin}/player.html?v=dQw4w9WgXcQ&sid=x&mode=live`)
    expect(res.status).toBe(200)
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const html = await res.text()
    expect(html).toContain('https://www.youtube.com/iframe_api')
    expect(html).toContain("origin: location.origin")
    expect(html).not.toMatch(/no-referrer|noreferrer/)
  })
  it('the page asks only for documented player calls and changes nothing about the player', () => {
    const html = playerPage()
    for (const call of ['playVideo', 'pauseVideo', 'seekTo', 'mute', 'unMute', 'setVolume', 'getPlayerState', 'getCurrentTime', 'getDuration']) expect(html).toContain(call)
    // nothing that downloads, blocks, hides, skips or restyles
    expect(html).not.toMatch(/download|adblock|skipAd|\.ytp-|display\s*:\s*none|opacity|loadModule|setOption|googlevideo|\.mp4|videoplayback/i)
    // its script is valid JavaScript
    const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
    expect(() => new Function(script)).not.toThrow()
  })
  it('delivers a page\'s report to whoever is listening for that session, and only that session', async () => {
    const got: HostMessage[] = []
    const other: HostMessage[] = []
    const off = host.listen('mine', (m) => got.push(m))
    host.listen('theirs', (m) => other.push(m))
    const r = await fetch(`${host.origin}/report?sid=mine`, { method: 'POST', body: JSON.stringify({ t: 'tick', state: 1, time: 4, duration: 90 }) })
    expect(r.status).toBe(204)
    expect(got).toEqual([{ t: 'tick', state: 1, time: 4, duration: 90 }])
    expect(other).toEqual([])
    off()
    await fetch(`${host.origin}/report?sid=mine`, { method: 'POST', body: JSON.stringify({ t: 'tick' }) })
    expect(got).toHaveLength(1)
  })
  it('ignores junk and unknown addresses', async () => {
    expect((await fetch(`${host.origin}/report?sid=mine`, { method: 'POST', body: 'not json' })).status).toBe(204)
    expect((await fetch(`${host.origin}/nope`)).status).toBe(404)
    expect((await fetch(`${host.origin}/player.html`, { method: 'POST' })).status).toBe(404)
  })
  it('builds a page address only for a real video id', () => {
    expect(host.urlFor('dQw4w9WgXcQ', { sid: 'abc', mode: 'probe', start: 12.9 })).toBe(`${host.origin}/player.html?v=dQw4w9WgXcQ&sid=abc&mode=probe&start=12`)
    expect(() => host.urlFor('../../etc/passwd', { sid: 'a', mode: 'live' })).toThrow()
    expect(() => host.urlFor('x"onload="1', { sid: 'a', mode: 'live' })).toThrow()
  })
  it('start() twice gives the same port', async () => {
    expect(await host.start()).toBe(port)
  })
})

describe('reading a title from the public oEmbed address', () => {
  const ok = (j: unknown) => async () => ({ ok: true, json: async () => j })
  it('returns the title and channel', async () => {
    expect(await lookupYouTube('dQw4w9WgXcQ', ok({ title: ' Me at the zoo ', author_name: 'jawed' }))).toEqual({ title: 'Me at the zoo', author: 'jawed' })
  })
  it('asks only the oEmbed address, for the ordinary watch link, with no sign-in', async () => {
    let asked = ''
    await lookupYouTube('dQw4w9WgXcQ', async (u) => { asked = u; return { ok: true, json: async () => ({ title: 'x' }) } })
    const u = new URL(asked)
    expect(u.origin + u.pathname).toBe('https://www.youtube.com/oembed')
    expect(u.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
  it('any failure is just "no title" — never an error for the operator', async () => {
    expect(await lookupYouTube('dQw4w9WgXcQ', async () => ({ ok: false, json: async () => ({}) }))).toBeNull()
    expect(await lookupYouTube('dQw4w9WgXcQ', async () => { throw new Error('offline') })).toBeNull()
    expect(await lookupYouTube('dQw4w9WgXcQ', ok({ title: '' }))).toBeNull()
    expect(await lookupYouTube('dQw4w9WgXcQ', ok({}))).toBeNull()
    expect(await lookupYouTube('not-an-id', ok({ title: 'x' }))).toBeNull()
  })
  it('gives up after the time limit', async () => {
    const never = (_u: string, init?: { signal?: AbortSignal }): Promise<never> => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))))
    expect(await lookupYouTube('dQw4w9WgXcQ', never, 40)).toBeNull()
  })
})

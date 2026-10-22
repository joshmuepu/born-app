import { describe, it, expect, vi, afterEach } from 'vitest'
import { request } from 'http'

vi.mock('os', async () => ({ ...(await vi.importActual<typeof import('os')>('os')), networkInterfaces: () => ({}) }))
const { startWebRemote, stopWebRemote } = await import('../../main/webRemote')

// Own port: webRemote.test.ts uses 43160 in a parallel worker.
const PORT = 43161
const noopSearch = {
  sermons: async () => [], bible: async () => ({ kind: 'error', message: '' }), songs: async () => [],
  bibleBooks: async () => [], bibleChapter: async () => ({}), sermonById: async () => null, songById: async () => null,
  onThisDay: async () => [], recentSongs: async () => [], songBrowse: async () => []
} as unknown as Parameters<typeof startWebRemote>[1]

async function boot(onCommand: (c: unknown) => void = () => {}): Promise<void> {
  await new Promise<void>((resolve) => startWebRemote(onCommand, noopSearch, resolve, PORT))
}
afterEach(async () => {
  stopWebRemote()
  await new Promise((r) => setTimeout(r, 50))
})

function get(path: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('the remote page cannot be shown inside another site', () => {
  it('the page itself is sent with X-Frame-Options and frame-ancestors none', async () => {
    await boot()
    const r = await get('/')
    expect(r.status).toBe(200)
    expect(r.headers['x-frame-options']).toBe('DENY')
    expect(r.headers['content-security-policy']).toBe("frame-ancestors 'none'")
  })
  it('scripts and styles are not affected', async () => {
    await boot()
    const r = await get('/app.js')
    expect(r.headers['x-frame-options']).toBeUndefined()
  })
})

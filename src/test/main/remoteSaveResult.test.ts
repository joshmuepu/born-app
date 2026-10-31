import { describe, it, expect, vi, afterEach } from 'vitest'
import { request } from 'http'
import { APP_JS } from '../../main/remoteAssets'

// The phone's Save always said "Saved": the remote answered the command at once and the save only happened afterwards, its result
// thrown away. So a save that failed (a full disk, a folder that cannot be written) still showed "Saved" on the phone. A command whose
// handler gives back a result (the save) is now answered with that result, and the phone says when the save failed.

vi.mock('os', async () => ({ ...(await vi.importActual<typeof import('os')>('os')), networkInterfaces: () => ({}) }))
const { startWebRemote, stopWebRemote } = await import('../../main/webRemote')

const PORT = 43163 // own port: other remote tests use 43160 and 43161 in parallel workers
const noopSearch = {} as unknown as Parameters<typeof startWebRemote>[1]
afterEach(async () => { stopWebRemote(); await new Promise((r) => setTimeout(r, 50)) })

function post(body: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = request({ host: '127.0.0.1', port: PORT, path: '/command', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let b = ''
      res.on('data', (c) => (b += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }))
    })
    req.on('error', reject)
    req.end(data)
  })
}

describe('the phone hears whether its save worked', () => {
  it('a save that fails is answered with ok:false, one that works with ok:true', async () => {
    let ok = false
    await new Promise<void>((resolve) => startWebRemote((c) => ((c as { action: string }).action === 'save-queue' ? Promise.resolve({ ok }) : undefined), noopSearch, resolve, PORT))
    expect(await post({ action: 'save-queue', name: 'Sunday' })).toEqual({ status: 200, body: '{"ok":false}' })
    ok = true
    expect(await post({ action: 'save-queue', name: 'Sunday' })).toEqual({ status: 200, body: '{"ok":true}' })
  })
  it('a handler that throws while saving counts as a failed save', async () => {
    await new Promise<void>((resolve) => startWebRemote(() => Promise.reject(new Error('disk')), noopSearch, resolve, PORT))
    expect(await post({ action: 'save-queue', name: 'Sunday' })).toEqual({ status: 200, body: '{"ok":false}' })
  })
  it('every other command is still answered at once with no body', async () => {
    await new Promise<void>((resolve) => startWebRemote(() => undefined, noopSearch, resolve, PORT))
    expect((await post({ action: 'next' })).status).toBe(204)
  })
  it('the phone page says the save failed instead of "Saved"', () => {
    const js = APP_JS.replace(/\r\n/g, '\n')
    const fn = js.slice(js.indexOf('function doSaveQueue'), js.indexOf('\nfunction ', js.indexOf('function doSaveQueue') + 10))
    expect(fn).toMatch(/ok === false/)
    expect(fn).toMatch(/Couldn.t save/)
  })
})

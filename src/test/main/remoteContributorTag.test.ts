// @vitest-environment jsdom
/**
 * remoteContributorTag.test.ts — the obvious "+ Queue" button on a result's
 * detail sheet (sheetAction in remoteAssets.ts) used to send nothing
 * identifying who tapped it, so an item added this way never carried the
 * "Who's this?" role — only the separate "My list" → Send batch flow did.
 * Exercises the real APP_JS source (see remoteCmd.test.ts's header comment
 * for why `new Function` rather than a reimplementation) to prove the
 * one-tap path now tags the same way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APP_JS } from '../../main/remoteAssets'

interface RemoteScript {
  sheetAction: (which: string) => void
  state: { selected: unknown }
}

function loadRemoteScript(): RemoteScript {
  document.body.innerHTML = '<div id="toast"></div><div id="conn-p"><span class="connLabel"></span></div>'
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${APP_JS}\nreturn { sheetAction: sheetAction, state: state };`)
  return factory() as RemoteScript
}

// A successful Project tap also triggers a follow-up GET /state poll (see
// sheetAction's pollUntilOnScreen), so the POST to /command isn't always
// the last fetch() call once the mock's promise resolves synchronously —
// find it by its method instead of assuming position.
function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>
  const call = calls.filter(([, init]) => init?.method === 'POST').at(-1)
  return JSON.parse(call![1].body as string)
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('remote sheetAction("queue") — contributor tagging', () => {
  it('attaches the chosen role to a song queued via the one-tap button', async () => {
    localStorage.setItem('born-remote-contributor-label', 'Song Leader')
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    const { sheetAction, state } = loadRemoteScript()
    state.selected = { kind: 'song', payload: { songId: 42 } }
    sheetAction('queue')
    await Promise.resolve().then(() => Promise.resolve())

    const body = lastRequestBody(fetchMock)
    expect(body.action).toBe('queue-song')
    expect(body.contributor).toMatchObject({ label: 'Song Leader' })
    expect(typeof (body.contributor as { deviceId: string }).deviceId).toBe('string')
  })

  it('attaches the chosen role to a sermon quote queued via the one-tap button', async () => {
    localStorage.setItem('born-remote-contributor-label', 'Preacher')
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    const { sheetAction, state } = loadRemoteScript()
    state.selected = { kind: 'sermon', payload: { quote: { id: 'q1' }, query: 'faith' } }
    sheetAction('queue')
    await Promise.resolve().then(() => Promise.resolve())

    const body = lastRequestBody(fetchMock)
    expect(body.action).toBe('queue-sermon')
    expect(body.contributor).toMatchObject({ label: 'Preacher' })
  })

  it('attaches the chosen role to a Bible verse queued via the one-tap button', async () => {
    localStorage.setItem('born-remote-contributor-label', 'Operator')
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    const { sheetAction, state } = loadRemoteScript()
    state.selected = { kind: 'bible', payload: { reference: 'John 3:16' } }
    sheetAction('queue')
    await Promise.resolve().then(() => Promise.resolve())

    const body = lastRequestBody(fetchMock)
    expect(body.action).toBe('queue-bible')
    expect(body.contributor).toMatchObject({ label: 'Operator' })
  })

  it('sends a custom typed-in name the same way as the built-in roles', async () => {
    localStorage.setItem('born-remote-contributor-label', 'Deacon Mike')
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    const { sheetAction, state } = loadRemoteScript()
    state.selected = { kind: 'song', payload: { songId: 7 } }
    sheetAction('queue')
    await Promise.resolve().then(() => Promise.resolve())

    expect(lastRequestBody(fetchMock).contributor).toMatchObject({ label: 'Deacon Mike' })
  })

  it('sends no contributor field at all when the phone skipped the role picker', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    const { sheetAction, state } = loadRemoteScript()
    state.selected = { kind: 'song', payload: { songId: 42 } }
    sheetAction('queue')
    await Promise.resolve().then(() => Promise.resolve())

    expect(lastRequestBody(fetchMock)).not.toHaveProperty('contributor')
  })

  it('does not attach a contributor to a plain Project tap — only Queue tags', async () => {
    localStorage.setItem('born-remote-contributor-label', 'Song Leader')
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    global.fetch = fetchMock as unknown as typeof fetch

    const { sheetAction, state } = loadRemoteScript()
    state.selected = { kind: 'song', payload: { songId: 42 } }
    sheetAction('project')
    await Promise.resolve().then(() => Promise.resolve())

    const body = lastRequestBody(fetchMock)
    expect(body.action).toBe('project-song')
    expect(body).not.toHaveProperty('contributor')
  })
})

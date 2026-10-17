// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TapeDownload from '../../renderer/src/components/TapeDownload'

const sermon = { id: 7, dateCode: '65-0418M', title: 'A Sample Message' }
let progressCb: ((p: { sermonId: number; received: number; total: number | null }) => void) | null = null
const api = {
  tapeDownload: vi.fn(),
  tapeDownloadCancel: vi.fn(async () => true),
  tapeOpenAudioPage: vi.fn(async () => true),
  onTapeDownloadProgress: vi.fn((cb: typeof progressCb) => { progressCb = cb; return () => {} })
}
beforeEach(() => { vi.clearAllMocks(); Object.assign(window, { electronAPI: api }) })
afterEach(cleanup)

describe('Get audio downloads the tape (not just a page)', () => {
  it('needs a sermon first, and the publisher’s page is still one click away', async () => {
    const user = userEvent.setup()
    render(<TapeDownload sermon={null} onDone={vi.fn()} />)
    expect((screen.getByRole('button', { name: /Download the tape/ }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: /Open the publisher’s page/ }))
    expect(api.tapeOpenAudioPage).toHaveBeenCalledOnce()
  })
  it('downloads on the click, shows progress with a Cancel, then says it was added and tells the page', async () => {
    let finish!: (v: unknown) => void
    api.tapeDownload.mockReturnValue(new Promise((r) => { finish = r }))
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<TapeDownload sermon={sermon} onDone={onDone} />)
    await user.click(screen.getByRole('button', { name: 'Download the tape for 65-0418M' }))
    expect(api.tapeDownload).toHaveBeenCalledWith(7)
    act(() => progressCb?.({ sermonId: 7, received: 52_428_800, total: 209_715_200 }))
    expect(screen.getByText(/Downloading… 50 MB of 200 MB/)).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
    await user.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(api.tapeDownloadCancel).toHaveBeenCalledOnce()
    await act(async () => finish({ ok: true, bytes: 209_715_200, results: [{ ok: true }] }))
    expect(await screen.findByText(/Downloaded and added “A Sample Message” \(200 MB\)/)).toBeTruthy()
    expect(onDone).toHaveBeenCalledOnce()
  })
  it('says what went wrong in plain words and does not claim success', async () => {
    api.tapeDownload.mockResolvedValue({ ok: false, message: 'BORN could not reach the publisher’s site. Check the internet connection.' })
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<TapeDownload sermon={sermon} onDone={onDone} />)
    await user.click(screen.getByRole('button', { name: /Download the tape for/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach/)
    expect(onDone).not.toHaveBeenCalled()
  })
  it('a cancelled download is a quiet status, not an alarm', async () => {
    api.tapeDownload.mockResolvedValue({ ok: false, message: 'The download was cancelled.' })
    const user = userEvent.setup()
    render(<TapeDownload sermon={sermon} onDone={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Download the tape for/ }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/cancelled/))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('names the publisher and the rights holder', () => {
    render(<TapeDownload sermon={sermon} onDone={vi.fn()} />)
    expect(screen.getByText(/Voice Of God Recordings/)).toBeTruthy()
  })
})

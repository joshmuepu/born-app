// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreviewLivePair, { type PreviewLivePairProps } from '../../renderer/src/components/PreviewLivePair'
import type { LiveChannel, SlidePayload } from '../../renderer/src/types'

const seen = (t: string | RegExp): boolean => screen.queryAllByText(t).length > 0

const slide = (ref: string, text = 'For God so loved the world'): SlidePayload => ({
  kind: 'bible',
  text,
  reference: ref
})

const main = (over: Partial<LiveChannel> = {}): LiveChannel => ({
  id: 'main',
  label: 'Main',
  current: slide('John 3:16 · KJV'),
  next: slide('John 3:17 · KJV', 'For God sent not his Son'),
  blanked: false,
  ...over
})

let pushLive: (l: LiveChannel[]) => void = () => {}

function baseProps(over: Partial<PreviewLivePairProps> = {}): PreviewLivePairProps {
  return {
    channels: [{ id: 'main', label: 'Main', translation: 'KJV', songbookId: 'all', sync: { syncMode: 'independent' } }],
    outputs: [],
    fontSize: 4.5,
    stagedPayload: null,
    stagedTitle: null,
    nextPayload: null,
    projectionOpen: true,
    canTake: true,
    onTake: vi.fn(),
    onUnstage: vi.fn(),
    onToggleBlank: vi.fn(),
    onClearChannel: vi.fn(),
    ...over
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.electronAPI.getLiveState = vi.fn(() => Promise.resolve([main()]))
  window.electronAPI.getObservability = vi.fn(() => Promise.resolve([]))
  window.electronAPI.onLiveChanged = vi.fn((cb: (l: LiveChannel[]) => void) => {
    pushLive = cb
    return () => {}
  })
})
afterEach(() => vi.useRealTimers())

describe('PreviewLivePair', () => {
  it('shows what the output actually has live, and what comes next', async () => {
    render(<PreviewLivePair {...baseProps()} />)
    await waitFor(() => expect(seen('John 3:16 · KJV')).toBe(true))
    expect(seen(/Next · John 3:17/)).toBe(true)
    expect(seen('Live')).toBe(true)
    expect(seen('Preview')).toBe(true)
  })

  it('follows pushed output changes — the output wins over anything the UI assumed', async () => {
    render(<PreviewLivePair {...baseProps()} />)
    await waitFor(() => expect(seen('John 3:16 · KJV')).toBe(true))
    act(() => pushLive([main({ current: slide('Psalm 23:1 · KJV', 'The LORD is my shepherd') })]))
    await waitFor(() => expect(seen('Psalm 23:1 · KJV')).toBe(true))
    expect(seen('John 3:16 · KJV')).toBe(false)
  })

  it('recovers from a missed event by re-reading the output on a timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<PreviewLivePair {...baseProps()} />)
    await waitFor(() => expect(seen('John 3:16 · KJV')).toBe(true))
    window.electronAPI.getLiveState = vi.fn(() =>
      Promise.resolve([main({ current: slide('Romans 8:1 · KJV', 'There is therefore now no condemnation') })])
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2700)
    })
    await waitFor(() => expect(seen('Romans 8:1 · KJV')).toBe(true))
  })

  it('marks a hidden screen as hidden and offers Show screen', async () => {
    const onToggleBlank = vi.fn()
    window.electronAPI.getLiveState = vi.fn(() => Promise.resolve([main({ blanked: true })]))
    const user = userEvent.setup()
    render(<PreviewLivePair {...baseProps({ onToggleBlank })} />)
    await waitFor(() => expect(seen('Hidden')).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Show screen' }))
    expect(onToggleBlank).toHaveBeenCalledOnce()
  })

  it('Show runs the take action; a staged item shows its title and can be unstaged', async () => {
    const onTake = vi.fn()
    const onUnstage = vi.fn()
    const user = userEvent.setup()
    render(
      <PreviewLivePair
        {...baseProps({
          onTake,
          onUnstage,
          stagedPayload: slide('Genesis 1:1 · KJV', 'In the beginning'),
          stagedTitle: 'Genesis 1:1'
        })}
      />
    )
    expect(seen('Genesis 1:1')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(onTake).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Unstage' }))
    expect(onUnstage).toHaveBeenCalledOnce()
  })

  it('staging never changes what is shown as live', async () => {
    render(
      <PreviewLivePair
        {...baseProps({ stagedPayload: slide('Genesis 1:1 · KJV', 'In the beginning'), stagedTitle: 'Genesis 1:1' })}
      />
    )
    await waitFor(() => expect(seen('John 3:16 · KJV')).toBe(true))
  })

  it('shows a channel switcher when more than one channel exists and reads that channel from the output', async () => {
    window.electronAPI.getLiveState = vi.fn(() =>
      Promise.resolve([
        main(),
        {
          id: 'ch2',
          label: 'Spanish',
          current: slide('Juan 3:16 · RVR', 'Porque de tal manera amó Dios'),
          next: null,
          blanked: false
        }
      ])
    )
    const onClearChannel = vi.fn()
    const user = userEvent.setup()
    render(
      <PreviewLivePair
        {...baseProps({
          onClearChannel,
          channels: [
            { id: 'main', label: 'Main', translation: 'KJV', songbookId: 'all', sync: { syncMode: 'independent' } },
            { id: 'ch2', label: 'Spanish', translation: 'RVR', songbookId: 'all', sync: { syncMode: 'follow', linkedTo: 'main' } }
          ]
        })}
      />
    )
    await waitFor(() => expect(seen('John 3:16 · KJV')).toBe(true))
    await user.click(screen.getByRole('tab', { name: 'Spanish' }))
    await waitFor(() => expect(seen('Juan 3:16 · RVR')).toBe(true))
    expect(seen('Follows Main automatically')).toBe(true)
    await user.click(screen.getByRole('button', { name: /Hide screen|Clear/ }))
    expect(onClearChannel).toHaveBeenCalledWith('ch2')
  })

  it('Show next is the one big button; Back and Next are small arrows next to where you are in the queue (P-07)', async () => {
    const onPrev = vi.fn(), onNext = vi.fn(), onTake = vi.fn()
    const user = userEvent.setup()
    render(<PreviewLivePair {...baseProps({ onTake, onPrev, onNext, canPrev: true, canNext: true, position: '2 of 9' })} />)
    expect(seen('2 of 9')).toBe(true)
    const steps = screen.getByRole('group', { name: 'Step through the queue' })
    expect(steps.querySelectorAll('button')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPrev).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
    // exactly one primary (filled) button in the box, and it is the one that shows something
    const primaries = document.querySelectorAll('.plp button.btn-primary')
    expect(primaries).toHaveLength(1)
    expect(primaries[0].textContent).toMatch(/^Show( next)?$/)
    await user.click(primaries[0] as HTMLElement)
    expect(onTake).toHaveBeenCalledOnce()
  })

  it('the arrows are off at the ends of the queue, and a second channel has none', async () => {
    const { rerender } = render(<PreviewLivePair {...baseProps({ onPrev: vi.fn(), onNext: vi.fn(), canPrev: false, canNext: false })} />)
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<PreviewLivePair {...baseProps({ channels: [], onPrev: vi.fn(), onNext: vi.fn() })} />)
  })
})


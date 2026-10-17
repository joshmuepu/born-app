// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import StageTape from '../../renderer/src/components/StageTape'
import type { TapeScreenSpec } from '../../shared/tapeScreen'
import type { TapeWire } from '../../shared/tapePlayback'

const spec: TapeScreenSpec = {
  v: 1, recordingId: 'r_1', sermonId: 1, title: 'A Sermon', mode: 'highlight', leadSec: 4, pinned: null,
  items: [{ n: 1, marker: '1', text: 'First placeholder paragraph.' }, { n: 2, marker: '2', text: 'Second placeholder paragraph.' }],
  marks: [{ n: 1, t: 10, kind: 'start' }, { n: 2, t: 70, kind: 'start' }], regions: []
}
const wire = (o: Partial<TapeWire> = {}): TapeWire => ({ recordingId: 'r_1', fileId: 'f', sermonId: 1, status: 'playing', position: 25, at: 0, duration: 3600, speed: 1, volume: 1, muted: false, hasPlayedOnce: true, stalled: false, error: null, errorKind: null, pausedBy: null, deviceId: '', deviceLabel: '', epoch: 1, sentAt: 0, ...o })
let push: (w: TapeWire | null) => void = () => {}
beforeEach(() => {
  Object.assign(window.electronAPI, { tapeGet: vi.fn(async () => null), onTapeState: vi.fn((cb: (w: TapeWire | null) => void) => { push = cb; return vi.fn() }) })
})
const show = async (w: TapeWire | null) => { const r = render(<StageTape spec={spec} />); await act(async () => { push(w) }); return r }

describe('the stage monitor tape layout', () => {
  it('shows time, time left, what is being spoken now and what is next with its countdown', async () => {
    const { container } = await show(wire({ status: 'paused' }))
    expect(container.querySelector('.stagetape-elapsed')!.textContent).toBe('0:00:25')
    expect(container.querySelector('.stagetape-left')!.textContent).toBe('−0:59:35')
    expect(screen.getByText('NOW ¶1')).toBeTruthy()
    expect(screen.getByText('First placeholder paragraph.')).toBeTruthy()
    expect(container.querySelector('.stagetape-cap b')!.textContent).toBe('in 0:00:45')
    expect(screen.getByText('Second placeholder paragraph.')).toBeTruthy()
  })
  it('says in one plain word what the tape is doing, and amber when something is wrong', async () => {
    const { container, rerender } = await show(wire({ status: 'paused' }))
    expect(container.querySelector('.stagetape-pill')!.textContent).toBe('Paused')
    await act(async () => { push(wire({ stalled: true })) })
    expect(container.querySelector('.stagetape-pill')!.textContent).toBe('Sound has stopped moving')
    expect(container.querySelector('.stagetape-pill.is-bad')).toBeTruthy()
    await act(async () => { push(wire({ status: 'ended' })) })
    expect(container.querySelector('.stagetape-pill')!.textContent).toBe('Tape finished')
    await act(async () => { push(wire({ status: 'error', error: 'x' })) })
    expect(container.querySelector('.stagetape-pill.is-bad')!.textContent).toBe('Problem with the tape')
    rerender(<StageTape spec={spec} />)
  })
  it('a tape that is not loaded says so and shows the title, never a wrong paragraph', async () => {
    const { container } = await show(null)
    expect(container.querySelector('.stagetape-pill')!.textContent).toBe('Tape not started')
    expect(screen.getByText('A Sermon')).toBeTruthy()
  })
  it('the stage view ignores the one-at-a-time lead and the pin: it always shows the speaker', async () => {
    const r = render(<StageTape spec={{ ...spec, mode: 'one', leadSec: 10, pinned: 2 }} />)
    await act(async () => { push(wire({ position: 65 })) })
    expect(r.container.textContent).toContain('NOW ¶1')
  })
})

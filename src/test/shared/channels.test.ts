import { describe, it, expect } from 'vitest'
import { createChannel, patchChannel, type ChannelState } from '../../shared/channels'

interface TestSlide {
  text: string
}

describe('createChannel', () => {
  it('starts empty, unblanked, and independent', () => {
    const channel = createChannel<TestSlide>('main', 'Main')
    expect(channel).toEqual({
      id: 'main',
      label: 'Main',
      current: null,
      next: null,
      blanked: false,
      sync: { syncMode: 'independent' }
    })
  })

  it('uses the given id and label', () => {
    const channel = createChannel<TestSlide>('french', 'French')
    expect(channel.id).toBe('french')
    expect(channel.label).toBe('French')
  })
})

describe('patchChannel', () => {
  it('applies a partial update without mutating the input', () => {
    const channel = createChannel<TestSlide>('main', 'Main')
    const updated = patchChannel(channel, { current: { text: 'hello' } })
    expect(channel.current).toBeNull() // original untouched
    expect(updated.current).toEqual({ text: 'hello' })
    expect(updated.id).toBe('main')
  })

  it('can update multiple fields at once', () => {
    const channel = createChannel<TestSlide>('main', 'Main')
    const updated = patchChannel(channel, {
      current: { text: 'a' },
      next: { text: 'b' },
      blanked: true
    })
    expect(updated.current).toEqual({ text: 'a' })
    expect(updated.next).toEqual({ text: 'b' })
    expect(updated.blanked).toBe(true)
  })

  it('leaves id and label untouched even though the type forbids passing them', () => {
    const channel = createChannel<TestSlide>('main', 'Main')
    const updated = patchChannel(channel, { blanked: true })
    expect(updated.id).toBe(channel.id)
    expect(updated.label).toBe(channel.label)
  })

  it('never forces a sync mode — independent stays independent unless patched', () => {
    const channel: ChannelState<TestSlide> = createChannel('french', 'French')
    expect(channel.sync.syncMode).toBe('independent')
    const linked = patchChannel(channel, { sync: { syncMode: 'follow', linkedTo: 'main' } })
    expect(linked.sync).toEqual({ syncMode: 'follow', linkedTo: 'main' })
  })
})

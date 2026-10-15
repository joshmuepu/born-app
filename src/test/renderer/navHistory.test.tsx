// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNavHistory, type NavEntry } from '../../renderer/src/navHistory'

const sermon = (id: number, anchor = '1'): NavEntry => ({ kind: 'sermon', sermonId: id, anchorRef: anchor })
const song = (id: number): NavEntry => ({ kind: 'song', songId: id })
const verse = (c: number): NavEntry => ({ kind: 'bible', bookNum: 43, chapter: c, verse: 1 })

afterEach(() => vi.useRealTimers())

describe('useNavHistory', () => {
  it('starts with nothing to go back or forward to', () => {
    const { result } = renderHook(() => useNavHistory(vi.fn()))
    expect(result.current.canBack).toBe(false)
    expect(result.current.canForward).toBe(false)
  })

  it('goes back and forward over opened places, re-opening each without recording it again', () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    const { result } = renderHook(() => useNavHistory(apply))
    act(() => {
      result.current.record(sermon(1))
      result.current.record(verse(3))
      result.current.record(song(9))
    })
    expect(result.current.canBack).toBe(true)
    act(() => result.current.back())
    expect(apply).toHaveBeenLastCalledWith(verse(3))
    // opening the place while restoring must not push a new entry
    act(() => result.current.record(verse(3)))
    expect(result.current.canForward).toBe(true)
    act(() => result.current.back())
    expect(apply).toHaveBeenLastCalledWith(sermon(1))
    expect(result.current.canBack).toBe(false)
    act(() => result.current.forward())
    expect(apply).toHaveBeenLastCalledWith(verse(3))
  })

  it('drops the forward stack when a new place is opened after going back', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useNavHistory(vi.fn()))
    act(() => {
      result.current.record(sermon(1))
      result.current.record(sermon(2))
      result.current.record(sermon(3))
    })
    act(() => result.current.back())
    act(() => {
      vi.advanceTimersByTime(800) // the restore window ends
    })
    act(() => result.current.record(song(5)))
    expect(result.current.canForward).toBe(false)
    act(() => result.current.back())
    // back from the song lands on sermon 2 (sermon 3 was discarded)
    expect(result.current.canBack).toBe(true)
  })

  it('does not grow when the same place is opened again', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useNavHistory(apply))
    act(() => {
      result.current.record(sermon(1, '4'))
      result.current.record(sermon(1, '9'))
    })
    expect(result.current.canBack).toBe(false)
  })

  it('never calls apply with out-of-range targets', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useNavHistory(apply))
    act(() => result.current.back())
    act(() => result.current.forward())
    expect(apply).not.toHaveBeenCalled()
  })
})

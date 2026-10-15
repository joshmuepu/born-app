// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastHost, useToasts, type ToastSpec } from '../../renderer/src/components/Toasts'

function Harness({ spec, onReady }: { spec?: ToastSpec; onReady?: (api: ReturnType<typeof useToasts>) => void }): JSX.Element {
  const api = useToasts()
  onReady?.(api)
  return (
    <>
      <button onClick={() => spec && api.push(spec)}>fire</button>
      <ToastHost toasts={api.toasts} onDismiss={api.dismiss} />
    </>
  )
}

afterEach(() => vi.useRealTimers())

describe('toasts', () => {
  it('runs the undo action once and dismisses', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<Harness spec={{ message: 'Removed “Amazing Grace”', actionLabel: 'Undo', onAction }} />)
    await user.click(screen.getByText('fire'))
    expect(screen.getByText('Removed “Amazing Grace”')).toBeDefined()
    await user.click(screen.getByRole('button', { name: /Undo/ }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByText('Removed “Amazing Grace”')).toBeNull()
  })

  it('goes away on its own after its timeout', async () => {
    vi.useFakeTimers()
    render(<Harness spec={{ message: 'Moved', onAction: () => {}, timeoutMs: 3000 }} />)
    await act(async () => {
      screen.getByText('fire').click()
    })
    expect(screen.getByText('Moved')).toBeDefined()
    await act(async () => {
      vi.advanceTimersByTime(3100)
    })
    expect(screen.queryByText('Moved')).toBeNull()
  })

  it('pauses the countdown while hovered', async () => {
    vi.useFakeTimers()
    render(<Harness spec={{ message: 'Hold on', onAction: () => {}, timeoutMs: 2000 }} />)
    await act(async () => {
      screen.getByText('fire').click()
    })
    const toast = screen.getByRole('status')
    await act(async () => {
      fireEvent.mouseEnter(toast)
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Hold on')).toBeDefined()
    await act(async () => {
      fireEvent.mouseLeave(toast)
      vi.advanceTimersByTime(2100)
    })
    expect(screen.queryByText('Hold on')).toBeNull()
  })

  it('undoLatest runs the newest undoable toast (the Ctrl/Cmd+Z path)', async () => {
    const first = vi.fn()
    const second = vi.fn()
    let api!: ReturnType<typeof useToasts>
    render(<Harness onReady={(a) => (api = a)} />)
    await act(async () => {
      api.push({ message: 'one', onAction: first })
      api.push({ message: 'two', onAction: second })
    })
    let ran = false
    await act(async () => {
      ran = api.undoLatest()
    })
    expect(ran).toBe(true)
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('does not bind Escape, which is the blackout key in the operator window', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<Harness spec={{ message: 'Keep me', onAction }} />)
    await user.click(screen.getByText('fire'))
    await user.keyboard('{Escape}')
    expect(screen.getByText('Keep me')).toBeDefined()
    expect(onAction).not.toHaveBeenCalled()
  })
})

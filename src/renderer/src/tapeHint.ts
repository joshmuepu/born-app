import { useCallback, useState } from 'react'

const KEY = 'born.tape.hints.v1'
export type TapeHintId = 'bar' | 'place'
/** One-time, dismissible hints for the tape service (the bar, the Tape place). Remembered in the browser; always works without storage. */
function read(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, boolean> } catch { return {} }
}
export function useTapeHint(id: TapeHintId): { show: boolean; dismiss: () => void } {
  const [seen, setSeen] = useState(() => !!read()[id])
  const dismiss = useCallback(() => {
    setSeen(true)
    try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: true })) } catch { /* a convenience only */ }
  }, [id])
  return { show: !seen, dismiss }
}

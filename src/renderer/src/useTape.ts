import { useCallback, useEffect, useRef, useState } from 'react'
import { tapeWirePosition, type TapeAction, type TapeWire } from '../../shared/tapePlayback'

/** The tape that is playing, as the main process keeps it. `pos` is the position right now (interpolated between messages). */
export function useTape(): {
  wire: TapeWire | null
  pos: number
  command: (a: TapeAction) => void
  load: (recordingId: string, o?: { play?: boolean; position?: number }) => Promise<void>
} {
  const [wire, setWire] = useState<TapeWire | null>(null)
  const receivedAt = useRef(performance.now())
  const pushed = useRef(false)
  const [, force] = useState(0)
  useEffect(() => {
    let alive = true
    // the first answer must never overwrite a newer pushed state that arrived while it was in flight
    void window.electronAPI.tapeGet?.()?.then((w) => { if (alive && !pushed.current) { receivedAt.current = performance.now(); setWire(w) } })
    const off = window.electronAPI.onTapeState?.((w) => { pushed.current = true; receivedAt.current = performance.now(); setWire(w) })
    // the clock between messages runs here
    const t = window.setInterval(() => force((n) => n + 1), 250)
    return () => { alive = false; off?.(); window.clearInterval(t) }
  }, [])
  const command = useCallback((a: TapeAction) => { void window.electronAPI.tapeCommand(a) }, [])
  const load = useCallback(async (id: string, o?: { play?: boolean; position?: number }) => { await window.electronAPI.tapeLoad(id, o) }, [])
  return { wire, pos: wire ? tapeWirePosition(wire, performance.now() - receivedAt.current) : 0, command, load }
}

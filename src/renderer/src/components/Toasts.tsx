import { useCallback, useEffect, useRef, useState } from 'react'
import { Undo2, X } from 'lucide-react'
import './Toasts.css'

export interface ToastSpec {
  message: string
  /** Label for the action button — "Undo" for everything this app offers. */
  actionLabel?: string
  onAction?: () => void
  /** Milliseconds before it goes away on its own. Hovering or focusing
   *  inside the toast pauses the countdown. */
  timeoutMs?: number
}

interface ToastItem extends ToastSpec {
  id: number
  timeoutMs: number
}

export const DEFAULT_TOAST_MS = 8000

/** A tiny toast stack. Toasts never take focus and never bind Escape (Esc is
 *  the blackout key in the operator window) — they are reached by their own
 *  button, or Ctrl/Cmd+Z for the most recent undoable one. */
export function useToasts(): {
  toasts: ToastItem[]
  push: (t: ToastSpec) => number
  dismiss: (id: number) => void
  /** Run the newest toast's action, if any. Returns whether one ran. */
  undoLatest: () => boolean
} {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const ref = useRef<ToastItem[]>([])
  ref.current = toasts

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((spec: ToastSpec): number => {
    const id = nextId.current++
    // At most three on screen; the oldest quietly drops off.
    setToasts((t) => [...t.slice(-2), { ...spec, id, timeoutMs: spec.timeoutMs ?? DEFAULT_TOAST_MS }])
    return id
  }, [])

  const undoLatest = useCallback((): boolean => {
    const latest = [...ref.current].reverse().find((t) => t.onAction)
    if (!latest) return false
    latest.onAction?.()
    setToasts((t) => t.filter((x) => x.id !== latest.id))
    return true
  }, [])

  return { toasts, push, dismiss, undoLatest }
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }): JSX.Element {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.timeoutMs)
  const startedAt = useRef(0)

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const t = window.setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      window.clearTimeout(t)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    }
  }, [paused, toast.id, onDismiss])

  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-msg">{toast.message}</span>
      {toast.onAction && (
        <button
          className="toast-action"
          onClick={() => {
            toast.onAction?.()
            onDismiss(toast.id)
          }}
        >
          <Undo2 width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
          {toast.actionLabel ?? 'Undo'}
        </button>
      )}
      <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        <X width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <span
        className="toast-timer"
        style={{ animationDuration: `${toast.timeoutMs}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        aria-hidden="true"
      />
    </div>
  )
}

export function ToastHost({
  toasts,
  onDismiss
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}): JSX.Element {
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

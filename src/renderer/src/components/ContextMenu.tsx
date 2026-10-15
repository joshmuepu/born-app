import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currentUiZoom } from '../uiScale'
import './ContextMenu.css'

export interface MenuItem {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  /** Right-aligned hint, e.g. a shortcut. */
  hint?: string
  /** Draw a divider above this item. */
  separatorBefore?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/** A small, keyboard-first context menu: ↑/↓ move, Enter runs, Esc closes
 *  (and is swallowed here, so it never reaches the blackout shortcut),
 *  Tab closes. Focus returns to wherever it came from. */
export function ContextMenu({ x, y, items, onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const enabled = items.filter((i) => !i.disabled)
  // Nothing is highlighted on open: a stray Enter right after the menu appears
  // must never run "Project now". The first arrow key (or hover) picks one.
  const [active, setActive] = useState(-1)
  const returnFocus = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Pointer coordinates are screen pixels; with the interface zoomed, CSS
    // lengths are multiplied, so measure and place in the same (screen) space
    // and convert the final position back to CSS pixels.
    const z = currentUiZoom()
    const r = el.getBoundingClientRect()
    const left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) / z
    const top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) / z
    setPos({ left, top })
    el.focus()
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onBlurWindow = (): void => onClose()
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('blur', onBlurWindow)
    window.addEventListener('resize', onBlurWindow)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('blur', onBlurWindow)
      window.removeEventListener('resize', onBlurWindow)
      returnFocus.current?.focus?.()
    }
  }, [onClose])

  const run = (item: MenuItem | undefined): void => {
    if (!item || item.disabled) return
    onClose()
    item.onSelect()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a < 0 ? 0 : (a + 1) % Math.max(1, enabled.length)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? enabled.length - 1 : a - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(Math.max(0, enabled.length - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      if (active >= 0) run(enabled[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onClose()
    } else {
      e.stopPropagation() // type-ahead keys must not drive the operator shortcuts
    }
  }

  return createPortal(
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      tabIndex={-1}
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => {
        const idx = enabled.indexOf(item)
        return (
          <div key={item.id}>
            {item.separatorBefore && <div className="ctx-sep" role="separator" />}
            <div
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              className={`ctx-item${idx === active ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}${item.danger ? ' is-danger' : ''}`}
              onMouseMove={() => idx >= 0 && setActive(idx)}
              onClick={() => run(item)}
            >
              <span>{item.label}</span>
              {item.hint && <span className="ctx-hint">{item.hint}</span>}
            </div>
          </div>
        )
      })}
    </div>,
    // Inside the zoomed app root (not <body>) so the menu scales with the UI.
    document.getElementById('root') ?? document.body
  )
}

/** Wire a menu to any element: spread `bind(items)` onto it. Opens on
 *  right-click and on the Menu key / Shift+F10 for keyboard users. */
export function useContextMenu(): {
  bind: (items: MenuItem[] | (() => MenuItem[])) => {
    onContextMenu: (e: React.MouseEvent) => void
    /** Capture phase on purpose: the row usually has its own onKeyDown (Enter
     *  to open), and a plain spread would silently replace one with the other. */
    onKeyDownCapture: (e: React.KeyboardEvent) => void
  }
  element: JSX.Element | null
} {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const close = useCallback(() => setMenu(null), [])

  const bind = useCallback(
    (items: MenuItem[] | (() => MenuItem[])) => ({
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setMenu({ x: e.clientX, y: e.clientY, items: typeof items === 'function' ? items() : items })
      },
      onKeyDownCapture: (e: React.KeyboardEvent) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault()
          e.stopPropagation()
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setMenu({
            x: r.left + Math.min(40, r.width / 2),
            y: r.top + Math.min(24, r.height / 2),
            items: typeof items === 'function' ? items() : items
          })
        }
      }
    }),
    []
  )

  return {
    bind,
    element: menu ? <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={close} /> : null
  }
}

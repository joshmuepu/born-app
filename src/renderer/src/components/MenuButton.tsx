import { useCallback, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ContextMenu, type MenuItem } from './ContextMenu'

/** A button that opens a small menu under itself (File ▾, the ⚙ menu). It is the same keyboard-first menu as the right-click ones: ↑/↓, Enter, Esc closes it
 *  (and never reaches the blackout), focus comes back to the button. */
export default function MenuButton({
  label,
  items,
  className = 'btn-quiet btn-sm',
  icon,
  title,
  ariaLabel,
  chevron = true
}: {
  label?: string
  items: MenuItem[] | (() => MenuItem[])
  className?: string
  icon?: JSX.Element
  title?: string
  ariaLabel?: string
  chevron?: boolean
}): JSX.Element {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const close = useCallback(() => setMenu(null), [])
  const open = (el: HTMLElement): void => {
    const r = el.getBoundingClientRect()
    setMenu({ x: r.left, y: r.bottom + 4, items: typeof items === 'function' ? items() : items })
  }
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        aria-label={ariaLabel}
        title={title}
        onClick={(e) => (menu ? close() : open(e.currentTarget))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); open(e.currentTarget) }
        }}
      >
        {icon}
        {label}
        {chevron && <ChevronDown width={12} height={12} strokeWidth={2.4} aria-hidden="true" />}
      </button>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={close} />}
    </>
  )
}

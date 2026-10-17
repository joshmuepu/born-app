import { focusRegion } from '../regions'
import './SkipLinks.css'

/** The first Tab stops of the window: jump straight to the content, the service queue or the live controls. Hidden until they have focus. */
export default function SkipLinks({ openQueue }: { openQueue?: () => void }): JSX.Element {
  const go = (selector: string, needsQueue = false) => (e: React.MouseEvent | React.KeyboardEvent): void => {
    e.preventDefault()
    // a closed queue pane cannot take focus: open it first, then move in once it is on the page
    if (needsQueue && openQueue) { openQueue(); window.setTimeout(() => { if (!focusRegion(selector)) focusRegion('#queue-pane') }, 80); return }
    // no live controls on the page (the screens are off): land on the queue instead of doing nothing
    if (!focusRegion(selector)) focusRegion('#queue-pane')
  }
  return (
    <nav className="skip-links" aria-label="Skip links">
      <a href="#main-content" onClick={go('#main-content')}>Skip to content</a>
      <a href="#queue-pane" onClick={go('#queue-pane', true)}>Skip to the queue</a>
      <a href="#live-controls" onClick={go('#live-controls', true)}>Skip to the live controls</a>
    </nav>
  )
}

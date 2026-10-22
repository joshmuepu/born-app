/** Where to nudge an absolutely-positioned popover so it stays inside the window. `r` is the popover's current box, `vw`/`vh` the window.
 *  The Filters popover is 320px wide and anchored to the right of a narrow left panel, so at 150% scale it spilled off the left edge,
 *  and with no height cap its last button (Done) sat below the bottom. */
export function popoverFit(r: { left: number; top: number; right: number }, vw: number, vh: number, margin = 8): { dx: number; maxHeight: number } {
  let dx = 0
  if (r.left < margin) dx = margin - r.left
  else if (r.right > vw - margin) dx = vw - margin - r.right
  return { dx, maxHeight: Math.max(120, vh - r.top - margin) }
}

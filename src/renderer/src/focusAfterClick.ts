/** After a MOUSE click on a button or row, let go of the focus so Space and the arrow keys drive the live slide again (they do nothing while a button has
 *  focus). After a KEYBOARD activation (Enter or Space on the button: `detail` is 0) the focus stays where the operator is, so they do not have to Tab
 *  from the top again. */
export function blurAfterPointer(e: { detail?: number; currentTarget: { blur: () => void } }): void {
  if ((e.detail ?? 0) > 0) e.currentTarget.blur()
}

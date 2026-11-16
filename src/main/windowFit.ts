/** The operator window's smallest size and its first size, fitted to the work area of the display it opens on. They were fixed at 1040x640 and
 *  1280x800, so on a 960x600 display (a small laptop at a large text setting) the window ran off the right and bottom edges. The layout itself already
 *  handles narrow and short windows. */
export function fitOperatorWindow(workArea: { width: number; height: number }): { min: { width: number; height: number }; size: { width: number; height: number } } {
  return {
    min: { width: Math.min(1040, workArea.width), height: Math.min(640, workArea.height) },
    size: { width: Math.min(1280, workArea.width), height: Math.min(800, workArea.height) }
  }
}

/** When the stage's current text does not fit its box at its usual smallest size (55% of its start), it is not cut: room is made for that page
 *  only, one step at a time, until it fits. First the Next band gets smaller (its text fitted to the smaller band), then the Next band is hidden,
 *  and only then may the current text go smaller than usual, down to the size that fits but never under 16 px. A page that fits at step 0 is
 *  shown exactly as before. */
export const NEXT_BAND_VH = [20, 15, 11] as const
export const HIDE_NEXT_STEP = NEXT_BAND_VH.length
export const SMALLER_TEXT_STEP = HIDE_NEXT_STEP + 1
/** never under this, at any screen height */
export const STAGE_TEXT_MIN_PX = 16

/** The step after `step` for a page whose current text is `currentCut` and whose Next text is `nextCut` (in a smaller band), or null when this
 *  step is enough (or nothing more can be done). Step 0 only moves on for cut current text, so a page that fits today is never changed. */
export function nextRoomStep(step: number, hasNext: boolean, currentCut: boolean, nextCut: boolean): number | null {
  if (step >= SMALLER_TEXT_STEP) return null
  if (step === 0) {
    if (!currentCut) return null
    return hasNext ? 1 : SMALLER_TEXT_STEP
  }
  if (step < HIDE_NEXT_STEP) {
    if (!currentCut && !nextCut) return null
    return step + 1
  }
  // Next hidden
  return currentCut ? SMALLER_TEXT_STEP : null
}

/** The current text's fit limits at a step: the usual 0.9 rem and 55% of its start, or, at the last step, 16 px. */
export function currentFitLimits(step: number, baseRem: number, rootPx: number): { minRem: number; floorRatio: number } {
  if (step < SMALLER_TEXT_STEP) return { minRem: 0.9, floorRatio: 0.55 }
  const minRem = STAGE_TEXT_MIN_PX / rootPx
  return { minRem, floorRatio: Math.min(0.55, minRem / baseRem) }
}

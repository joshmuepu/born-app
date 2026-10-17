/**
 * The words the operator sees, in one place. One word per job, used the same way in the operator app, the phone remote, the stage monitor, the
 * command palette, menus, toasts, dialogs, Help and the manual (docs/design/ux-review/03-proposals.md, P-02). API field names and command ids keep their
 * old names for compatibility (`project`, `blank` …); only the words people read change.
 */
export const TERMS = {
  /** send this to the screens now */
  show: 'Show',
  showNow: 'Show now',
  showNext: 'Show next',
  /** step through the queue */
  next: 'Next',
  back: 'Back',
  /** the blackout (Esc) */
  hideScreen: 'Hide screen',
  showScreen: 'Show screen',
  /** remove the text but keep the screens on */
  clear: 'Clear',
  /** the window */
  openProjection: 'Open projection',
  closeProjection: 'Close projection'
} as const

/** Words that are no longer used for these jobs in anything the operator reads. A repo test (`glossary.test.ts`) fails if they come back. */
export const RETIRED: ReadonlyArray<{ word: RegExp; use: string }> = [
  { word: /\bProject\b/, use: 'Show' },
  { word: /\bTake next\b|\bTake it\b|\bTake now\b/, use: 'Show next' },
  { word: /\bPut\b[^.<>]{0,40}\bon the screens?\b/i, use: 'Show …' },
  { word: /\bBlank\b(?! the)/, use: 'Hide screen' }
]

/** Older words that still find the new commands in the command palette (typing "project" finds "Show"). */
export const SEARCH_ALIASES = 'project take put blank'

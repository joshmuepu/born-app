# v1 hand-off from the v2 UX review (nothing was changed in v1)

Found while reviewing v2 (branch `v2-ux-review`); the same code is in v1.13.1 (`main`), so the same defects are there. v1 was not touched.
Port by intent if the owner wants a v1.13.2.

1. **Esc that closes a popover or the manual also blanks the screens (P1, safety).** `App.tsx` handles Esc app-wide (`if (e.key === 'Escape' && projectionOpen) … handleToggleBlank()`),
   and `HelpViewer.tsx` (line ~148) and `RemotePanel.tsx` (line ~162) close themselves on Esc without telling it. Closing the Remote QR panel or the manual mid-service blanks the
   congregation screen. v2 fix: `src/renderer/src/escRule.ts` records, in the capture phase, whether an overlay was open when Esc went down; Shift+Esc still always blanks.
2. **The keyboard shortcuts dialog is taller than a small window and does not scroll (P1).** `.modal` has no `max-height`/`overflow-y`; in v1 the list is shorter than v2's but still
   runs off a 640 px-high window. v2 fix: `.modal { max-height: calc(90vh / var(--ui-zoom, 1)); overflow-y: auto }`.
3. **Three dialogs have no `role="dialog"` / `aria-modal` / name (P2, accessibility):** the Message dialog, the Keyboard shortcuts dialog and the per-channel operator dialog in `App.tsx`.
4. **Raw browser text in an error (P2):** none in v1's tape (v1 has no tape), but v1's video/YouTube-free build is unaffected; listed only so nobody re-introduces `String(e.message)` in UI text.

Not in v1 (v2-only code): the header/rail/scale issues (v1 has no interface scale).

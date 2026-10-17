# v1 hand-off from the v2 UX review (nothing was changed in v1)

Found while reviewing v2 (branch `v2-ux-review`); the same code is in v1.13.1 (`main`), so the same defects are there. v1 was not touched.
Port by intent if the owner wants a v1.13.2.

1. **Esc that closes a popover or the manual also blanks the screens (P1, safety).** `App.tsx` handles Esc app-wide (`if (e.key === 'Escape' && projectionOpen) … handleToggleBlank()`),
   and `HelpViewer.tsx` (line ~148) and `RemotePanel.tsx` (line ~162) close themselves on Esc without telling it. Closing the Remote QR panel or the manual mid-service blanks the
   congregation screen. v2 fix: `src/renderer/src/escRule.ts` records, in the capture phase, whether an overlay was open when Esc went down; Shift+Esc still always blanks.
2. **The keyboard shortcuts dialog is taller than a small window and does not scroll (P1).** `.modal` has no `max-height`/`overflow-y`; in v1 the list is shorter than v2's but still
   runs off a 640 px-high window. v2 fix: `.modal { max-height: calc(90vh / var(--ui-zoom, 1)); overflow-y: auto }`.
3. **Three dialogs have no `role="dialog"` / `aria-modal` / name (P2, accessibility):** the Message dialog, the Keyboard shortcuts dialog and the per-channel operator dialog in `App.tsx`.
4. **The default Electron menu is still on (P2, safety).** Neither v1 nor v2 sets an application menu, so the default one is live: **Ctrl/⌘+R** reloads the operator window and **Ctrl/⌘+Shift+R** force-reloads it (and ⌘+Shift+V is "Paste and Match Style"). Pressed by accident mid-service, a reload loses the operator window's state. Not changed in v2 either; v2 only avoids using those chords (its Run view shortcut is Ctrl/⌘+Shift+U). A one-line `Menu.setApplicationMenu(null)` on Windows (and a minimal Edit-only menu on macOS) would close it.
5. **The start screen can be cut off at the top** when its content is taller than the queue column (`.start-screen { align-items: center }` with `overflow-y: auto`): v1 shows the Recent services list there. v2 fix: centre with `margin: auto` on the inner block instead.

Not in v1 (v2-only code): the header/rail/scale issues (v1 has no interface scale).

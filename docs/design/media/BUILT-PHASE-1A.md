# Phase 1a — as built (summary)

Full report: [`docs/qa/v2-media-1a-report.md`](../../qa/v2-media-1a-report.md). Storage and safety rules:
[`storage.md`](storage.md). Manual pages: `docs/manual/v2/operators/media-*.md`.

## Where it follows the design package exactly
Fourth top-level area with its own teal token (passes the automated contrast test in all four themes); copy-by-default library with
link-in-place; the drill-down shell; undo toasts; four fixed layers (Background → Content → Overlay → Alert); preflight with one fix per
row; Esc always blanks; phone remote has no seek or sound; media travels by content hash with a review and relink.

## Where it differs, and why
| Design | Built | Why |
|---|---|---|
| Panic = one key that also stops video | `Esc`/`B` unchanged (toggle) + cancels loading takes; **Ctrl/⌘+Shift+L** = logo | No video yet; Esc was already the documented blank |
| Backgrounds as a separate picker screen | A view inside Media + "Use as a background" in the picture pane | Fewer places to look |
| `.bornpack` bundle | Not built (Phase 3) | Roadmap |
| PDF via the current pdf.js | Legacy build | The current build needs JavaScript this Electron lacks |
| Thumbnails "on hover" | Thumbnails everywhere; no hover scrub | Pictures only in 1a |
| Library index inside `library.db` | Separate `media.db` | `library.db` is re-seeded on corruption, which would erase the operator's index |

## Added beyond the design (all small)
Slideshow auto-advance menu on queue rows; "Needs attention" view; `/api/v1/automation/queue`; `/media/<id>/thumb|display` HTTP routes;
`born-media://` protocol for the operator and output windows.

# 3. Visual design — Tape service

Follows [`docs/design/born-again-ui-direction.md`](../born-again-ui-direction.md) and the tokens in [`docs/design/tokens.css`](../tokens.css) (mirrored in `src/renderer/src/App.css`). **No hard-coded colours** in the real build: every colour below is an existing token. The mockups use the same tokens and themes (dark, light, high-contrast) and the same inlined fonts as `docs/design/media/mockups`.
Original design: nothing here copies the reference app's layout, icons, colours or wording. The shared idea is only "the current paragraph is bright, the rest is dim, and the text follows the audio".

## 1. Colour roles
| Role | Token | Notes |
|---|---|---|
| Current paragraph (operator reader) | `--ba-accent-wash` background + `--ba-accent` 3 px edge, text `--ba-text-1`, number `--ba-accent` | The one interactive colour; red is **never** used for it (red = live/destructive) |
| Past / future paragraphs | `--ba-text-2` / `--ba-text-3` | `--ba-text-3` is the readable floor (5.4:1) |
| Play button | `--ba-accent` filled | like every primary action |
| "In sync" / "Tape ended" | `--ba-ok` | connected/ok is green |
| Warnings (drift, mismatch, blanked) | `--ba-warn` | |
| Errors (file missing, device lost) | `--ba-danger` | |
| Live frame in Preview/Live | `--ba-live` | the existing Live outline |
| "Tape" identity (chips, tick marks) | `--ba-sermons` (Quiet Stone) | audio belongs to Sermons, so it uses that content colour; no new content colour is introduced |
| Projector number colour | accent tint (`#b9a8f5` dark / `--ba-accent` light / yellow focus colour in high-contrast) | screen palettes follow the theme but are projection-specific (below) |

## 2. Projector palettes (per Destination)
| Palette | Background | Text | Dimmed paragraphs | Number |
|---|---|---|---|---|
| Dark (default) | `#000` | `#f4f2ee` | 26 % opacity | soft violet |
| Light | warm paper | near-black | 26 % | `--ba-accent` |
| High contrast | `#000` | `#fff` | **50 %** (so dimmed text still passes 7:1 against the background) | yellow (focus) |
The dim level is a **per-palette** value; the audit checks that the *dimmed* text still meets the palette's contrast target (AA for dark/light at the default opacity on the actual rendered pixels; AAA in high contrast), because "dim" must never mean "unreadable from the back".

## 3. Type
- **Reader (operator):** a serif for sermon text (`Iowan Old Style / Palatino / Georgia` in the mockups; in the real build a bundled open serif must be chosen and licensed — an open item), 20 px / 1.55; numbers in Inter Light 34 px; UI in Inter. Time values in JetBrains Mono, tabular.
- **Projector:** the same serif at 39 px on a 720 p frame (≈5.4 % of height), 1.42 line height, number 76 px Light; scales with screen height like today's `baseRem`; never below 30 px-equivalent at 1080 p.
- **Lower third:** the profile's own sizes (`clamp(1rem, 2.1vw, 2.2rem)`), `unicode-bidi: plaintext`, 2 lines per page.
- **Non-Latin / RTL:** `dir="auto"`, per-script system font stacks, line height raised for scripts with tall marks (Arabic, Thai, Khmer, Burmese).

## 4. Layout
- Operator: the Sermons reader fills the work area (reader column 760 px, centred) with the existing **Preview/Live pair** on the right and the player bar docked at the bottom; the seek bar has paragraph ticks; "Reader follows" and "Projector follows" are two separate switches.
- Projector highlight view: the current paragraph rests at about 21 % from the top of the frame (the mockup's 150 px / 720 px); top and bottom edges fade to the background; a one-line footer (title, tape time) at 55 % opacity.
- One at a time: number (150 px Light) left, text right, vertically centred, with the "NEXT ¶ / countdown" bar 52 px from the bottom.
- Stage monitor: time at 44 px mono, bar, then Now/Next blocks.

## 5. Motion
Scroll glide 0.9 s `cubic-bezier(.22,.7,.2,1)`; dim/brighten 0.6 s; crossfade 0.35 s. `prefers-reduced-motion`: all instant. Never animate the sermon text *size*.

## 6. States to design (all in the mockups)
No tape · tape without timing · syncing · playing · paused · ended · blank-but-playing · file missing · file cut short · text/tape mismatch · device lost · drift. Each has a plain sentence and **one button** (mockup 09).

## 7. Contrast audit plan (before any build)
Measure on rendered pixels for the three themes: the dimmed paragraph text on every projector palette, the number colour, the sync pill, the lower-third panel over bright video (the OBS work found OBS blends in linear light: use an opaque-enough panel), and the tick marks. Add the new tokens/palettes to `src/test/shared/themeContrast.test.ts`.

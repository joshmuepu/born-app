# v1-fixes-1.13.11: text cut on the first slide after the screen opens

Branch `v1-fixes-1.13.11`, from `main` at 1.13.10. Not released.

## What was wrong

The owner saw verse 1 of "All That Thrills My Soul" cut at the top and the bottom of the congregation screen, at a raised text size, on a
1728x1117 screen.

The screens' font (Inter) is only downloaded once text first uses it. The first slide shown after a screen opens is fitted while that font is
still loading, so it is fitted with the system font. The screen font is wider: lines such as "Who can cheer the heart like Jesus," wrap
onto two lines, the page grows from 4 to 6 drawn lines and runs off both ends. Nothing fitted the text again once the font arrived. Going to
another page and back fitted it correctly, which is why it looked like it happened on one song only.

The fault has been there since the font was added (1.5.0). It shows more often since 1.13.9 because the congregation text starts larger, so
more lines are close to wrapping.

## The fix

- `useAutoFitFontSize.ts`: when a font finishes loading, the text is fitted again and the screen is drawn again. This covers the
  congregation screen, the live preview and the stage monitor (whose "never cut" check runs after every draw).
- `ProjectionApp.tsx`: when a font finishes loading, the operator window is told to measure its "Text is very small / Text is cut" marks
  again.

## Proof

- `src/test/renderer/autoFitTiming.test.tsx`: two new tests (the text is fitted again when a font loads; the listener is removed with the
  slide). Both fail without the fix.
- `scripts/qa/font-late.cjs`, in the real app on an isolated profile: text size 6.5, screens at 1728x1117, the font download held back
  while the first page goes live, then let through.

| | Congregation screen after the font loads |
|---|---|
| Without the fix | 943 px of text in an 815 px box at 104.8 px: cut (as in the owner's picture) |
| With the fix | 528 px of text in an 815 px box at 88.1 px: fits |

The stage monitor fits in both cases at this size (510 px in a 679 px box).

## Gates

Typecheck passed; full unit suite 138 of 138 files passed; real-app checks: font-late 10/10, slide-fit 15/15, stage-room 43/43, output-probe 6/6, operator-sizes 72/72.

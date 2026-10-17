# 03 · Proposals (nothing here is built)

Review them on the clickable **Review board**: `docs/design/ux-review/mockups/index.html` (Approve / Discuss / Reject, a notes box each, and **Copy my decisions**).
Each proposal below has the same content as its card. Bugs already fixed are in `02-fixed-bugs.md`; feature ideas that are not UI fixes are in `04-idea-backlog.md`.

| ID | One line | Effort | Risk | Impact |
|---|---|---|---|---|
| P-02 | One vocabulary for sending something to the screens | S | low | high |
| P-03 | Service queue: one File menu, one readiness chip, room for more rows | S | low | high |
| P-09 | Bigger targets where it matters (Fitts) and a minimum size everywhere | S | low | med |
| P-10 | Skip links, landmarks and a content-first tab order | S | low | med |
| P-04 | Left rail: Find / Tape / Service groups and one selection colour | S | low | med |
| P-01 | A header with zones: the "on air" cluster, and a menu for the rest | M | low | high |
| P-11 | Appearance and interface size in one place | S | low | low |
| P-05 | A "Now" dock: what is on air, the tape, and the connections in one bottom strip | M | med | high |
| P-07 | One primary button in the live box (Show next), steps become small arrows | M | med | high |
| P-13 | Phone remote: Media and Tape tabs, a clear blank state, and bigger Blank | S | low | med |
| P-08 | Rows: one click selects, one key shows; actions appear on hover or focus | M | med | med |
| P-12 | First run: a short "Set up Sunday" checklist and quick-start templates | M | low | med |
| P-06 | A Run view for services: queue and live first, finding tucked away | L | med | high |

**Recommended order:** P-02 → P-03 → P-09 → P-10 → P-04 → P-01 → P-11 → P-05 → P-07 → P-13 → P-08 → P-12 → P-06.

Why this order: P-02, P-03, P-09, P-10 are small and independent (words, one toolbar, sizes, keyboard) and every later proposal benefits from the shared vocabulary and sizes. P-04, P-01 and P-11 then reshape the rail and header together (they share the ⚙ menu). P-05 and P-07 change the live strip and live box (most visible, so after the vocabulary is agreed). P-13 and P-08 change the phone and the row gesture. P-12 (first run) and P-06 (Run view, the largest) come last, once the pieces they reuse exist.

## A coherent overall app shell

If P-01, P-03, P-04, P-05, P-07 and P-08 are all approved they form one shell, shown clickable in `mockups/shell.html` and side by side with today in `mockups/live-compare.html`: a header with three zones, a rail with three labelled groups, a queue pane with a File menu and a readiness chip, one primary button in the live box, and one bottom dock that answers "what is on air?" and carries the tape. The Run view (P-06) is the same shell with the browse columns replaced by the queue.

## Build plan (small slices, each with acceptance tests)

1. **P-02** — One vocabulary for sending something to the screens. Slice: String changes only: App.tsx, QueuePanel/Preview components, BiblePanel, SongsPanel, SermonFollowView, MediaPanel, Tape components, webRemote.ts (phone), docs/manual. A tests/strings check keeps the glossary. Acceptance: A repo test fails if "Project" or "Take" appears in operator-facing strings; the phone and app agree on every label.
2. **P-03** — Service queue: one File menu, one readiness chip, room for more rows. Slice: components/QueuePanel (toolbar), App.tsx (rail Open), Preflight.tsx (chip data), CommandPalette (same commands), phone: unchanged. Acceptance: Queue list shows ≥ 8 rows at 1366×768; the chip turns amber when a check item fails; every old action reachable in ≤ 2 clicks.
3. **P-09** — Bigger targets where it matters (Fitts) and a minimum size everywhere. Slice: App.css (.btn-sm, .panel-subtab, .btn-quiet), component CSS; one new test that scans the CSS for heights under the minimum. Acceptance: A DOM probe finds no interactive control under 32 px except text links inside paragraphs; live-critical ≥ 40 px.
4. **P-10** — Skip links, landmarks and a content-first tab order. Slice: App.tsx (skip links, landmarks, F6), a11y test additions. Acceptance: Tab from page start reaches "Skip to content" first; F6 cycles regions; axe landmark and heading checks pass.
5. **P-04** — Left rail: Find / Tape / Service groups and one selection colour. Slice: App.tsx (rail), App.css (.rail-btn colour modifiers), TapeRailButton.tsx; themeContrast test already covers the tokens. Acceptance: One selected colour in all three themes (contrast tests pass); Queue count badge unchanged; keyboard order top to bottom.
6. **P-01** — A header with zones: the "on air" cluster, and a menu for the rest. Slice: src/renderer/src/App.tsx (header), App.css (.app-header, .header-actions), components/ScreensMenu.tsx, RemotePanel.tsx; a new small SettingsMenu component reusing ContextMenu. Acceptance: At 1040×640 with the screens live the header has no overlap and no wrap; every item reachable by keyboard; theme/contrast/size work from the ⚙ menu; the Esc rule is unchanged.
7. **P-11** — Appearance and interface size in one place. Slice: SettingsMenu (new), uiScale.ts, useTheme.ts. Acceptance: All three settings reachable by keyboard; persisted; reduced-motion respected.
8. **P-05** — A "Now" dock: what is on air, the tape, and the connections in one bottom strip. Slice: components/GlobalTapeBar.tsx/.css, status bar in App.tsx (.status-bar), new NowDock component using useTapeNow and live state; remote unchanged. Acceptance: LIVE zone shows the same item as the Live box in 100 % of samples; at 1040 px the dock does not wrap; contrast audit clean in all themes.
9. **P-07** — One primary button in the live box (Show next), steps become small arrows. Slice: components/PreviewLivePair, QueuePanel footer buttons, webRemote.ts (phone mirrors it), tests for keyboard mapping. Acceptance: The same keystrokes produce the same results as today (existing tests moved); a new test pins the single primary.
10. **P-13** — Phone remote: Media and Tape tabs, a clear blank state, and bigger Blank. Slice: src/main/webRemote.ts (the remote's HTML/CSS/JS), tests in webRemote tests, Chromium and WebKit remote scripts. Acceptance: Remote regression (Chromium and WebKit) passes at 360×640, 390×844 and tablet; banner shown in the blanked state.
11. **P-08** — Rows: one click selects, one key shows; actions appear on hover or focus. Slice: BiblePanel, SermonFollowView, SongsPanel, MediaPanel row components; ContextMenu entries unchanged. Acceptance: Click never changes what is live unless the setting is on (CLAUDE.md rule); keyboard Enter shows; every row still reachable by Tab.
12. **P-12** — First run: a short "Set up Sunday" checklist and quick-start templates. Slice: QueuePanel empty state, Preflight, a templates module (data only), Help. Acceptance: Fresh profile shows the checklist; each step performs the real action; dismissal persists.
13. **P-06** — A Run view for services: queue and live first, finding tucked away. Slice: App.tsx layout, new RunView component reusing QueuePanel rows, PreviewLivePair, DrillShell slide-over; CommandPalette launch. Acceptance: In Run view at 1040×640 the queue shows ≥ 7 rows, Show next ≥ 44 px high; ⌘K → verse → Show works without leaving Run view; undo and Esc rules unchanged.

Every slice follows the repo rules: typecheck, the full suite, a production build, the regression scripts (`scripts/regression/run-all.sh`), the contrast audit in all three themes, a short real-app run on an isolated profile, then commit and push.

---

## P-02 · One vocabulary for sending something to the screens

Effort **S** · Risk **low** · Impact **high**

**In one line.** "Project", "Take", "Put on the screen", "Show", "Hide screen", "Blank" and "Clear" are used for overlapping things. Pick one word per job and use it on every surface.

**Problem and evidence.** The same action is called Project (verse buttons, search results), Take next (live box), "Put verse 1 on the screen" (accessible name), "Tap a verse to put it on screen" (hint), Show (Tape: "Put on the screens"), and the phone says Next/Blank. Hiding is Hide screen / Show screen / Blank / Clear / "Screen hidden" / Esc, depending on where you are. A volunteer who has used the app twice cannot tell whether "Clear" removes the queue item or the live text.

**The change.** A short glossary used everywhere (operator app, phone, Help, manual, tooltips): SHOW = send to the screens now; NEXT / BACK = step through the queue; HIDE SCREEN / SHOW SCREEN = the blackout (Esc); CLEAR = remove the text but keep the screens on; PROJECTION = the window (Open / Close). "Project" and "Take" disappear from the UI.

**Benefit in a service.** One word to learn per job; the manual and the phone match the app; fewer mistakes about what a button does.

**Files / modules.** String changes only: App.tsx, QueuePanel/Preview components, BiblePanel, SongsPanel, SermonFollowView, MediaPanel, Tape components, webRemote.ts (phone), docs/manual. A tests/strings check keeps the glossary.

**Migration path.** Strings only. Keep the old words as search keywords in the command palette (typing "project" still finds "Show").

**Stays for v1 familiarity.** v1 users know "Project": the palette and Help list "Project = Show". The v1 manual already says Project.

**Acceptance.** A repo test fails if "Project" or "Take" appears in operator-facing strings; the phone and app agree on every label.

Mockup: `mockups/proposals.html#P-02`

## P-03 · Service queue: one File menu, one readiness chip, room for more rows

Effort **S** · Risk **low** · Impact **high**

**In one line.** Seven text buttons in two rows (New, Open, Import, Save, Save + pictures, Open pack, Check) collapse into File ▾ plus an "Is tonight ready?" status chip.

**Problem and evidence.** The queue toolbar takes two rows (about 70 px) before the first queue row; at 1366×768 the list shows six rows and at 1040×640 only two. "Open" exists four times (rail, toolbar, empty-state button, palette). The phone remote already uses a compact File ▾ / Save / Edit group, so the two surfaces disagree. The readiness check ("Check") is the thing a volunteer needs before service, but it is the quietest word in the row.

**The change.** Toolbar: File ▾ (New, Open…, Import…, Save, Save + pictures, Open pack…), Edit, and a status chip: ✓ Ready / ⚠ 2 to fix (opens "Is tonight ready?"). The empty state keeps one "Open a saved service…" button. The rail Open button goes (see P-04).

**Benefit in a service.** About 36 px more list height (two more queue rows); the readiness state is visible without opening anything; phone and desktop share the same File pattern.

**Files / modules.** components/QueuePanel (toolbar), App.tsx (rail Open), Preflight.tsx (chip data), CommandPalette (same commands), phone: unchanged.

**Migration path.** No data change. Keyboard: ⌘O / ⌘S unchanged.

**Stays for v1 familiarity.** File ▾ matches the v1 phone remote; v1 desktop had the same text buttons, so the first-time tooltip says "New, Open, Save are under File".

**Acceptance.** Queue list shows ≥ 8 rows at 1366×768; the chip turns amber when a check item fails; every old action reachable in ≤ 2 clicks.

Mockup: `mockups/proposals.html#P-03`

## P-09 · Bigger targets where it matters (Fitts) and a minimum size everywhere

Effort **S** · Risk **low** · Impact **med**

**In one line.** The measured controls under 24 px (Help, Shortcuts, subtabs, "Add pictures", filters) become at least 32 px; Show, Hide screen, Play and Panic at least 40 px.

**Problem and evidence.** A DOM probe at 1366×768 found, per section, 10–15 visible controls under 24 px high and 19–28 under 32 px (of 32–46 visible): btn-sm, subtabs, Help, filters. Open/Close projection and Hide screen, the controls that matter most under pressure, are only 28 px high. The phone remote already meets 44 px.

**The change.** A target-size token (min 32 desktop, 40 for live-critical, 44 on touch) applied to btn-sm, subtabs and links; Show, Hide screen, Play get the larger tier. No visual redesign; padding only.

**Benefit in a service.** Fewer mis-clicks on a trackpad in a dark booth; easier on touch laptops.

**Files / modules.** App.css (.btn-sm, .panel-subtab, .btn-quiet), component CSS; one new test that scans the CSS for heights under the minimum.

**Migration path.** None.

**Stays for v1 familiarity.** Same look, slightly roomier.

**Acceptance.** A DOM probe finds no interactive control under 32 px except text links inside paragraphs; live-critical ≥ 40 px.

Mockup: `mockups/proposals.html#P-09`

## P-10 · Skip links, landmarks and a content-first tab order

Effort **S** · Risk **low** · Impact **med**

**In one line.** Reaching the first control of a section takes 26 Tab presses; there is no skip link and no heading level 1.

**Problem and evidence.** Keyboard-only walkthrough: Tab starts in the header (13 stops) and the rail (8 stops) and the section tabs (5) before the content. There is no "skip to content", no h1, the queue pane is not a landmark, and Tab does not reach the queue pane from the content without crossing everything again.

**The change.** Skip links ("Skip to content", "Skip to the queue", "Skip to the live controls") visible on focus; one h1 per section; the queue pane as a complementary landmark; F6 cycles the main regions (header, rail, content, queue, dock).

**Benefit in a service.** Keyboard operators and screen-reader users reach their target in 1–2 keystrokes; the same F6 helps sighted keyboard users.

**Files / modules.** App.tsx (skip links, landmarks, F6), a11y test additions.

**Migration path.** None.

**Stays for v1 familiarity.** Nothing changes for mouse users.

**Acceptance.** Tab from page start reaches "Skip to content" first; F6 cycles regions; axe landmark and heading checks pass.

Mockup: `mockups/proposals.html#P-10`

## P-04 · Left rail: Find / Tape / Service groups and one selection colour

Effort **S** · Risk **low** · Impact **med**

**In one line.** Eight rail buttons in one list, each section highlighted in its own colour (green, orange, teal, white, plum). Group them and use one meaning for colour.

**Problem and evidence.** Selected Bible is green, Songs orange, Media teal, Tape white, Queue plum, Saved and Open plain. Colour is supposed to carry meaning (red = live only, plum = the action colour, blue = screens), so five accent colours that mean nothing but "this section" dilute it. Saved and Open are service-file actions, not places to browse, but sit among the places. On a short window the last buttons fell off the bottom (fixed as a bug: the rail now scrolls).

**The change.** Three labelled groups: FIND (Sermons, Bible, Songs, Media), LISTEN (Tape), SERVICE (Queue with its count, Saved, Open moves into File ▾ per P-03). Selected state is one plum wash for all; the section keeps its own colour only inside its own panel (a small stripe), where it helps recognition.

**Benefit in a service.** The rail reads at a glance; colour regains its meaning; fewer controls to scan.

**Files / modules.** App.tsx (rail), App.css (.rail-btn colour modifiers), TapeRailButton.tsx; themeContrast test already covers the tokens.

**Migration path.** None. Rail order of the first four stays.

**Stays for v1 familiarity.** Same icons and order for Sermons, Bible, Songs.

**Acceptance.** One selected colour in all three themes (contrast tests pass); Queue count badge unchanged; keyboard order top to bottom.

Mockup: `mockups/proposals.html#P-04`

## P-01 · A header with zones: the "on air" cluster, and a menu for the rest

Effort **M** · Risk **low** · Impact **high**

**In one line.** 13 header controls in one row become three groups: find (search, history), ON AIR (Screens, Hide screen, Message, Open/Close projection) and a ⚙ menu (appearance, Help, Shortcuts, Remote).

**Problem and evidence.** The header holds 13 controls of four different kinds in one flat row: navigation, search, appearance (theme, contrast), help, and the live controls. Help, Shortcuts, theme and contrast are used once a month; Hide screen, Message and Close projection are used every service, yet look the same. With the screens live at 1040 px the row did not fit (the search button was squeezed to 22 px and the logo overlapped; fixed as a bug, but the cause is the number of controls). At a 150 % interface scale the row needed a second line.

**The change.** Left: logo, history, search. Right: one bordered ON AIR cluster (a red outline while the screens are live) with Screens ▾, Hide screen, Message and Open/Close projection. Far right: Remote (shows a phone count when connected) and a ⚙ menu that holds Appearance (theme, high contrast, interface size), Help and Keyboard shortcuts. Seven controls instead of thirteen, and the live ones are grouped where the eye lands first.

**Benefit in a service.** Faster to find the screens controls; no wrapping at 1040 px even with the screens live; fewer wrong clicks on a rarely used control; room to add things later without another overflow.

**Files / modules.** src/renderer/src/App.tsx (header), App.css (.app-header, .header-actions), components/ScreensMenu.tsx, RemotePanel.tsx; a new small SettingsMenu component reusing ContextMenu.

**Migration path.** No data change. Shortcuts stay (?, F1, Alt+←/→, ⌘K). The ⚙ menu also lists the shortcut next to each item so v1 users find them.

**Stays for v1 familiarity.** Hide screen / Message / Screens stay in the same screen position (to the right of the search), so muscle memory holds.

**Acceptance.** At 1040×640 with the screens live the header has no overlap and no wrap; every item reachable by keyboard; theme/contrast/size work from the ⚙ menu; the Esc rule is unchanged.

Mockup: `mockups/proposals.html#P-01`

## P-11 · Appearance and interface size in one place

Effort **S** · Risk **low** · Impact **low**

**In one line.** Theme and high contrast are header buttons, the interface size is only in the command palette, and language/fonts are elsewhere. Put them in the ⚙ menu (P-01).

**Problem and evidence.** The interface size (100–175 %) is the one setting that decides whether the app is usable on a small or very large screen and it is found only through the palette ("Interface size…"). Theme and contrast are two separate icon buttons whose icons are not self-explanatory (a sun and a half-filled circle).

**The change.** ⚙ Appearance: Theme (Dark / Light), Contrast (Normal / High), Interface size (Auto / 100 / 125 / 150 / 175 %) with a live preview line. The two icon buttons leave the header.

**Benefit in a service.** Discoverable; one decision at a time.

**Files / modules.** SettingsMenu (new), uiScale.ts, useTheme.ts.

**Migration path.** Existing choices persist (same storage keys).

**Stays for v1 familiarity.** The sun and contrast icons remain in the menu next to the words.

**Acceptance.** All three settings reachable by keyboard; persisted; reduced-motion respected.

Mockup: `mockups/proposals.html#P-11`

## P-05 · A "Now" dock: what is on air, the tape, and the connections in one bottom strip

Effort **M** · Risk **med** · Impact **high**

**In one line.** The status bar (On air · 3 displays · 12 in queue) and the tape bar are two stacked strips; the question "what is on screen right now?" is answered by a small word. Merge them into one 56 px dock.

**Problem and evidence.** "What is live right now" must be obvious in under a second. Today it is a red "On air" word in a 12 px status bar plus a small LIVE box in the queue pane that disappears when the queue pane is hidden; the tape bar (57 px) sits above the status bar (~30 px), so two strips cost ~87 px of a 640 px window. Connections (screens, stage, phone, OBS) are only visible by opening Screens ▾ or Remote.

**The change.** One dock: left zone LIVE (red outline, type icon, title, "on screen 0:42", Hide screen when live; grey "Nothing on screen" when not); middle zone the tape (play, ±10 s, paragraph, seek, volume; hidden with no tape); right zone small status dots for Screens, Stage, Phone, Output with a click-through to a status popover (see backlog: status centre).

**Benefit in a service.** "What is live" is answered in one glance in every section, with the queue pane open or shut; about 30 px back; one place for problems.

**Files / modules.** components/GlobalTapeBar.tsx/.css, status bar in App.tsx (.status-bar), new NowDock component using useTapeNow and live state; remote unchanged.

**Migration path.** The tape bar keeps all its behaviour and shortcuts; the status bar text moves. Toast lift (body:has(.gtb)) is updated.

**Stays for v1 familiarity.** The v1 status bar content (On air, displays, queue count) is kept as the right zone.

**Acceptance.** LIVE zone shows the same item as the Live box in 100 % of samples; at 1040 px the dock does not wrap; contrast audit clean in all themes.

Mockup: `mockups/proposals.html#P-05`

## P-07 · One primary button in the live box (Show next), steps become small arrows

Effort **M** · Risk **med** · Impact **high**

**In one line.** "Take next" and "Next ›" are two big purple buttons that do different things. Keep one primary: Show next.

**Problem and evidence.** The live box has two same-weight purple buttons: Take next (send the previewed item live) and Next › (step the queue forward) plus Back ‹ and Clear. In the manual they are explained at length. Under stress the likelihood of pressing the wrong one is real: Next moves on without the volunteer noticing what is previewed.

**The change.** Show next ▸ is the only large primary (Space, as today). Back/Next become compact arrows beside the title of the Preview box ("‹ 3 of 12 ›"). Clear and Hide screen sit on the Live box. Colour: plum = action, red = live only.

**Benefit in a service.** One obvious action; accidental step-forward is less likely; the live box is shorter (about 40 px).

**Files / modules.** components/PreviewLivePair, QueuePanel footer buttons, webRemote.ts (phone mirrors it), tests for keyboard mapping.

**Migration path.** Keyboard stays: → / Space next, ← back. Phone: Prev/Next stay big (a phone has no keyboard).

**Stays for v1 familiarity.** Space/arrow behaviour is identical.

**Acceptance.** The same keystrokes produce the same results as today (existing tests moved); a new test pins the single primary.

Mockup: `mockups/proposals.html#P-07`

## P-13 · Phone remote: Media and Tape tabs, a clear blank state, and bigger Blank

Effort **S** · Risk **low** · Impact **med**

**In one line.** The remote has Queue, Sermons, Bible, Songs but no Media or Tape tab; when the screen is hidden the only sign is the colour of the Blank button.

**Problem and evidence.** The remote's bottom navigation (phone) and side rail (tablet) list Queue, Sermons, Bible and Songs (Media and Tape have no tab of their own); the Blank button is amber in both states (blanked or not); there is no "Hidden" banner. The tape card appears only when a tape is loaded.

**The change.** Add Media (pictures and the Send-to-screen shortcut) and Tape tabs (the tape card plus the follow list); a full-width "SCREEN HIDDEN — Show" banner when blanked; Blank grows to 56 px.

**Benefit in a service.** The person holding the phone can do everything a walking operator needs; state is obvious without reading colours.

**Files / modules.** src/main/webRemote.ts (the remote's HTML/CSS/JS), tests in webRemote tests, Chromium and WebKit remote scripts.

**Migration path.** None; the remote auto-updates with the app.

**Stays for v1 familiarity.** The v1 remote tabs and layout are unchanged.

**Acceptance.** Remote regression (Chromium and WebKit) passes at 360×640, 390×844 and tablet; banner shown in the blanked state.

Mockup: `mockups/proposals.html#P-13`

## P-08 · Rows: one click selects, one key shows; actions appear on hover or focus

Effort **M** · Risk **med** · Impact **med**

**In one line.** Every Bible verse and sermon paragraph carries "+ Queue" and "Project" buttons and also says "Tap a verse to put it on screen". Choose one gesture.

**Problem and evidence.** Each row has three ways to send it (click the row, Project, Enter) and a fourth to queue (+ Queue, Q). The result: a dense column of repeated buttons (24 verse rows × 2 buttons), large body text that shows only two verses at 1366×768, and uncertainty about whether a click shows or selects.

**The change.** Click selects (and previews); Enter or double-click shows; hover/focus reveals two small buttons (Queue, Show) so the row reads as text. Same pattern for Bible, Sermons, Songs and Media. The hint line says it once.

**Benefit in a service.** Cleaner reading surface; the same gesture everywhere; fewer accidental sends (the single click no longer puts text live).

**Files / modules.** BiblePanel, SermonFollowView, SongsPanel, MediaPanel row components; ContextMenu entries unchanged.

**Migration path.** A one-time hint on first use. Setting "Click shows immediately" for people who prefer v1 behaviour.

**Stays for v1 familiarity.** Right-click menus and keyboard are unchanged.

**Acceptance.** Click never changes what is live unless the setting is on (CLAUDE.md rule); keyboard Enter shows; every row still reachable by Tab.

Mockup: `mockups/proposals.html#P-08`

## P-12 · First run: a short "Set up Sunday" checklist and quick-start templates

Effort **M** · Risk **low** · Impact **med**

**In one line.** A new profile opens straight into an empty Sermons search; nothing tells a first-time volunteer what to do first.

**Problem and evidence.** On a fresh profile the app shows "Type a word or phrase above to search sermon quotes" and an empty queue. There is no first-run guidance beyond Help. The volunteer who has used the app twice has no path from "open" to "ready".

**The change.** An empty-queue card with a four-step checklist (Choose screens → Open projection test pattern → Add tonight's items → Check "Is tonight ready?") and three templates (Sunday morning: song, scripture, sermon, song; Midweek; Funeral). Each step opens the real control; the card disappears once the queue has items and can be re-opened from Help.

**Benefit in a service.** The first service is guided; fewer questions to the owner; templates save ~10 clicks per week.

**Files / modules.** QueuePanel empty state, Preflight, a templates module (data only), Help.

**Migration path.** New profiles only; existing profiles see it once, dismissible.

**Stays for v1 familiarity.** None removed.

**Acceptance.** Fresh profile shows the checklist; each step performs the real action; dismissal persists.

Mockup: `mockups/proposals.html#P-12`

## P-06 · A Run view for services: queue and live first, finding tucked away

Effort **L** · Risk **med** · Impact **high**

**In one line.** When the screens are on and the queue has items, offer a layout that puts the queue, the live and preview boxes and Next/Back at the centre; finding things opens as a slide-over.

**Problem and evidence.** During a service the volunteer mostly steps through a prepared queue, but the layout is the preparation layout: browse columns and a reading pane take two thirds of the window while the queue (the thing in use) has a third, and the Preview/Live pair is at the bottom right at 100 px wide. At 1040×640 the work area is 501 px; at 150 % it is smaller still. The Take/Next/Back buttons are the most important controls and are about 34 px high.

**The change.** A "Run" toggle (also automatic when the projection opens, with a one-line "Back to Prepare") that shows: left, the queue as large rows (current and next highlighted); right, big Preview and Live (about 360 px wide) with Show next, Back, Next, Hide screen as large targets; ⌘K / "Find" opens Sermons, Bible, Songs, Media as a slide-over for a last-minute change. Prepare view stays exactly as today.

**Benefit in a service.** A volunteer at 9:55 sees only what a service needs; the critical buttons become large; a last-minute change is still two keystrokes (⌘K then the verse).

**Files / modules.** App.tsx layout, new RunView component reusing QueuePanel rows, PreviewLivePair, DrillShell slide-over; CommandPalette launch.

**Migration path.** A setting "Switch to Run view when the screens open" (default on for new profiles, off for existing).

**Stays for v1 familiarity.** Prepare = today; nothing is removed.

**Acceptance.** In Run view at 1040×640 the queue shows ≥ 7 rows, Show next ≥ 44 px high; ⌘K → verse → Show works without leaving Run view; undo and Esc rules unchanged.

Mockup: `mockups/proposals.html#P-06`

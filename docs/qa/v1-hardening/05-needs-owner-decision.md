# 05 · Needs owner decision (nothing here was built)

Each item is either a feature, a design preference, a behaviour change, or something I could not verify here. Recommendation first.

| # | Item | Options | Recommendation |
|---|---|---|---|
| 1 | **`release.yml` guard for missing libraries** (see `04-windows.md`, exact diff) | (a) apply the diff; (b) leave | **(a)**, in the same change as any v1.13.2. It is small, changes nothing when libraries are fine, and would have caught the v2 problem. |
| 2 | **v1's npm scripts do not work on Windows** (`npm test` runs no tests; `build:db`, `build:library` fail) | (a) port v2's small Node helper scripts; (b) leave, document "build on Mac/Linux" | **(b)** unless you or a helper will build v1 on a Windows machine. The release does not use these scripts on Windows. |
| 3 | **SEC-01: the remote's `open-service` / `import-service` take any file path** (it can read any `.json`-parsable file the app can reach and put its content in the queue) | (a) restrict to the saved-services folder and `.born` / `.bpservice`; (b) leave | **(a)** in a later v1.x; it changes what the remote can open, so it needs your OK. Unfixed in v2 too. |
| 4 | **PIN / token for the phone remote; CORS `*`** | add (v2 has it) / leave | Feature. Leave in v1; v2 carries it. |
| 5 | **Tell the user when a damaged file was set aside** (`queue.corrupt-…`, `settings.corrupt-…`) | add one line to the existing notice area / leave | Worth doing, but it is new UI. Today the file is kept safely and the log says so. |
| 6 | **Stage label / Next-reference colours are low contrast** (`#3a6186` ≈ 3:1, `#5a5a5a` ≈ 2.7:1 on the stage background) | v2's lighter colours / leave | Yes, CSS-only and tiny, but it is a visible look change on the stage monitor. |
| 7 | **Textarea focus ring is the browser's amber outline** (paste-a-song) | theme it / leave | Leave (it is visible). Design preference. |
| 8 | **Long song titles wrap** across several lines | clamp to 3 lines / leave | Leave. Nothing is clipped. |
| 9 | **Remote tap sizes and tooltips** (scope pills, stage buttons, truncated text) and the **Add-to-Home-Screen sheet stacking on the role prompt** | polish / leave; check A2HS on a real phone first-run | Polish later; check A2HS on a phone first (I could not drive it). |
| 10 | **Remote: offline bar, wake lock, gzip/ETag** | add / leave | Features. Leave. |
| 11 | **Ambiguous display match** (two identical monitors: which one?) | add a warning / leave | Feature. Leave. |
| 12 | **App-window Content-Security-Policy** | do it properly / leave | Needs inline styles moved first; leave. |
| 13 | **Windows console flash during an update** (`updateCheck.ts` spawns `cmd.exe` without `windowsHide`) | add `windowsHide: true` / leave | Add it if you ever see the flash; I could not observe it here, so I did not touch it. It is a one-word change. |
| 14 | **First Ctrl/Cmd+→ right after launch is ignored** because the Sermons search box has the cursor | stop auto-focusing / leave | Leave. Intentional: arrows in a text box move the cursor. |
| 15 | **`apple-mobile-web-app-capable` deprecation warning** on the remote page | swap to the new meta tag / leave | Cosmetic (console only). Leave. |
| 16 | **v2 only: queue virtualisation / `contain: layout`** | — | Not needed: v1 switches sections in 13–23 ms with 600 items. |

## Known limits of what was fixed
- **Fix 16 (empty box)** hides the symbol when text is shown. The projector, stage monitor, queue row and every search now draw clean text, including for items saved earlier. Other places that show saved text directly (for example the phone remote's own queue list, which uses what the desktop sends) get clean text for newly searched items; an already-queued item re-sent from an old saved file may still carry the symbol there. Easy to extend if you see it.
- **Fix 2 (Ctrl/Cmd+R)** applies to the installed app. Please press Ctrl/Cmd+R once in the installer build before releasing (10 seconds; see `06-verification.md`).

# 11 · Release record: BORN v1.13.2 (2026-10-22)

## What was released
- **Version 1.13.2**, tag **`v1.13.2`** (annotated) on merge commit **`4122e4a`** on `main` (merge of `release/v1.13.2`, no squash, no force push, no history rewrite).
- Release: https://github.com/joshmuepu/born-app/releases/tag/v1.13.2, published 2026-10-22 20:36 UTC, **marked Latest**, not a draft, not a pre-release. Release notes = the 1.13.2 changelog text.
- Assets: `BORN-1.13.2-macOS-arm64.dmg` (209,932,812 bytes), `BORN-1.13.2-macOS-x64.dmg` (214,605,305), `BORN-1.13.2-Windows-Setup.exe` (183,610,852). The project publishes no separate checksum files.
- Release workflow run: https://github.com/joshmuepu/born-app/actions/runs/39849166342 (guard, build-db with the new library check, macOS and Windows builds with their smoke tests, publish: all green).
- Branches kept: `v1-hardening` (`baebb97`) and `release/v1.13.2`. The temporary Windows check branches were deleted.

## Commits on `release/v1.13.2` after `v1-hardening`
Version bump to 1.13.2 · changelog entry (every line checked against the commits; one untrue phrase removed) · release.yml library guard · manual pages updated (Esc, Ctrl/Cmd+R, damaged files, read-only data folder) · reload-guard check script.

## Checks before the tag
| Check | Result |
|---|---|
| Typecheck, build | clean |
| Unit tests (`npm test`) | 61 files, 745 tests, all pass |
| Probes (`scripts/qa/run-all.sh`: layout 19, output 6, remote 23, reconnect 8, input 24, flows 8) and the sweep | all pass; **sweep 0 findings** |
| Packaged macOS smoke | 11 / 11 |
| Compat against `origin/main` | output identical for all four old formats and the autosaved queue |
| Identity | version 1.13.2; `com.joshmuepu.born`; "Branham or Nothing"; port 4316; icons `a9dd996d` / `805174be` / `4f3e98c7`; no changes to `build/`, `resources/`; no forbidden files |
| `release.yml` guard, Linux side | passes on the good libraries; **fails when a library is missing** (local, and in CI) |
| `release.yml` guard, Windows side (the real snippet, extracted from the file) | passes on the good packaged app; **fails when `library.db.gz` is missing** (CI) |
| Windows candidate (read-only temporary branch, now deleted) | https://github.com/joshmuepu/born-app/actions/runs/39848670343: typecheck; **61 files, 0 failures**; libraries in the unpacked app: sermons 1,218, paragraphs 104,644, Bible verses 93,285 (3 translations), songs 1,163, slides 5,219; smoke: window loads, libraries seed (152 MB + 27 MB), remote answers, sermon search 200 results, song search 24, Bible lookup; icon: all 7 images byte-identical to `icon.ico`; installer 183,610,908 bytes. (Run 39847338370 built the databases and passed the same, but its guard test hit a CRLF bug in my test harness, not in `release.yml`; the second run reused its databases.) |

## Ctrl/Cmd+R guard: evidence and its limit
A physical key press cannot be injected from here, so the guard was checked in the **real main process** through Node's inspector (`scripts/qa/reload-guard.cjs`): the main window's actual `before-input-event` handler was given synthetic keys.
- Packaged (local build **and the published 1.13.2 macOS installer**): `app.isPackaged` true, one handler on the main window; Ctrl+R, Cmd+R, Ctrl+Shift+R, Cmd+Shift+R are blocked; R alone, Ctrl+F, Ctrl+C, Cmd+V, Esc, Space, arrows, Ctrl+→, Ctrl+Shift+W, Ctrl+Alt+R and key-up are not (16 / 16).
- Development: `app.isPackaged` false, **no** handler, Ctrl+R not prevented, so reload keeps working for developers.
- Code path read: `blockReloadChord()` returns at once unless `app.isPackaged`, and is attached only to the main, projection and stage windows. The key rule is unit-tested.
Limit: a synthetic event through the same handler is not the operating system delivering a key. Hence the one manual line below.

## After the tag
- The published macOS arm64 installer was downloaded, mounted and smoke-tested (11 / 11, version 1.13.2, icon `805174be`) and passed the reload-guard check.
- The in-app update check, run with v1's own `checkForUpdate()` as a 1.13.1 and as a 1.12.1 client against the live GitHub feed: **latest 1.13.2, update offered, installer name `BORN-1.13.2-macOS-arm64.dmg`**; as 1.13.2: up to date. All three download links return 200 (also through the site's `/download/*` redirects).

## Website
Repo `joshmuepu/joshmuepu-site`, commit `1b97d46`, deployed by Netlify from `main`: `born.html` (version labels, `softwareVersion`, date), `changelog.html` (new v1.13.2 entry), `netlify.toml` (three download redirects to the 1.13.2 files). Verified live: https://joshmuepu.com/born.html and https://joshmuepu.com/changelog.html respond 200 with v1.13.2; `/download/mac-arm`, `/download/mac-intel`, `/download/windows` redirect to the 1.13.2 assets. Nothing about v2.

## Rollback notes
- Hide the release from update checks without deleting anything: `gh release edit v1.13.2 --repo joshmuepu/born-app --prerelease` (or unpublish); `latest` falls back to v1.13.1 (its assets are untouched). Revert the site with `git revert 1b97d46` in `joshmuepu-site` (its download redirects would then point at the 1.13.1 files, which still exist).
- Never delete or move the tag. A fix goes out forward as v1.13.3 with a new test.

## The one manual line
Press **Ctrl/Cmd+R once in the installed app: nothing should reload.**

# Is `v2-media-1a` + follow-up + `v2-media-1b` ready to merge into `v2-channels`?

Written for the owner. Checked 2026-10-16 on branch `v2-media-1b` (55 commits ahead of `v2-channels`, which has not moved). **Nothing was merged, tagged or released.**

**Verdict: ready — with two things only you can decide (Windows, and an old `docs/commercial` issue).** Biggest risk: **everything Windows-specific is reviewed and unit-tested but has never run on Windows.**

## Checklist

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Typecheck (`npm run typecheck`) | **pass** | node + web projects clean |
| 2 | Full test suite | **pass** | **1202 passed**, 1 skipped (the opt-in benchmark), 83 files; run repeatedly, stable |
| 3 | Lint | **n/a** | the project has no lint tool configured; nothing to run |
| 4 | Production build | **pass** | `electron-vite build`, worker bundled as its own file |
| 5 | Packaged build on this machine | **pass** (macOS arm64, unsigned, run from the package, isolated profile) | pictures, HEIC/TIFF, PDF, packs, Help, video (import, take, play, seek, Esc, Range 206, preflight). `BORN_TEST_*` hooks confirmed **ignored** when packaged |
| 6 | Packaged build on Windows | **needs-owner** | run the manual workflow `v2 dev build (manual, no release)` and the checklist `docs/qa/windows-church-pc-checklist.md` |
| 7 | v1 compatibility | **pass** | v1.13.0's own queue reader (real file from `../born-v1`) opens a queue with picture, slideshow and video items; no crash, nothing dropped (`src/test/shared/v1Compat.test.ts`). Plain `.born` unchanged |
| 8 | Unknown/newer queue items | **pass** | kept, never opened, never dropped (v2 side); the v1-side two-line hotfix is only a hand-off note (`docs/notes/v1-needs-unknown-item-safety.md`) |
| 9 | `v2-dev-build.yml` cannot publish | **pass** | `on: workflow_dispatch` only; `permissions: contents: read`; no release, tag or push step; installer kept as a workflow artifact for 3 days |
| 10 | `release.yml` unchanged; v1.x.x tag gate | **pass** | `git diff` of `release.yml` against the 1a base is empty. The gate's own regex rejects `v2.0.0`, `v2.0.0-dev.1`, `v1.13`, `v1.13.1-rc1`, `v10.0.0`, accepts `v1.13.2` (tested with the same bash test the workflow uses). **Note:** `.github/scripts/smoke-macos.sh` (called by `release.yml`) now uses an isolated profile and its own ports — a safer script, same pass/fail meaning; it only takes effect from this branch |
| 11 | v2 identity unchanged | **pass** | version `2.0.0-dev.1`, appId `com.joshmuepu.born.v2dev`, productName "Branham or Nothing (v2 dev)", ports and data dir untouched (package.json differs only by the HEIC dependencies and unpacking rules) |
| 12 | No tags, no releases, no merges, v1 / `main` untouched | **pass** | no tag points at this branch; `born-v1` worktree untouched; 12 stale local branches deleted (all fully merged; remotes untouched) |
| 13 | No large media or test videos tracked | **pass** | no video was ever created inside the repository (tests build MP4 boxes in memory; local test clips lived outside it). Largest tracked files: `Songs.zip` 2.9 MB (pre-existing), mockup PNGs ≤ 0.8 MB. The only tracked media files are two tiny pre-existing 1a stubs (`clip.mp4`, `song.mp3`) |
| 14 | **No `docs/commercial` content pushed by this work** | **pass for this work / needs-owner for history** | nothing under `docs/commercial` changed on any branch of this work. **But** `docs/commercial/dependency-audit.md` and `licenses.csv` were committed on 8 Oct (`dcfdbcc`, "read-only audit") and are **already in `origin/v2-channels`** (and the first is in `origin/main`'s history? — it is in `origin/v2-channels`). The rule says never pushed; removing them from the remote needs a history rewrite, so it is your call |
| 15 | New dependencies recorded | **pass / needs-owner** | `libheif-js` (**LGPL-3.0**, unpacked as a replaceable file), `heic-decode`, `jpeg-js`, `utif2`: justification and sizes in `docs/design/dependency-notes.md`. **Counsel:** the LGPL arrangement and the **HEVC patent** question (HEIC photos) |
| 16 | Accessibility / contrast | **pass** | 60 + 60 combinations audited in the real app (follow-up screens; video screens) in dark, light and both high-contrast themes at three window sizes: 0 issues. `themeContrast.test.ts` green. Keyboard: all new controls are buttons/sliders |
| 17 | Documentation | **pass** | Help manual (HEIC, service packs, drive reconnect, videos, remote network picker), troubleshooting, screenshots regenerated, QA reports, design docs, `V1-PARITY.md`, dependency notes |
| 18 | Windows church-PC checklist | **needs-owner** | `docs/qa/windows-church-pc-checklist.md` (photos, HEIC, PDF, packs by USB, unplugged drive, video clips and loops, real phone, OBS, projector, panic keys) |

## Conflict forecast (tried, not committed)

A throw-away worktree of `v2-channels` was merged with `git merge --no-commit --no-ff v2-media-1b`: **"Automatic merge went well"** — **no conflicts**, 281 files changed (26,460 insertions, 268 deletions), then aborted and the worktree removed. `v2-channels` has not moved since the branch point, so a fast-forward is also possible.

## Exact steps for you to approve later (do **not** run until you decide)

1. `git fetch && git log v2-channels..origin/main --oneline` — look at what `main` has (the network-picker fix is already ported on this branch).
2. Run the manual Windows build and the 30-minute checklist first (items 6 and 18).
3. `git checkout v2-channels && git merge --no-ff v2-media-1b -m "Merge v2-media-1b: Media phases 1a, 1a follow-up and 1b (pictures, HEIC/TIFF, service packs, video)"`
4. `npm rebuild better-sqlite3 && npm test` (expect 1202 passed), `npm run typecheck`, then `npm run rebuild:native`.
5. `git push origin v2-channels`. **No tag. No release.** The version stays `2.0.0-dev.1`.
6. Optional afterwards: delete `v2-media-1a`, `v2-media-1a-followup`, `v2-media-1b` locally.

**To bring only the v1.13.1 network-picker port onto `v2-channels` without the media work:** `git checkout v2-channels && git cherry-pick 2d41c3b e17ef57 e05879c fcd43d1` (backend, panel, single-network name, docs), then step 4.

## Risks, biggest first

1. **Windows has never run any of this** (installer, long paths, antivirus delays, drive letters, HEIC speed and memory on a weaker PC, hardware video decoding). Mitigations: the manual workflow and checklist, and every video/picture path having a plain failure message and a preflight check.
2. **Video on a church-class PC** may stutter at 4K or high bit rates; the spikes ran on an M4 Max. Preflight warns; nothing is refused for performance reasons.
3. **LGPL + HEVC patents** (HEIC decoder) — counsel decision before any commercial release.
4. **WebKit/Safari browser outputs** (Graphics follower) are unverified; OBS (Chromium) is measured.
5. `docs/commercial` is already in `origin/v2-channels` history (item 14).

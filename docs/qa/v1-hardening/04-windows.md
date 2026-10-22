# 04 · Windows

## Answer first
**v1's real Windows release path is not broken.** The release builds the databases on Linux, hands them to the Windows leg, and the Windows installer contains
the full libraries (proven below). What v1 does lack is a guard: its Windows smoke test only checks that a window loads, so if a library were ever missing it
would still pass. And v1's own npm scripts (`npm test`, `build:db`, `build:library`) do not work on a Windows machine, which matters only to someone building on Windows.
Per your instruction, the package scripts were **not** changed (G1 not applied); the exact proposed `release.yml` change is at the bottom, **not applied**.

## How it was checked
A temporary, push-triggered, read-only workflow (`contents: read` + `actions: read`, no secrets, no signing, `--publish never`) on the temporary branch `v1-hardening-wincheck`,
cut from `v1-hardening`. The workflow file existed only on that branch. **The branch has been deleted** (remote and local); nothing from it was merged;
`release.yml` and every workflow on `main` are untouched. Runner: `windows-latest` = `windows-2025-vs2026`, Node 20 (as `release.yml` builds), Node 22 for the verifier.

| Run | Link | What it was |
|---|---|---|
| 1 | https://github.com/joshmuepu/born-app/actions/runs/39832307243 | Databases built on Linux exactly as `release.yml` does, verified; **v1's npm scripts run unmodified on Windows**; the first full Windows pack + smoke |
| 2 | https://github.com/joshmuepu/born-app/actions/runs/39834443694 | Windows real path (databases from run 1) + the unit tests on Windows |
| 3 | https://github.com/joshmuepu/born-app/actions/runs/39834951140 | Unit tests on Windows after the test fixes |

## Real path (run 2, job `windows-real-path`): all green
- Install, typecheck, `npm run dist:win -- --publish never` (exactly `release.yml`'s step).
- **Libraries inside the unpacked app** (`dist-installers/win-unpacked/resources`), counted by `scripts/qa/verify-libraries.cjs`: sermons **1,218** · paragraphs **104,644** · Bible translations **3** · verses **93,285** · songs **1,163** · song slides **5,219** (all above the thresholds; the job fails if any is missing or short).
- **Packaged smoke** (`scripts/qa/smoke-windows.ps1`, isolated profile / port / mDNS name): main window loads; libraries seeded into the data folder (`sermons.db` 152 MB, `library.db` 27 MB, same counts again); remote answers `/ping`; the page carries `X-Frame-Options: DENY` (fix 7); sermon search for "faith" returns 200 results, song search 24, a Bible lookup returns a passage.
- **Installer**: `BORN-1.13.1-Windows-Setup.exe`, **175.1 MB**, real PE (MZ header).
- **Icon**: `build\icons\icon.ico` hashes to `4f3e98c7…` (unchanged); `scripts/qa/verify-exe-icon.cjs` reads the packaged exe's icon resources and finds **all 7 images of `icon.ico` byte-for-byte in the exe** (16, 24, 32, 48, 64, 128, 256 px), and none shared with Electron's default exe.

## v1's npm scripts on Windows, unmodified (run 1, job `windows-scripts-as-is`)
| Script | Result on Windows | Why |
|---|---|---|
| `npm test` | **runs no tests** ("No test files found; filter: `run;`, `npm`, `run`, `rebuild:native`") | `;` is not a command separator in `cmd.exe` |
| `npm run build:db` | **fails** (`better_sqlite3.node` is built for Electron's ABI 130, Node 20 needs 115) and the fallback line `ELECTRON_RUN_AS_NODE=1 electron …` is not valid in `cmd` | POSIX env-var syntax |
| `npm run build:library` | **fails** at `prepare:songs`: "The syntax of the command is incorrect" | `mkdir -p`, `unzip` |
Not used by the real pipeline (those two run on Linux in `release.yml`'s `build-db` job, where the fallback form works).

## Windows-only test failures, fixed (tests only)
Run 1 vitest directly on Windows / Node 20: **9 failures in 4 files**. After the four test-only commits: **0**.
| Failure | Cause | Fix |
|---|---|---|
| `webRemote.test.ts` ×5 | the port blocker listened on the IPv6 wildcard; on Windows that does not collide with the remote's IPv4 bind, so the test failed and left the blocker open, timing out the next four tests | `276ca65`: listen on `0.0.0.0`, always close |
| `dbIntegrity.test.ts` | 500 separate inserts took 13 s on a Windows disk | `2938472`: one transaction |
| `songParsers.test.ts` ×2, `songs.test.ts` | pdfjs needs `Promise.withResolvers` (absent on Node 20) | `cfd813c`: test-setup shim |
| the two real-PDF tests | 8–16 s on the runner, over the 5 s default (run 2) | `43c2472`: 60 s limit |
Run 3: **60 files, 741 passed, 1 skipped** (the chmod read-only test cannot run on Windows), 0 failed. (Run at `43c2472`; later commits added Windows-neutral tests.)

## Artifacts
- Installer + smoke logs + icon report: run 2 artifact **`windows-installer-and-logs`**, uploaded 2026-10-22 18:50 UTC, **expires 2026-10-29** (7-day retention).
- Download: `gh run download 39834443694 --repo joshmuepu/born-app -n windows-installer-and-logs`
- Run 1 logs (npm scripts as-is, vitest): artifact `windows-scripts-logs`, same expiry.
- To try the installer on a Windows machine: it is not code-signed, so Windows SmartScreen will warn ("More info" → "Run anyway"), the same as any release.

## Proposed change to `release.yml` (NOT applied; the file is untouched)
Goal: a missing or short library fails the build instead of shipping. Uses only existing steps plus two guards; no behaviour change when libraries are fine.
```diff
   build-db:
     ...
       - name: Build prebuilt library (Bible + songs)
         run: |
           if [ -f resources/bible-cache.db ]; then export BORN_REUSE_BIBLE=1; fi
           npm run build:library
+
+      # Fail here, not after a release: the libraries must exist and be full-size.
+      - name: Verify the libraries
+        run: node scripts/qa/verify-libraries.cjs resources     # Node 22 in this job (node:sqlite)
 ...
   build:
     ...
       - name: Smoke test (Windows)
         ...
           Write-Host "window loaded — killing"
           Stop-Process -Id $p.Id -Force
-          Get-Content $log | Select-String 'BORN starting|did-finish-load|seed complete|already complete'
+          Get-Content $log | Select-String 'BORN starting|did-finish-load|seed complete|already complete'
+          # The packaged app must carry both libraries.
+          # real sizes today: sermons.db.gz 67 MB, library.db.gz 10.8 MB
+          $min = @{ 'sermons.db.gz' = 30MB; 'library.db.gz' = 5MB }
+          foreach ($f in $min.Keys) {
+            $p2 = "dist-installers\win-unpacked\resources\$f"
+            if (-not (Test-Path $p2) -or (Get-Item $p2).Length -lt $min[$f]) { throw "$f missing or too small in the packaged app" }
+          }
```
(The first block needs `scripts/qa/verify-libraries.cjs`, which is on `v1-hardening`; the second is plain PowerShell.)

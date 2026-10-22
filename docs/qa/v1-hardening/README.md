# v1 hardening round (branch `v1-hardening`)

Hardening only. Nothing released, tagged, merged into `main`, or version-bumped. Start from `origin/main` v1.13.1 (`19d4c37`).

| File | What |
|---|---|
| `00-candidates.md` | every bug v2 fixed (with v2 commits), to check against v1 |
| `01-classification.md` | per candidate: shared? reproduced on v1? fixed / n/a / not reproduced / decision, with evidence |
| `02-fixes.md` | each fix: commit, what a person sees, test; "display only" proof for the empty-box fix; judgement calls |
| `03-fresh-hunt.md` | v1's own bugs found, what was checked clean, what could not be driven |
| `04-windows.md` | Windows result (run links, library counts, smoke, icon, installer size, expiry), was v1's pipeline broken, proposed `release.yml` change (not applied) |
| `05-needs-owner-decision.md` | everything not built, with a recommendation each |
| `06-verification.md` | final checks, compat, identity, what could not be verified, the known test flake |
| `07-draft-changelog-v1.13.2.md` | DRAFT release notes for operators (not published) |
| `08-v2-parity.md` | which v1 fix v2 already has (read-only check of `born-again`), and two to port by intent |
| `11-release-record.md` | the v1.13.2 release: tag, assets, checks, update-check result, site changes, rollback |
| `screenshots/` | Filters popover before / after (placeholder UI only, ~55 KB each) |

Probes and helpers are in `scripts/qa/` (scripts only, not shipped). `bash scripts/qa/run-all.sh` repeats the verification on isolated profiles.

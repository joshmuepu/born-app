# Final QA — progress (branch `v2-final-qa`)

**How to resume:** read this file, `docs/qa/final-qa/README.md` (base), `coverage.md` (matrix, regenerate with `node scripts/qa/reconcile.cjs`), `changes.md` (every fix, with commit). Harness: `scripts/qa/` — `lib.cjs` (launcher/CDP), `census.cjs`, `crawl.cjs` (+ `merge-crawl.cjs`), `sweep.cjs` + `checks.js` (+ `selftest/`), `report.cjs`, `scenarios/*.cjs`, `seed.cjs`, `fuzz.cjs`, `perf.cjs`, `probe.cjs`. Local-only output: `qa-out/` (git-ignored). Use `grep -a` on `src/main/remoteAssets.ts` (BSD grep silently reports nothing on it).

## State (update as you go)
- [x] Base branch `v2-final-qa` (from v2-tape-add-redesign = v2-channels + UX build + bundled timing + Tape Add).
- [x] Phase 1 census: static (census.cjs), runtime crawl (8 parallel crawls → 315 distinct surfaces), manual-check. Reconcile: `reconcile.cjs`.
- [~] Phase 2 sweeps: round 1 done (7 variants × 315), fixes F-001…F-022; round 2 running (9 variants). Need two consecutive clean rounds.
- [~] Phase 3 scenarios: first-run, service, outputs (projector/stage/Graphics/phone), tape done once; resilience, fuzz, perf, packaged still to run.
- [ ] Phase 4 Windows (temp push-triggered CI branch, since workflow_dispatch needs the workflow on `main`).
- [ ] Wrap-up: full gate, packaged smoke, compat checks, review pack.

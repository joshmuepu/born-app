# Final QA — base and method

## Base (verified with `git merge-base --is-ancestor`)
`v2-final-qa` was branched from `v2-tape-add-redesign` (tip `8da9460` + later commits), which already contains **v2-channels** (`54c3ac3`) and **v2-ux-build** (the Now dock, Run view, glossary, bundled automatic timing) and the **Tape Add redesign**. `v2-channels` itself does not yet contain the UX build or the Tape Add work (it is 43 commits behind this branch); nothing was merged into it.
Not included on purpose: `v2-media-spikes` (spikes), `v2-ops-readiness-local-only` (local-only by its name), `v2-sermon-audio-design` / `v2-media-design` (already ancestors of v2-channels).

## v1 parity note (CLAUDE.md rule)
`origin/main` has 6 commits not in this line: **v1.13.1** (Remote network selector, per-address connection check, network ranking, mDNS per adapter). Per the project rule they were NOT merged; they need a decision from the owner (see `docs/V1-PARITY.md`).

## Method
Census (static + runtime + docs) → sweep harness over surface × state × theme × size × scale → live scenarios → fix and re-sweep until two clean sweeps. Screenshots stay in `qa-out/` (git-ignored; they may show the real library).

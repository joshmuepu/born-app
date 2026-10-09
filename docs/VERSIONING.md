# Versioning and the v1 / v2 split

This repository holds two product lines that share a codebase but are at very
different points in their life:

- **v1** (`main` branch) is the **released** product — the one a real church
  installs and uses on Sunday. It gets fixes and small improvements, shipped
  as `v1.x.x` GitHub Releases.
- **v2** (`v2-channels` branch) is **unreleased** internal work-in-progress —
  multi-channel/multi-output support, the automation API, a built-in manual,
  and more. It is not installed anywhere real yet. It will be **rebranded and
  launched in 2027**, not before.

Until that launch, v2's job is simple: **it must receive every fix that lands
on v1.** A bug fixed for the church running v1 today is still a bug in v2's
codebase tomorrow unless it's ported over.

## How the two are kept apart

- **Version numbers.** v1 uses ordinary `1.x.x` semver. v2's `package.json`
  version is a pre-release string (`2.0.0-dev.N`) — never a bare `2.x.x` —
  so it's never mistaken for a real release at a glance, and so the
  major-version guard below actually has something distinct to compare
  against.
- **App identity.** v2's `appId` and `productName` (`package.json`) and its
  `app.setName()` call (`src/main/index.ts`) are all deliberately different
  from v1's. This isn't cosmetic — it's what keeps a v2 build's default
  install location, macOS bundle identity, Windows registry entry, and
  userData directory (settings, sermons.db, library.db) from ever colliding
  with a real v1 install on the same machine, with no extra configuration
  required.
- **Update checks.** `src/main/updateCheck.ts` only offers an update within
  the same major version (`sameMajor()`). GitHub's release feed returns
  whichever release is newest *by publish date*, not by version number, so
  without this guard a v1 install could theoretically be offered a v2
  preview, or vice versa.
- **The release workflow.** `.github/workflows/release.yml`'s tag guard only
  accepts `v1.x.x` tags — a `v2.x.x` tag cannot trigger a public release,
  from any branch. v2 can still be built and smoke-tested via the workflow's
  manual `workflow_dispatch` trigger, which never publishes.

## Porting a v1 fix to v2

After every v1 release:

1. On `v2-channels`, merge `main` into it (`git merge origin/main`) — this is
   preferred over cherry-picking so the history shows v1's work as an
   ancestor of v2's, and so future merges stay simple instead of compounding
   divergence. Only fall back to cherry-picking a specific commit if the merge
   conflicts are large enough that merging everything at once isn't safe to
   resolve confidently.
2. Resolve conflicts by combining both sides, not picking one — v2's own
   features (the automation API, Graphics destination, multi-channel support,
   the in-app manual) must survive every merge alongside whatever v1 just
   fixed. When the same dev-only escape hatch or similar utility exists on
   both sides already, keep one copy, not two.
3. Run typecheck and the full test suite on v2-channels after the merge.
4. Rehearse v2's own flows (Screens, Channels, the automation API) in an
   isolated profile — a clean v1 merge can still break something that only
   v2 exercises.
5. Update the v2 manual for anything whose behavior or screenshots changed.
6. Push `v2-channels`. Never merge `v2-channels` back into `main`, and never
   push a `v2.x.x` tag.

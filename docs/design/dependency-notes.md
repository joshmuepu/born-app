# Dependency notes for the commercialization list

For whoever maintains `docs/commercial/dependency-audit.md` and `licenses.csv`
(those files are not edited from this branch; this note is the source to copy from).

## Added by the Born Again UI pass

| Package | Version (exact) | License | Used in | Why |
|---|---|---|---|---|
| `@tanstack/react-virtual` | 3.13.12 | MIT | renderer only (`VirtualList.tsx`) | Windows very long lists — a 25,000-hit search, a 1,600-row sermon, a 2,000+ song library — so only the rows near the viewport are in the DOM. Measured: search first paint 4.4 s → 0.29 s; longest sermon 261 ms → 66 ms. |
| `@tanstack/virtual-core` | 3.13.12 | MIT | transitive of the above | The framework-agnostic engine. |

- **Source:** https://github.com/TanStack/virtual · **Copyright:** (c) 2021-present Tanner Linsley
- **Size:** about 12 kB of ES modules for the React adapter; no native code, no install scripts, no network access at runtime.
- **Bundled into:** the renderer bundle (shipped inside the app); not used by the main process, the projection window, the stage window or the phone remote.
- **Pinned** with `--save-exact` in `package.json`.
- **Attribution:** MIT requires the copyright and licence text to ship with the app; the existing third-party notices mechanism should list it.

## Not added (tooling only, never in `package.json`)

Playwright 1.49.1 (Apache-2.0) was installed in a scratch directory outside the repository to drive the real
app with real mouse input and to load the phone remote in WebKit. It is a test aid, not a dependency of the
product, and is not in the lockfile.

## Not changed

No existing dependency was upgraded or removed in this branch.

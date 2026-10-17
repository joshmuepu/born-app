# Recommendations (ideas and bigger changes NOT made during the final QA)

Kept here instead of changed, because each is more than polish or needs an owner decision.

1. **Merge v1.13.1 into v2** (Remote network selector, per-address connection check) — decision needed (CLAUDE.md: never merged without being asked). See `docs/V1-PARITY.md`.
2. **Content-Security-Policy for the renderer windows.** Electron's "Insecure Content-Security-Policy" warning appears in development runs (it is not shown by a packaged app). A strict CSP needs the inline styles in a few components moved out; worth doing before any public release.
3. (more are added as the sweeps find things)

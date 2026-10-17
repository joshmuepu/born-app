# Changes made during the final QA (each is its own commit; revert any one)

| # | Sev | Where | Before | After | Why | Commit |
|---|---|---|---|---|---|---|
| F-001 | P1 | Application menu (`src/main/appMenu.ts`) | Electron's default menu: View → Reload / Force Reload / Toggle Developer Tools / Zoom In / Zoom Out, and a Help menu that opens Electron's website. A stray Ctrl+R reloads the operator window mid-service; browser zoom is shared with the projector (the app's own interface size is CSS zoom on purpose). | BORN's own menu: Edit, full screen, window, Quit; Help → Open the manual / Keyboard shortcuts (the app's own screens). Reload and Developer Tools only in a development run; no Zoom anywhere. | Live safety + consistency | (next commit) |

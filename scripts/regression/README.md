# Regression passes (real app, fresh throw-away profile)

`bash scripts/regression/run-all.sh` starts the dev app on a fresh profile for each script (BORN_USER_DATA_DIR, BORN_REMOTE_PORT=4317, BORN_MDNS_NAME) and prints `N checks, M failed`:

| script | what |
|---|---|
| hist | Alt+Left/Right history, mouse back button, nothing goes on the screen |
| dnd | queue drag-and-drop, keyboard reorder, live row stays live |
| az | songs A–Z, search and browse |
| reg | Channels / Destinations / Profiles, Remote popover and connection check, Help viewer |
| rem | phone remote layouts (Chromium + WebKit, themes, offline) |
| gfx2 | Graphics page: blank, suppress, profile with Auto off (creates the Graphics page it needs) |
| rtabs (`remote-tabs.cjs`) | phone and tablet remote: Media and Tape tabs, Show / + Queue, the SCREEN HIDDEN banner |
| flows | key service flows through the real UI with action counts: ⌘K → verse → Enter, Esc rules, Run view, skip link |
| contrast | rendered text contrast of the main screens in all four themes (AA; AAA in high contrast) |

Needs `npm run rebuild:native` (Electron build of better-sqlite3) and Playwright in `PW_DIR` (default /tmp/born-pw). Last run: hist 10/0, dnd 20/0, az 656/0, reg 43/0, rem 64/0, gfx2 7/0 (checks/failed).

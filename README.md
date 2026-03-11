![BORN](build/icons/icon.png)

# BORN — Branham or Nothing

A free, open-source desktop application for believers to search William Branham sermon quotes, build service queues, and project them on a second screen — fully offline.

**[Download for Mac, Windows, or Linux →](https://github.com/joshmuepu/born-app/releases/latest)**

---

## Features

- **Instant full-text search** across 1,217+ William Branham sermons
- **Service queue** — add quotes, reorder, and navigate with keyboard shortcuts
- **Second-screen projection** — send quotes to a dedicated projection window
- **Offline-first** — the full sermon database is stored locally, no internet required
- **Autocomplete** — word suggestions as you type
- **Filters** — search by year range, sermon title, or phrase/all-words mode

## Download

| Platform | Link |
|----------|------|
| macOS (Apple Silicon) | [Branham.or.Nothing-0.1.0-arm64.dmg](https://github.com/joshmuepu/born-app/releases/latest) |
| macOS (Intel) | [Branham.or.Nothing-0.1.0.dmg](https://github.com/joshmuepu/born-app/releases/latest) |
| Windows | [Branham.or.Nothing.Setup.0.1.0.exe](https://github.com/joshmuepu/born-app/releases/latest) |
| Linux | [Branham.or.Nothing-0.1.0.AppImage](https://github.com/joshmuepu/born-app/releases/latest) |

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist:mac     # macOS
npm run dist:win     # Windows
npm run dist:linux   # Linux
```

Built with [Electron](https://electronjs.org), [React](https://react.dev), [electron-vite](https://electron-vite.github.io), and [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## License

MIT — [joshmuepu.com](https://joshmuepu.com)

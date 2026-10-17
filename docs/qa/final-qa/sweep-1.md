# Sweep 1

Distinct findings: **315** (P0 0, P1 121, P2 194)

| Sev | Check | Count |
|---|---|---|
| P1 | no-focus-indicator | 10 |
| P1 | outside-viewport | 10 |
| P1 | overlap | 78 |
| P1 | page-h-scroll | 1 |
| P1 | target-small | 18 |
| P1 | text-spills-out | 4 |
| P2 | console | 1 |
| P2 | many-primary-buttons | 11 |
| P2 | target-below-32 | 135 |
| P2 | truncated-no-tooltip | 1 |
| P2 | unreachable | 46 |

## Findings

| Sev | Check | Where (selector) | Text | Detail | Variants | States |
|---|---|---|---|---|---|---|
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Sermons |  | dark,light,dark-hc,light-hc… | 79 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Queue 10 |  | dark,light,dark-hc,light-hc… | 177 |
| P1 | no-focus-indicator | `input#born-search-input` |  |  | light,dark,narrow,scale150… | 13 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Bible |  | dark,light,dark-hc,light-hc… | 38 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Media |  | dark,light,dark-hc,light-hc… | 41 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Saved: favorites and recents |  | dark,light,dark-hc,light-hc… | 80 |
| P1 | no-focus-indicator | `div.palette-overlay > div.palette > div.palette-input-row > input.palette-input` |  |  | dark,light,dark-hc,light-hc… | 45 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Songs |  | dark,light,dark-hc,light-hc… | 41 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Tape |  | dark,light,dark-hc,light-hc… | 76 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Queue |  | dark,dark-hc,narrow,4k… | 21 |
| P1 | outside-viewport | `div.nd-main > div.nd-status > div.status-trigger-wrap > div.status-popover` | check for updates You're on the latest version (2. | left 1257 right 1580 of 1366 | dark,light,dark-hc,light-hc… | 2 |
| P1 | outside-viewport | `div.nd-status > div.status-trigger-wrap > div.status-popover > div.status-popover-row` | check for updates | left 1270 right 1567 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.status-trigger-wrap > div.status-popover > div.status-popover-row > button.status-update-link` | check for updates | left 1270 right 1388 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.nd-status > div.status-trigger-wrap > div.status-popover > div.status-popover-row` | You're on the latest version (2.0.0-dev.1). | left 1270 right 1567 of 1366 | dark,light,dark-hc,light-hc… | 2 |
| P1 | outside-viewport | `div.nd-status > div.status-trigger-wrap > div.status-popover > div.status-popover-row` | ● 1,218 sermons ready Refresh | left 1270 right 1567 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.status-trigger-wrap > div.status-popover > div.status-popover-row > span.status-text` | ● 1,218 sermons ready | left 1270 right 1415 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.status-trigger-wrap > div.status-popover > div.status-popover-row > button.btn-secondary` | Refresh | left 1423 right 1489 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.nd-status > div.status-trigger-wrap > div.status-popover > div.status-popover-row` | Open data folder | left 1270 right 1567 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.status-trigger-wrap > div.status-popover > div.status-popover-row > button.btn-secondary` | Open data folder | left 1270 right 1385 of 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | outside-viewport | `div.nd-main > div.nd-status > div.status-trigger-wrap > div.status-popover` | check for updates ● 1,218 sermons ready Refresh Op | left 1257 right 1502 of 1366 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | Me at the zoo Me at the zoo Show Remove | with "Main" 48x12 | dark,light,dark-hc,light-hc… | 169 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | 'Tis So Sweet To Trust In Jesus 2 Line one Line tw | with "Main" 48x11 | dark,light,dark-hc,light-hc… | 169 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | John 3:16 · KJV For God so loved the world, that h | with "Main" 48x26 | narrow | 144 |
| P1 | overlap | `div.queue-section-items > div.queue-row > span.queue-row-actions > button.btn-quiet` | Show | with "Next in the service" 11x11 | narrow,scale150 | 163 |
| P1 | overlap | `div.queue-section-items > div.queue-row > span.queue-row-actions > button.btn-quiet` | Remove | with "Hide screen" 66x15 | narrow,scale150 | 163 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | 'Tis True 2 Line one Line two Show Remove | with "Show next" 120x13 | narrow | 145 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | A Brand New Touch 2 Line one Line two Show Remove | with "App info — Born Again v2.0.0-dev.1" 89x32 | narrow,dark,light,dark-hc… | 145 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | Do You Now Believe? 54-0307E — 3 Just a while ago  | with "Main" 72x11 | scale150 | 143 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | Do You Now Believe? 54-0307E — 4 He said when he w | with "Main" 72x22 | scale150 | 143 |
| P1 | overlap | `div.queue-list > div.queue-section > div.queue-section-items > div.queue-row` | tiny Picture Show Remove | with "Show next" 181x60 | scale150 | 144 |
| P1 | overlap | `div#root > div.app > header.app-header > button.app-logo-born` | Born Again | with "Sermons" 57x19 | scale150 | 78 |
| P1 | overlap | `header.app-header > div.header-actions > div.nav-history > button.btn-icon` | Back | with "Sermons" 14x17 | scale150 | 78 |
| P1 | overlap | `div.panel-view > div.bible-panel > div.panel-subtab-bar > button.panel-subtab` | Search | with "Favorites" 64x30 | dark,light,dark-hc,light-hc… | 18 |
| P1 | overlap | `div.panel-view > div.bible-panel > div.panel-subtab-bar > button.panel-subtab` | Browse | with "Favorites" 33x30 | dark,light,dark-hc,light-hc… | 18 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 86% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | dark,light | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 90% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | dark-hc,light-hc,narrow | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 94% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | narrow,scale150,4k | 2 |
| P1 | overlap | `div.drill-left > div.media-left > div.media-cats > button.media-cat` | All media 13 | with "Favorites" 101x10 | dark,light,dark-hc,light-hc… | 16 |
| P1 | overlap | `div.media-left > div.media-items-col > div.media-toolbar > select.media-sort` | Sort pictures | with "Close" 32x30 | dark,light,dark-hc,light-hc… | 15 |
| P1 | overlap | `div.media-items-col > div.media-toolbar > div.media-search > input` | Search pictures | with "Recent" 10x31 | narrow,scale150,4k,dark… | 15 |
| P1 | overlap | `header.app-header > div.header-actions > div.appearance-menu > button.btn-icon` | Settings and help | with "Close" 24x25 | scale150 | 34 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | Phrase | with "Quick start" 95x15 | scale150,dark,light,dark-hc… | 9 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | All words | with "Quick start" 7x15 | scale150,dark,light,dark-hc… | 9 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-row > input.filter-input` |  | with "Preview, Live, and saving time" 108x28 | scale150,4k | 8 |
| P1 | overlap | `div.filter-popover-wrap > div.filter-popover > div.filter-section > input.filter-input` |  | with "Hiding, clearing, and messages" 108x40 | scale150 | 9 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timed 65-0418M · 2:24: | with "More for It Is The Rising Of The Sun" 32x32 | dark,light,dark-hc,light-hc… | 63 |
| P1 | overlap | `div.panel-view > div.songs-panel > div.panel-subtab-bar > button.panel-subtab` | Search | with "Favorites" 64x32 | dark,light,dark-hc,light-hc… | 10 |
| P1 | overlap | `div.panel-view > div.songs-panel > div.panel-subtab-bar > button.panel-subtab` | Browse | with "Favorites" 33x32 | dark,light,dark-hc,light-hc… | 10 |
| P1 | overlap | `div.panel-subtab-bar > span.songs-view-toggle > div.browse-view-toggle > button.active` | Grid view | with "Close" 17x31 | narrow,scale150 | 9 |
| P1 | overlap | `div.panel-subtab-bar > span.songs-view-toggle > div.browse-view-toggle > button` | List view | with "Close" 13x31 | narrow | 9 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 36% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | dark,4k,light | 3 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 40% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | light,dark-hc,light-hc,narrow | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 44% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | light-hc,narrow,scale150,4k | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 48% 65-0418M · | with "More for It Is The Rising Of The Sun" 57x56 | 4k,dark | 3 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 52% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | light,dark-hc,light-hc | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 57% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | narrow,scale150,4k,dark… | 3 |
| P1 | overlap | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button.is-selected` | All songbooks | with "" 150x31 | dark,light,dark-hc,light-hc… | 4 |
| P1 | overlap | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button` | Songs | with "" 150x7 | dark,light,dark-hc,light-hc… | 4 |
| P1 | overlap | `div.songs-panel > div.panel-subtab-bar > div.songs-songbook-menu > button.btn-quiet` | All songbooks | with "" 114x15 | narrow,scale150 | 8 |
| P1 | overlap | `div.songs-panel > div.panel-subtab-bar > div.songs-import-menu > button.btn-secondary` | Import… | with "" 86x15 | narrow,scale150 | 6 |
| P1 | overlap | `div.panel-subtab-bar > div.songs-import-menu > div.songs-import-popover > button` | From a file… | with "" 54x10 | scale150 | 1 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | Any word | with "What's new in v2" 74x14 | narrow | 1 |
| P1 | overlap | `div.drill-left > div.media-left > div.media-cats > button.media-cat` | Backgrounds | with "Show browse columns" 11x8 | narrow,scale150 | 3 |
| P1 | overlap | `div.drill-left > div.media-left > div.media-cats > button.media-cat` | Videos | with "Show browse columns" 17x51 | scale150 | 2 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Search | with "Favorites" 89x32 | dark,light,dark-hc,light-hc… | 10 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Date | with "Favorites" 9x32 | dark,light,dark-hc,light-hc… | 10 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Series | with "Recent" 22x32 | dark,light,dark-hc,light-hc… | 10 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Location | with "Close" 32x32 | dark,light,dark-hc,light-hc… | 10 |
| P1 | overlap | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Sermons | with "All media 13" 55x34 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Bible | with "Favorites" 55x12 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Songs | with "Needs attention" 55x24 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Media | with "Backgrounds" 55x34 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.search-bar-container > div.search-bar > div.filter-popover-wrap > button.btn-secondary` | Filters | with "" 90x27 | dark,dark-hc,narrow,light… | 5 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 23% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | dark,light,dark-hc,scale150… | 5 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 27% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | light,dark-hc,light-hc,narrow… | 4 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 32% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | narrow,scale150,4k | 4 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 61% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | light,dark-hc,light-hc,4k | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 65% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | narrow,scale150,4k,dark… | 2 |
| P1 | overlap | `div.browse-panel > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Search | with "Favorites" 89x30 | dark,light,dark-hc,light-hc… | 4 |
| P1 | overlap | `div.browse-panel > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Date | with "Favorites" 9x30 | dark,light,dark-hc,light-hc… | 4 |
| P1 | overlap | `div.browse-panel > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Series | with "Recent" 22x30 | dark,light,dark-hc,light-hc… | 4 |
| P1 | overlap | `div.browse-panel > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Location | with "Close" 32x30 | dark,light,dark-hc,light-hc… | 4 |
| P1 | overlap | `div.help-content > div.help-markdown > p > a` | Hiding, clearing, and messages | with "The Screens menu" 202x17 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Needs timing 65-0418M  | with "More for It Is The Rising Of The Sun" 32x32 | dark,light,dark-hc | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 1% 65-0418M ·  | with "More for It Is The Rising Of The Sun" 32x32 | light-hc | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 3% 65-0418M ·  | with "More for It Is The Rising Of The Sun" 32x32 | narrow | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 5% 65-0418M ·  | with "More for It Is The Rising Of The Sun" 49x48 | scale150 | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 7% 65-0418M ·  | with "More for It Is The Rising Of The Sun" 57x56 | 4k | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 19% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | dark,dark-hc,light-hc,narrow | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 69% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | light-hc,narrow,scale150 | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 73% 65-0418M · | with "More for It Is The Rising Of The Sun" 57x56 | 4k | 1 |
| P1 | overlap | `div.am-pop > div.am-row > div.am-segs > button.am-seg` | Normal | with "Filters" 51x26 | dark,light,dark-hc,light-hc… | 2 |
| P1 | overlap | `div.appearance-menu > div.am-pop > label.am-check > input` |  | with "" 13x7 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.header-actions > div.appearance-menu > div.am-pop > button.am-item` | Open the manual F1 | with "Done" 51x20 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.header-actions > div.appearance-menu > div.am-pop > button.am-item` | Keyboard shortcuts ? | with "Done" 51x12 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 15% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 | dark,light | 1 |
| P1 | overlap | `section > div.tsp-row > div.tsp-seg > button` | Off | with "App info — Born Again v2.0.0-dev.1" 11x10 | scale150 | 1 |
| P1 | overlap | `section > div.tsp-row > div.tsp-seg > button` | Tape off | with "App info — Born Again v2.0.0-dev.1" 11x23 | scale150 | 1 |
| P1 | page-h-scroll | `html` |  | scrollWidth 1580 > 1366 | dark,light,dark-hc,light-hc… | 4 |
| P1 | target-small | `div.bible-panel-main > div.drill > div.drill-seam > button.drill-handle` | Hide browse columns | 18x56 (<24) | dark,light,dark-hc,light-hc… | 38 |
| P1 | target-small | `div.media-items-col > div.media-actions > label.media-link-toggle > input` |  | 13x13 (<24) | dark,light,dark-hc,light-hc… | 41 |
| P1 | target-small | `div.media-panel > div.drill > div.drill-seam > button.drill-handle` | Hide browse columns | 18x56 (<24) | dark,light,dark-hc,light-hc… | 37 |
| P1 | target-small | `div.status-trigger-wrap > div.status-popover > div.status-popover-row > button.status-update-link` | check for updates | 118x16 (<24) | dark,light,dark-hc,light-hc… | 4 |
| P1 | target-small | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button.is-on` | Highlight | 70x22 (<24) | dark,light,dark-hc,light-hc… | 54 |
| P1 | target-small | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button` | One at a time | 92x22 (<24) | dark,light,dark-hc,light-hc… | 54 |
| P1 | target-small | `div.tp-follow-head > div.tape-screen-row > label.tape-screen-lead > select` | Screen colours | 113x23 (<24) | dark,light,dark-hc,light-hc… | 57 |
| P1 | target-small | `div.browse-panel > div.drill > div.drill-seam > button.drill-handle` | Hide browse columns | 18x56 (<24) | dark,light,dark-hc,light-hc… | 9 |
| P1 | target-small | `div.songs-panel > div.drill > div.drill-seam > button.drill-handle` | Hide browse columns | 18x56 (<24) | dark,light,dark-hc,light-hc… | 29 |
| P1 | target-small | `div.media-panel > div.drill > div.drill-seam > button.drill-handle` | Show browse columns | 18x56 (<24) | dark,light,dark-hc,light-hc… | 4 |
| P1 | target-small | `div.remote-popover > div.remote-popover-body > div.remote-automation > button.remote-automation-head` | Automation API (Stream Deck, Companion) | 306x14 (<24) | dark,light,dark-hc,light-hc… | 2 |
| P1 | target-small | `tbody > tr > td > a` | Troubleshooting | 96x15 (<24) | dark,light,dark-hc,light-hc… | 2 |
| P1 | target-small | `tbody > tr > td > a` | Importing a PDF | 95x15 (<24) | dark,light,dark-hc,light-hc… | 2 |
| P1 | target-small | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button` | Highlight | 70x22 (<24) | dark,light,dark-hc,light-hc… | 3 |
| P1 | target-small | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button.is-on` | One at a time | 92x22 (<24) | dark,light,dark-hc,light-hc… | 3 |
| P1 | target-small | `div.tp-follow-head > div.tape-screen-row > label.tape-screen-lead > select` | Show the next paragraph early, seconds | 60x23 (<24) | dark,light,dark-hc,light-hc… | 3 |
| P1 | target-small | `div.songs-panel > div.drill > div.drill-seam > button.drill-handle` | Show browse columns | 18x56 (<24) | dark,light,dark-hc,light-hc… | 2 |
| P1 | target-small | `div.appearance-menu > div.am-pop > label.am-check > input` |  | 13x13 (<24) | dark,light,dark-hc,light-hc… | 2 |
| P1 | text-spills-out | `div.media-left > div.media-items-col > div.media-actions > button.btn-primary` | Add pictures | by 60px | dark,light,dark-hc,light-hc… | 4 |
| P1 | text-spills-out | `div.media-left > div.media-items-col > div.media-actions > button.btn-secondary` | YouTube | by 35px | dark,light,dark-hc,light-hc… | 4 |
| P1 | text-spills-out | `div.media-left > div.media-items-col > div.media-actions > button.btn-quiet` | Add folder | by 41px | dark,light,dark-hc,light-hc… | 4 |
| P1 | text-spills-out | `div.media-left > div.media-items-col > div.media-actions > button.btn-quiet` | Import PDF | by 48px | dark,light,dark-hc,light-hc… | 4 |
| P2 | console | `console.warning` | %cElectron Security Warning (Insecure Content-Secu |  |  | 275 |
| P2 | many-primary-buttons | `document` | Open projection / Search / Show next | 3 | dark,light,dark-hc,light-hc… | 22 |
| P2 | many-primary-buttons | `document` | Open projection / Add pictures / Show next | 3 | dark,light,dark-hc,light-hc… | 24 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 5 | dark,light,dark-hc,light-hc… | 8 |
| P2 | many-primary-buttons | `document` | Open projection / Done / Search / Show next | 4 | dark,light,dark-hc,light-hc… | 16 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 6 | dark,light,dark-hc,light-hc… | 25 |
| P2 | many-primary-buttons | `document` | Open projection / Done / Search | 3 | light,light-hc,scale150,dark… | 19 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 5 | light,light-hc,scale150,dark… | 43 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 4 | dark,light,dark-hc,light-hc… | 5 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 6 | dark,light,dark-hc | 1 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 4 | dark,light,dark-hc,light-hc… | 4 |
| P2 | many-primary-buttons | `document` | Open projection / ＋ Add recording… / More ways to  | 3 | dark,light,dark-hc,light-hc… | 3 |
| P2 | target-below-32 | `section#live-controls > div.plp-channels > button.plp-channel` | Main | 48x26 | dark,light,dark-hc,light-hc… | 151 |
| P2 | target-below-32 | `section#live-controls > div.plp-channels > button.plp-channel` | Overflow room | 103x26 | dark,light,dark-hc,light-hc… | 151 |
| P2 | target-below-32 | `div.queue-live-bar > section.plp > div.plp-channels > button.plp-channel` | Main | 48x26 | dark,light,dark-hc,light-hc… | 18 |
| P2 | target-below-32 | `div.queue-live-bar > section.plp > div.plp-channels > button.plp-channel` | Overflow room | 103x26 | dark,light,dark-hc,light-hc… | 18 |
| P2 | target-below-32 | `div.bible-controls > div.bible-scope-wrap > div.bible-scope-popover > button.bible-scope-option` | Whole Bible | 252x29 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-controls > div.bible-scope-wrap > div.bible-scope-popover > button.bible-scope-option` | Old Testament | 252x29 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-controls > div.bible-scope-wrap > div.bible-scope-popover > button.bible-scope-option` | New Testament | 252x29 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Gen | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Exod | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Lev | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Num | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Deut | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Josh | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Judg | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Ruth | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Sam | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Sam | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Kgs | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Kgs | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Chr | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Chr | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Ezra | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Neh | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Esth | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Job | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Ps | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Prov | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Eccl | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Song | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Isa | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Jer | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Lam | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Ezek | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Dan | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Hos | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Joel | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Amos | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Obad | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Jonah | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Mic | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Nah | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Hab | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Zeph | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Hag | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Zech | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Mal | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Matt | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Mark | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Luke | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | John | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Acts | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Rom | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Cor | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Cor | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Gal | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Eph | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Phil | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Col | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Thess | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Thess | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Tim | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Tim | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Titus | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Phlm | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Heb | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Jas | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 Pet | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 Pet | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 1 John | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 2 John | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | 3 John | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Jude | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.bible-scope-wrap > div.bible-scope-popover > div.bible-scope-grid > button.bible-scope-book` | Rev | 60x28 | dark,light,dark-hc,light-hc… | 13 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button.is-selected` | All songbooks | 150x31 | dark,light,dark-hc,light-hc… | 11 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button` | Songs | 150x31 | dark,light,dark-hc,light-hc… | 11 |
| P2 | target-below-32 | `div.tp-follow > div.tp-follow-head > label.tp-lang > select` | Text language | 131x27 | dark,light,dark-hc,light-hc… | 69 |
| P2 | target-below-32 | `div.tp-pane > div.tp-follow > div.tp-follow-bar > button.tape-toggle` | Text follows the tape | 165x24 | dark,light,dark-hc,light-hc… | 69 |
| P2 | target-below-32 | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | Phrase | 64x25 | dark,light,dark-hc,light-hc… | 31 |
| P2 | target-below-32 | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | All words | 73x25 | dark,light,dark-hc,light-hc… | 31 |
| P2 | target-below-32 | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | Any word | 74x25 | dark,light,dark-hc,light-hc… | 31 |
| P2 | target-below-32 | `div.filter-popover > div.filter-section > div.filter-row > input.filter-input` |  | 130x28 | dark,light,dark-hc,light-hc… | 31 |
| P2 | target-below-32 | `div.filter-popover-wrap > div.filter-popover > div.filter-section > input.filter-input` |  | 286x30 | dark,light,dark-hc,light-hc… | 31 |
| P2 | target-below-32 | `div.status-trigger-wrap > div.status-popover > div.status-popover-row > button.status-update-link` | check for updates | 206x27 | 4k | 4 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | What Born Again is | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | What's new in v2 | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Service Day cheat sheet | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Quick start | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Projecting each content type | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Run view: the service, large | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | The mobile remote | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | The Screens menu | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Pictures: the Media library | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Using YouTube | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Running a tape service | 179x29 | dark,light,dark-hc,light-hc… | 32 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Installing Born Again | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Graphics output & OBS | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Presentation profiles | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Songbooks & import | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | On service day | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Setup warnings explained | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | A damaged database | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Automation API | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button` | Glossary | 179x29 | dark,light,dark-hc,light-hc… | 34 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | Using YouTube | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button.is-on` | Highlight | 105x32 | scale150 | 52 |
| P2 | target-below-32 | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button` | One at a time | 139x32 | scale150 | 52 |
| P2 | target-below-32 | `div.app > div.toast-host > div.toast > button.toast-close` | Dismiss | 28x28 | dark,dark-hc,light | 5 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-import-menu > div.songs-import-popover > button` | From a file… | 150x31 | dark,light,dark-hc,light-hc… | 6 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-import-menu > div.songs-import-popover > button` | Paste text… | 150x31 | dark,light,dark-hc,light-hc… | 6 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | What Born Again is | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | The mobile remote | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | Running a tape service | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | What's new in v2 | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | The Screens menu | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | Service Day cheat sheet | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `tbody > tr > td > a` | Troubleshooting | 168x27 | 4k | 2 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | Pictures: the Media library | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `tbody > tr > td > a` | Importing a PDF | 166x27 | 4k | 2 |
| P2 | target-below-32 | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button` | Highlight | 105x32 | scale150 | 3 |
| P2 | target-below-32 | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button.is-on` | One at a time | 139x32 | scale150 | 3 |
| P2 | target-below-32 | `div.help-body > nav.help-sidebar > div.help-sidebar-section > button.is-active` | Quick start | 179x29 | dark,light,dark-hc,light-hc… | 2 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Highlight | 82x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | One at a time | 108x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | 0.8–1.25× | 84x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | 0.9–1.1× | 76x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Off | 43x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Tape pauses | 104x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Tape off | 75x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Pause the tape | 118x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Switch to default | 131x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Ask me | 71x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Matching only | 114x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Never use | 88x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Tape keeps playing | 146x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Also pauses | 103x26 | dark,light,dark-hc,light-hc… | 4 |
| P2 | truncated-no-tooltip | `div.tp-pad > section.tp-folder-setting > div.tsp-row > span.tsp-label` | Using your Downloads folder until you choose anoth | hidden 368px | dark,light,dark-hc,light-hc… | 4 |
| P2 | unreachable | `M041` | Bible > Overflow room > Tape: It Is The Rising Of  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M081` | Songs > Hide browse columns > Browse | narrow | narrow,scale150 | 1 |
| P2 | unreachable | `M209` | Queue > Bible Bible > Media Media > Tape: It Is Th | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M241` | Saved > Recently Played > Tape: It Is The Rising O | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M249` | Saved > Bible Bible > Overflow room > Whole Bible | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M257` | Saved > Songs Songs > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M265` | Sermons > Bible Bible > Hide browse columns > Tape | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M289` | Songs > Bible Bible > Browse > Tape: It Is The Ris | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M305` | Tape > More ways to add > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M313` | Tape > Bible Bible > Saved: favorites and recents  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M082` | Bible > Songs Songs > Hide browse columns > Tape:  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M154` | Media > Videos > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M202` | Queue > Filters > Tape: It Is The Rising Of The Su | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M242` | Saved > Filters > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M250` | Saved > Bible Bible > Overflow room > Recent | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M258` | Sermons > Search > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M266` | Sermons > Bible Bible > Overflow room > Tape | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M274` | Songs > Hide browse columns > Tape: It Is The Risi | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M163` | Media > Bible Bible > Hide browse columns > Tape | narrow | narrow,scale150 | 1 |
| P2 | unreachable | `M187` | Queue > Media Media > Hide browse columns | scale150 | scale150 | 1 |
| P2 | unreachable | `M243` | Saved > Overflow room > Media Media | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M251` | Saved > Bible Bible > Overflow room > Tape: It Is  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M259` | Sermons > Location > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M068` | Bible > Songs Songs > All songbooks > Tape: It Is  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M164` | Media > Bible Bible > Hide browse columns > Tape:  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M228` | Saved > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M244` | Sermons > Recently Played > Tape: It Is The Rising | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M260` | Sermons > Filters > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M268` | Sermons > Songs Songs > Saved: favorites and recen | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M308` | Tape > Timing > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M021` | Media > Hide browse columns | narrow | narrow,scale150 | 1 |
| P2 | unreachable | `M077` | Bible > Songs Songs > Import… > Tape: It Is The Ri | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M197` | Queue > Recently Played > Tape: It Is The Rising O | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M261` | Sermons > Overflow room > Tape: It Is The Rising O | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M293` | Songs > Bible Bible > Hide browse columns > Tape | narrow | narrow,scale150 | 1 |
| P2 | unreachable | `M150` | Media > Recently used > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M214` | Queue > Bible Bible > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M238` | Saved > Search > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M270` | Songs > All songbooks > Tape: It Is The Rising Of  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M310` | Tape > Overflow room > Options | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M167` | Media > Songs Songs > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M287` | Songs > Bible Bible > Search > Tape: It Is The Ris | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M080` | Songs > Hide browse columns > Search | narrow | narrow,scale150 | 1 |
| P2 | unreachable | `M152` | Media > Needs attention > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M272` | Songs > Import… > Tape: It Is The Rising Of The Su | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M280` | Songs > Bible Bible > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |

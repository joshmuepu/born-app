# Sweep 2

Distinct findings: **569** (P0 0, P1 99, P2 470)

| Sev | Check | Count |
|---|---|---|
| P1 | broken-image | 2 |
| P1 | console | 2 |
| P1 | no-focus-indicator | 25 |
| P1 | overlap | 44 |
| P1 | target-small | 19 |
| P1 | text-clipped | 1 |
| P1 | text-clipped-v | 6 |
| P2 | console | 3 |
| P2 | glossary | 5 |
| P2 | many-primary-buttons | 5 |
| P2 | no-main-landmark | 1 |
| P2 | target-below-32 | 96 |
| P2 | truncated-no-tooltip | 309 |
| P2 | unreachable | 51 |

## Findings

| Sev | Check | Where (selector) | Text | Detail | Variants | States |
|---|---|---|---|---|---|---|
| P1 | broken-image | `div > div.qlist > button.qitem > img.qthumb` |  | http://127.0.0.1:4480/media/yt-jNQXAC9IVRw/thumb |  | 20 |
| P1 | broken-image | `div.scroll > div.qlist > button.qitem > img.qthumb` |  | http://127.0.0.1:4480/media/yt-jNQXAC9IVRw/thumb |  | 2 |
| P1 | console | `log.error` | Failed to load resource: the server responded with |  |  | 1 |
| P1 | console | `log.error` | Failed to load resource: the server responded with |  |  | 6 |
| P1 | no-focus-indicator | `div.palette-overlay > div.palette > div.palette-input-row > input.palette-input` |  |  | dark,dark-hc,narrow,scale150… | 27 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Bible |  | dark,light,dark-hc,light-hc… | 2 |
| P1 | no-focus-indicator | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button` | One at a time |  | light-hc,scale150,4k | 1 |
| P1 | no-focus-indicator | `div.tp-follow-head > div.tape-screen-row > div.tse-seg > button.is-on` | Highlight |  | full-hd,narrow-scale175 | 1 |
| P1 | no-focus-indicator | `button.btn-primary` | Time it now |  | light | 1 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Sermons |  |  | 38 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Queue |  |  | 6 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Songs |  |  | 1 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Media |  |  | 3 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Saved: favorites and recents |  |  | 6 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Tape |  |  | 2 |
| P1 | no-focus-indicator | `div#queuePerfStrip > div.qstrip > button.qstrip-card` | QUOTE Do You Now Believe? |  |  | 25 |
| P1 | no-focus-indicator | `input#sermonInput` |  |  |  | 2 |
| P1 | no-focus-indicator | `button.livebar` | Do You Now Believe? · 54-0307E · 2bSure, a wonderf |  |  | 4 |
| P1 | no-focus-indicator | `input#sermonInputT` |  |  |  | 1 |
| P1 | no-focus-indicator | `input#bibleInputT` |  |  |  | 1 |
| P1 | no-focus-indicator | `input#songInputT` |  |  |  | 1 |
| P1 | no-focus-indicator | `div.queue-section-items > div.queue-row > span.queue-row-actions > button.btn-quiet` | Remove |  |  | 2 |
| P1 | no-focus-indicator | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 15% 65-0418M · |  |  | 1 |
| P1 | no-focus-indicator | `div.queue-section-items > div.queue-row > span.queue-row-actions > button.btn-quiet` | Show |  |  | 1 |
| P1 | no-focus-indicator | `ul.tp-lib > li.tp-lib-head > div.tp-addsplit > button.btn-secondary` | ＋ Add recording… |  |  | 1 |
| P1 | no-focus-indicator | `div#queue-pane > div.queue-header > div.queue-file-actions > button.readiness` | Is tonight ready? Check the service |  |  | 2 |
| P1 | no-focus-indicator | `div.search-panel > nav.app-rail > div.rail-group > button.rail-btn` | Queue 10 |  |  | 1 |
| P1 | no-focus-indicator | `div#queue-pane > div.queue-header > div.queue-file-actions > button.btn-secondary` | Run view |  |  | 1 |
| P1 | no-focus-indicator | `header.app-header > div.header-actions > div.onair-cluster > button.btn-primary` | Open projection |  |  | 1 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-row > input.filter-input` |  | with "Save this page as PDF" 46x17 | full-hd,scale150,4k,narrow-scale175 | 18 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | Phrase | with "Quick start" 95x37 | scale150,dark,light,dark-hc… | 17 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | All words | with "Quick start" 7x37 | scale150,narrow-scale175,dark,light… | 9 |
| P1 | overlap | `div.filter-popover-wrap > div.filter-popover > div.filter-section > input.filter-input` |  | with "Run view: the service, large" 108x20 | scale150,4k,narrow | 10 |
| P1 | overlap | `div.filter-popover > div.filter-section > div.filter-mode > button.filter-mode-btn` | Any word | with "Projecting each content type" 129x21 | narrow-scale175,narrow | 10 |
| P1 | overlap | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button.is-selected` | All songbooks | with "" 150x32 | dark,light,dark-hc,light-hc… | 5 |
| P1 | overlap | `div.panel-subtab-bar > div.songs-import-menu > div.songs-import-popover > button` | From a file… | with "" 54x10 | scale150 | 1 |
| P1 | overlap | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button` | Songs | with "Paste text…" 60x32 | dark,light,dark-hc,light-hc… | 3 |
| P1 | overlap | `div.appearance-menu > div.am-pop > label.am-check > input` |  | with "" 13x13 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.header-actions > div.appearance-menu > div.am-pop > button.am-item` | Open the manual F1 | with "" 188x13 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.header-actions > div.appearance-menu > div.am-pop > button.am-item` | Keyboard shortcuts ? | with "Done" 51x21 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.header-actions > div.appearance-menu > div.am-pop > button.am-item` | Show the Set up Sunday checklist | with "Done" 51x12 | dark,light,dark-hc,light-hc… | 1 |
| P1 | overlap | `div.filter-popover-wrap > div.filter-popover > div.filter-popover-footer > button.btn-primary` | Done | with "check for updates" 42x20 | narrow | 1 |
| P1 | overlap | `div.drill-left > div.media-left > div.media-cats > button.media-cat` | All media 0 | with "Favorites" 101x10 |  | 1 |
| P1 | overlap | `div.media-left > div.media-items-col > div.media-toolbar > select.media-sort` | Sort pictures | with "Close" 32x30 |  | 1 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Search | with "Favorites" 89x32 |  | 3 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Date | with "Favorites" 9x32 |  | 3 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Series | with "Recent" 22x32 |  | 3 |
| P1 | overlap | `div.panel-view > div.browse-modes > div.browse-mode-tabs > button.browse-mode` | Location | with "Close" 32x32 |  | 3 |
| P1 | overlap | `div.am-pop > div.am-row > div.am-segs > button.am-seg` | Normal | with "Filters" 51x26 |  | 1 |
| P1 | overlap | `button#a2hsPrimary` | Install | with "Skip for now" 100x23 |  | 41 |
| P1 | overlap | `button#a2hsSkip` | Skip for now | with "Skip for now" 52x20 |  | 13 |
| P1 | overlap | `input#born-search-input` |  | with "Clear search" 20x20 |  | 1 |
| P1 | overlap | `div.drill-left > div.bible-controls > div.search-input-wrap > input.search-input` |  | with "Clear search" 20x20 |  | 1 |
| P1 | overlap | `div.songs-search > div.songs-search-bar > div.search-input-wrap > input.search-input` |  | with "Clear search" 20x20 |  | 4 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Needs timing 65-0418M  | with "More for It Is The Rising Of The Sun" 32x32 |  | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 3% 65-0418M ·  | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 9% 65-0418M ·  | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 13% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 15% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 2 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 19% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 23% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 32% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 36% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 40% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 52% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 57% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 61% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 65% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 69% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 77% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 81% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timing… 94% 65-0418M · | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | overlap | `div.tp-body > ul.tp-lib > li.tp-lib-item > button.tp-rec` | It Is The Rising Of The Sun Timed 65-0418M · 2:24: | with "More for It Is The Rising Of The Sun" 32x32 |  | 1 |
| P1 | target-small | `div.media-items-col > div.media-actions > label.media-link-toggle > input` |  | 13x13 (<24) |  | 28 |
| P1 | target-small | `div#queuePerfStrip > div.qstrip-row > button.viewall` | View all | 62x19 (<24) |  | 26 |
| P1 | target-small | `button#a2hsSkip` | Skip for now | 100x23 (<24) |  | 41 |
| P1 | target-small | `button#roleSkipBtn` | Skip for now | 100x23 (<24) |  | 41 |
| P1 | target-small | `input#sermonInput` |  | 200x20 (<24) |  | 2 |
| P1 | target-small | `input#sermonInputT` |  | 259x20 (<24) |  | 1 |
| P1 | target-small | `input#bibleInputT` |  | 325x20 (<24) |  | 1 |
| P1 | target-small | `input#songInputT` |  | 325x20 (<24) |  | 1 |
| P1 | target-small | `div.search-bar-container > div.search-bar > div.search-input-wrap > button.search-clear` | Clear search | 20x20 (<24) |  | 1 |
| P1 | target-small | `div.browse-content > div.browse-sermons > div.browse-back-row > button.browse-back` | Clear | 38x19 (<24) |  | 1 |
| P1 | target-small | `div.drill-left > div.bible-controls > div.search-input-wrap > button.search-clear` | Clear search | 20x20 (<24) |  | 1 |
| P1 | target-small | `div.songs-search > div.songs-search-bar > div.search-input-wrap > button.search-clear` | Clear search | 20x20 (<24) |  | 4 |
| P1 | target-small | `div.screens-group > div.display-rows > div.display-row > button.display-row-select` | Built-in Retina Display | 420x15 (<24) |  | 2 |
| P1 | target-small | `div.screens-group > div.display-rows > div.display-row > button.display-row-select` | PA278QV (2) | 420x15 (<24) |  | 2 |
| P1 | target-small | `div.screens-group > div.display-rows > div.display-row > button.display-row-select` | PA278QV (1) | 420x15 (<24) |  | 2 |
| P1 | target-small | `div.tse-timeline-wrap > div.tse-timeline-bar > div.tse-seg > button.on` | Whole tape | 81x22 (<24) |  | 1 |
| P1 | target-small | `div.tse-timeline-wrap > div.tse-timeline-bar > div.tse-seg > button` | Around now (6 min) | 128x22 (<24) |  | 1 |
| P1 | target-small | `div.tape-bar > div.tape-bar-row > div.tape-vol > input` | Volume | 96x16 (<24) |  | 1 |
| P1 | target-small | `div.tse > div.tse-actions > label.tse-react > input` | Reaction time in seconds | 62x24 (<24) |  | 1 |
| P1 | text-clipped | `div.scroll > div.qlist > button.qitem > div.qpreview` | 4 He said when he was in Fort Wayne, said, “As soo | hidden 3px, no ellipsis |  | 2 |
| P1 | text-clipped-v | `div#root > div.stage > div.stage-next > div.stage-next-text` | And I am so happy to be here this morning to talk  | hidden 302px |  | 1 |
| P1 | text-clipped-v | `div.scroll > div.qlist > button.qitem > div.qpreview` | 2 And when we’re singing that glorious old song a  | hidden 333px |  | 2 |
| P1 | text-clipped-v | `div.scroll > div.qlist > button.qitem > div.qpreview` | 3 Just a while ago I was talking to Brother Shuler | hidden 228px |  | 2 |
| P1 | text-clipped-v | `div.scroll > div.qlist > button.qitem > div.qpreview` | 4 He said when he was in Fort Wayne, said, “As soo | hidden 280px |  | 2 |
| P1 | text-clipped-v | `div.scroll > div.qlist > button.qitem > div.qpreview` | 5 And Brother Jack Shuler is a fine man. You heard | hidden 350px |  | 2 |
| P1 | text-clipped-v | `div.scroll > div.qlist > button.qitem > div.qpreview` | For God so loved the world, that he gave his only  | hidden 18px |  | 2 |
| P2 | console | `console.warning` | %cElectron Security Warning (Insecure Content-Secu |  |  | 282 |
| P2 | console | `log.warning` | <meta name="apple-mobile-web-app-capable" content= |  |  | 3 |
| P2 | console | `console.warning` | Failed to scroll to index 229 after 10 attempts. |  |  | 1 |
| P2 | glossary | `div#songsBodyT > div.songlist > button.song-row` | Take Me Back To Calvery | Take Me Back To Calvery |  | 1 |
| P2 | glossary | `div#songsBodyT > div.songlist > button.song-row` | Take Me Deeper | Take Me Deeper |  | 1 |
| P2 | glossary | `div#songsBodyT > div.songlist > button.song-row` | Take Me In To The Holy Of Holies | Take Me In To The Holy Of Holies |  | 1 |
| P2 | glossary | `div#songsBodyT > div.songlist > button.song-row` | Take The Name Of Jesus With You | Take The Name Of Jesus With You |  | 1 |
| P2 | glossary | `div#songsBodyT > div.songlist > button.song-row` | Take Up Your Cross | Take Up Your Cross |  | 1 |
| P2 | many-primary-buttons | `document` | Done / Search | 2 | dark,light,dark-hc,light-hc… | 31 |
| P2 | many-primary-buttons | `document` | Add pictures / Add pictures | 2 |  | 2 |
| P2 | many-primary-buttons | `document` | Search / Show / Show / Show / Show / Show | 13 |  | 1 |
| P2 | many-primary-buttons | `document` | Show / Show / Show / Show / Show / Show | 21 |  | 3 |
| P2 | many-primary-buttons | `document` | Add pictures / Add to queue | 2 |  | 15 |
| P2 | no-main-landmark | `document` |  |  |  | 70 |
| P2 | target-below-32 | `div.stage > div.stage-topbar > div.stage-viewpick > button.is-active` | Stage | 67x29 |  | 11 |
| P2 | target-below-32 | `div.stage > div.stage-topbar > div.stage-viewpick > button` | Congregation | 124x29 |  | 11 |
| P2 | target-below-32 | `div#tabletList > div.scope-row > button.scope-pill` | Whole Bible | 97x29 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | # | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | A | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | B | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | C | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | D | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | E | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | F | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | G | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | H | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | I | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | J | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | K | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | L | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | M | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | N | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | O | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | P | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | Q | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | R | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | S | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | T | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | U | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | V | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | W | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | Y | 28x28 |  | 1 |
| P2 | target-below-32 | `div#songsBodyT > div.azstrip > button` | Z | 28x28 |  | 1 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-import-menu > div.songs-import-popover > button` | From a file… | 150x31 |  | 2 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-import-menu > div.songs-import-popover > button` | Paste text… | 150x31 |  | 2 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button.is-selected` | All songbooks | 150x31 |  | 1 |
| P2 | target-below-32 | `div.panel-subtab-bar > div.songs-songbook-menu > div.songs-import-popover > button` | Songs | 150x31 |  | 1 |
| P2 | target-below-32 | `div.media-detail > div.media-tags > div.media-tag-list > input.media-tag-input` |  | 157x24 |  | 15 |
| P2 | target-below-32 | `select#media-usebg-target` | Congregation screen Graphics output (OBS / browser | 239x31 |  | 15 |
| P2 | target-below-32 | `select#media-folder-select` | (no folder) | 100x31 |  | 15 |
| P2 | target-below-32 | `div.media-bg-row > div.media-bg-main > div.media-bg-controls > select` | Background for Congregation screen | 199x31 |  | 1 |
| P2 | target-below-32 | `div.media-bg-row > div.media-bg-main > div.media-bg-controls > select` | Background for Graphics output (OBS / browser) | 199x31 |  | 1 |
| P2 | target-below-32 | `div.media-bg-row > div.media-bg-main > div.media-bg-controls > select` | Background for Channel default — Main | 199x31 |  | 1 |
| P2 | target-below-32 | `div.media-bg-row > div.media-bg-main > div.media-bg-controls > select` | Background for Channel default — Overflow room | 199x31 |  | 1 |
| P2 | target-below-32 | `div.app > div.toast-host > div.toast > button.toast-close` | Dismiss | 28x28 |  | 4 |
| P2 | target-below-32 | `div.screens-popover-body > div.screens-group > div.screens-group-head > button.display-row-btn` | Clear Graphics output | 24x24 |  | 1 |
| P2 | target-below-32 | `div.screens-popover-body > div.screens-group > div.screens-seg > button.on` | Auto | 91x26 |  | 1 |
| P2 | target-below-32 | `div.screens-popover-body > div.screens-group > div.screens-seg > button` | Full-screen | 91x26 |  | 1 |
| P2 | target-below-32 | `div.screens-popover-body > div.screens-group > div.screens-seg > button` | Lower third | 91x26 |  | 1 |
| P2 | target-below-32 | `div.screens-channel-live > div.screens-channel-row > div.screens-channel-top > button.display-row-btn` | Open Overflow room | 24x24 |  | 1 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button.is-active` | Displays | 147x31 |  | 2 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button` | Channels | 147x31 |  | 4 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button` | Outputs | 147x31 |  | 3 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button` | Status | 147x31 |  | 3 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Identify Built-in Retina Display | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Test pattern on Built-in Retina Display | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Rename Built-in Retina Display | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Identify PA278QV (2) | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Test pattern on PA278QV (2) | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Rename PA278QV (2) | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Identify PA278QV (1) | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Test pattern on PA278QV (1) | 24x24 |  | 2 |
| P2 | target-below-32 | `div.display-rows > div.display-row > span.display-row-actions > button.display-row-btn` | Rename PA278QV (1) | 24x24 |  | 2 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button` | Displays | 147x31 |  | 2 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button.is-active` | Outputs | 147x31 |  | 1 |
| P2 | target-below-32 | `div.display-row > span.display-row-main > span.display-row-sub > button.display-row-btn` | Copy this-computer Graphics URL | 24x24 |  | 1 |
| P2 | target-below-32 | `div > div.display-row > span.display-row-actions > button.display-row-btn` | Copy Graphics output URL | 24x24 |  | 1 |
| P2 | target-below-32 | `div > div.display-row > span.display-row-actions > button.display-row-btn` | Preview Graphics output | 24x24 |  | 1 |
| P2 | target-below-32 | `div > div.display-row > span.display-row-actions > button.display-row-btn` | Clear Graphics output | 24x24 |  | 1 |
| P2 | target-below-32 | `div > div.display-row > span.display-row-actions > button.display-row-btn` | Remove Graphics output | 24x24 |  | 1 |
| P2 | target-below-32 | `div.display-rows > div > div.screens-seg > button.on` | Auto | 174x27 |  | 1 |
| P2 | target-below-32 | `div.display-rows > div > div.screens-seg > button` | Full-screen | 174x27 |  | 1 |
| P2 | target-below-32 | `div.display-rows > div > div.screens-seg > button` | Lower third | 174x27 |  | 1 |
| P2 | target-below-32 | `div.modal > div.screens-manager-body > nav.screens-manager-sidebar > button.is-active` | Status | 147x31 |  | 1 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Highlight | 82x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | One at a time | 108x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | 0.8–1.25× | 84x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | 0.9–1.1× | 76x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Off | 43x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Tape pauses | 104x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Tape off | 75x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Pause the tape | 118x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Switch to default | 131x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Ask me | 71x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Matching only | 114x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Never use | 88x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button.is-on` | Tape keeps playing | 146x26 |  | 6 |
| P2 | target-below-32 | `section > div.tsp-row > div.tsp-seg > button` | Also pauses | 103x26 |  | 6 |
| P2 | target-below-32 | `div.tp-sheet-backdrop > div.tp-sheet > div.tpa-pick > input.tp-input` | Find the sermon to download | 260x26 |  | 4 |
| P2 | target-below-32 | `div.gtb > div.gtb-row > div.tape-vol > button.tape-ico` | Mute | 30x30 |  | 6 |
| P2 | target-below-32 | `div.gtb > div.gtb-row > div.tape-dev > button.tape-chipbtn` | Sound output: System default | 36x30 |  | 6 |
| P2 | target-below-32 | `div.tape-bar > div.tape-bar-row > div.tape-vol > button.tape-ico` | Mute | 30x30 |  | 1 |
| P2 | target-below-32 | `div.tape-bar > div.tape-bar-row > div.tape-dev > button.tape-chipbtn` | System default | 124x30 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 39 | 48x32 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 40 | 48x32 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 41 | 48x32 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 42 | 48x32 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 43 | 48x32 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 44 | 48x32 |  | 1 |
| P2 | target-below-32 | `div > div.tfl-row > span.tfl-no > button.tfl-jump` | Move the tape to paragraph 45 | 48x32 |  | 1 |
| P2 | truncated-no-tooltip | `div.media-left > div.media-cats > button.media-cat > span.media-cat-label` | Recently used | hidden 3px | narrow-scale175 | 37 |
| P2 | truncated-no-tooltip | `div.media-left > div.media-cats > button.media-cat > span.media-cat-label` | Needs attention | hidden 12px | narrow-scale175 | 37 |
| P2 | truncated-no-tooltip | `div#livebar-sermons > button.livebar > div.livebar-body > div.livebar-text` | Sure, a wonderful man. Not long ago I was standing | hidden 968px |  | 2 |
| P2 | truncated-no-tooltip | `div#tabletPreview > div > span.now-ref` | Do You Now Believe? · 54-0307E · 2b | hidden 142px |  | 2 |
| P2 | truncated-no-tooltip | `div#livebar-sermonsT > button.livebar > div.livebar-body > div.livebar-text` | Sure, a wonderful man. Not long ago I was standing | hidden 937px |  | 1 |
| P2 | truncated-no-tooltip | `div#livebar-bibleT > button.livebar > div.livebar-body > div.livebar-text` | Sure, a wonderful man. Not long ago I was standing | hidden 937px |  | 1 |
| P2 | truncated-no-tooltip | `div#livebar-songsT > button.livebar > div.livebar-body > div.livebar-text` | Sure, a wonderful man. Not long ago I was standing | hidden 937px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-verse > span.palette-item-main > span.palette-item-sub` | In the beginning was the Word, and the Word was wi | hidden 295px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-sermon:0 > span.palette-item-main > span.palette-item-sub` | 60-1204M · ¶109-111 — 109 Then we find out that wh | hidden 152px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-sermon:1 > span.palette-item-main > span.palette-item-sub` | 60-0522M · ¶97-98 — 97 Why, I stood not long ago b | hidden 154px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-sermon:2 > span.palette-item-main > span.palette-item-sub` | 63-1114 · ¶145-146 — 145 And then we find then in  | hidden 113px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-sermon:3 > span.palette-item-main > span.palette-item-sub` | 62-0610M · ¶220-221 — 220 John never presumed that | hidden 182px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-sermon:4 > span.palette-item-main > span.palette-item-sub` | 55-0501E · ¶29 — 29 Get it? “Upon whom thou shall  | hidden 129px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-sermon:5 > span.palette-item-main > span.palette-item-sub` | 54-0411 · ¶28 — 28 I want to read another Scriptur | hidden 113px |  | 1 |
| P2 | truncated-no-tooltip | `div#pal-bible:John 10:41 > span.palette-item-main > span.palette-item-sub` | And many resorted unto him, and said, John did no  | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Let us bow our heads. Lord, as we gather here this | hidden 11px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And let there come an Easter among us all, today.  | hidden 34px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Heal all the sick and the afflicted. May it be an  | hidden 13px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I certainly deem this a marvelous privilege, this  | hidden 7px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Five o’clock this morning, my little friend with a | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | As the legend about him says, “A little brown bird | hidden 31px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Later, the Angels appeared as was prophesied. And  | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Science took the picture, all the way from Mexico, | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, they asked, to know. Science, the one of them | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And so there He spoke to me, and said, “The Seven  | hidden 34px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And now, as this went up, we have the picture outs | hidden 15px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You remember, I was preaching when this vision cam | hidden 42px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | With the white, see, you see the dark, His face, H | hidden 34px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I wish, this morning, that I had just much time to | hidden 55px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now I want you to turn in—in your Bibles, as we al | hidden 34px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now we’re going to—to read from the Holy Scripture | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now in Revelation 1:18, we read these Words, 17 an | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And in Romans the 8th chapter and the 11th verse,  | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And now in Mark the 16th chapter, the chapter of t | hidden 31px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, my text this morning, I want to take for a te | hidden 6px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, you know, you perhaps have been hearing the r | hidden 43px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, as the world today in a—a memorial service, o | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I think, as Saviour when He died, or as an infant  | hidden 33px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, that it is the greatest week in history, the  | hidden 3px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And, now, not only is it a memorial day, of all th | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | As people today are trying to say, “We should wash | hidden 40px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Satan doesn’t care how religious you are, or how r | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Therefore, if God raised up Jesus from the dead, d | hidden 39px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | As I was tired, my arm hurting me, from shots that | hidden 32px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And as I was setting there, wondering what would I | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And then while I was setting there, almost asleep, | hidden 21px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | She handed me a card. And it was the… Course, I gu | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And in the form of this card I drew my text. For,  | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, the sun, at the rising of the sun. Well, ther | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the first Light was ever given in the earth wa | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But, oh, it wasn’t nothing, that sunrise, like the | hidden 4px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But this time, when the sun rose, there was a—a du | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No more could the—the botany life lived back there | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And on Easter morning, then, in this dirt somewher | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, today we have a tuberculosis, Easter seal. Pe | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And now, the true Easter Seal, on this sunrise, wa | hidden 13px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But the real Seal had been broken, and One Who onc | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And He said, when He come forth on that morning, “ | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | At this glorious sunrise, God had proven, or vindi | hidden 38px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I’m sure this morning that even we, who believe it | hidden 36px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice now. As the gloom covered the earth, and th | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But now the true trinity of God, being One manifes | hidden 39px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No wonder He could claim there, Matthew the 27th c | hidden 45px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now! And then, not only that, He sent Word to His  | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Oh, what a wonderful thing that is, “I am alive, o | hidden 47px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He was “quickened.” Not only that. “And will send  | hidden 45px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | In Luke, 24th chapter, 49th verse. He said, “Behol | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He come to redeem, or to bring to Life, those pred | hidden 34px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No wonder the Gospel is good news. The very word G | hidden 60px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Hebrews 13:8 said, “He’s the same yesterday, today | hidden 11px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, if there is another gospel, as Paul spoke to  | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, the very essence of the Message that was sent | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I’m afraid today that too many of us are not getti | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | If the blood of a man was a certain type, and you  | hidden 38px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And if your spirit that’s in you is reckoned dead, | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And that Gospel Light of the resurrection, the con | hidden 51px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | What He promised to do in Christ, He proved on the | hidden 50px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now in this day, He proves what He said, because t | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | On Easter morning, not only did He raise, but His  | hidden 31px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The darkened world of unbelief, where churches and | hidden 54px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Like, He was the manifestation of the promised Wor | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, them who were once groping in darkness and wo | hidden 42px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | There had never been, to that time, a man that cou | hidden 7px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | When they say, that, “Jesus Christ isn’t the same  | hidden 11px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | We are the benefactors of His resurrection, quicke | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “Unto the place, the position, that I have given u | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | If there would be any holy ritual, it should come  | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “The sheaf, which was the first of your seed that  | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | It’s not s-u-n anymore. It’s the S-o-n d-a-y, the  | hidden 10px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice, It was the first corn of God’s Wheat that  | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That’s why they had to wave that sheaf, for it was | hidden 21px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And, today, because He was the first Son of God to | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He was waved at the Day of Pentecost, “when there  | hidden 56px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And to be waved again, we realize, in the last day | hidden 6px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, Who is the Son of man? “In the beginning was  | hidden 76px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | As Christ was the first One to raise, from all the | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Waving of the sheaf! What was the sheaf? The first | hidden 21px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Hallelujah! I’m sure you see what I’m talking abou | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He was waved to them. The Word, which He was, was  | hidden 74px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But now, for instance, what if—if we were going to | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | They had been pushed off the assembly line, both o | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “Well,” you say, “the power is in the gasoline, Br | hidden 27px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No matter how much theologians claim, how well you | hidden 58px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | We have put too much stress on the Mechanics and n | hidden 58px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And when you try to put the Holy Spirit in a denom | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But, oh, I’m so glad that there is a ten thousand  | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But there has got to come One! Hallelujah! There h | hidden 39px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That’s what He proved! Hallelujah! That’s what Eas | hidden 59px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And as He, being the Groom, the Bride has to come  | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Until that Church becomes both Dynamics and Mechan | hidden 53px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You can scream and shout, and jump up-and-down, al | hidden 43px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | It just won’t move, no matter how good the Mechani | hidden 52px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “You can do nothing without Me; but with Me you ca | hidden 21px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Paul said, “The Gospel came to us not in Word only | hidden 33px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | It’s the same Spirit, that raised Him up, that qui | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | In Romans 8:11, “But if …” There is the problem. T | hidden 11px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | When God made His first bridegroom, He made the br | hidden 65px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | So the Bride must also be flesh of His flesh, and  | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Oh, my! The predestinated One, of course, like the | hidden 33px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, the predestinated Ones are the first to be qu | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Not all men will receive Christ. Oh, no. But those | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, the Holy Spirit comes now. Of course, It wasn | hidden 5px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | My crude little story about the farmer putting the | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He didn’t even like the diet she was feeding him.  | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the—the hen would cluck, and, you know, “The d | hidden 27px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The old eagle knowed she had laid so many eggs, an | hidden 49px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | So does God. He is that Great Eagle. In His though | hidden 59px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And one day, the story goes, this old eagle flew o | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And God knows! Hallelujah! He’s got a predestinate | hidden 57px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No matter how many tried to tell him, “a eagle,” h | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And when we see, not a denomination, not a Ph.D.,  | hidden 43px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | This then, this earthly body, is quickened and bro | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Quickly. When he wanted to know how he could get t | hidden 35px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “No matter what the chickens are, you’re a eagle.  | hidden 7px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Word to the Word! “The works that I do shall y | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | What does It do? Now listen, so that you’ll know.  | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, you who once walked along with a great big ci | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | When, the Word said, “No.” See, It quickens you to | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Well, you say, “Well, now, let me tell you somethi | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Bible said it’s wrong to do that, and the man  | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But, brother, when you hear that scream, there’s S | hidden 32px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “If the Spirit that raised Him from the dead,” the | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Therefore, your bodies is the temple of the Dynami | hidden 40px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Dynamics, if It comes upon water, it’ll just s | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But when He hits that one thousand octane, “Whrrrr | hidden 41px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, to prove that’s right. I go down here, and he | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | As in the Marriage And Divorce case, the other day | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Some minister lady give me a right sharp, little b | hidden 8px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Said, “Well, you told them their sin is forgiven.” | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I said, “You see, that you might know, that, Jesus | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He said, “Blessed art thou,” see, “son of Jonas; f | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That’s the reason He told them to go baptize in “N | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Talking to a little preacher the other day, he sai | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Where, the Pentecostal now has started taking the  | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And he said, “I want to ask you something.” He was | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He said, “Well, now, let me tell you something.” H | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He said, “Well, you was speaking over there, a whi | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I said, “No, they were baptized ‘unto repentance,’ | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I said, “The man that had the keys, said this, ‘Fo | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Salvation alone goes in the Name of Jesus Christ.  | hidden 27px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I said, “Sir, I want to ask you something.” He and | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I said, “Now, if I told you, brother, to, ‘Go over | hidden 4px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But now, the next thing, will you believe? See? “H | hidden 36px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | When you have received this Holy Spirit now, that  | hidden 43px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Acts 19, they had believed, but they didn’t have I | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, when you get the Dynamics, you have been quic | hidden 63px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now look… [Blank spot on tape—Ed.] …been quickened | hidden 65px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, how can you claim to have that Spirit, and th | hidden 49px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, potentially, you are resurrected. You’re resu | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Church come that way, through justification, s | hidden 35px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the spirit of the world has come through the a | hidden 32px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the individual comes that way. Everything work | hidden 40px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That’s what’s the matter today. They try to give t | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Take these man-made fountains away from me! “No ot | hidden 49px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice, they were coward. Notice. But, they had th | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Some of you people that are afraid that some woman | hidden 39px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | It changed them. It quickened them. It made them d | hidden 46px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now listen. Here is another thing, for proof. It s | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Your body ain’t subject to sin no more; you, your  | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Did you ever see how independent an old eagle walk | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “Not for me. See, my desires has changed. My appet | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Oh, and He raised up Christ from the grave, dwelli | hidden 43px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | What did they do? They spoke in another language.  | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Could you imagine that, them old mortal bodies tha | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the Son has got to be—be revealed again, in th | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No, It quickened them to new Life. It does the sam | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The quickening Power wasn’t only in their soul, bu | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the Spirit quickened their fellowship together | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That’s right, quickened! Not only was His resurrec | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | They laid hands on the sick; they recovered. They  | hidden 5px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, notice, quickening in the Presence of God. Wh | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now look. How can you say that that Spirit dwells  | hidden 36px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | My own mother, she’s gone on now, and she was a ve | hidden 59px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I remember one time when I first started preaching | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | There was a lady came by. Now, you know what kind  | hidden 40px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And she said, “Ah!” She said, looked around at the | hidden 36px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You know, as the Bible said, in Isaiah, 5th chapte | hidden 14px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And she started up that highway, just as hard as s | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And mother said, “The horriblest screams that I ev | hidden 34px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | She just obeyed everything but one Word, see, ever | hidden 42px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now notice this quickening Power, Zoe , bringing t | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Spirit left Him, in the Garden of Gethsemane.  | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But, remember, He went there with you in Him. See, | hidden 58px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Well, how can the Bride come, and fail to manifest | hidden 57px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Well, friends, I know I’m keeping you a long time, | hidden 5px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Look, notice this. But God foresaw the Bride in th | hidden 27px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Like the pentecostal experience today, and the com | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And when a man has said that he believes the Word, | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Like the little, epileptic child I prayed for, a f | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | But when the abstract has come, It struck off, omi | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | What you scared about? No wonder He said, “Fear no | hidden 42px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | What deed? I have now cashed in on my beneficiary, | hidden 39px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Let us now notice, quickly, the quickening of the  | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now let’s notice what It did on Stephen. Stephen w | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And when he died, they stoned him; and his poor li | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice another fellow, had this quickening Power,  | hidden 40px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And he found a eunuch there, and baptized him in t | hidden 58px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | In obedience to God, if you have never been baptiz | hidden 32px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | When Stephen done this great thing…or, not Stephen | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Oh, Church of the living God, we can’t stand aroun | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Excuse that expression. I was thinking about a mot | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | We are tired of such stuff as that. Get back! You’ | hidden 15px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Let’s take another man. There was a man by the nam | hidden 50px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That’s the same quickening Power that we have righ | hidden 13px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Enoch, with that perfect testimony, that, “Everyth | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, now notice, on Elijah. After…Look, Elijah, th | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | So full of the quickening Power, until, he seen a  | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, then that fellow picked up that robe, a type  | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You know, well, that quickening Power didn’t leave | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “It’ll quicken your mortal body.” Though dead and  | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Remember, that dead man, that prophet, full of tha | hidden 32px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And remember, we are flesh of His flesh, Jesus Chr | hidden 15px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Easter means more than just a tradition. It is als | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And this body may rot in the sea; it may rot in th | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | For as Paul said, “Death, where is your sting? Gra | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He is alive for evermore, “the same yesterday, tod | hidden 27px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice, death does not stop God’s quickening Power | hidden 15px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice, Moses is full of that quickening Power. Wa | hidden 46px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | If you would read in Matthew, I got a Scripture, M | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | As Job back there under his great strain, my, ever | hidden 29px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And his wife even turned against him. Said her bre | hidden 52px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | See, he held right to what he had. Now, he was a p | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He was an eagle. Oh, my! You can’t keep the film o | hidden 15px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You know, skin worms don’t come to you. That worm  | hidden 47px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And on that resurrection morning! Glory! Halleluja | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “If this Spirit that raised up Jesus from the dead | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I see you putting down some Scriptures. All right, | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | That same quickening Power of God presented in bot | hidden 41px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Elijah, and look how it’s represented here. Now, E | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice. Remember, remember now, quickened to see w | hidden 71px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And I—I think our Lord said, and so did Paul, “Wha | hidden 27px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The other day I was telling someone, little Donavo | hidden 35px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I looked, and his ear, turned all the way, inside  | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He said, “Don’t know, Brother Branham. About six,  | hidden 47px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I just put my hand over on him, never said a word. | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And one day when I was weary, myself, about…I said | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Quickening Power! “And if the Spirit that raised u | hidden 33px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Look what we’ve seen in this day. The quickening P | hidden 33px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He is the One Who opened those Seals. He is those  | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And the very seven Angels, which represented the S | hidden 36px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Quickening Power lets us see His coming. Quickenin | hidden 53px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Our Lord Jesus is so full of quickening Power, He  | hidden 12px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Why, why’d He say that? He knew that it was writte | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Why? It was prophecy, the Word of God. And prophec | hidden 52px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now look at transfiguration. We was, every one, re | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Notice, oh, look what we are now seeing in these l | hidden 42px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | We’re just like them at Mount Transfiguration, see | hidden 35px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And so is it today, we don’t try to be some big pe | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Did you get that? See, our desire is not to be glo | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | If I can get myself out of the way, so when Willia | hidden 25px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | No wonder He said, “Fear not”, for now, notice, we | hidden 56px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I just—I just want to see Him manifested. How can  | hidden 22px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | With all that evidence collected, with us now this | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You believe that? We shall rise! In Him we become  | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Oh, aren’t you glad! I’m so glad! Way back down yo | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Not long ago, I was told a little story about a—a  | hidden 19px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | If any of you have fished out there for the salmon | hidden 10px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | So this fisherman was kind of a greenhorn, you kno | hidden 32px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | He said, “Sit down, son. Sit down.” The old fisher | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Just wait. The Son comes up, we’ll see where we’re | hidden 24px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Sorry I kept you this long. How many of you is goi | hidden 18px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Is there one here, or many, who doesn’t have this  | hidden 31px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Will you raise your hand, say, “Pray for me, broth | hidden 17px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Bible said, “As many as believed,” see, “were  | hidden 7px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, you might be buried in, many times, in the Na | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Father God, I—I have spoke at length, and taken up | hidden 23px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Our hearts are burning; our souls are thrilled; th | hidden 40px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The dewdrops that come from Heaven, the Word of Go | hidden 38px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | May, then, Father, may…If they’re sick, may they w | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Father, they are Yours. They raised their hands. I | hidden 28px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | You love Him? Isn’t He wonderful? Are you satisfie | hidden 16px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | “My little children,” as Paul would have said. Not | hidden 7px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | We are part of one another. Don’t you never let Sa | hidden 13px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And now, see, now you are already resurrected. Whe | hidden 51px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | And we will rise at the last day, even though our  | hidden 9px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | God bless you. I’ve kept you here a long time. If  | hidden 6px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, the Lord willing, I’ll be back tonight, to ta | hidden 10px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Don’t you send no word ahead. Please don’t. See, i | hidden 42px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Then there is going to be one brother meet me, say | hidden 26px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Remember, you don’t know what troubles are, till y | hidden 20px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Dear God, as this Message this morning, of the res | hidden 37px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | I’m laying my hands upon these handkerchiefs, that | hidden 70px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | The Spirit that was upon the body of Elisha, that, | hidden 21px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now may that quickening Power, as I lay this Word  | hidden 43px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | May it not only for these handkerchiefs, but for t | hidden 11px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, how many has got quickening Power? Now lay yo | hidden 3px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now, there is only one thing to keep It from, hind | hidden 45px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Now I want you to bow your head and pray for one a | hidden 30px |  | 1 |
| P2 | truncated-no-tooltip | `div.tse-table > div.tse-rows > div.tse-row > span.tse-text` | Dear God, we do this in the Name of Jesus Christ,  | hidden 56px |  | 1 |
| P2 | unreachable | `M041` | Bible > Overflow room > Tape: It Is The Rising Of  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M081` | Songs > Hide browse columns > Browse | narrow | narrow,scale150,narrow-scale175 | 1 |
| P2 | unreachable | `M209` | Queue > Bible Bible > Media Media > Tape: It Is Th | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M241` | Saved > Recently Played > Tape: It Is The Rising O | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M249` | Saved > Bible Bible > Overflow room > Whole Bible | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M257` | Saved > Songs Songs > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M265` | Sermons > Bible Bible > Hide browse columns > Tape | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M273` | Songs > Hide browse columns > Tape | narrow-scale175 | narrow-scale175 | 1 |
| P2 | unreachable | `M289` | Songs > Bible Bible > Browse > Tape: It Is The Ris | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M305` | Tape > More ways to add > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M313` | Tape > Bible Bible > Saved: favorites and recents  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M082` | Bible > Songs Songs > Hide browse columns > Tape:  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M146` | Media > Saved: favorites and recents Saved > Hide  | narrow-scale175 | narrow-scale175 | 1 |
| P2 | unreachable | `M154` | Media > Videos > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M202` | Queue > Filters > Tape: It Is The Rising Of The Su | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M242` | Saved > Filters > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M250` | Saved > Bible Bible > Overflow room > Recent | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M258` | Sermons > Search > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M266` | Sermons > Bible Bible > Overflow room > Tape | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M274` | Songs > Hide browse columns > Tape: It Is The Risi | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M163` | Media > Bible Bible > Hide browse columns > Tape | narrow | narrow,scale150,narrow-scale175 | 1 |
| P2 | unreachable | `M187` | Queue > Media Media > Hide browse columns | narrow-scale175 | narrow-scale175 | 1 |
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
| P2 | unreachable | `M021` | Media > Hide browse columns | narrow | narrow,scale150,narrow-scale175 | 1 |
| P2 | unreachable | `M077` | Bible > Songs Songs > Import… > Tape: It Is The Ri | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M197` | Queue > Recently Played > Tape: It Is The Rising O | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M261` | Sermons > Overflow room > Tape: It Is The Rising O | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M293` | Songs > Bible Bible > Hide browse columns > Tape | narrow | narrow,scale150,narrow-scale175 | 1 |
| P2 | unreachable | `M078` | Songs > Hide browse columns > Saved: favorites and | narrow-scale175 | narrow-scale175 | 1 |
| P2 | unreachable | `M150` | Media > Recently used > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M214` | Queue > Bible Bible > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M238` | Saved > Search > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M270` | Songs > All songbooks > Tape: It Is The Rising Of  | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M310` | Tape > Overflow room > Options | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M079` | Bible > Songs Songs > Hide browse columns > Tape | narrow-scale175 | narrow-scale175 | 1 |
| P2 | unreachable | `M159` | Media > YouTube > Hide browse columns | narrow-scale175 | narrow-scale175 | 1 |
| P2 | unreachable | `M167` | Media > Songs Songs > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M287` | Songs > Bible Bible > Search > Tape: It Is The Ris | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M080` | Songs > Hide browse columns > Search | narrow | narrow,scale150,narrow-scale175 | 1 |
| P2 | unreachable | `M152` | Media > Needs attention > Overflow room | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M272` | Songs > Import… > Tape: It Is The Rising Of The Su | dark | dark,light,dark-hc,light-hc… | 1 |
| P2 | unreachable | `M280` | Songs > Bible Bible > Saved: favorites and recents | dark | dark,light,dark-hc,light-hc… | 1 |

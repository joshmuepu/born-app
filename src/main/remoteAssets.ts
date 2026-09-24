/**
 * remoteAssets.ts — the web remote's client: CSS, JS, manifest and service
 * worker, as plain strings served by webRemote.ts's tiny HTTP server. Kept
 * separate from webRemote.ts (routing/business-data plumbing) so the actual
 * UI is easy to read and edit on its own.
 */

export const APP_CSS = `
:root{
  --bg:#0d1117; --surface:#161b22; --surface2:#1c2230; --border:#30363d;
  --text:#e6edf3; --text2:#8b949e; --text3:#6e7681;
  --accent:#8B6FD1; --accent-hover:#9d82e0; --accent-ink:#0d1117;
  --live:#2ea043; --warn:#e3b341; --warn-ink:#1a1200;
  --sage:#83C08E; --amber:#D9A25C; --stone:#C9C2B4;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{
  background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  -webkit-tap-highlight-color:transparent;
  overscroll-behavior-y:none;
}
button{font-family:inherit;-webkit-tap-highlight-color:transparent}
input{font-family:inherit}
::-webkit-scrollbar{display:none}
mark.hl{background:rgba(139,111,209,0.38); color:inherit; border-radius:3px; padding:0 2px}

/* ── App shell: two whole shells, one shown per breakpoint ────────── */
#app{height:100vh; height:100dvh; overflow:hidden;}
#phoneShell{display:flex; flex-direction:column; height:100%}
#tabletShell{display:none; height:100%}

.topbar{
  flex-shrink:0; display:flex; align-items:center; justify-content:space-between;
  padding:calc(14px + env(safe-area-inset-top,0px)) 18px 0;
}
.brand{font-size:14px; font-weight:800; letter-spacing:0.02em; color:var(--accent); display:flex; align-items:center; gap:2px}
.brand .dot{color:var(--sage)}
.conn{display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700}
.conn.ok{color:var(--live)}
.conn.bad{color:var(--text2)}
.conn .led{width:6px; height:6px; border-radius:50%; background:currentColor}

/* Persistent transport strip — on every tab. Sized for a thumb reaching across
   a phone one-handed mid-service, not a mouse: tall targets, generous gaps so
   a miss-tap can't land on the neighboring button, and Next set apart visually
   (filled) from Prev (outline) since it's the one an operator reaches for far
   more often. */
.transport{flex-shrink:0; display:flex; gap:20px; padding:14px 18px 0}
.transport button{
  flex:1; min-height:64px; padding:14px; border-radius:16px;
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:var(--surface); border:1.5px solid var(--border); color:var(--text);
  font-size:15px; font-weight:800;
}
.transport button:active{background:var(--surface2)}
.transport button:disabled{opacity:0.4}
.transport .btn-next{background:var(--accent); border-color:var(--accent); color:var(--accent-ink)}
.transport .btn-next:active{background:var(--accent-hover)}
.transport .blank{flex:0 0 86px; min-height:64px; background:rgba(227,179,65,0.12); border-color:rgba(227,179,65,0.4); color:var(--warn)}
.transport .blank.active{background:var(--warn); color:var(--warn-ink)}

/* Scrolling happens on the active .view itself (not .scroll) so a tab that
   needs an internal fixed-header + independently-scrolling list (Songs, with
   its A-Z rail) has a real bounded height to flex against. */
.scroll{flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0}
.view{display:none}
.view.active{display:flex; flex-direction:column; flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-bottom:24px}

/* Search boxes (and the compact Live Bar riding along with them) must never
   scroll out of view — pinned to the top of whichever .view is scrolling. */
.sticky-head{position:sticky; top:0; z-index:5; background:var(--bg); padding-bottom:6px}

/* ── Compact Live Bar — Sermons / Bible / Songs tabs ─────────────────
   Shows what's currently on screen while the operator searches or browses
   somewhere else, without giving up the room needed to search. Tapping it
   jumps back to the Queue tab, which is the only place content gets big. */
.livebar-slot{padding:0 18px}
.livebar{display:flex; align-items:center; gap:10px; width:100%; margin-top:10px; padding:10px 12px; border-radius:12px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--live); text-align:left; transition:border-color .2s}
.livebar--blanked{border-left-color:var(--warn)}
.livebar:active{background:var(--surface2)}
.livebar svg{flex-shrink:0; color:var(--text2)}
.livebar-dot{width:7px; height:7px; border-radius:50%; background:var(--live); box-shadow:0 0 0 3px rgba(46,160,67,0.22); flex-shrink:0}
.livebar-dot--blanked{background:var(--warn); box-shadow:0 0 0 3px rgba(227,179,65,0.22)}
.livebar-body{flex:1; min-width:0}
.livebar-ref{font-size:10px; font-weight:800; letter-spacing:0.05em; color:var(--live)}
.livebar--blanked .livebar-ref{color:var(--warn)}
.livebar-text{font-size:13px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px; transition:opacity .2s}
.livebar--blanked .livebar-text{opacity:0.6}

/* ── Queue tab: "performance mode" ───────────────────────────────────
   The song leader reads from this device, so what's on screen now
   dominates the screen; what's next is clearly visible but visually
   muted; everything else collapses into a small horizontal strip. */
.queue-header-row{display:flex; align-items:center; justify-content:space-between; padding:16px 18px 0}
.queue-header-row .qh-label{margin:0; font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--text2)}
.queue-file-actions{display:flex; gap:6px}
.filebtn{
  display:flex; align-items:center; gap:5px; padding:0 12px; height:36px;
  border-radius:10px; background:var(--surface); border:1px solid var(--border); color:var(--text2);
  font-size:12.5px; font-weight:700;
}
.filebtn:active{background:var(--surface2)}
/* Legacy icon-only button, kept for call sites elsewhere in the sheet UI. */
.iconbtn{
  display:flex; align-items:center; justify-content:center; width:36px; height:36px;
  border-radius:10px; background:var(--surface); border:1px solid var(--border); color:var(--text2);
}
.iconbtn:active{background:var(--surface2)}

.queue-empty-card{margin:14px 18px 0; padding:28px 20px; border-radius:14px; border:1.5px dashed var(--border); background:rgba(255,255,255,0.02); text-align:center; color:var(--text2); font-size:14px; line-height:1.5}

.now-card{margin:14px 18px 0; border-radius:14px; background:var(--surface); border:1px solid var(--border); overflow:hidden}
.now-card-body{padding:14px}
/* flex-wrap so a long reference (title + date + marker) drops to its own
   full-width line on a narrow phone instead of squeezing into a mid-word
   wrap beside the label — found during a broad QA pass, not a regression
   from any single change. */
.now-head{display:flex; align-items:center; flex-wrap:wrap; gap:2px 6px; margin:14px 18px 8px}
.now-dot{width:6px; height:6px; border-radius:50%; background:var(--live); box-shadow:0 0 0 3px rgba(46,160,67,0.22); flex-shrink:0}
.now-dot--blanked{background:var(--warn); box-shadow:0 0 0 3px rgba(227,179,65,0.22)}
.now-label{font-size:10.5px; font-weight:800; letter-spacing:0.06em; color:var(--live); flex-shrink:0}
.now-label--blanked{color:var(--warn)}
.now-ref{margin-left:auto; font-size:11px; font-family:ui-monospace,monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%}
/* font-size: inherit, not a fixed px, is load-bearing — fitLiveText() sets
   the size on this element's ancestor (.now-card-body or .preview-now) and
   expects the text to scale with it. A fixed value here silently pinned the
   text to 19px forever: the container's font-size kept changing (visible in
   dev tools) but nothing on screen ever did, because this rule always won
   the cascade over inheriting that value. */
.now-text{font-size:inherit; line-height:1.5; color:var(--text)}

/* Fixed, compact — content is always one bounded slide (a sermon paragraph,
   a Bible verse, a song section) now, never the old multi-paragraph blob
   this used to be sized for. fitLiveText() sets the actual font-size; this
   is just its ceiling and the box's height. overflow-y:auto stays as a
   last-resort safety net, not the primary fit mechanism. A colored left
   edge (green live, amber blanked) is a second, independent read on the
   state — registers from the card's silhouette alone, not just the dot. */
.now-card.perf{height:28vh; margin-top:0; display:flex; flex-direction:column; box-shadow:inset 3px 0 0 var(--live); transition:box-shadow .2s}
.now-card.perf.now-card--blanked{box-shadow:inset 3px 0 0 var(--warn)}
.now-card.perf .now-card-body{flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; padding:18px; overflow-y:auto}
.now-card.perf .now-text{line-height:1.4; transition:opacity .2s}
.now-card--blanked .now-text{opacity:0.55}
.now-card.flash{animation:nowFlash .5s ease-out}
@keyframes nowFlash{0%{box-shadow:inset 3px 0 0 var(--live), 0 0 0 3px rgba(139,111,209,0.35)}100%{box-shadow:inset 3px 0 0 var(--live), 0 0 0 0 rgba(139,111,209,0)}}
.now-card--blanked.flash{animation:nowFlashWarn .5s ease-out}
@keyframes nowFlashWarn{0%{box-shadow:inset 3px 0 0 var(--warn), 0 0 0 3px rgba(227,179,65,0.35)}100%{box-shadow:inset 3px 0 0 var(--warn), 0 0 0 0 rgba(227,179,65,0)}}

.next-card{margin:12px 18px 0; min-height:21vh; display:flex; flex-direction:column; padding:16px 18px; border-radius:14px; border:1.5px dashed var(--border); background:rgba(255,255,255,0.02); opacity:0.72}
.next-card .next-label-lg{font-size:10px; font-weight:800; letter-spacing:0.07em; color:var(--text2); opacity:0.75; flex-shrink:0}
.next-card .next-text-lg{flex:1; display:flex; align-items:center; font-size:18px; line-height:1.45; color:var(--text2); margin-top:6px}

.qstrip-row{display:flex; align-items:center; justify-content:space-between; padding:18px 18px 8px}
.qstrip-row .section-label{padding:0}
.qstrip-row .viewall{display:flex; align-items:center; gap:2px; background:none; border:none; color:var(--accent); font-size:12px; font-weight:700; padding:2px 0}
.qstrip{display:flex; gap:8px; overflow-x:auto; padding:0 18px 4px; -webkit-overflow-scrolling:touch}
.qstrip-card{flex:0 0 134px; padding:11px 12px; border-radius:12px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--border); text-align:left}
.qstrip-card[data-kind="song"]{border-left-color:var(--amber)}
.qstrip-card[data-kind="quote"]{border-left-color:var(--stone)}
.qstrip-card[data-kind="bible"]{border-left-color:var(--sage)}
.qstrip-kind{font-size:9px; font-weight:700; font-family:ui-monospace,monospace; color:var(--text2)}
.qstrip-title{font-size:12.5px; font-weight:700; color:var(--text); margin-top:4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden}

.section-label{padding:18px 18px 8px; font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--text2)}
.qlist{padding:0 18px; display:flex; flex-direction:column; gap:8px}
.qitem{padding:14px; border-radius:12px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--border)}
.qitem[data-kind="song"]{border-left-color:var(--amber)}
.qitem[data-kind="quote"]{border-left-color:var(--stone)}
.qitem[data-kind="bible"]{border-left-color:var(--sage)}
.qkind{font-size:10.5px; font-weight:700; font-family:ui-monospace,monospace}
.qitem[data-kind="song"] .qkind{color:var(--amber)}
.qitem[data-kind="quote"] .qkind{color:var(--stone)}
.qitem[data-kind="bible"] .qkind{color:var(--sage)}
.qtitle{font-size:14.5px; font-weight:700; color:var(--text); margin-top:3px}
.qsub{font-size:12px; color:var(--text2); margin-top:2px}
.empty{text-align:center; color:var(--text2); padding:40px 24px; font-size:14px; line-height:1.5}

/* ── Item detail view — verse/slide-by-slide, tap any part to project ─
   Opened from a queue item (Songs, Bible, sermon quotes alike). This is
   what gives the song leader the freedom to jump to any verse next,
   not necessarily in order. */
.slide-list{display:flex; flex-direction:column; gap:10px}
.slide-row{display:block; width:100%; text-align:left; padding:14px 16px; border-radius:12px; background:var(--surface2); border:1px solid var(--border)}
.slide-row:active{background:var(--surface)}
.slide-row.live{border-color:var(--live); background:rgba(46,160,67,0.12)}
/* The verse the operator actually opened on — a lighter accent than "live",
 * same distinction the desktop app draws between .bible-verse--focus and
 * .bible-verse--on-screen. */
.slide-row.focus{border-color:var(--accent); background:rgba(139,111,209,0.14)}
.jumpchips{display:flex; flex-shrink:0; gap:6px; overflow-x:auto; margin-bottom:10px}
.jumpchips button{flex-shrink:0; padding:7px 13px; border-radius:999px; background:var(--surface2); border:1px solid var(--border); font-size:12px; font-weight:700; color:var(--text)}
.jumpchips button:active{background:var(--surface)}
.jumpchips button.is-focus{background:rgba(139,111,209,0.22); border-color:var(--accent); color:#fff}
.slide-label{font-size:11px; font-weight:800; letter-spacing:0.05em; color:var(--accent); margin-bottom:5px}
.slide-row.live .slide-label{color:var(--live)}
.live-tag{font-size:10px; font-weight:800; color:var(--live)}
.slide-text{font-size:16px; line-height:1.5; color:var(--text); white-space:pre-wrap}

/* ── Bottom tab bar (phone) ────────────────────────────────────────── */
.tabbar{
  flex-shrink:0; display:flex; border-top:1px solid var(--border); background:var(--surface);
  padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px));
}
.tab{flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 2px; border-radius:10px; color:var(--text2); font-size:10.5px; font-weight:700; background:none; border:none}
.tab.active{color:var(--accent); background:rgba(139,111,209,0.14)}
.tab[data-tab="sermons"].active{color:var(--stone); background:rgba(201,194,180,0.14)}
.tab[data-tab="bible"].active{color:var(--sage); background:rgba(131,192,142,0.14)}
.tab[data-tab="songs"].active{color:var(--amber); background:rgba(217,162,92,0.14)}

/* ── Search boxes ──────────────────────────────────────────────────── */
.searchbar{padding:14px 18px 0; display:flex; gap:8px}
.searchbox{flex:1; display:flex; align-items:center; gap:10px; padding:13px 14px; border-radius:13px; background:var(--surface); border:1px solid var(--border)}
.searchbox.bible{border-color:var(--sage)}
.searchbox svg{flex-shrink:0; color:var(--text2)}
.searchbox.bible svg{color:var(--sage)}
.searchbox input{flex:1; background:none; border:none; outline:none; color:var(--text); font-size:15px; min-width:0}
.searchbox input::placeholder{color:var(--text3)}
.gobtn{width:58px; border-radius:13px; background:var(--accent); border:none; color:var(--accent-ink); font-size:14px; font-weight:800}
.gobtn:active{background:var(--accent-hover)}

.datebar{padding:8px 18px 0}
.date-input{width:100%; padding:11px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--border); color:var(--text); font-size:13px; font-family:ui-monospace,monospace; outline:none}
.date-input:focus{border-color:var(--accent)}
.date-input::placeholder{color:var(--text3); font-family:inherit; font-size:12.5px}

.results{padding:14px 18px 0; display:flex; flex-direction:column; gap:8px}
.ritem{padding:14px; border-radius:13px; background:var(--surface); border:1px solid var(--border); text-align:left; width:100%}
.ritem:active{background:var(--surface2)}
.rtitle{font-size:15px; font-weight:700; color:var(--text)}
.rmeta{font-size:11px; font-family:ui-monospace,monospace; margin:3px 0 5px}
.rmeta.sermon{color:var(--stone)}
.rmeta.bible{color:var(--sage)}
.rsnippet{font-size:12.5px; color:var(--text2); line-height:1.4}

.browse-chip-row{display:flex; gap:8px; padding-bottom:14px}
.browse-chip{flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 8px; border-radius:12px; background:var(--surface); border:1px solid var(--border); color:var(--stone)}
.browse-chip:active{background:var(--surface2)}
.browse-chip span{font-size:11px; font-weight:700; color:var(--text)}

/* ── Songs tab ─────────────────────────────────────────────────────── */
.recent-head{padding:20px 18px 0; display:flex; align-items:center; gap:7px}
.recent-head svg{color:var(--text2)}
.recent-head span{font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--text2)}
.recent-clear{margin-left:auto; background:none; border:none; color:var(--accent); font-size:12px; font-weight:700; padding:2px 2px}
.recent-list{padding:8px 18px 0; display:flex; flex-direction:column; gap:6px}
.recent-item{padding:13px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--amber); text-align:left; width:100%}
.recent-item:active{background:var(--surface2)}
.recent-item span{font-size:14.5px; font-weight:700; color:var(--text)}

/* The Recent shortlist + section label stay put; only the A-Z list scrolls
   internally, in the space actually left after them. The jump strip is a
   full-width horizontal row of real tap targets under the search box —
   not a sliver of 9px letters pinned to the screen edge, which was there
   but essentially undiscoverable and untappable one-handed. */
.songs-body{flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden}
.azstrip{display:flex; gap:4px; padding:2px 2px 10px; overflow-x:auto; flex-shrink:0}
.azstrip button{flex-shrink:0; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:var(--text); background:var(--surface2); border:none}
.azstrip button:disabled{color:var(--text3); opacity:0.4}
.azstrip button.current{background:var(--accent); color:#fff}
.songlist{flex:1; min-height:0; display:flex; flex-direction:column; gap:1px; padding:0 2px; overflow-y:auto}
.song-letter{position:sticky; top:0; z-index:1; background:var(--bg); font-size:11px; font-weight:800; color:var(--accent); padding:10px 8px 3px}
.song-row{padding:11px 8px; border-radius:10px; font-size:14.5px; color:var(--text); text-align:left; width:100%; background:none; border:none}
.song-row:active{background:var(--surface)}
.song-row mark{background:rgba(139,111,209,0.35); color:var(--text); font-weight:800; border-radius:2px}

/* ── Bible book / chapter grid ─────────────────────────────────────── */
.bible-groups{padding:16px 18px 0; flex:1; overflow-y:auto}
.testament-label{font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--text2); margin:0 0 8px}
.book-grid{display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:6px; margin-bottom:18px}
.book-chip{padding:11px 4px; text-align:center; border-radius:9px; background:var(--surface); border:1px solid var(--border); font-size:12px; font-weight:700; color:var(--text)}
.book-chip:active{background:var(--surface2); border-color:var(--sage)}

.chapter-header{padding:16px 18px 0; display:flex; align-items:center; gap:10px}
.backbtn{background:none; border:none; color:var(--text2); display:flex; align-items:center}
.chapter-title{font-size:16px; font-weight:800; color:var(--text)}
.chapter-grid{display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:6px; padding:14px 18px 0}
.chapter-chip{padding:12px 2px; text-align:center; border-radius:9px; background:var(--surface); border:1px solid var(--border); font-size:13px; font-weight:700; color:var(--text)}
.chapter-chip:active{background:rgba(131,192,142,0.14); border-color:var(--sage)}

.verse-list{padding:12px 18px 0; display:flex; flex-direction:column; gap:8px}

/* ── Search scope: default "Whole Bible", opt-in narrowing ───────────── */
.scope-row{display:flex; align-items:center; gap:8px; margin-top:10px; flex-wrap:wrap}
.scope-pill{padding:6px 12px; border-radius:999px; background:var(--surface); border:1px solid var(--border); color:var(--text2); font-size:12px; font-weight:700}
.scope-pill.active{color:var(--sage); border-color:var(--sage); background:rgba(131,192,142,0.14); font-family:ui-monospace,monospace}
.scope-clear{padding:6px 9px; border-radius:999px; background:rgba(131,192,142,0.14); border:1px solid var(--sage); color:var(--sage); font-size:14px; line-height:1; font-weight:700}
.scope-translation{font-size:11px; color:var(--text3); margin-left:auto}
.scope-options{display:flex; flex-direction:column; gap:2px}
.scope-opt{padding:10px 12px; border-radius:10px; background:none; border:none; color:var(--text); font-size:14px; font-weight:600; text-align:left}
.scope-opt:active{background:var(--surface)}
.scope-opt.active{color:var(--sage)}
.verse-row{display:flex; gap:10px; padding:13px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--border); text-align:left; width:100%}
.verse-row:active{background:var(--surface2)}
.verse-num{font-size:12px; font-weight:800; color:var(--sage); flex-shrink:0; padding-top:1px}
.verse-text{font-size:14.5px; line-height:1.45; color:var(--text2)}

/* ── Preview sheet (shared: sermons / bible / songs) ──────────────── */
.sheet-overlay{position:fixed; inset:0; background:rgba(0,0,0,0.55); display:none; align-items:flex-end; z-index:70}
.sheet-overlay.active{display:flex}
.sheet{
  background:var(--surface); border-top:1px solid var(--border); border-radius:20px 20px 0 0;
  padding:10px 20px calc(26px + env(safe-area-inset-bottom,0px)); width:100%; max-height:78vh;
  overflow-y:auto; box-shadow:0 -12px 32px rgba(0,0,0,0.5);
  display:flex; flex-direction:column; gap:14px;
}
.sheet-overlay.detail-mode .sheet{max-height:92vh}
.sheet-grip{width:36px; height:4px; border-radius:2px; background:var(--border); margin:4px auto 0}
.sheet-title{font-size:17px; font-weight:800; color:var(--text)}
.sheet-meta{font-size:12px; font-family:ui-monospace,monospace; margin-top:3px}
.sheet-meta.sermon{color:var(--stone)} .sheet-meta.bible{color:var(--sage)} .sheet-meta.song{color:var(--amber)}
.sheet-text{font-size:19px; line-height:1.6; color:var(--text)}
.sheet-actions{display:flex; gap:10px; margin-top:2px}
.sheet-actions .btn-queue{flex:1; padding:16px; border-radius:14px; background:transparent; border:1.5px solid var(--border); color:var(--text2); font-size:14.5px; font-weight:700}
.sheet-actions .btn-project{flex:1.3; padding:16px; border-radius:14px; background:var(--accent); border:none; color:var(--accent-ink); font-size:15.5px; font-weight:800; box-shadow:0 6px 18px rgba(139,111,209,0.4)}
.sheet-hint{text-align:center; font-size:11px; color:var(--text2)}

/* ── Song key picker ──────────────────────────────────────────────── */
.key-edit-btn{align-self:flex-start; margin-top:6px; padding:5px 11px; border-radius:999px; background:var(--surface2); border:1px solid var(--border); color:var(--text2); font-size:12px; font-weight:700}
.key-picker-label{margin-top:14px; margin-bottom:8px; font-size:11px; font-weight:800; letter-spacing:.06em; color:var(--text2)}
.key-picker-label:first-child{margin-top:0}
.key-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:8px}
.key-chip{padding:12px 0; border-radius:10px; background:var(--surface2); border:1px solid var(--border); color:var(--text); font-size:15px; font-weight:700; text-align:center}
.key-chip.active{background:rgba(139,111,209,0.22); border-color:var(--accent); color:#fff}
.key-clear{width:100%; margin-top:16px; padding:14px; border-radius:12px; background:transparent; border:1.5px dashed var(--border); color:var(--text2); font-size:14px; font-weight:700}

/* ── Save-queue sheet ──────────────────────────────────────────────── */
.name-input{padding:14px; border-radius:12px; background:var(--bg); border:1px solid var(--border); color:var(--text); font-size:16px; outline:none}
.name-input:focus{border-color:var(--accent)}
.saved-item{display:flex; align-items:center; justify-content:space-between; padding:13px 14px; border-radius:12px; background:var(--bg); border:1px solid var(--border); width:100%; text-align:left}
.saved-item:active{background:var(--surface2)}
.saved-name{font-size:14.5px; font-weight:700; color:var(--text)}
.saved-when{font-size:11px; color:var(--text2)}

/* ── Toast ─────────────────────────────────────────────────────────── */
.toast{position:fixed; top:calc(14px + env(safe-area-inset-top,0px)); left:50%; transform:translateX(-50%); background:#238636; color:#fff; padding:9px 18px; border-radius:9px; font-size:13px; font-weight:700; z-index:90; display:none; white-space:nowrap}

/* ── One-time "Add to Home Screen" sheet ──────────────────────────── */
.a2hs-overlay{position:fixed; inset:0; background:rgba(0,0,0,0.55); display:none; align-items:flex-end; z-index:80}
.a2hs-overlay.active{display:flex}
.a2hs{background:var(--surface); border-top:1px solid var(--border); border-radius:20px 20px 0 0; padding:22px 22px calc(30px + env(safe-area-inset-bottom,0px)); width:100%; display:flex; flex-direction:column; gap:16px}
.a2hs h3{margin:0; font-size:17px; font-weight:800; color:var(--text)}
.a2hs p{margin:0; font-size:13px; color:var(--text2); line-height:1.5}
.a2hs-steps{display:flex; flex-direction:column; gap:12px}
.a2hs-step{display:flex; align-items:center; gap:12px}
.a2hs-num{flex-shrink:0; width:26px; height:26px; border-radius:8px; background:rgba(139,111,209,0.15); display:flex; align-items:center; justify-content:center; color:var(--accent); font-size:12px; font-weight:800}
.a2hs-step-text{display:flex; align-items:center; gap:6px; font-size:13.5px; color:var(--text)}
.a2hs .btn-primary{width:100%; padding:15px; border:none; border-radius:13px; background:var(--accent); color:var(--accent-ink); font-size:15px; font-weight:800}
.a2hs .btn-skip{display:block; margin:0 auto; background:none; border:none; color:var(--text3); font-size:12.5px; font-weight:600; padding:4px 12px}

/* ── Tablet / landscape layout ─────────────────────────────────────────
 * 768px, not 860px: a QA pass found every standard iPad in PORTRAIT (iPad
 * Mini 768, iPad 810, iPad Air/Pro 11" 834) fell just under the old 860px
 * breakpoint and got the cramped phone layout with a huge dead column of
 * empty space, instead of the sidebar + list + preview layout this was
 * actually built for. 768 is also the conventional tablet breakpoint (same
 * one Bootstrap/Tailwind use) and comfortably above any real phone's width,
 * portrait or landscape. ──────────────────────────────────────────── */
@media (min-width: 768px){
  #phoneShell{display:none}
  #tabletShell{display:flex}

  .sidebar{
    width:96px; flex-shrink:0; background:var(--surface); border-right:1px solid var(--border);
    display:flex; flex-direction:column; align-items:center; padding:calc(22px + env(safe-area-inset-top,0px)) 0 22px;
  }
  .sidebar .brand{margin-bottom:26px}
  .sidebar-tab{display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 0; width:72px; border-radius:12px; color:var(--text2); margin-bottom:10px; background:none; border:none; font-size:10px; font-weight:700}
  .sidebar-tab.active{background:rgba(139,111,209,0.14); color:var(--accent)}
  .sidebar-tab[data-tab="sermons"].active{background:rgba(201,194,180,0.14); color:var(--stone)}
  .sidebar-tab[data-tab="bible"].active{background:rgba(131,192,142,0.14); color:var(--sage)}
  .sidebar-tab[data-tab="songs"].active{background:rgba(217,162,92,0.14); color:var(--amber)}
  .sidebar-spacer{flex:1}
  .sidebar .blank{width:84px; min-height:60px; padding:12px 0; border-radius:14px; background:rgba(227,179,65,0.12); border:1.5px solid rgba(227,179,65,0.4); color:var(--warn); font-size:13px; font-weight:800; margin-bottom:16px}
  .sidebar .blank.active{background:var(--warn); color:var(--warn-ink)}
  .sidebar .led{width:7px; height:7px; border-radius:50%; background:var(--live)}

  .tablet-main{flex:1; display:flex; min-width:0}
  .list-pane{width:400px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; padding:26px 22px; overflow:hidden}
  .list-pane h2{margin:0 0 14px; font-size:18px; font-weight:800}
  .list-pane .transport-inline{display:flex; gap:20px; margin-bottom:18px}
  .list-pane .transport-inline button{flex:1; min-height:60px; padding:12px; border-radius:14px; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--bg); border:1.5px solid var(--border); color:var(--text); font-size:14px; font-weight:800}
  .list-pane .transport-inline button:active{background:var(--surface2)}
  .list-pane .transport-inline .btn-next{background:var(--accent); border-color:var(--accent); color:var(--accent-ink)}
  .list-pane .transport-inline .btn-next:active{background:var(--accent-hover)}
  .list-pane .scroll{flex:1; padding-bottom:0; overflow-y:auto}
  .list-pane .songs-body{flex:1; min-height:0}
  .list-pane .searchbar,.list-pane .section-label,.list-pane .results,.list-pane .qlist,.list-pane .now-card,.list-pane .recent-head,.list-pane .recent-list,.list-pane .bible-groups,.list-pane .chapter-grid,.list-pane .verse-list,.list-pane .searchbox,.list-pane .datebar,.list-pane .livebar-slot{padding-left:0 !important; padding-right:0 !important}

  .preview-pane{flex:1; display:flex; flex-direction:column; padding:30px 34px; min-width:0}
  .preview-empty{flex:1; display:flex; align-items:center; justify-content:center; color:var(--text2); font-size:15px; text-align:center; padding:0 40px}
  /* Fixed, compact — see the matching comment on .now-card.perf: content is
     always one bounded slide now, not the old multi-paragraph blob this
     column-filling box used to be sized for. */
  .preview-now{height:42vh; display:flex; align-items:center; padding:26px 28px; border-radius:18px; background:var(--surface); border:1px solid var(--border); box-shadow:inset 4px 0 0 var(--live); overflow-y:auto; transition:box-shadow .2s}
  .preview-now.now-card--blanked{box-shadow:inset 4px 0 0 var(--warn)}
  .preview-now .now-text{line-height:1.4}
  .preview-now.flash{animation:nowFlash .5s ease-out}
  .preview-now.now-card--blanked.flash{animation:nowFlashWarn .5s ease-out}
  .preview-next-box{margin-top:16px; padding:18px 22px; border-radius:16px; background:var(--surface2); border:1.5px dashed var(--border); opacity:0.78; display:flex; gap:12px; align-items:flex-start}
  .preview-next-box svg{flex-shrink:0; margin-top:3px}
  /* Previously unstyled — "NEXT" inherited plain body text size/weight, so it
     read as almost the same line as the next-content text below it. */
  .preview-next-box .next-label{font-size:11px; font-weight:800; letter-spacing:0.07em; color:var(--text2); opacity:0.75}
  .preview-next-box .next-text{white-space:normal; font-size:16px; line-height:1.45; color:var(--text2)}
  .preview-sheet-inline{flex:1; display:flex; flex-direction:column; min-height:0}
  .preview-sheet-inline .sheet-title{font-size:20px}
  .preview-sheet-inline .sheet-text{flex:1; padding:24px 26px; border-radius:16px; background:var(--surface); border:1px solid var(--border); font-size:18px; overflow-y:auto}
  .preview-sheet-inline .sheet-actions{margin-top:18px}
  .preview-sheet-inline .sheet-actions button{padding:18px; font-size:16px}
  .preview-sheet-inline .slide-list{flex:1; overflow-y:auto; padding-right:2px}
  .preview-sheet-inline .slide-row{padding:18px 20px}
  .preview-sheet-inline .slide-text{font-size:19px}
}
`

export const MANIFEST_JSON = JSON.stringify(
  {
    name: 'BORN Remote',
    short_name: 'BORN',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1117',
    theme_color: '#0d1117',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  },
  null,
  2
)

// A trivial service worker: no offline caching (the remote is useless without
// the LAN connection anyway), just enough registration for Chromium/Android
// to consider the page installable and offer the native "Install" prompt.
export const SW_JS = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
`

// Inline stroke icons — kept tiny and named so both shells can reuse them.
const ICON = {
  queue: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  sermons: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/></svg>',
  bible: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  songs: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
  save: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><rect x="4" y="13" width="16" height="8" rx="2"/></svg>',
  flame: '<svg class="dot" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none"><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
}

export function buildAppBody(): string {
  return `
<div id="app">
  <div id="phoneShell">
    <div class="topbar">
      <div class="brand">B${ICON.flame}RN</div>
      <div class="conn bad" id="conn-p"><span class="led"></span><span class="connLabel">Connecting…</span></div>
    </div>
    <div class="transport">
      <button id="prev-p" class="btn-prev"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg><span>Prev</span></button>
      <button id="next-p" class="btn-next"><span>Next</span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
      <button class="blank" id="blank-p">Blank</button>
    </div>
    <div class="scroll">
      <div class="view active" data-view="queue" id="view-queue"></div>
      <div class="view" data-view="sermons" id="view-sermons"></div>
      <div class="view" data-view="bible" id="view-bible"></div>
      <div class="view" data-view="songs" id="view-songs"></div>
    </div>
    <div class="tabbar">
      <button class="tab active" data-tab="queue">${ICON.queue}Queue</button>
      <button class="tab" data-tab="sermons">${ICON.sermons}Sermons</button>
      <button class="tab" data-tab="bible">${ICON.bible}Bible</button>
      <button class="tab" data-tab="songs">${ICON.songs}Songs</button>
    </div>
  </div>

  <div id="tabletShell">
    <div class="sidebar">
      <div class="brand">B${ICON.flame}RN</div>
      <button class="sidebar-tab active" data-tab="queue">${ICON.queue}Queue</button>
      <button class="sidebar-tab" data-tab="sermons">${ICON.sermons}Sermons</button>
      <button class="sidebar-tab" data-tab="bible">${ICON.bible}Bible</button>
      <button class="sidebar-tab" data-tab="songs">${ICON.songs}Songs</button>
      <div class="sidebar-spacer"></div>
      <button class="blank" id="blank-t">Blank</button>
      <div class="led" id="conn-t" title="Connecting…"></div>
    </div>
    <div class="tablet-main">
      <div class="list-pane" id="tabletList"></div>
      <div class="preview-pane" id="tabletPreview"></div>
    </div>
  </div>

  <div class="sheet-overlay" id="sheetOverlay"><div class="sheet" id="sheetBody"></div></div>
  <div class="a2hs-overlay" id="a2hsOverlay">
    <div class="a2hs">
      <h3>Add this to your Home Screen</h3>
      <p>So it's a single tap next time — no browser, no address, no waiting.</p>
      <div class="a2hs-steps" id="a2hsSteps"></div>
      <button class="btn-primary" id="a2hsPrimary">Got it</button>
      <button class="btn-skip" id="a2hsSkip">Skip for now</button>
    </div>
  </div>
  <div class="toast" id="toast"></div>
</div>
`
}

export { ICON }

export const APP_JS = `
'use strict';
var state = {
  tab: 'queue',
  qs: { queue: [], activeIndex: null, activeSlide: 0, blanked: false, onScreen: null },
  sermonQuery: '', sermonDate: '', sermonResults: [],
  bibleQuery: '', bibleView: 'grid', bibleBooks: [], bibleBook: null, bibleChapterNum: null, bibleChapter: null, bibleResults: null, bibleScope: { type: 'all' },
  songsQuery: '', songsAll: [], songsRecent: [], songsResults: null,
  selected: null,
  detailIndex: null,
  savedList: null
};

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function $(id){ return document.getElementById(id); }
function on(el, ev, fn){ if(el) el.addEventListener(ev, fn); }
function kindClass(k){ return k === 'bible' ? 'bible' : k === 'song' ? 'song' : 'sermon'; }

/* Shrinks container's own font-size (its single child inherits it) until
   that child's scrollHeight fits within container's clientHeight, starting
   from basePx and never going below minPx — same idea as the desktop app's
   confidence-monitor auto-fit, ported here so the remote's "on screen now"
   preview doesn't rely on a fixed size + scroll for anything longer than a
   short line. */
function fitLiveText(container, basePx, minPx){
  if(!container) return;
  // The phone card wraps .now-text alongside a status/reference row
  // (.now-head) that isn't part of the text being measured — firstElementChild
  // picked that up instead on phone, so the shrink check compared the wrong
  // element's height and the loop always exited on its first look. Target
  // .now-text by class so both the phone (two children) and tablet (one
  // child) layouts measure the actual text being sized.
  var inner = container.querySelector('.now-text') || container.firstElementChild;
  if(!inner) return;
  var size = basePx;
  container.style.fontSize = size + 'px';
  var guard = 0;
  // Measure the CONTAINER's full scrollHeight, not just inner's — on phone
  // that container also holds the status/reference row (.now-head) above the
  // text, at its own fixed size. Checking inner alone let text grow until it
  // fit the box on its own, ignoring the header sharing that same space, so
  // the two together overflowed: with justify-content:center this clipped
  // evenly off both ends, hiding the header and cutting the last line.
  while(container.scrollHeight > container.clientHeight + 1 && size > minPx && guard < 120){
    size = Math.max(minPx, size - basePx * 0.04);
    container.style.fontSize = size + 'px';
    guard++;
  }
}

/* A short, distinct buzz per action — confirms the tap landed before the
   next /state poll (up to 1s away) can confirm it visually. try/catch and
   the method check both matter: iOS Safari has no navigator.vibrate at all,
   and this must stay silent there, never throw. */
var HAPTIC_MS = { prev: 12, next: 12, blank: 22, unblank: 22 };
function haptic(action){
  try{
    if(navigator.vibrate) navigator.vibrate(HAPTIC_MS[action] || 12);
  }catch(e){}
}
function cmd(action, extra){
  haptic(action);
  var body = Object.assign({ action: action }, extra || {});
  return fetch('/command', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
}
function getJSON(url){ return fetch(url).then(function(r){ return r.json(); }); }

function toast(msg){
  var t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.style.display = 'none'; }, 1700);
}

/* ── Tab switching ─────────────────────────────────────────────────── */
function setTab(tab){
  state.tab = tab;
  if(tab !== 'queue') state.detailIndex = null;
  document.querySelectorAll('.tab').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  document.querySelectorAll('.sidebar-tab').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  document.querySelectorAll('.view').forEach(function(v){ v.classList.toggle('active', v.getAttribute('data-view') === tab); });
  renderCurrentTab();
}
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.tab, .sidebar-tab').forEach(function(b){
    on(b, 'click', function(){ setTab(b.getAttribute('data-tab')); });
  });
  on($('prev-p'), 'click', function(){ cmd('prev'); });
  on($('next-p'), 'click', function(){ cmd('next'); });
  on($('blank-p'), 'click', toggleBlank);
  on($('blank-t'), 'click', toggleBlank);
  on($('sheetOverlay'), 'click', function(e){ if(e.target === $('sheetOverlay')) closeSheet(); });
  initA2HS();
  loadBibleBooks();
  loadSongs();
  renderCurrentTab();
  poll();
  setInterval(poll, 1000);
});
function toggleBlank(){ cmd(state.qs.blanked ? 'unblank' : 'blank'); }

function renderCurrentTab(){
  if(state.tab === 'queue') renderQueueTab();
  else if(state.tab === 'sermons') renderSermonsTab();
  else if(state.tab === 'bible') renderBibleTab();
  else if(state.tab === 'songs') renderSongsTab();
}

/* ── Polling: queue / on-screen / blank state ─────────────────────── */
/* undefined (not '') on purpose — the very first poll always has "no prior
   state to compare against", and must never flash. */
var lastNowSig;
function nowSignature(qs){
  if(!qs || !qs.onScreen) return '';
  return (qs.blanked ? 'B' : 'L') + '|' + (qs.onScreen.reference || '') + '|' + qs.onScreen.text;
}
function poll(){
  // Returns the fetch promise so a just-fired project/queue command can wait
  // for one fresh /state before switching the view to it — otherwise the
  // Queue tab renders with whatever state.qs was BEFORE this action, up to
  // 1s stale, showing "Nothing on screen yet" right after the operator just
  // projected something.
  return getJSON('/state').then(function(s){
    var sig = nowSignature(s);
    // A brief pulse on the "on screen now" card whenever what's live actually
    // changes (new slide, or blanked/restored) — a second, glanceable signal
    // beyond the dot+label text, for an operator watching from across the
    // room. Only ever true when a *previous* poll already ran; the first
    // paint after a page load or tab switch is not a change.
    state.nowJustChanged = (lastNowSig !== undefined && sig !== lastNowSig);
    lastNowSig = sig;
    state.qs = s;
    setConn(true);
    if(state.tab === 'queue') renderQueueTab();
    updateBlankButtons();
    updateLiveBars();
    refreshOpenDetailSheet();
    renderTabletPreview();
  }).catch(function(){ setConn(false); });
}

/* A "project" command's HTTP response only means the desktop received it —
 * the actual on-screen update still has to cross an IPC hop into the
 * desktop's own React state (and, if the projection window was closed, wait
 * for a whole new window to open) before this remote's next /state fetch can
 * see it. One immediate poll often loses that race and switches to the Queue
 * tab showing a stale "Nothing on screen yet." Poll a few times, short delay
 * between each, and stop as soon as the state we're after actually shows up
 * — falls back to just moving on after the last attempt either way, since a
 * bounded wait beats blocking indefinitely on an edge case. */
function pollUntilOnScreen(done){
  var attempts = 0;
  function attempt(){
    attempts++;
    poll().then(function(){
      if(state.qs && state.qs.onScreen) { done(); return; }
      if(attempts >= 6) { done(); return; }
      setTimeout(attempt, 200);
    });
  }
  attempt();
}
function setConn(ok){
  var p = $('conn-p'); var t = $('conn-t');
  if(p){ p.className = 'conn ' + (ok ? 'ok' : 'bad'); p.querySelector('.connLabel').textContent = ok ? 'Connected' : 'Reconnecting…'; }
  if(t){ t.style.background = ok ? 'var(--live)' : 'var(--text3)'; t.title = ok ? 'Connected' : 'Reconnecting…'; }
}
function updateBlankButtons(){
  ['blank-p','blank-t'].forEach(function(id){
    var b = $(id); if(!b) return;
    b.textContent = state.qs.blanked ? 'Restore' : 'Blank';
    b.classList.toggle('active', !!state.qs.blanked);
  });
}
function updateLiveBars(){
  ['livebar-sermons','livebar-sermonsT','livebar-bible','livebar-bibleT','livebar-songs','livebar-songsT'].forEach(function(id){
    var el = $(id);
    if(el) el.innerHTML = liveBarHtml();
  });
}
function refreshOpenDetailSheet(){
  var overlay = $('sheetOverlay');
  if(overlay && overlay.classList.contains('active') && overlay.classList.contains('detail-mode') && state.detailIndex != null){
    var body = $('sheetBody');
    if(body) body.innerHTML = '<div class="sheet-grip"></div>' + queueDetailInnerHtml(state.detailIndex);
  }
}
/* Same phrase the desktop app's own confidence monitor already uses for this
   exact state ("Hidden from screen") — one vocabulary for "blanked but still
   loaded" everywhere in BORN, not a different word on each surface. Dot
   color, label text, and a shared modifier class (for dimming the content
   and an edge color, both driven by CSS) all come from this one place so the
   three places "on screen" is shown can never drift out of sync with each
   other. */
function nowStatusHtml(blanked){
  return blanked
    ? '<span class="now-dot now-dot--blanked"></span><span class="now-label now-label--blanked">HIDDEN FROM SCREEN</span>'
    : '<span class="now-dot"></span><span class="now-label">ON SCREEN NOW</span>';
}
function liveBarHtml(){
  var on = state.qs.onScreen;
  if(!on) return '';
  var blanked = !!state.qs.blanked;
  return '<button class="livebar' + (blanked ? ' livebar--blanked' : '') + '" onclick="setTab(\\'queue\\')">'
    + '<span class="livebar-dot' + (blanked ? ' livebar-dot--blanked' : '') + '"></span>'
    + '<div class="livebar-body">'
    + '<div class="livebar-ref">' + (blanked ? 'HIDDEN' : (on.reference ? esc(on.reference) : 'ON SCREEN')) + '</div>'
    + '<div class="livebar-text">' + esc(on.text) + '</div>'
    + '</div>'
    + ICON_CHEVRON_RIGHT
    + '</button>';
}
/* One builder for all four tablet list panes (Queue/Sermons/Bible/Songs) —
   was four copies of the same markup that had already drifted once (this
   pass changes size and Next/Prev styling; without a shared source that's
   four edits to keep in sync instead of one). */
function transportInlineHtml(){
  return '<div class="transport-inline">'
    + '<button class="btn-prev" onclick="cmd(\\'prev\\')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg><span>Prev</span></button>'
    + '<button class="btn-next" onclick="cmd(\\'next\\')"><span>Next</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>'
    + '</div>';
}

/* ── Queue tab ─────────────────────────────────────────────────────── */
function queueHeaderHtml(){
  return '<div class="queue-header-row">'
    + '<h2 class="qh-label">SERVICE QUEUE</h2>'
    + '<div class="queue-file-actions">'
    + '<button class="filebtn" title="Start a new service" onclick="newService()">' + ICON_PLUS + ' New</button>'
    + '<button class="filebtn" title="Open a saved service" onclick="openSavedSheet()">' + ICON_FOLDER + ' Open</button>'
    + '<button class="filebtn" title="Save this queue" onclick="saveQueueSheet()">' + ICON_SAVE + ' Save</button>'
    + '</div></div>';
}
function nowNextPerfHtml(){
  var on = state.qs.onScreen;
  if(!on){
    return '<div class="queue-empty-card">Nothing on screen yet.<br>Project something from Sermons, Bible or Songs.</div>';
  }
  var blanked = !!state.qs.blanked;
  var refClass = kindClass(on.kind);
  var clickable = state.qs.activeIndex != null;
  // Status + reference sit above the card now, not inside it — same split
  // the tablet layout already used. Sharing one box with the verse text
  // meant the status row ate into the space fitLiveText had to work with,
  // and once the text was actually sized to fill that space (see the
  // fitLiveText fixes above) the two visually ran together as one clump.
  var html = '<div class="now-head">' + nowStatusHtml(blanked)
    + (on.reference ? '<span class="now-ref ' + refClass + '-ref">' + esc(on.reference) + '</span>' : '') + '</div>';
  html += '<div class="now-card perf' + (blanked ? ' now-card--blanked' : '') + (state.nowJustChanged ? ' flash' : '') + '"' + (clickable ? ' style="cursor:pointer" onclick="openQueueItemDetail(' + state.qs.activeIndex + ')"' : '') + '>'
    + '<div class="now-card-body">'
    + '<div class="now-text">' + esc(on.text) + '</div>'
    + '</div></div>';
  html += '<div class="next-card">'
    + '<div class="next-label-lg">NEXT' + (on.nextText ? ' — NOT ON SCREEN YET' : '') + '</div>'
    + '<div class="next-text-lg">' + (on.nextText ? esc(on.nextText) : 'End of this item — pick the next one below') + '</div>'
    + '</div>';
  return html;
}
function nowNextBigHtml(){
  var on = state.qs.onScreen;
  if(!on) return '<div class="preview-empty">Nothing on screen yet.</div>';
  var blanked = !!state.qs.blanked;
  var nextLine = on.nextText ? esc(on.nextText) : 'End of this item — pick the next one from the queue';
  return '<div class="preview-now' + (blanked ? ' now-card--blanked' : '') + (state.nowJustChanged ? ' flash' : '') + '"><div class="now-text">' + esc(on.text) + '</div></div>'
    + '<div class="preview-next-box">' + ICON_CHEVRON_RIGHT
    + '<div><div class="next-label" style="margin-bottom:4px">NEXT</div><div class="next-text">' + nextLine + '</div></div></div>';
}
function compactQueueStripHtml(){
  var q = state.qs.queue || [];
  if(q.length === 0) return '';
  var html = '<div class="qstrip-row"><div class="section-label">QUEUE</div><button class="viewall" onclick="openViewAllQueueSheet()">View all ' + ICON_CHEVRON_RIGHT + '</button></div>';
  html += '<div class="qstrip">';
  for(var i=0;i<q.length;i++){
    var it = q[i];
    var active = i === state.qs.activeIndex;
    html += '<button class="qstrip-card" data-kind="' + esc(it.kind) + '"' + (active ? ' style="outline:2px solid var(--live)"' : '') + ' onclick="openQueueItemDetail(' + i + ')">'
      + '<div class="qstrip-kind">' + esc(it.kind).toUpperCase() + '</div>'
      + '<div class="qstrip-title">' + esc(it.title) + '</div>'
      + '</button>';
  }
  html += '</div>';
  return html;
}
function restOfQueueHtml(includeActive){
  var q = state.qs.queue || [];
  if(q.length === 0) return includeActive ? '<div class="empty">Queue is empty.</div>' : '';
  var html = includeActive ? '' : '<div class="section-label">QUEUE</div>';
  html += '<div class="qlist">';
  for(var i=0;i<q.length;i++){
    var it = q[i];
    var active = i === state.qs.activeIndex;
    if(active && !includeActive) continue;
    html += '<button class="qitem" data-kind="' + esc(it.kind) + '" onclick="openQueueItemDetail(' + i + ')">'
      + '<div class="qkind">' + esc(it.kind).toUpperCase() + (it.slideCount > 1 ? ' \\u00b7 ' + it.slideCount + ' slides' : '') + (active ? ' \\u00b7 ON SCREEN' : '') + '</div>'
      + '<div class="qtitle">' + esc(it.title) + '</div>'
      + (it.subtitle ? '<div class="qsub">' + esc(it.subtitle) + '</div>' : '')
      + '</button>';
  }
  html += '</div>';
  return html;
}
function openViewAllQueueSheet(){
  openGenericSheet('Full Queue', restOfQueueHtml(true));
}
function renderQueueTab(){
  var phone = $('view-queue');
  if(phone){
    phone.innerHTML = queueHeaderHtml() + nowNextPerfHtml() + compactQueueStripHtml();
    fitLiveText(phone.querySelector('.now-card.perf .now-card-body'), 34, 20);
  }

  var list = $('tabletList');
  if(list && state.tab === 'queue'){
    list.innerHTML = '<h2 class="qh-label">SERVICE QUEUE</h2>'
      + transportInlineHtml()
      + '<div class="queue-file-actions" style="margin-bottom:14px">'
      + '<button class="filebtn" title="Start a new service" onclick="newService()">' + ICON_PLUS + ' New</button>'
      + '<button class="filebtn" title="Open a saved service" onclick="openSavedSheet()">' + ICON_FOLDER + ' Open</button>'
      + '<button class="filebtn" title="Save this queue" onclick="saveQueueSheet()">' + ICON_SAVE + ' Save</button>'
      + '</div>'
      + '<div class="scroll">' + restOfQueueHtml() + '</div>';
  }
  renderTabletPreview();
}

function renderTabletPreview(){
  var pane = $('tabletPreview');
  if(!pane) return;
  if(state.tab === 'queue'){
    if(state.detailIndex != null && state.qs.queue && state.qs.queue[state.detailIndex]){
      pane.innerHTML = '<div class="preview-sheet-inline">' + queueDetailInnerHtml(state.detailIndex) + '</div>';
      return;
    }
    pane.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'
      + nowStatusHtml(!!state.qs.blanked)
      + (state.qs.onScreen && state.qs.onScreen.reference ? '<span class="now-ref" style="margin-left:auto;font-size:13px;color:var(--sage)">' + esc(state.qs.onScreen.reference) + '</span>' : '')
      + '</div>'
      + nowNextBigHtml();
    fitLiveText(pane.querySelector('.preview-now'), 36, 20);
    return;
  }
  if(!state.selected){
    pane.innerHTML = '<div class="preview-empty">Select a result on the left to preview it here.<br>Nothing goes on screen until you tap Project.</div>';
    return;
  }
  pane.innerHTML = '<div class="preview-sheet-inline">' + previewInnerHtml(state.selected) + '</div>';
}

/* ── Item detail view (queue) — tap a queue item to see the whole thing,
   tap any slide/verse within it to project that slide immediately. ──── */
function queueDetailInnerHtml(i){
  var it = (state.qs.queue || [])[i];
  if(!it) return '<div class="empty">That item is no longer in the queue.</div>';
  var activeSlide = (i === state.qs.activeIndex) ? state.qs.activeSlide : -1;
  var slides = it.slides || [];
  var html = '<div class="sheet-title">' + esc(it.title) + '</div>'
    + (it.subtitle ? '<div class="sheet-meta ' + kindClass(it.kind) + '">' + esc(it.subtitle) + '</div>' : '');
  if(slides.length === 0){
    html += '<div class="empty">No detail text available — Project will still show the title slide.</div>'
      + '<div class="sheet-actions"><button class="btn-project" onclick="cmd(\\'project\\',{index:' + i + '})">Project ▸</button></div>';
    return html;
  }
  html += '<div class="slide-list">';
  for(var s=0;s<slides.length;s++){
    var sl = slides[s];
    var isLive = (s === activeSlide);
    html += '<button class="slide-row' + (isLive ? ' live' : '') + '" onclick="cmd(\\'project-at\\',{index:' + i + ',slide:' + s + '})">';
    if(sl.label || isLive){
      html += '<div class="slide-label">' + (sl.label ? esc(sl.label) : '') + (isLive ? ' <span class="live-tag">\\u25cf LIVE</span>' : '') + '</div>';
    }
    html += '<div class="slide-text">' + esc(sl.text) + '</div></button>';
  }
  html += '</div><div class="sheet-hint">Tap any part to project it now</div>';
  return html;
}
function openQueueItemDetail(i){
  state.selected = null;
  state.detailIndex = i;
  if(isTabletLayout()){
    closeSheet();
    renderTabletPreview();
    return;
  }
  var body = $('sheetBody');
  if(body) body.innerHTML = '<div class="sheet-grip"></div>' + queueDetailInnerHtml(i);
  var overlay = $('sheetOverlay');
  if(overlay){ overlay.classList.add('active'); overlay.classList.add('detail-mode'); }
}

function newService(){
  if(!confirm('Clear the current queue and start a new service?')) return;
  cmd('new-service').then(function(){ toast('Started a new service'); });
}
function saveQueueSheet(){
  openGenericSheet('Save this queue', ''
    + '<input class="name-input" id="saveNameInput" placeholder="e.g. Sunday Service — ' + new Date().toLocaleDateString() + '" autocomplete="off"/>'
    + '<button class="btn-project" style="padding:15px;border-radius:13px" onclick="doSaveQueue()">Save</button>');
  setTimeout(function(){ var i = $('saveNameInput'); if(i) i.focus(); }, 150);
}
function doSaveQueue(){
  var name = ($('saveNameInput') || {}).value || '';
  if(!name.trim()){ toast('Type a name first'); return; }
  cmd('save-queue', { name: name.trim() }).then(function(){
    toast('Saved “' + name.trim() + '”');
    closeSheet();
  });
}
function openSavedSheet(){
  openGenericSheet('Open a saved service', '<div id="savedListBody">Loading…</div>');
  getJSON('/api/services/recent').then(function(list){
    var body = $('savedListBody');
    if(!body) return;
    if(!list || list.length === 0){ body.innerHTML = '<div class="empty">No saved services yet.</div>'; return; }
    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    for(var i=0;i<list.length;i++){
      html += '<button class="saved-item" onclick="doOpenSaved(' + i + ')">'
        + '<span class="saved-name">' + esc(list[i].name) + '</span>'
        + '<span class="saved-when">' + new Date(list[i].mtimeMs).toLocaleDateString() + '</span>'
        + '</button>';
    }
    html += '</div>';
    body.innerHTML = html;
    window._savedList = list;
  });
}
function doOpenSaved(i){
  var item = (window._savedList || [])[i];
  if(!item) return;
  if(!confirm('Replace the current queue with “' + item.name + '”?')) return;
  cmd('open-service', { path: item.path }).then(function(){
    toast('Loaded “' + item.name + '”');
    closeSheet();
  });
}

/* ── Sermons tab ───────────────────────────────────────────────────── */
function renderSermonsTab(){
  var html = '<div class="sticky-head">'
    + '<div class="searchbar">'
    + '<div class="searchbox"><span>' + ICON_SEARCH + '</span><input id="sermonInput" placeholder="Search sermon quotes…" value="' + esc(state.sermonQuery) + '" onkeydown="if(event.key===\\'Enter\\')runSermonSearch()"/></div>'
    + '<button class="gobtn" onclick="runSermonSearch()">Go</button>'
    + '</div>'
    + '<div class="datebar"><input id="sermonDateInput" class="date-input" placeholder="Optional date filter — e.g. 63-0825E" value="' + esc(state.sermonDate) + '" onkeydown="if(event.key===\\'Enter\\')runSermonSearch()"/></div>'
    + '<div class="livebar-slot" id="livebar-sermons">' + liveBarHtml() + '</div>'
    + '</div>'
    + '<div class="results" id="sermonResultsBox">' + sermonResultsHtml() + '</div>';

  var phone = $('view-sermons');
  if(phone) phone.innerHTML = html;

  var list = $('tabletList');
  if(list && state.tab === 'sermons'){
    list.innerHTML = '<h2>Sermons</h2>'
      + transportInlineHtml()
      + '<div style="display:flex;gap:8px;margin-bottom:10px">'
      + '<div class="searchbox" style="flex:1"><span>' + ICON_SEARCH + '</span><input id="sermonInputT" placeholder="Search sermon quotes…" value="' + esc(state.sermonQuery) + '" onkeydown="if(event.key===\\'Enter\\')runSermonSearch(true)"/></div>'
      + '<button class="gobtn" onclick="runSermonSearch(true)">Go</button>'
      + '</div>'
      + '<div class="datebar" style="margin-bottom:16px"><input id="sermonDateInputT" class="date-input" placeholder="Optional date filter — e.g. 63-0825E" value="' + esc(state.sermonDate) + '" onkeydown="if(event.key===\\'Enter\\')runSermonSearch(true)"/></div>'
      + '<div class="livebar-slot" id="livebar-sermonsT" style="margin-bottom:12px">' + liveBarHtml() + '</div>'
      + '<div class="scroll" id="sermonResultsBoxT">' + sermonResultsHtml() + '</div>';
  }
  renderTabletPreview();
}
function runSermonSearch(tablet){
  var q = ((tablet ? $('sermonInputT') : $('sermonInput')) || {}).value || '';
  q = q.trim();
  var dateEl = tablet ? $('sermonDateInputT') : $('sermonDateInput');
  var dateCode = ((dateEl || {}).value || '').trim();
  state.sermonDate = dateCode;
  if(!q) return;
  state.sermonQuery = q;
  var boxIds = ['sermonResultsBox','sermonResultsBoxT'];
  boxIds.forEach(function(id){ var el = $(id); if(el) el.innerHTML = '<div class="empty">Searching…</div>'; });
  var url = '/api/search/sermons?q=' + encodeURIComponent(q) + (dateCode ? '&date=' + encodeURIComponent(dateCode) : '');
  getJSON(url).then(function(rows){
    state.sermonResults = rows || [];
    boxIds.forEach(function(id){ var el = $(id); if(el) el.innerHTML = sermonResultsHtml(); });
  });
}
function sermonResultsHtml(){
  var rows = state.sermonResults;
  if(!state.sermonQuery) return sermonBrowseChipsHtml();
  if(!rows || rows.length === 0) return '<div class="empty">No results for “' + esc(state.sermonQuery) + '”' + (state.sermonDate ? ' on ' + esc(state.sermonDate) : '') + '.</div>';
  // 200 == MAX_REMOTE_RESULTS (src/shared/searchLimits.ts) — the server
  // already truncates there, so hitting it here means "at least this many."
  var countLabel = (rows.length >= 200 ? rows.length + '+' : rows.length) + ' RESULT' + (rows.length === 1 ? '' : 'S');
  var html = '<div class="section-label">' + countLabel + '</div>';
  for(var i=0;i<rows.length;i++){
    var q = rows[i];
    html += '<button class="ritem" onclick="selectSermon(' + i + ')">'
      + '<div class="rtitle">' + esc(q.sermonTitle) + '</div>'
      + '<div class="rmeta sermon">' + esc(q.dateCode || '') + ' · ¶' + esc(q.paragraphRef) + '</div>'
      + '<div class="rsnippet">' + (q.highlightedText || esc(q.text).slice(0,160)) + '</div>'
      + '</button>';
  }
  return html;
}
function selectSermon(i){
  var q = state.sermonResults[i];
  // A source row can legitimately span several numbered paragraphs
  // ("156-157") — q.slides is the same one-paragraph-per-slide split
  // quoteToItem() computes everywhere else (server-side, so it can never
  // drift from it). Without this the preview fell back to .html below and
  // showed the whole multi-paragraph span as one undivided block, even
  // though projecting it already split correctly.
  var slides = (q.slides || []).map(function(sl){ return { text: sl.text, label: sl.marker ? ('¶' + sl.marker) : '' }; });
  state.selected = {
    kind: 'sermon',
    title: q.sermonTitle,
    meta: (q.dateCode || '') + ' · ¶' + q.paragraphRef,
    slides: slides,
    html: q.highlightedText || esc(q.text),
    payload: { quote: q, query: state.sermonQuery }
  };
  openPreview();
}

/* ── Sermons: lightweight Browse (Date / Series / Recent) ────────────
   Shown in place of the empty-search hint. Date and Series both drill into
   a sermon's full paragraph list (tap any part to project it, same freedom
   as the queue detail view); Recent re-opens a past quote the same way a
   fresh search result does — Queue/Project, nothing projects by accident. */
function sermonBrowseChipsHtml(){
  return '<div class="browse-chip-row">'
    + '<button class="browse-chip" onclick="openOnThisDay()">' + ICON_CALENDAR + '<span>Date</span></button>'
    + '<button class="browse-chip" onclick="openSeriesList()">' + ICON_BOOK + '<span>Series</span></button>'
    + '<button class="browse-chip" onclick="openRecentSermons()">' + ICON_CLOCK + '<span>Recent</span></button>'
    + '</div>'
    + '<div class="empty">Search for a word or phrase, or browse above.</div>';
}
function sermonListSheetHtml(list, onTap){
  if(!list || list.length === 0) return '<div class="empty">Nothing here.</div>';
  var html = '<div class="qlist">';
  for(var i=0;i<list.length;i++){
    var s = list[i];
    html += '<button class="qitem" data-kind="quote" onclick="(' + onTap + ')(' + i + ')">'
      + '<div class="qkind">' + esc(s.date_code || '') + '</div>'
      + '<div class="qtitle">' + esc(s.title) + '</div>'
      + '</button>';
  }
  html += '</div>';
  return html;
}
function openOnThisDay(){
  openGenericSheet('On This Day', '<div id="onThisDayBody" class="empty">Loading…</div>');
  getJSON('/api/sermons/on-this-day').then(function(rows){
    window._onThisDay = rows || [];
    var body = $('onThisDayBody');
    if(body) body.outerHTML = '<div id="onThisDayBody">' + sermonListSheetHtml(window._onThisDay, 'pickOnThisDay') + '</div>';
  });
}
function pickOnThisDay(i){
  var s = window._onThisDay[i];
  if(!s) return;
  openSermonDetailSheet(s.id, s.title, s.date_code);
}
function openSeriesList(){
  openGenericSheet('Series', '<div id="seriesListBody" class="empty">Loading…</div>');
  getJSON('/api/sermons/series').then(function(rows){
    window._series = rows || [];
    var html = '<div class="qlist">';
    for(var i=0;i<window._series.length;i++){
      var s = window._series[i];
      html += '<button class="qitem" data-kind="quote" onclick="pickSeries(' + i + ')">'
        + '<div class="qkind">' + (s.s ? s.s.length : 0) + ' SERMONS</div>'
        + '<div class="qtitle">' + esc(s.n) + '</div>'
        + '</button>';
    }
    html += '</div>';
    var body = $('seriesListBody');
    if(body) body.outerHTML = '<div id="seriesListBody">' + html + '</div>';
  });
}
function pickSeries(i){
  var series = window._series[i];
  if(!series) return;
  openGenericSheet(series.n, '<div id="seriesSermonsBody" class="empty">Loading…</div>');
  getJSON('/api/sermons/by-ids?ids=' + series.s.join(',')).then(function(rows){
    window._seriesSermons = rows || [];
    var body = $('seriesSermonsBody');
    if(body) body.outerHTML = '<div id="seriesSermonsBody">' + sermonListSheetHtml(window._seriesSermons, 'pickSeriesSermon') + '</div>';
  });
}
function pickSeriesSermon(i){
  var s = window._seriesSermons[i];
  if(!s) return;
  openSermonDetailSheet(s.id, s.title, s.date_code);
}
function openSermonDetailSheet(sermonId, title, dateCode){
  openGenericSheet(title, '<div id="sermonDetailBody" class="empty">Loading…</div>');
  getJSON('/api/sermons/' + sermonId + '/paragraphs').then(function(paras){
    window._sermonDetailParas = paras || [];
    // Flatten each row's own one-paragraph-per-slide split into one flat,
    // tap-to-project list — a source row can span several numbered
    // paragraphs ("156-157"), and without this every one of them showed as
    // a single row with both paragraphs' text run together. Each flattened
    // row remembers which source row and which of its slides it came from,
    // so a tap projects exactly that paragraph, not the whole source row.
    window._sermonDetailSlides = [];
    var html = '<div class="sheet-meta sermon">' + esc(dateCode || '') + '</div><div class="slide-list">';
    for(var i=0;i<paras.length;i++){
      var p = paras[i];
      var slides = (p.slides && p.slides.length) ? p.slides : [{ text: p.text, marker: null }];
      for(var s=0;s<slides.length;s++){
        var sl = slides[s];
        var flatIdx = window._sermonDetailSlides.length;
        window._sermonDetailSlides.push({ paraIndex: i, slideIndex: s });
        html += '<button class="slide-row" onclick="projectSermonParagraph(' + flatIdx + ')">'
          + '<div class="slide-label">¶' + esc(sl.marker || p.paragraphRef) + '</div>'
          + '<div class="slide-text">' + esc(sl.text) + '</div></button>';
      }
    }
    html += '</div><div class="sheet-hint">Tap any part to project it now</div>';
    var body = $('sermonDetailBody');
    if(body) body.outerHTML = '<div id="sermonDetailBody">' + html + '</div>';
  });
}
function projectSermonParagraph(flatIdx){
  var ref = (window._sermonDetailSlides || [])[flatIdx];
  if(!ref) return;
  var p = (window._sermonDetailParas || [])[ref.paraIndex];
  if(!p) return;
  cmd('project-sermon', { quote: p, query: '', slide: ref.slideIndex });
}
function openRecentSermons(){
  openGenericSheet('Recently Played', '<div id="recentSermonsBody" class="empty">Loading…</div>');
  getJSON('/api/sermons/recent').then(function(rows){
    window._recentSermons = rows || [];
    var html;
    if(window._recentSermons.length === 0){
      html = '<div class="empty">Sermon quotes you queue or project show up here.</div>';
    } else {
      html = '';
      for(var i=0;i<window._recentSermons.length;i++){
        var q = window._recentSermons[i];
        html += '<button class="ritem" onclick="selectRecentSermon(' + i + ')">'
          + '<div class="rtitle">' + esc(q.sermonTitle) + '</div>'
          + '<div class="rmeta sermon">' + esc(q.dateCode || '') + ' · ¶' + esc(q.paragraphRef) + '</div>'
          + '<div class="rsnippet">' + esc(q.text).slice(0,160) + '</div>'
          + '</button>';
      }
    }
    var body = $('recentSermonsBody');
    if(body) body.outerHTML = '<div id="recentSermonsBody">' + html + '</div>';
  });
}
function selectRecentSermon(i){
  var q = window._recentSermons[i];
  if(!q) return;
  closeSheet();
  var slides = (q.slides || []).map(function(sl){ return { text: sl.text, label: sl.marker ? ('¶' + sl.marker) : '' }; });
  state.selected = {
    kind: 'sermon',
    title: q.sermonTitle,
    meta: (q.dateCode || '') + ' · ¶' + q.paragraphRef,
    slides: slides,
    full: q.text,
    payload: { quote: q, query: '' }
  };
  openPreview();
}

/* ── Bible tab ─────────────────────────────────────────────────────── */
function loadBibleBooks(){
  getJSON('/api/bible/books').then(function(books){ state.bibleBooks = books || []; if(state.tab === 'bible') renderBibleTab(); });
}
/** Whatever the desktop app currently has selected — the remote has no
 *  translation picker of its own, it just reflects this. */
function currentTranslation(){ return (state.qs && state.qs.bibleTranslation) || 'KJV'; }
function bibleScoped(){ return !state.bibleScope || state.bibleScope.type !== 'all'; }
function bibleScopeLabel(){
  var s = state.bibleScope;
  if(!s || s.type === 'all') return 'Whole Bible';
  if(s.type === 'ot') return 'Old Testament';
  if(s.type === 'nt') return 'New Testament';
  return s.abbrev || 'Book';
}
function bibleScopeParam(){
  var s = state.bibleScope;
  if(!s || s.type === 'all') return 'all';
  if(s.type === 'book') return String(s.num);
  return s.type;
}
function renderBibleTab(){
  var scopeRow = '<div class="scope-row">'
    + '<button class="scope-pill' + (bibleScoped() ? ' active' : '') + '" onclick="openScopePicker()">' + esc(bibleScopeLabel()) + '</button>'
    + (bibleScoped() ? '<button class="scope-clear" onclick="clearBibleScope()">&times;</button>' : '')
    + '<span class="scope-translation">' + esc(currentTranslation()) + ' · set on desktop</span>'
    + '</div>';
  var html = '<div class="sticky-head">'
    + '<div class="searchbar">'
    + '<div class="searchbox bible"><span>' + ICON_SEARCH + '</span><input id="bibleInput" placeholder="John 3:16, or &quot;faith&quot;…" value="' + esc(state.bibleQuery) + '" onkeydown="if(event.key===\\'Enter\\')runBibleSearch()"/></div>'
    + '</div>'
    + scopeRow
    + '<div class="livebar-slot" id="livebar-bible">' + liveBarHtml() + '</div>'
    + '</div>'
    + '<div id="bibleBody">' + bibleBodyHtml() + '</div>';

  var phone = $('view-bible');
  if(phone) phone.innerHTML = html;

  var list = $('tabletList');
  if(list && state.tab === 'bible'){
    list.innerHTML = '<h2>Bible</h2>'
      + transportInlineHtml()
      + '<div style="display:flex;margin-bottom:10px"><div class="searchbox bible"><span>' + ICON_SEARCH + '</span><input id="bibleInputT" placeholder="John 3:16, or &quot;faith&quot;…" value="' + esc(state.bibleQuery) + '" onkeydown="if(event.key===\\'Enter\\')runBibleSearch(true)"/></div></div>'
      + scopeRow
      + '<div class="livebar-slot" id="livebar-bibleT" style="margin-bottom:12px">' + liveBarHtml() + '</div>'
      + '<div class="scroll" id="bibleBodyT">' + bibleBodyHtml() + '</div>';
  }
  renderTabletPreview();
}
function openScopePicker(){
  var html = '<div class="scope-options">'
    + '<button class="scope-opt' + (!bibleScoped() ? ' active' : '') + '" onclick="pickScope(\\'all\\')">Whole Bible</button>'
    + '<button class="scope-opt' + (state.bibleScope && state.bibleScope.type==='ot' ? ' active' : '') + '" onclick="pickScope(\\'ot\\')">Old Testament</button>'
    + '<button class="scope-opt' + (state.bibleScope && state.bibleScope.type==='nt' ? ' active' : '') + '" onclick="pickScope(\\'nt\\')">New Testament</button>'
    + '</div><div class="book-grid" style="margin-top:12px">';
  for(var i=0;i<state.bibleBooks.length;i++){
    var b = state.bibleBooks[i];
    html += '<button class="book-chip" onclick="pickScope(' + b.num + ')">' + esc(b.abbrev) + '</button>';
  }
  html += '</div>';
  openGenericSheet('Search in…', html);
}
function pickScope(v){
  if(v === 'all') state.bibleScope = { type: 'all' };
  else if(v === 'ot') state.bibleScope = { type: 'ot' };
  else if(v === 'nt') state.bibleScope = { type: 'nt' };
  else {
    var b = state.bibleBooks.find(function(x){ return x.num === v; });
    state.bibleScope = { type: 'book', num: v, abbrev: b ? b.abbrev : String(v) };
  }
  closeSheet();
  renderBibleTab();
  if(state.bibleQuery) runBibleSearch();
}
function clearBibleScope(){
  state.bibleScope = { type: 'all' };
  renderBibleTab();
  if(state.bibleQuery) runBibleSearch();
}
function bibleBodyHtml(){
  if(state.bibleView === 'results') return bibleResultsHtml();
  if(state.bibleView === 'chapters') return bibleChapterGridHtml();
  if(state.bibleView === 'verses') return bibleVerseListHtml();
  return bibleBookGridHtml();
}
function bibleBookGridHtml(){
  var ot = state.bibleBooks.filter(function(b){ return b.num <= 39; });
  var nt = state.bibleBooks.filter(function(b){ return b.num > 39; });
  function grid(list){
    var h = '<div class="book-grid">';
    for(var i=0;i<list.length;i++){
      h += '<button class="book-chip" onclick="pickBook(' + list[i].num + ')">' + esc(list[i].abbrev) + '</button>';
    }
    return h + '</div>';
  }
  if(state.bibleBooks.length === 0) return '<div class="empty">Loading books…</div>';
  return '<div class="testament-label">OLD TESTAMENT</div>' + grid(ot) + '<div class="testament-label">NEW TESTAMENT</div>' + grid(nt);
}
function pickBook(num){
  state.bibleBook = state.bibleBooks.find(function(b){ return b.num === num; });
  state.bibleView = 'chapters';
  renderBibleTab();
}
function bibleChapterGridHtml(){
  var b = state.bibleBook;
  if(!b) return '';
  var h = '<div class="chapter-header"><button class="backbtn" onclick="backToBooks()">' + ICON_CHEVRON_LEFT + '</button><span class="chapter-title">' + esc(b.name) + '</span></div>'
    + '<div class="chapter-grid">';
  for(var c=1;c<=b.chapters;c++){
    h += '<button class="chapter-chip" onclick="pickChapter(' + c + ')">' + c + '</button>';
  }
  return h + '</div>';
}
function backToBooks(){ state.bibleView = 'grid'; state.bibleBook = null; renderBibleTab(); }
function pickChapter(c){
  state.bibleChapterNum = c;
  state.bibleView = 'verses';
  renderBibleTab();
  var b = state.bibleBook;
  getJSON('/api/bible/chapter?book=' + b.num + '&chapter=' + c).then(function(data){
    state.bibleChapter = data;
    if(state.bibleView === 'verses') renderBibleTab();
  });
}
function bibleVerseListHtml(){
  var b = state.bibleBook;
  var h = '<div class="chapter-header"><button class="backbtn" onclick="backToChapters()">' + ICON_CHEVRON_LEFT + '</button><span class="chapter-title">' + esc(b.name) + ' ' + state.bibleChapterNum + '</span></div>';
  var ch = state.bibleChapter;
  if(!ch || ch.error) return h + '<div class="empty">Loading…</div>';
  h += '<div class="verse-list">';
  for(var i=0;i<ch.verses.length;i++){
    var v = ch.verses[i];
    h += '<button class="verse-row" onclick="selectVerse(' + v.verse + ')"><span class="verse-num">' + v.verse + '</span><span class="verse-text">' + esc(v.text) + '</span></button>';
  }
  return h + '</div>';
}
function backToChapters(){ state.bibleView = 'chapters'; state.bibleChapter = null; renderBibleTab(); }
function bookNameFor(num){
  var b = state.bibleBooks.find(function(x){ return x.num === num; });
  return b ? b.name : '';
}
/** The one place every entry path (browse, reference lookup, keyword hit)
 *  converges: the WHOLE chapter, not an isolated verse, so the song leader
 *  — sorry, the reader — can see what comes before and after. Every verse
 *  is tappable to project immediately, same as the queue's own slide list. */
function openChapterContext(bookNum, chapterNum, focusVerses){
  var trans = currentTranslation();
  getJSON('/api/bible/chapter?book=' + bookNum + '&chapter=' + chapterNum).then(function(ch){
    if(!ch || ch.error || !ch.verses) return;
    var bookName = bookNameFor(bookNum);
    var slides = ch.verses.map(function(v){ return { label: 'Verse ' + v.verse, text: v.text, verseNum: v.verse }; });
    var verseRefs = ch.verses.map(function(v){ return bookName + ' ' + chapterNum + ':' + v.verse; });
    var idx = ch.verses.findIndex(function(v){ return focusVerses.indexOf(v.verse) !== -1; });
    var primary = idx >= 0 ? idx : 0;
    state.selected = {
      kind: 'bible',
      title: bookName + ' ' + chapterNum,
      meta: trans,
      slides: slides,
      focusVerses: focusVerses,
      focusIndex: primary,
      payload: { reference: verseRefs[primary], translation: trans, verseRefs: verseRefs }
    };
    openPreview();
  });
}
function selectVerse(v){
  var b = state.bibleBook;
  openChapterContext(b.num, state.bibleChapterNum, [v]);
}
function runBibleSearch(tablet){
  var q = ((tablet ? $('bibleInputT') : $('bibleInput')) || {}).value || '';
  q = q.trim();
  if(!q){ state.bibleView = 'grid'; renderBibleTab(); return; }
  state.bibleQuery = q;
  state.bibleView = 'results';
  renderBibleTab();
  getJSON('/api/search/bible?q=' + encodeURIComponent(q) + '&scope=' + encodeURIComponent(bibleScopeParam())).then(function(data){
    state.bibleResults = data;
    if(state.bibleView === 'results') renderBibleTab();
  });
}
function bibleResultsHtml(){
  var data = state.bibleResults;
  if(!data) return '<div class="empty">Searching…</div>';
  if(data.kind === 'error') return '<div class="empty">' + esc(data.message) + '</div>';
  var backRow = '<div class="chapter-header"><button class="backbtn" onclick="clearBibleSearch()">' + ICON_CHEVRON_LEFT + '</button><span class="chapter-title">Results</span></div>';
  if(data.kind === 'passage'){
    var p = data.passage;
    var text = p.verses.map(function(v){ return v.verse + ' ' + v.text; }).join('  ');
    window._passage = p;
    return backRow + '<div class="results"><button class="ritem" onclick="selectPassage()">'
      + '<div class="rtitle">' + esc(p.reference) + ' · ' + esc(p.translation) + '</div>'
      + '<div class="rsnippet">' + esc(text).slice(0,200) + '</div></button></div>';
  }
  var hits = data.hits || [];
  window._bibleHits = hits;
  if(hits.length === 0) return backRow + '<div class="empty">No matches.</div>';
  var q = state.bibleQuery || '';
  // 200 == MAX_REMOTE_RESULTS (src/shared/searchLimits.ts) — the server already
  // truncates there, so hitting it here means "at least this many," not exact.
  var countLabel = (hits.length >= 200 ? hits.length + '+' : hits.length) + ' RESULT' + (hits.length === 1 ? '' : 'S');
  var html = backRow + '<div class="section-label">' + countLabel + (bibleScoped() ? ' IN ' + esc(bibleScopeLabel()).toUpperCase() : '') + '</div><div class="results">';
  for(var i=0;i<hits.length;i++){
    var h = hits[i];
    html += '<button class="ritem" onclick="selectBibleHit(' + i + ')">'
      + '<div class="rtitle">' + esc(h.reference) + ' · ' + esc(h.translation) + '</div>'
      + '<div class="rsnippet">' + hlText(h.text.slice(0,160), q) + '</div></button>';
  }
  return html + '</div>';
}
function clearBibleSearch(){ state.bibleQuery = ''; state.bibleView = 'grid'; renderBibleTab(); }
function selectPassage(){
  var p = window._passage;
  var focus = [];
  if(p.verseStart != null){
    for(var i=p.verseStart;i<=p.verseEnd;i++) focus.push(i);
  }
  openChapterContext(p.bookNum, p.chapter, focus);
}
function selectBibleHit(i){
  var h = window._bibleHits[i];
  openChapterContext(h.bookNum, h.chapter, [h.verse]);
}

/* ── Songs tab ─────────────────────────────────────────────────────── */
var songsSearchTimer = null;
var songsSearchSeq = 0;
function loadSongs(){
  // The full library, loaded once — Browse and the A-Z strip work off this,
  // no cap, no re-fetch per keystroke.
  getJSON('/api/search/songs?q=').then(function(rows){ state.songsAll = rows || []; if(state.tab === 'songs') renderSongsBody(); });
  getJSON('/api/songs/recent').then(function(rows){ state.songsRecent = rows || []; if(state.tab === 'songs') renderSongsBody(); });
}
function renderSongsTab(){
  var html = '<div class="sticky-head">'
    + '<div class="searchbar">'
    + '<div class="searchbox"><span>' + ICON_SEARCH + '</span><input id="songInput" placeholder="Search titles &amp; lyrics…" value="' + esc(state.songsQuery) + '" oninput="filterSongs(this.value)"/></div>'
    + '</div>'
    + '<div class="livebar-slot" id="livebar-songs">' + liveBarHtml() + '</div>'
    + '</div>'
    + '<div id="songsBody" class="songs-body">' + songsBodyHtml() + '</div>';

  var phone = $('view-songs');
  if(phone) phone.innerHTML = html;

  var list = $('tabletList');
  if(list && state.tab === 'songs'){
    list.innerHTML = '<h2>Songs</h2>'
      + transportInlineHtml()
      + '<div style="display:flex;margin-bottom:10px"><div class="searchbox"><span>' + ICON_SEARCH + '</span><input id="songInputT" placeholder="Search titles &amp; lyrics…" value="' + esc(state.songsQuery) + '" oninput="filterSongs(this.value,true)"/></div></div>'
      + '<div class="livebar-slot" id="livebar-songsT" style="margin-bottom:12px">' + liveBarHtml() + '</div>'
      + '<div id="songsBodyT" class="songs-body songs-body--tablet">' + songsBodyHtml() + '</div>';
  }
  renderTabletPreview();
}
function renderSongsBody(){
  var ids = ['songsBody','songsBodyT'];
  ids.forEach(function(id){ var el = $(id); if(el) el.innerHTML = songsBodyHtml(); });
}
function filterSongs(v){
  state.songsQuery = v;
  var q = v.trim();
  if(songsSearchTimer) clearTimeout(songsSearchTimer);
  if(q.length < 2){
    state.songsResults = null;
    renderSongsBody();
    return;
  }
  // Server-side search — the same title+lyrics FTS the desktop app uses, not
  // a client-side title-only substring filter over whatever's cached, so a
  // half-remembered lyric line finds the song here too.
  var seq = ++songsSearchSeq;
  songsSearchTimer = setTimeout(function(){
    getJSON('/api/search/songs?q=' + encodeURIComponent(q)).then(function(rows){
      if(seq !== songsSearchSeq) return; // a newer keystroke already won
      state.songsResults = rows || [];
      renderSongsBody();
    });
  }, 200);
  renderSongsBody(); // show the "keep typing" / stale state immediately
}
function clearRecentSongs(){
  cmd('clear-recent-songs').then(function(){
    state.songsRecent = [];
    renderSongsBody();
  });
}
/** First occurrence of 'q' in 'text', wrapped in <mark>, everything escaped. */
function hlText(text, q){
  text = text || '';
  if(!q) return esc(text);
  var idx = text.toLowerCase().indexOf(q.toLowerCase());
  if(idx === -1) return esc(text);
  return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + q.length)) + '</mark>' + esc(text.slice(idx + q.length));
}
function songRowHtml(s, q){
  var html = '<button class="song-row" onclick="selectSongById(' + s.id + ')">' + (q ? hlText(s.title, q) : esc(s.title));
  if(s.source === 'import') html += ' <span style="opacity:.6;font-size:10.5px;font-weight:700;letter-spacing:.03em">IMPORTED</span>';
  if(q && s.matchedInTitle === false && s.matchSlide){
    html += '<div style="margin-top:4px;font-size:12.5px;color:var(--text2);font-style:italic">“' + hlText(s.matchSlide.text, q) + '”</div>'
      + '<div style="margin-top:2px;font-size:10.5px;color:var(--text3)">Matched in lyrics' + (s.matchSlide.label ? ' — ' + esc(s.matchSlide.label) : '') + '</div>';
  }
  html += '</button>';
  return html;
}
function azStripHtml(list){
  var present = {};
  for(var i=0;i<list.length;i++){
    var ch = /[A-Za-z]/.test((list[i].title||'')[0] || '') ? list[i].title[0].toUpperCase() : '#';
    present[ch] = true;
  }
  var letters = ['#'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  var html = '<div class="azstrip">';
  for(var j=0;j<letters.length;j++){
    var l = letters[j];
    html += present[l]
      ? '<button onclick="jumpToLetter(this,\\'' + l + '\\')">' + l + '</button>'
      : '<button disabled>' + l + '</button>';
  }
  html += '</div>';
  return html;
}
function songsBodyHtml(){
  var q = (state.songsQuery || '').trim();
  if(q.length > 0 && q.length < 2){
    return '<div class="section-label">SEARCH</div><div class="empty">Keep typing — search needs at least 2 letters.</div>';
  }

  if(q.length >= 2){
    if(state.songsResults === null) return '<div class="section-label">SEARCHING…</div>';
    var results = state.songsResults;
    var html = '<div class="section-label">' + results.length + ' RESULT' + (results.length === 1 ? '' : 'S') + '</div>';
    if(results.length === 0){ html += '<div class="empty">No songs found.</div>'; return html; }
    html += '<div class="songlist">';
    for(var i=0;i<results.length;i++) html += songRowHtml(results[i], q);
    html += '</div>';
    return html;
  }

  // No query: Recent shortlist, then the full A-Z library — no cap, so every
  // song in a 1,000+ song library is actually reachable by scrolling.
  var recent = state.songsRecent;
  var all = state.songsAll;
  var html = '';
  if(recent.length > 0){
    html += '<div class="recent-head">' + ICON_CLOCK + '<span>RECENT</span><button class="recent-clear" onclick="clearRecentSongs()">Clear</button></div><div class="recent-list">';
    for(var r=0;r<recent.length;r++){
      html += '<button class="recent-item" onclick="selectSongById(' + recent[r].id + ')"><span>' + esc(recent[r].title) + '</span></button>';
    }
    html += '</div>';
  }
  html += '<div class="section-label">ALL SONGS' + (all.length ? ' · ' + all.length : '') + '</div>';
  if(all.length === 0){ html += '<div class="empty">No songs found.</div>'; return html; }
  html += azStripHtml(all);
  html += '<div class="songlist">';
  var lastLetter = '';
  for(var j=0;j<all.length;j++){
    var s = all[j];
    var letter = /[A-Za-z]/.test(s.title[0] || '') ? s.title[0].toUpperCase() : '#';
    if(letter !== lastLetter){
      html += '<div class="song-letter" data-letter="' + letter + '">' + letter + '</div>';
      lastLetter = letter;
    }
    html += songRowHtml(s, null);
  }
  html += '</div>';
  return html;
}
function jumpToLetter(btn, letter){
  var container = btn.closest('.songs-body');
  if(!container) return;
  var target = container.querySelector('[data-letter="' + letter + '"]');
  if(target) target.scrollIntoView({ block: 'start' });
}
function afterProjectFromSheet(){
  toast('Projecting…');
  closeSheet();
  state.selected = null;
  // Fetch the just-updated on-screen state before switching to the Queue
  // tab, so it never briefly renders "Nothing on screen yet" right after
  // the operator's own tap projected something.
  pollUntilOnScreen(function(){ setTab('queue'); });
}
function projectPreviewSlide(i){
  var item = state.selected;
  if(!item) return;
  if(item.kind === 'song'){
    cmd('project-song', { songId: item.payload.songId, slide: i }).then(afterProjectFromSheet);
  } else if(item.kind === 'bible' && item.payload && item.payload.verseRefs){
    cmd('project-bible', { reference: item.payload.verseRefs[i], translation: item.payload.translation }).then(afterProjectFromSheet);
  } else if(item.kind === 'sermon' && item.payload && item.payload.quote){
    cmd('project-sermon', { quote: item.payload.quote, query: item.payload.query, slide: i }).then(afterProjectFromSheet);
  }
}
function selectSongById(id){
  getJSON('/api/song/' + id).then(function(s){
    if(!s) return;
    var slides = (s.slides || []).map(function(sl){ return { text: sl.text, label: sl.label || '' }; });
    state.selected = {
      kind: 'song',
      title: s.title,
      songKey: s.songKey,
      meta: [s.author, s.songKey ? ('Key of ' + s.songKey) : null].filter(Boolean).join(' · '),
      slides: slides,
      payload: { songId: s.id }
    };
    openPreview();
  });
}

/* ── Key picker (song leader can fix a key from the remote, live or ahead
   of time) — same 12-root × major/minor grid the desktop popover uses,
   presented as a sheet since the remote has no inline-popover real estate. */
var KEY_MAJORS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var KEY_MINORS = KEY_MAJORS.map(function(k){ return k + 'm'; });
function keyChipHtml(k, current){
  // Single-quoted JS arg inside the double-quoted onclick attribute — same
  // escaping pattern jumpToLetter() already uses; JSON.stringify would wrap
  // in double quotes and collide with the attribute's own quoting.
  return '<button class="key-chip' + (k === current ? ' active' : '') + '" onclick="setSongKey(\\'' + k + '\\')">' + esc(k) + '</button>';
}
function renderKeyPickerSheet(){
  var item = state.selected;
  if(!item || item.kind !== 'song') return;
  var current = item.songKey;
  var recent = state.recentKeys || [];
  var html = '';
  if(recent.length){
    html += '<div class="key-picker-label">RECENTLY USED</div><div class="key-grid">'
      + recent.map(function(k){ return keyChipHtml(k, current); }).join('') + '</div>';
  }
  html += '<div class="key-picker-label">MAJOR</div><div class="key-grid">'
    + KEY_MAJORS.map(function(k){ return keyChipHtml(k, current); }).join('') + '</div>';
  html += '<div class="key-picker-label">MINOR</div><div class="key-grid">'
    + KEY_MINORS.map(function(k){ return keyChipHtml(k, current); }).join('') + '</div>';
  html += '<button class="key-clear" onclick="setSongKey(null)">No key</button>';
  openGenericSheet('Set key', html);
}
function openKeyPickerSheet(){
  var item = state.selected;
  if(!item || item.kind !== 'song') return;
  // Fetch fresh each time rather than trusting a possibly-stale cache —
  // this sheet is opened rarely enough that one extra round trip is free.
  getJSON('/api/songs/recent-keys').then(function(k){
    state.recentKeys = k || [];
    renderKeyPickerSheet();
  });
}
function setSongKey(key){
  var item = state.selected;
  if(!item || item.kind !== 'song') return;
  var songId = item.payload.songId;
  cmd('update-song-key', { songId: songId, key: key }).then(function(){
    return getJSON('/api/song/' + songId);
  }).then(function(s){
    if(!s) { closeSheet(); return; }
    item.songKey = s.songKey;
    item.meta = [s.author, s.songKey ? ('Key of ' + s.songKey) : null].filter(Boolean).join(' · ');
    // On tablet the key picker is its own overlay on top of the persistent
    // side pane, not the pane itself — close it explicitly (openPreview()'s
    // tablet branch only re-renders the pane, it was never the thing
    // holding the picker open) before rebuilding the preview underneath.
    closeSheet();
    openPreview();
  });
}

/* ── Shared preview (sheet on phone, side pane on tablet) ─────────── */
function previewInnerHtml(item){
  var bodyHtml;
  // Only a song sets .slides — sermon/bible previews use .full/.html.
  // Every slide carries a real label now (Verse 2, Verse 3… not just the
  // first one), and tapping a slide projects it immediately instead of
  // being a static read-only list — the same "one tap = live" rule the
  // desktop app's own slide cards already follow.
  var isSlidesItem = item.slides && item.slides.length > 0;
  var focusVerses = item.focusVerses || [];
  if(isSlidesItem){
    bodyHtml = '';
    if(item.slides.length > 1){
      bodyHtml += '<div class="jumpchips">';
      for(var c=0;c<item.slides.length;c++){
        var chipFocus = item.kind === 'bible' && focusVerses.indexOf(item.slides[c].verseNum) !== -1;
        bodyHtml += '<button class="' + (chipFocus ? 'is-focus' : '') + '" onclick="projectPreviewSlide(' + c + ')">' + esc(item.slides[c].label || ('Slide ' + (c + 1))) + '</button>';
      }
      bodyHtml += '</div>';
    }
    bodyHtml += '<div class="slide-list">';
    for(var s=0;s<item.slides.length;s++){
      var sl = item.slides[s];
      var rowFocus = item.kind === 'bible' && focusVerses.indexOf(sl.verseNum) !== -1;
      bodyHtml += '<button class="slide-row' + (rowFocus ? ' focus' : '') + '" data-idx="' + s + '" onclick="projectPreviewSlide(' + s + ')">'
        + (sl.label ? '<div class="slide-label">' + esc(sl.label) + '</div>' : '')
        + '<div class="slide-text">' + esc(sl.text) + '</div></button>';
    }
    bodyHtml += '</div>';
  } else if(item.html){
    bodyHtml = '<div class="sheet-text">' + item.html + '</div>';
  } else {
    bodyHtml = '<div class="sheet-text">' + esc(item.full || 'Tap Project to send this live.') + '</div>';
  }
  var hint = (isSlidesItem && item.slides.length > 1)
    ? 'Tap any verse to put it on screen instantly'
    : 'Nothing goes on screen until you tap Project';
  var keyEditHtml = item.kind === 'song'
    ? '<button class="key-edit-btn" onclick="openKeyPickerSheet()">' + (item.songKey ? 'Change key' : '+ Add key') + '</button>'
    : '';
  return '<div class="sheet-title">' + esc(item.title) + '</div>'
    + (item.meta ? '<div class="sheet-meta ' + item.kind + '">' + esc(item.meta) + '</div>' : '')
    + keyEditHtml
    + bodyHtml
    + '<div class="sheet-actions">'
    + '<button class="btn-queue" onclick="sheetAction(\\'queue\\')">' + ICON_PLUS + ' Add to Queue</button>'
    + '<button class="btn-project" onclick="sheetAction(\\'project\\')">Project ▸</button>'
    + '</div>'
    + '<div class="sheet-hint">' + hint + '</div>';
}
function isTabletLayout(){
  // Must match the @media breakpoint above (768px) exactly, or the CSS layout
  // and this JS-side branch (which decides sheet-vs-side-pane behavior) can
  // disagree at some widths.
  return window.matchMedia('(min-width: 768px)').matches;
}
/** Jump straight to the verse/slide the operator actually asked for,
 *  instead of always opening scrolled to the top of a whole chapter. */
function scrollToPreviewFocus(){
  if(!state.selected || state.selected.focusIndex == null) return;
  var idx = state.selected.focusIndex;
  setTimeout(function(){
    var els = document.querySelectorAll('.slide-row[data-idx="' + idx + '"]');
    for(var i=0;i<els.length;i++) els[i].scrollIntoView({ block: 'center' });
  }, 0);
}
function openPreview(){
  state.detailIndex = null;
  renderTabletPreview();
  if(isTabletLayout()){ scrollToPreviewFocus(); return; } // tablet shows the preview in the persistent side pane, not a sheet
  var body = $('sheetBody');
  if(body) body.innerHTML = '<div class="sheet-grip"></div>' + previewInnerHtml(state.selected);
  var overlay = $('sheetOverlay');
  if(overlay) overlay.classList.add('active');
  scrollToPreviewFocus();
}
function closeSheet(){
  var overlay = $('sheetOverlay');
  if(overlay){ overlay.classList.remove('active'); overlay.classList.remove('detail-mode'); }
}
function openGenericSheet(title, innerHtml){
  var body = $('sheetBody');
  if(body) body.innerHTML = '<div class="sheet-grip"></div><div class="sheet-title">' + esc(title) + '</div><div style="display:flex;flex-direction:column;gap:12px">' + innerHtml + '</div>';
  var overlay = $('sheetOverlay');
  if(overlay) overlay.classList.add('active');
}
function sheetAction(which){
  var item = state.selected;
  if(!item) return;
  var action =
    item.kind === 'sermon' ? (which === 'queue' ? 'queue-sermon' : 'project-sermon') :
    item.kind === 'bible'  ? (which === 'queue' ? 'queue-bible'  : 'project-bible')  :
                              (which === 'queue' ? 'queue-song'   : 'project-song');
  var payload = item.kind === 'sermon' ? { quote: item.payload.quote, query: item.payload.query } : item.payload;
  cmd(action, payload).then(function(){
    toast(which === 'queue' ? 'Added to queue' : 'Projecting…');
    closeSheet();
    if(which === 'project'){
      state.selected = null;
      // Same fix as afterProjectFromSheet: wait for a fresh /state before
      // switching to the Queue tab, so it doesn't render a stale "nothing
      // on screen" for up to a second right after this project tap.
      pollUntilOnScreen(function(){ setTab('queue'); });
    } else {
      renderTabletPreview();
    }
  });
}

/* ── Renderer-triggered new/save/open confirmations already gate on the
   remote side (above) — the desktop app applies them without asking again,
   since asking twice (once here, once via a JS confirm() on an unattended
   desktop) would block on nobody being there to click it. ──────────── */

/* ── Add to Home Screen ────────────────────────────────────────────── */
var deferredInstallPrompt = null;
function initA2HS(){
  var already = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var dismissed = false;
  try { dismissed = localStorage.getItem('born-remote-a2hs-dismissed') === '1'; } catch(e){}
  if(already || dismissed) return;

  // iPadOS 13+ Safari reports a desktop-Mac user agent by design, so "iPad"
  // never appears in it — maxTouchPoints is the only reliable way left to
  // tell a real Mac (0) from an iPad pretending to be one (>1).
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredInstallPrompt = e;
    showA2HS(false);
  });

  if(isIOS){
    setTimeout(function(){ showA2HS(true); }, 900);
  }
}
function showA2HS(isIOS){
  var steps = $('a2hsSteps');
  var primary = $('a2hsPrimary');
  if(isIOS){
    steps.innerHTML = ''
      + '<div class="a2hs-step"><div class="a2hs-num">1</div><div class="a2hs-step-text">Tap ' + ICON_SHARE + ' Share</div></div>'
      + '<div class="a2hs-step"><div class="a2hs-num">2</div><div class="a2hs-step-text">Choose “Add to Home Screen”</div></div>';
    primary.textContent = 'Got it';
    primary.onclick = function(){ dismissA2HS(); };
  } else {
    steps.innerHTML = '<div class="a2hs-step"><div class="a2hs-step-text">Installs like an app — opens straight to the remote next time, no browser bar.</div></div>';
    primary.textContent = 'Install';
    primary.onclick = function(){
      $('a2hsOverlay').classList.remove('active');
      if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); deferredInstallPrompt = null; }
      try { localStorage.setItem('born-remote-a2hs-dismissed', '1'); } catch(e){}
    };
  }
  $('a2hsOverlay').classList.add('active');
}
function dismissA2HS(){
  $('a2hsOverlay').classList.remove('active');
  try { localStorage.setItem('born-remote-a2hs-dismissed', '1'); } catch(e){}
}
document.addEventListener('DOMContentLoaded', function(){ on($('a2hsSkip'), 'click', dismissA2HS); });
`
  .replace(/ICON_QUEUE/g, JSON.stringify(ICON.queue))
  .replace(/ICON_SEARCH/g, JSON.stringify(ICON.search))
  .replace(/ICON_CLOCK/g, JSON.stringify(ICON.clock))
  .replace(/ICON_CHEVRON_LEFT/g, JSON.stringify(ICON.chevronLeft))
  .replace(/ICON_CHEVRON_RIGHT/g, JSON.stringify(ICON.chevronRight))
  .replace(/ICON_FOLDER/g, JSON.stringify(ICON.folder))
  .replace(/ICON_SAVE/g, JSON.stringify(ICON.save))
  .replace(/ICON_PLUS/g, JSON.stringify(ICON.plus))
  .replace(/ICON_SHARE/g, JSON.stringify(ICON.share))
  .replace(/ICON_CALENDAR/g, JSON.stringify(ICON.calendar))
  .replace(/ICON_BOOK/g, JSON.stringify(ICON.book))

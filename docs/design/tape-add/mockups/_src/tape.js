/* Tape "Add" redesign mockups — behaviour. Placeholder content only; nothing is stored except the chosen theme and the board decisions (localStorage, wrapped). */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) }
  var store = { get: function (k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set: function (k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
  var qs = new URLSearchParams(location.search)

  // ---- theme / size (also from the address, for screenshots)
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); store.set('ba-tape-theme', t); $$('[data-theme-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t)) }) }
  setTheme(qs.get('theme') || store.get('ba-tape-theme') || 'dark')
  $$('[data-theme-btn]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.dataset.themeBtn) }) })
  var narrow = qs.get('size') === 'narrow'
  if (qs.get('frame')) document.documentElement.classList.add('frameonly')
  function fit() { $$('.fitbox').forEach(function (box) { var w = +box.dataset.w, h = +box.dataset.h, inner = box.firstElementChild; var s = Math.min(1, (box.parentElement.clientWidth - 2) / w); inner.style.transform = 'scale(' + s + ')'; inner.style.transformOrigin = 'top left'; box.style.width = Math.round(w * s) + 'px'; box.style.height = Math.round(h * s) + 'px' }) }
  window.addEventListener('resize', fit)

  // ---- invented placeholder data (no real sermons, no real text)
  var LIB = [
    { id: 'r1', t: 'A Sample Message', code: '99-0101M', len: '1:21:07' },
    { id: 'r2', t: 'The Good Shepherd', code: '99-0202E', len: '1:46:55' },
    { id: 'r3', t: 'Morning Light', code: '99-0303M', len: '2:24:47' }
  ]
  var NEW = { id: 'r4', t: 'Evening Hymn Service', code: '99-0404E', len: '1:12:30' }
  var TEXT = ['The LORD is my shepherd; I shall not want.', 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.', 'He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake.', 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me.']
  var FOLDER = '~/Tape audio'

  // ---- pieces
  var I = { head: '🎧', up: '⇪', down: '⇩', globe: '◍', folder: '▭', ok: '✓', warn: '!', x: '✕', sp: '↻' }
  function chip(kind, text) { return '<span class="chip ' + kind + '">' + text + '</span>' }
  function rec(r, o) { o = o || {}; return '<button class="rec' + (o.sel ? ' sel' : '') + '" data-go="' + (o.go || '') + '"><b>' + r.t + '</b>' + (o.chip || chip('ok', I.ok + ' Timed')) + '<small>' + r.code + ' · ' + r.len + ' · M4A</small></button>' }
  function btn(label, o) { o = o || {}; return '<button class="btn ' + (o.cls || '') + '"' + (o.go ? ' data-go="' + o.go + '"' : '') + (o.title ? ' title="' + o.title + '"' : '') + '>' + label + '</button>' }
  function toast(kind, html) { return '<div class="toast ' + kind + '" role="status">' + html + '</div>' }
  function sheet(html) { return '<div class="scrim"><div class="sheet" role="dialog">' + html + '</div></div>' }
  function tabs(list, on) { return '<div class="tptabs" role="tablist">' + list.map(function (t) { return '<button class="' + (t === on ? 'on' : '') + '" role="tab" data-go="' + (t === on ? '' : 'tab:' + t) + '">' + t + '</button>' }).join('') + '</div>' }
  function hintBar() { return '<div class="hintbar"><span><b>Welcome to the Tape place.</b> Recordings live here: add one, time it once, and the text follows it. The player is the bar at the bottom of every section; <b>Show on the screens</b> shows the text to the congregation. Nothing plays until you press Play.</span><span style="margin-left:auto">Got it</span></div>' }
  function follow(r, banner) {
    return '<div class="tpc">' + (banner || '') + '<div class="row"><span class="faint">Text</span><span class="btn sm">English ▾</span><span class="faint">· Tape EN</span><span style="margin-left:auto" class="btn sm">Show on the screens</span></div><div class="verselines">' + TEXT.map(function (t, i) { return '<p class="' + (i === 1 ? 'cur' : '') + '"><b>' + (i + 1) + '</b> ' + t + '</p>' }).join('') + '</div></div>'
  }
  function timingTab(r) { return '<div class="tpc"><div class="c2"><h4>Timing for “' + r.t + '”</h4><p>' + chip('ok', I.ok + ' Timed') + ' 182 paragraphs have a time. It was timed automatically by BORN.</p><div class="row">' + btn('Time it again') + btn('Edit timing…') + '</div></div><div class="c2"><h4>Remove this recording</h4><p>Takes the recording off the sermon and forgets its timing. The sermon text and the original audio file are never deleted.</p>' + btn('Remove this recording…') + '</div></div>' }
  function optionsTab(withFolder) {
    return '<div class="tpc"><div class="c2"><h4>How the screens follow</h4><div class="opt"><span>Projector view</span><span class="btn sm">Highlight</span></div><div class="opt"><span>Show next paragraph early</span><span class="btn sm">4 s ▾</span></div></div><div class="c2"><h4>Sound</h4><div class="opt"><span>When a video plays</span><span class="btn sm">Tape pauses</span></div><div class="opt"><span>If the sound device is lost</span><span class="btn sm">Pause the tape</span></div></div>' +
      (withFolder ? '<div class="c2 mark"><h4>' + I.folder + ' Tape audio folder</h4><div class="opt"><span>' + FOLDER + ' <span class="faint">· BORN looks here by itself</span></span><span class="row">' + btn('Change…', { cls: 'sm' }) + btn('Open folder', { cls: 'sm' }) + '</span></div></div>' : '') + '</div>'
  }
  function dock(r, playing) { return '<div class="dock2"><span>● Screens are off — Open projection to start</span><span class="t"></span>' + (r ? '<span>' + I.head + ' <b style="color:var(--ba-text-1)">' + r.t + '</b> ▶ 12:04 / ' + r.len + '</span>' : '<span class="faint">No tape loaded</span>') + '</div>' }
  function rail() {
    function b(g, l, on) { return '<span class="rb' + (on ? ' on neutral' : '') + '"><span class="g">' + g + '</span>' + l + '</span>' }
    return '<div class="rail"><div class="rlab">Find</div>' + b('⚲', 'Sermons') + b('▤', 'Bible') + b('♪', 'Songs') + b('▣', 'Media') + b('★', 'Saved') + '<div class="rsep"></div><div class="rlab">Listen</div>' + b('◖◗', 'Tape', true) + '<div class="rgrow"></div><div class="rlab">Service</div>' + b('☰', 'Queue') + '</div>'
  }
  function app(inner, o) {
    o = o || {}
    var w = narrow ? 1040 : 1366, h = narrow ? 700 : 768
    var hdr = '<div class="hdr"><span class="logo"><i>◆</i>Born <span>Again</span></span><span class="hb srch" style="min-width:' + (narrow ? 40 : 190) + 'px">⌕' + (narrow ? '' : ' Search everything <kbd>⌘K</kbd>') + '</span><span class="grow"></span><span class="hb">○ Screens 3</span><span class="hb pri">Open projection</span></div>'
    return '<div class="fitbox" data-w="' + w + '" data-h="' + h + '"><div class="app' + (narrow ? ' narrow s1040' : '') + '" style="--w:' + w + 'px;height:' + h + 'px;position:relative">' + hdr + '<div class="body noq" style="min-height:0">' + rail() + '<div class="main" style="min-height:0;display:flex;flex-direction:column"><div class="tph"><small>Tape</small><h2>' + I.head + ' Recordings</h2></div>' + (o.hint ? hintBar() : '') + inner + '</div></div>' + dock(o.tape || null) + '</div></div>'
  }
  function place(o) {
    // o: lib (html), tabs (html), content (html), overlay (html), toast (html)
    return '<div class="tpw">' + '<div class="tplib">' + o.lib + '</div><div class="tpm">' + (o.tabs || '') + (o.content || '') + (o.overlay || '') + (o.toast || '') + '</div></div>'
  }
  function libList(items, sel, extra) { return items.map(function (r, i) { var c = extra && extra[r.id]; return rec(r, { sel: r.id === sel, chip: c, go: 'tab:Follow' }) }).join('') }
  function emptyNote() { return '<p class="faint" style="margin:6px 2px">No recordings yet.</p>' }

  // =====================================================================================================================
  // TODAY (for comparison): the current page, as it is in the app
  // =====================================================================================================================
  function cardsToday(withFolder) {
    return '<div class="tpc" style="overflow:auto">' +
      '<div class="c2"><h4>' + I.head + ' Add a recording</h4><div class="row">' + btn(I.up + ' Add a recording…', { cls: 'pri', go: 'pick' }) + '<span class="faint">or drop the file anywhere on this page</span></div><p>The file picker opens in your Tape audio folder. A file named with its date code (like <b>65-0418M</b>) goes to the right sermon by itself and shows in the list on the left. BORN keeps its own copy and never changes your file.</p></div>' +
      '<div class="c2"><h4>' + I.folder + ' In your “Tape audio” folder</h4><div class="row"><span class="faint" style="flex:1">' + (withFolder === 'new' ? FOLDER + ' — 2 files here are not added yet.' : FOLDER + ' — everything in that folder is already added.') + '</span>' + btn('Change…') + btn(I.sp + ' Look again', { cls: 'q', go: 'look' }) + '</div></div>' +
      '<div class="c2"><h4>' + I.globe + ' Don’t have the file? Get audio</h4><div class="row"><span class="fld ph" style="flex:1">Type a title or a date code, e.g. 65-0418M</span></div><p>Downloads this recording from the internet (English, usually 30–60 MB) into your “Tape audio” folder, then adds it. One recording, only when you press the button.</p><div class="row">' + btn(I.down + ' Download the tape for 99-0303M', { cls: 'pri', go: 'dl' }) + btn(I.globe + ' Open the download page', { cls: 'q' }) + '</div></div></div>'
  }
  var TODAY = {
    start: 'Populated: Add tab',
    scenarios: { 'Empty library': ['t-empty'], 'Add one file': ['t-add', 'pick', 't-done'], 'New file in the folder': ['t-add', 'look', 't-folder'], 'Download': ['t-add', 'dl', 't-dl', 't-done'], 'Errors': ['t-err'] },
    screens: {
      't-empty': { n: 'Empty library (today)', p: 'The empty state repeats the whole Add stack under a big “No recordings yet”. “Add a recording” is the card title, the button and (once something exists) a third button in the list. The folder card says “Not chosen yet” although the picker will open in Downloads.', render: function () { return app(place({ lib: emptyNote() + btn('Add a recording…', { cls: 'sm', go: 'pick' }), tabs: '', content: '<div class="tpc"><div class="dz" style="padding:14px"><h4>No recordings yet</h4><p>Add a recorded sermon and BORN will play it and keep the text in step.</p></div>' + cardsToday().replace('Add a recording…', 'Add a recording…') + '</div>' }), { hint: true }) } },
      't-add': { n: 'Add tab (today)', p: 'Three cards of equal weight: a picker, a folder status and a download. The folder card has two small buttons (Change…, Look again) whose purpose a volunteer has to guess. The welcome note above still says “time it once”.', render: function () { return app(place({ lib: libList(LIB, 'r1') + btn('Add a recording…', { cls: 'sm', go: 'pick' }), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: cardsToday() }), { hint: true, tape: LIB[0] }) } },
      'pick': { n: 'The file picker opens', p: 'A system file picker (not drawn). The volunteer chooses “Morning Light.m4a”.', render: function () { return app(place({ lib: libList(LIB, 'r1'), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: cardsToday(), overlay: sheet('<h4>Choose a recording</h4><p class="faint">Opens in ' + FOLDER + '</p><div class="fl"><div><span class="nm">99-0303M Morning Light.m4a</span><span class="faint">38 MB</span></div><div><span class="nm">99-0404E Evening Hymn Service.m4a</span><span class="faint">29 MB</span></div></div><div class="row">' + btn('Open', { cls: 'pri', go: 't-done' }) + btn('Cancel', { cls: 'q' }) + '</div>') }), { hint: true, tape: LIB[0] }) } },
      't-done': { n: 'Added', p: 'The new recording is selected in the list. The toast says it plays at once. The volunteer is still on the Add tab and has to go to Follow by hand.', render: function () { var all = LIB.concat([NEW]); return app(place({ lib: libList(all, 'r4', { r4: chip('warn', 'Timing… 8%') }) + btn('Add a recording…', { cls: 'sm' }), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: cardsToday(), toast: toast('ok', 'Added “Evening Hymn Service” to 99-0404E. It plays now; the text follows once BORN has timed it.') }), { hint: true, tape: LIB[0] }) } },
      'look': { n: 'Look again', p: 'The folder is only read when the volunteer presses Look again (or when the app starts). Nothing tells them a file has appeared.', render: function () { return app(place({ lib: libList(LIB, 'r1'), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: cardsToday('new'), toast: toast('', 'Looked again: 2 audio files in the folder, 2 not added yet.') }), { hint: true, tape: LIB[0] }) } },
      't-folder': { n: 'Files found in the folder', p: 'A list appears at the bottom of the Add tab (below the fold at 768 px): Add / Add all.', render: function () { return app(place({ lib: libList(LIB, 'r1'), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: cardsToday('new') + '' }), { hint: true, tape: LIB[0] }) } },
      'dl': { n: 'Download', p: 'Download starts from a card at the bottom of the tab; progress shows inside the card.', render: function () { return app(place({ lib: libList(LIB, 'r1'), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: '<div class="tpc"><div class="c2"><h4>' + I.globe + ' Getting 99-0404E…</h4><div class="prog"><i style="width:46%"></i></div><div class="row"><span class="faint">17 of 38 MB</span>' + btn('Cancel', { cls: 'sm' }) + '</div></div></div>' }), { hint: true, tape: LIB[0] }) } },
      't-dl': { n: 'Downloading', p: 'See previous.', render: function () { return TODAY.screens['dl'].render() } },
      't-err': { n: 'Error (today)', p: 'Errors appear as a line inside the card they came from, which may be scrolled out of view.', render: function () { return app(place({ lib: libList(LIB, 'r1'), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], 'Add'), content: cardsToday().replace('One recording, only when you press the button.', 'One recording, only when you press the button.</p><p style="color:var(--ba-danger)">The download site did not answer. Nothing was added.') }), { hint: true, tape: LIB[0] }) } }
    }
  }

  // =====================================================================================================================
  // OPTION A — One door: no Add tab; Add ▾ on the list; the folder is watched; download is a small dialog
  // =====================================================================================================================
  function addBtn(menu) { return '<div class="lh" style="justify-content:flex-start"><span class="row" style="gap:2px;position:relative;flex-wrap:nowrap">' + btn('＋ Add recording…', { cls: 'pri sm', go: 'a-pick', title: 'Choose a file (opens in your Tape audio folder)' }) + btn('▾', { cls: 'pri sm', go: menu ? 'a-menu-close' : 'a-menu', title: 'More ways to add' }) + (menu ? '<div class="menu" role="menu" style="top:32px;left:auto;right:0"><button data-go="a-pick"><span>' + I.up + '</span><span><b>Choose a file…</b><small>Opens in ' + FOLDER + ' · or just drop a file here</small></span></button><button data-go="a-dl"><span>' + I.down + '</span><span><b>Download…</b><small>English · one recording, only when you press the button</small></span></button></div>' : '') + '</span></div>' }
  function aStrip(n) { return '<div class="strip" role="status"><span>' + I.folder + '</span><span style="flex:1"><b>' + n + ' new recordings in your Tape audio folder.</b> <span class="faint">Found by BORN just now — nothing is added until you say.</span></span>' + btn('Add 1 recognised', { cls: 'pri sm', go: 'a-added' }) + btn('See both', { cls: 'sm', go: 'a-folder-list' }) + '</div>' }
  function aEmpty(drag) { return '<div class="tpc" style="justify-content:center"><div class="dz' + (drag ? ' hot' : '') + '"><div style="font-size:30px">' + I.head + '</div><h4>' + (drag ? 'Drop to add' : 'Add your first recording') + '</h4><p>Drop a recording here, or choose a file. A file named with its date code (like 99-0303M) goes to the right sermon by itself. BORN keeps its own copy and never changes your file.</p><div class="row">' + btn(I.up + ' Choose a file…', { cls: 'pri big', go: 'a-pick' }) + btn(I.down + ' Download…', { cls: 'big', go: 'a-dl' }) + '</div><p class="faint">Or put files in <b>' + FOLDER + '</b> and BORN will offer them here. <a href="#" data-go="a-opts">Change folder</a></p></div></div>' }
  function aTabs(on) { return tabs(['Follow', 'Timing', 'Options'], on) }
  function aPage(o) {
    o = o || {}
    var items = o.items || LIB, sel = o.sel || 'r1'
    return app(place({ lib: addBtn(o.menu) + (o.strip ? '' : '') + libList(items, sel, o.chips), tabs: o.empty ? '' : aTabs(o.tab || 'Follow'), content: o.content || (o.empty ? aEmpty(o.drag) : (o.tab === 'Options' ? optionsTab(true) : o.tab === 'Timing' ? timingTab(items.filter(function (r) { return r.id === sel })[0]) : follow(items[0], (o.strip ? aStrip(2) : '') + (o.banner || '')))), overlay: o.overlay, toast: o.toast }), { tape: LIB[0] })
  }
  function aFollowBanner(pct) { return '<div class="bn"><span>This recording plays now. BORN is timing it in the background (' + pct + '%); the text will follow it when that finishes.</span></div>' }
  var A = {
    scenarios: {
      'Empty library': ['a-empty', 'a-drag', 'a-pick', 'a-added'],
      'Add one file': ['a-start', 'a-pick', 'a-added', 'a-timed'],
      'Add several': ['a-start', 'a-pick-many', 'a-several', 'a-place', 'a-added'],
      'New file in the folder': ['a-start', 'a-newfile', 'a-added', 'a-timed'],
      'Download': ['a-start', 'a-menu', 'a-dl', 'a-dl-typed', 'a-downloading', 'a-added'],
      'Errors': ['a-err-dl', 'a-err-type', 'a-err-dup', 'a-err-space', 'a-err-time'],
      'Success: what next': ['a-added', 'a-timed']
    },
    screens: {
      'a-start': { n: 'Tape place, three recordings', p: 'The Add tab is gone. One button, “Add recording…”, sits at the top of the list — the only place you add from; its main part opens the file picker straight away, its ▾ offers Download. Tabs are Follow, Timing, Options (all about the selected recording or the tape).', render: function () { return aPage() } },
      'a-empty': { n: 'Empty library', p: 'One calm drop zone with the two ways in: choose a file, or download. The folder is mentioned once, in a sentence. No welcome banner, no cards.', render: function () { return aPage({ empty: true, items: [], sel: '' }) } },
      'a-drag': { n: 'A file is dragged over', p: 'The whole Tape place accepts a drop (as today); the zone shows it is ready.', render: function () { return aPage({ empty: true, items: [], sel: '', drag: true }) } },
      'a-menu': { n: 'The ▾ part of the button offers the other way in', p: 'Two verbs, each with its one-line promise. Esc closes it (Esc closes whatever is on top).', render: function () { return aPage({ menu: true }) } },
      'a-menu-close': { n: 'Menu closed', p: '', render: function () { return aPage() } },
      'a-pick': { n: 'The file picker opens in your Tape audio folder', p: 'A system picker (drawn simply). Several files can be chosen.', render: function () { return aPage({ overlay: sheet('<h4>Choose recordings</h4><p class="faint">Opens in ' + FOLDER + '</p><div class="fl"><div><span class="nm">99-0303M Morning Light.m4a</span><span class="faint">38 MB</span></div><div><span class="nm">99-0404E Evening Hymn Service.m4a</span><span class="faint">29 MB</span></div></div><div class="row">' + btn('Open', { cls: 'pri', go: 'a-added' }) + btn('Cancel', { cls: 'q', go: 'a-start' }) + '</div>'), items: LIB }) } },
      'a-pick-many': { n: 'Choose three files at once', p: 'Two have date codes; one (“mystery.mp3”) does not.', render: function () { return aPage({ overlay: sheet('<h4>Choose recordings</h4><div class="fl"><div><span class="nm">✓ 99-0404E Evening Hymn Service.m4a</span></div><div><span class="nm">✓ 99-0505M Sample Sermon Two.m4a</span></div><div><span class="nm">✓ mystery.mp3</span></div></div><div class="row">' + btn('Open (3)', { cls: 'pri', go: 'a-several' }) + btn('Cancel', { cls: 'q', go: 'a-start' }) + '</div>') }) } },
      'a-added': { n: 'Added — it is selected and plays now', p: 'The new recording appears in the list, is selected, and the Follow tab says what is happening: it plays at once; the text joins when timing finishes. Nothing was asked of the volunteer.', render: function () { var all = LIB.concat([NEW]); return aPage({ items: all, sel: 'r4', chips: { r4: chip('warn', 'Timing… 8%') }, banner: aFollowBanner(8), toast: toast('ok', 'Added “Evening Hymn Service” to 99-0404E · plays now') }) } },
      'a-timed': { n: 'A minute later: timed', p: 'The chip turns green and a toast says the text now follows. “Show on the screens” is the volunteer’s next move.', render: function () { return aPage({ items: LIB.concat([NEW]), sel: 'r4', toast: toast('ok', 'Timing finished — the text now follows the tape (356 of 363 paragraphs found).') }) } },
      'a-several': { n: 'Added 3 files in one go', p: 'Two are added and timing in turn (one at a time, in the background). The one BORN could not place is listed once, with its one button.', render: function () { var all = LIB.concat([NEW, { id: 'r5', t: 'Sample Sermon Two', code: '99-0505M', len: '1:05:00' }]); return aPage({ items: all, sel: 'r4', chips: { r4: chip('warn', 'Timing… 31%'), r5: chip('warn', 'Timing soon') }, strip: false, toast: toast('', 'Added 2 recordings. <b>mystery.mp3</b> needs a sermon.' + ' ' + btn('Choose sermon', { cls: 'sm pri', go: 'a-place' })) }) } },
      'a-place': { n: 'Only a file BORN cannot place asks a question', p: 'Likeliest sermons are one-click buttons; or type a title or date code.', render: function () { return aPage({ items: LIB.concat([NEW]), sel: 'r4', overlay: sheet('<h4>Which sermon is “mystery.mp3”?</h4><div class="fl"><div><span class="nm">99-0505M Sample Sermon Two</span>' + btn('This one', { cls: 'sm pri', go: 'a-added' }) + '</div><div><span class="nm">99-0606E Another Sample</span>' + btn('This one', { cls: 'sm' }) + '</div></div><div class="fld ph">Or type a title or date code</div><div class="row">' + btn('Not now', { cls: 'q', go: 'a-start' }) + '</div>') }) } },
      'a-newfile': { n: 'A file appears in the Tape audio folder', p: 'BORN notices by itself (no “Look again”). A calm strip appears at the top of the list column’s page; it never adds anything on its own. A file whose name carries a date code is “recognised”.', render: function () { return aPage({ strip: true }) } },
      'a-folder-list': { n: 'See what was found', p: 'Expands in place: one row per file with its match and an Add button.', render: function () { return aPage({ content: '<div class="tpc"><div class="c2"><h4>' + I.folder + ' New in ' + FOLDER + '</h4><div class="fl"><div><span class="nm">99-0404E Evening Hymn Service.m4a</span><span class="faint">→ 99-0404E</span>' + btn('Add', { cls: 'sm pri', go: 'a-added' }) + '</div><div><span class="nm">mystery.mp3</span><span class="faint">sermon unknown</span>' + btn('Choose sermon…', { cls: 'sm', go: 'a-place' }) + '</div></div><div class="row">' + btn('Add all', { cls: 'sm pri', go: 'a-several' }) + '</div></div></div>' }) } },
      'a-dl': { n: 'Download… (a small dialog)', p: 'Opened from the Add menu — or prefilled when you start from a sermon in the reader. One field, one button.', render: function () { return aPage({ overlay: sheet('<h4>' + I.down + ' Download</h4><div class="fld ph">Type a title or a date code, e.g. 99-0404E</div><p class="faint">English, usually 30–60 MB. Goes into ' + FOLDER + ' and is added. One recording, only when you press the button.</p><div class="row">' + btn('Download', { cls: 'pri' }) + btn('Cancel', { cls: 'q', go: 'a-start' }) + '<span style="margin-left:auto">' + btn('Open the download page', { cls: 'q sm' }) + '</span></div>') }) } },
      'a-dl-typed': { n: 'Typed: it says which recording it found', p: '“Download” is now specific, and nothing is fetched until it is pressed.', render: function () { return aPage({ overlay: sheet('<h4>' + I.down + ' Download</h4><div class="fld">99-0404</div><div class="row">' + chip('ok', I.ok + ' 99-0404E · Evening Hymn Service') + '</div><p class="faint">English, about 29 MB. Goes into ' + FOLDER + ' and is added.</p><div class="row">' + btn(I.down + ' Download 99-0404E', { cls: 'pri', go: 'a-downloading' }) + btn('Cancel', { cls: 'q', go: 'a-start' }) + '</div>') }) } },
      'a-downloading': { n: 'Downloading: progress and Cancel, and the app stays usable', p: 'The dialog closes into a progress row at the top of the list, so the volunteer can keep working. Cancel is one click.', render: function () { return aPage({ strip: false, content: follow(LIB[0], '<div class="bn"><span>' + I.down + ' Downloading 99-0404E — 17 of 29 MB</span><span class="prog" style="flex:1;min-width:120px"><i style="width:58%"></i></span>' + btn('Cancel', { cls: 'sm' }) + '</div>') }) } },
      'a-err-dl': { n: 'Error: the download site did not answer', p: 'Plain words, what happened to their data (nothing), and the next move.', render: function () { return aPage({ overlay: sheet('<h4>Could not download</h4><p>The download site did not answer. Nothing was added.</p><div class="row">' + btn('Try again', { cls: 'pri' }) + btn('Open the download page') + btn('Close', { cls: 'q', go: 'a-start' }) + '</div>') }) } },
      'a-err-type': { n: 'Error: not an audio file', p: 'Named, with the reason, no stack trace.', render: function () { return aPage({ toast: toast('bad', '“notes.docx” is not an audio file BORN can play. Nothing was added.') }) } },
      'a-err-dup': { n: 'Already added', p: 'Selecting the existing recording is better than an error.', render: function () { return aPage({ toast: toast('', 'That recording is already added — here it is.') }) } },
      'a-err-space': { n: 'Not enough room', p: 'Says how much it needs and offers the safe alternative (keep the file where it is).', render: function () { return aPage({ overlay: sheet('<h4>Not enough space</h4><p>BORN keeps its own copy of each recording, which needs 38 MB; this computer has 12 MB free.</p><div class="row">' + btn('Use the file where it is', { cls: 'pri' }) + btn('Cancel', { cls: 'q', go: 'a-start' }) + '</div><p class="faint">If that drive is not plugged in during a service, the recording will not play.</p>') }) } },
      'a-err-time': { n: 'Timing could not finish (for example a non-English tape)', p: 'The tape still plays. The banner says why the text is not following and what to do. Hand timing stays available.', render: function () { return aPage({ banner: '<div class="bn warn"><span>This recording plays, but BORN could not time it automatically (it is not in English).</span>' + btn('Time it by hand…', { cls: 'sm' }) + '</div>' }) } },
      'a-opts': { n: 'Options: the Tape audio folder lives here', p: 'Change… and Open folder, next to the other tape settings. A setting you touch once, not a card you see every time.', render: function () { return aPage({ tab: 'Options' }) } }
    }
  }

  // =====================================================================================================================
  // OPTION B — Keep the Add tab, but make it one clear page
  // =====================================================================================================================
  function bAdd(state) {
    var found = state === 'found'
    return '<div class="tpc" style="overflow:auto"><div class="dz" style="padding:18px"><h4>Drop a recording here</h4><p>A file named with its date code goes to the right sermon by itself.</p>' + btn(I.up + ' Choose a file…', { cls: 'pri big', go: 'b-added' }) + '</div>' +
      (found ? '<div class="c2 mark"><h4>' + I.folder + ' Found in ' + FOLDER + ' <span class="chip warn">2 new</span></h4><div class="fl"><div><span class="nm">99-0404E Evening Hymn Service.m4a</span>' + btn('Add', { cls: 'sm pri', go: 'b-added' }) + '</div><div><span class="nm">mystery.mp3</span>' + btn('Choose sermon…', { cls: 'sm' }) + '</div></div><div class="row">' + btn('Add all', { cls: 'sm' }) + '<span class="faint" style="margin-left:auto">' + FOLDER + ' · <u>Change</u></span></div></div>'
        : '<p class="faint" style="margin:2px 4px">Nothing new in ' + FOLDER + ' · <u>Change folder</u></p>') +
      (state === 'dl' ? '<div class="c2"><h4>' + I.globe + ' Download</h4><div class="fld">99-0404</div><div class="row">' + chip('ok', I.ok + ' 99-0404E · Evening Hymn Service') + btn(I.down + ' Download 99-0404E', { cls: 'pri', go: 'b-downloading' }) + '</div></div>'
        : '<div class="c2" style="padding:8px 14px"><div class="row"><span>' + I.globe + ' Don’t have the file?</span><span style="margin-left:auto">' + btn('Download ▸', { cls: 'sm', go: 'b-dl' }) + '</span></div></div>') + '</div>'
  }
  function bPage(o) { o = o || {}; var items = o.items || LIB; return app(place({ lib: '<div class="lh"><h3>Recordings</h3></div>' + libList(items, o.sel || 'r1', o.chips) + btn('＋ Add a recording', { cls: 'sm', go: 'b-add' }), tabs: tabs(['Follow', 'Timing', 'Options', 'Add' + (o.badge ? ' •' : '')], o.tab || 'Follow'), content: o.content, toast: o.toast }), { tape: LIB[0] }) }
  var B = {
    scenarios: { 'Empty library': ['b-empty'], 'Add one file': ['b-add', 'b-added'], 'New file in the folder': ['b-start', 'b-found', 'b-added'], 'Download': ['b-add', 'b-dl', 'b-downloading', 'b-added'], 'Errors': ['b-err'], 'Success: what next': ['b-added'] },
    screens: {
      'b-start': { n: 'Tape place (Add tab shows a dot when files are waiting)', p: 'The Add tab stays, but gets a quiet dot when BORN sees new files in the folder.', render: function () { return bPage({ badge: true, content: follow(LIB[0]) }) } },
      'b-empty': { n: 'Empty library', p: 'The same single Add page, no duplicate headline.', render: function () { return app(place({ lib: '<div class="lh"><h3>Recordings</h3></div>' + emptyNote(), tabs: '', content: bAdd('x') })) } },
      'b-add': { n: 'The Add tab: one drop zone first', p: 'Primary action first and large. The folder becomes a line (or a list when something is waiting). Download is one collapsed row. The welcome note is gone.', render: function () { return bPage({ tab: 'Add', content: bAdd('x') }) } },
      'b-found': { n: 'Files found in the folder', p: 'A list of what is waiting, with Add / Add all. No “Look again” button: the page reads the folder when it opens.', render: function () { return bPage({ tab: 'Add', badge: true, content: bAdd('found') }) } },
      'b-dl': { n: 'Download opened in place', p: 'Expands inside the page.', render: function () { return bPage({ tab: 'Add', content: bAdd('dl') }) } },
      'b-downloading': { n: 'Downloading', p: 'Progress in the page; leaving the tab does not stop it.', render: function () { return bPage({ tab: 'Add', content: '<div class="tpc"><div class="c2"><h4>' + I.globe + ' Downloading 99-0404E</h4><div class="prog"><i style="width:46%"></i></div><div class="row"><span class="faint">17 of 29 MB</span>' + btn('Cancel', { cls: 'sm' }) + '</div></div></div>' }) } },
      'b-added': { n: 'Added: lands on Follow', p: 'Selecting the new recording and switching to Follow is automatic (as in the app today after the earlier fix).', render: function () { return bPage({ items: LIB.concat([NEW]), sel: 'r4', chips: { r4: chip('warn', 'Timing… 8%') }, content: follow(LIB[0], aFollowBanner(8)), toast: toast('ok', 'Added “Evening Hymn Service” to 99-0404E · plays now') }) } },
      'b-err': { n: 'Errors inline, at the top of the page', p: 'A single message area at the top of the Add page (never inside a card that may be scrolled away).', render: function () { return bPage({ tab: 'Add', content: '<div class="tpc"><div class="bn bad"><span>The download site did not answer. Nothing was added.</span>' + btn('Try again', { cls: 'sm' }) + '</div>' + bAdd('x').replace('<div class="tpc" style="overflow:auto">', '') }) } }
    }
  }

  // =====================================================================================================================
  // OPTION C — Find a tape: one search; every sermon shows what to do with it
  // =====================================================================================================================
  function cRow(code, t, status, act) { return '<div class="res"><div><b>' + t + '</b> <span class="faint">' + code + '</span><small>' + status + '</small></div><div>' + act + '</div></div>' }
  function cPage(o) { o = o || {}; var items = o.items || LIB; return app(place({ lib: '<div class="lh"><h3>On this computer</h3></div>' + libList(items, o.sel || 'r1', o.chips), tabs: tabs(['Find a tape', 'Follow', 'Timing', 'Options'], o.tab || 'Find a tape'), content: o.content, toast: o.toast }), { tape: LIB[0] }) }
  function cFind(q, rows, extra) { return '<div class="tpc"><div class="row"><span class="fld' + (q ? '' : ' ph') + '" style="flex:1;height:40px;font-size:15px">⌕ ' + (q || 'Find a sermon — type a title or a date code') + '</span></div>' + (extra || '') + (rows ? '<div class="fl">' + rows + '</div>' : '<p class="faint">Recordings on this computer are on the left. Everything else is one search away. You can also drop a file anywhere on this page.</p>' + '<div class="strip"><span>' + I.folder + '</span><span style="flex:1"><b>2 new files in your Tape audio folder.</b></span>' + btn('See them', { cls: 'sm', go: 'c-found' }) + '</div>') + '</div>' }
  var C = {
    scenarios: { 'Empty library': ['c-empty'], 'Add one file': ['c-type', 'c-have', 'c-added'], 'New file in the folder': ['c-start', 'c-found', 'c-added'], 'Download': ['c-type', 'c-dl', 'c-downloading', 'c-added'], 'Errors': ['c-err'], 'Success: what next': ['c-added'] },
    screens: {
      'c-start': { n: 'Find a tape (the first tab)', p: 'The tab opens on a search. Mid-service, the volunteer types a few letters and presses one button.', render: function () { return cPage({ content: cFind('', '') }) } },
      'c-empty': { n: 'Empty library', p: 'Same page; the search is the whole story.', render: function () { return app(place({ lib: '<div class="lh"><h3>On this computer</h3></div>' + emptyNote(), tabs: tabs(['Find a tape', 'Options'], 'Find a tape'), content: cFind('', '') })) } },
      'c-type': { n: 'Typing finds sermons and says what each one needs', p: 'Each row has ONE action chosen for it: Load (already here), Add (in your folder), Download (not here yet).', render: function () { return cPage({ content: cFind('morning', cRow('99-0303M', 'Morning Light', 'On this computer · timed', btn('Load into the player', { cls: 'sm', go: 'c-have' })) + cRow('99-0404E', 'Evening Hymn Service', 'Not on this computer · English recording available', btn(I.down + ' Download', { cls: 'sm pri', go: 'c-dl' })) + cRow('99-0505M', 'Sample Sermon Two', 'In your Tape audio folder', btn('＋ Add', { cls: 'sm pri', go: 'c-added' }))) }) } },
      'c-have': { n: 'Already here: Load', p: 'Loading never plays (the rule stays).', render: function () { return cPage({ tab: 'Follow', content: follow(LIB[0]), toast: toast('', 'Loaded “Morning Light”. Press Play when you are ready.') }) } },
      'c-found': { n: 'Folder files appear as rows too', p: 'Files in the folder show with the sermon BORN thinks they are.', render: function () { return cPage({ content: cFind('', cRow('99-0404E', 'Evening Hymn Service', 'In your Tape audio folder · Evening Hymn Service.m4a', btn('＋ Add', { cls: 'sm pri', go: 'c-added' })) + cRow('?', 'mystery.mp3', 'In your Tape audio folder · sermon unknown', btn('Choose sermon…', { cls: 'sm' }))) }) } },
      'c-dl': { n: 'Download happens in the row', p: 'The row shows progress and Cancel; nothing blocks the page.', render: function () { return cPage({ content: cFind('morning', cRow('99-0404E', 'Evening Hymn Service', 'Downloading — 17 of 29 MB<div class="prog" style="width:220px;margin-top:4px"><i style="width:58%"></i></div>', btn('Cancel', { cls: 'sm' }))) }) } },
      'c-downloading': { n: 'Downloading', p: 'See previous.', render: function () { return C.screens['c-dl'].render() } },
      'c-added': { n: 'Added: the row turns into Load', p: 'Lands on Follow with the same “plays now; text follows” banner.', render: function () { return cPage({ items: LIB.concat([NEW]), sel: 'r4', chips: { r4: chip('warn', 'Timing… 8%') }, tab: 'Follow', content: follow(LIB[0], aFollowBanner(8)), toast: toast('ok', 'Added “Evening Hymn Service” · plays now') }) } },
      'c-err': { n: 'Errors are in the row', p: 'The row says what happened and offers the next move; other rows are untouched.', render: function () { return cPage({ content: cFind('evening', cRow('99-0404E', 'Evening Hymn Service', '<span style="color:var(--ba-danger)">The download site did not answer. Nothing was added.</span>', btn('Try again', { cls: 'sm pri' }) + btn('Download page', { cls: 'sm q' }))) }) } }
    }
  }

  // =====================================================================================================================
  // OPTION D — Tidy only: the same tab, two cards, honest wording
  // =====================================================================================================================
  function dAdd(found) { return '<div class="tpc" style="overflow:auto"><div class="c2"><h4>' + I.head + ' Add a recording</h4><div class="row">' + btn(I.up + ' Choose a file…', { cls: 'pri', go: 'd-added' }) + '<span class="faint">or drop it anywhere on this page</span></div></div><div class="c2"><h4>' + I.globe + ' Get a recording</h4><div class="row"><span class="fld ph" style="flex:1">Type a title or a date code</span>' + btn(I.down + ' Download', { cls: '', go: 'd-dl' }) + '</div></div><p class="faint" style="margin:2px 4px">' + (found ? '<b style="color:var(--ba-accent-hi)">2 new files in ' + FOLDER + '</b> ' + btn('Add them', { cls: 'sm pri', go: 'd-added' }) : FOLDER + ' · nothing new') + ' · <u>Change folder</u></p></div>' }
  function dPage(o) { o = o || {}; var items = o.items || LIB; return app(place({ lib: libList(items, o.sel || 'r1', o.chips), tabs: tabs(['Follow', 'Timing', 'Options', 'Add'], o.tab || 'Add'), content: o.content, toast: o.toast }), { tape: LIB[0] }) }
  var D = {
    scenarios: { 'Add one file': ['d-add', 'd-added'], 'New file in the folder': ['d-found', 'd-added'], 'Download': ['d-add', 'd-dl', 'd-added'], 'Errors': ['d-err'] },
    screens: {
      'd-add': { n: 'Add tab, tidied', p: 'Two cards instead of three. The left-hand duplicate button and the welcome note are removed; “Look again” goes (the folder is read when the page opens); the folder is a line.', render: function () { return dPage({ content: dAdd(false) }) } },
      'd-found': { n: 'A line says files are waiting', p: 'One line, one button. No list.', render: function () { return dPage({ content: dAdd(true) }) } },
      'd-dl': { n: 'Download', p: 'Progress shows in the card.', render: function () { return dPage({ content: '<div class="tpc"><div class="c2"><h4>' + I.globe + ' Downloading 99-0404E</h4><div class="prog"><i style="width:46%"></i></div><div class="row"><span class="faint">17 of 29 MB</span>' + btn('Cancel', { cls: 'sm' }) + '</div></div></div>' }) } },
      'd-added': { n: 'Added', p: 'Selected, on Follow.', render: function () { return dPage({ items: LIB.concat([NEW]), sel: 'r4', chips: { r4: chip('warn', 'Timing… 8%') }, tab: 'Follow', content: follow(LIB[0], aFollowBanner(8)), toast: toast('ok', 'Added “Evening Hymn Service” · plays now') }) } },
      'd-err': { n: 'Error', p: 'A message line at the top of the tab.', render: function () { return dPage({ content: '<div class="tpc"><div class="bn bad"><span>The download site did not answer. Nothing was added.</span></div>' + dAdd(false).replace('<div class="tpc" style="overflow:auto">', '') }) } }
    }
  }
  var OPTS = { today: TODAY, a: A, b: B, c: C, d: D }

  // ---- the demo player
  function demo(root) {
    var key = root.dataset.opt, O = OPTS[key]
    var names = Object.keys(O.scenarios)
    var scen = qs.get('scen') || names[0], idx = +(qs.get('i') || 0)
    if (qs.get('screen')) { for (var k in O.scenarios) { var j = O.scenarios[k].indexOf(qs.get('screen')); if (j >= 0) { scen = k; idx = j; break } } }
    function cur() { return O.scenarios[scen][idx] }
    function go(name) { var s = O.scenarios[scen].indexOf(name); if (s >= 0) idx = s; else { for (var k in O.scenarios) { var j = O.scenarios[k].indexOf(name); if (j >= 0) { scen = k; idx = j; break } } if (O.scenarios[scen].indexOf(name) < 0) { O.scenarios[scen] = O.scenarios[scen].slice(); O.scenarios[scen].push(name); idx = O.scenarios[scen].length - 1 } } draw() }
    function draw() {
      var sc = O.screens[cur()]
      $('.scen', root).innerHTML = names.map(function (n) { return '<button aria-pressed="' + (n === scen) + '" data-scen="' + n + '">' + n + '</button>' }).join('')
      $('.frame', root).innerHTML = sc.render()
      $('.narr', root).innerHTML = '<div class="stepn">' + scen + ' · step ' + (idx + 1) + ' of ' + O.scenarios[scen].length + '</div><h3>' + sc.n + '</h3><p>' + sc.p + '</p><div class="row" style="margin-top:10px"><button class="btn sm" data-nav="-1"' + (idx === 0 ? ' disabled' : '') + '>‹ Back</button><button class="btn sm pri" data-nav="1"' + (idx >= O.scenarios[scen].length - 1 ? ' disabled' : '') + '>Next ›</button></div><p class="faint" style="font-size:12px">You can also click the buttons inside the picture.</p>'
      fit()
    }
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-scen],[data-nav],[data-go]'); if (!t) return
      e.preventDefault()
      if (t.dataset.scen) { scen = t.dataset.scen; idx = 0; draw() }
      else if (t.dataset.nav) { idx = Math.max(0, Math.min(O.scenarios[scen].length - 1, idx + +t.dataset.nav)); draw() }
      else if (t.dataset.go) { var g = t.dataset.go; if (g.indexOf('tab:') === 0) return; if (g) go(g) }
    })
    draw()
  }
  $$('[data-opt]').forEach(demo)
  window.addEventListener('load', fit); setTimeout(fit, 0)

  // ---- the review board
  var board = $('#board')
  if (board) {
    var KEY = 'ba-tape-add-decisions-v1', saved = {}
    try { saved = JSON.parse(store.get(KEY) || '{}') } catch (e) { saved = {} }
    var cards = $$('[data-pid]', board), save = function () { store.set(KEY, JSON.stringify(saved)) }
    var summary = function () { var c = { approve: 0, reject: 0, discuss: 0, open: 0 }; cards.forEach(function (card) { var d = saved[card.dataset.pid]; c[d && d.v ? d.v : 'open']++ }); $('#sum-approve').textContent = c.approve; $('#sum-reject').textContent = c.reject; $('#sum-discuss').textContent = c.discuss; $('#sum-open').textContent = c.open }
    cards.forEach(function (card) {
      var id = card.dataset.pid, d = saved[id] = saved[id] || { v: '', n: '' }
      var show = function () { $$('[data-v]', card).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === d.v)) }) }
      show(); $('textarea', card).value = d.n || ''
      $$('[data-v]', card).forEach(function (b) { b.addEventListener('click', function () { d.v = d.v === b.dataset.v ? '' : b.dataset.v; show(); save(); summary() }) })
      $('textarea', card).addEventListener('input', function (e) { d.n = e.target.value; save() })
    })
    summary()
    $('#copy').addEventListener('click', function () {
      var lines = ['My decisions on the Tape “Add” redesign:']
      cards.forEach(function (card) { var d = saved[card.dataset.pid] || {}; lines.push(card.dataset.pid + ' ' + card.dataset.title + ' — ' + ({ approve: 'APPROVE', reject: 'REJECT', discuss: 'DISCUSS' }[d.v] || 'NO DECISION') + (d.n ? ' — ' + d.n.replace(/\s+/g, ' ') : '')) })
      var txt = lines.join('\n'), out = $('#out'); out.value = txt; out.hidden = false; out.select()
      var done = function () { $('#copied').textContent = 'Copied — paste it back to Claude.' }
      try { navigator.clipboard.writeText(txt).then(done, function () { $('#copied').textContent = 'Select the text below and copy it.' }) } catch (e) { $('#copied').textContent = 'Select the text below and copy it.' }
    })
    $('#reset').addEventListener('click', function () { if (confirm('Clear all decisions on this page?')) { saved = {}; save(); location.reload() } })
  }
})()

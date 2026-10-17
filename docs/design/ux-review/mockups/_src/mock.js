/* Born Again UX review mockups — behaviour: theme, before/after, fit-to-width, shell sections, review board. No network, no storage beyond localStorage (wrapped). */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)) }
  var store = { get: function (k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set: function (k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }

  // ---- theme: dark / light / contrast (shared across the mockup pages)
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t)
    store.set('ba-mock-theme', t)
    $$('[data-theme-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t)) })
  }
  var t0 = store.get('ba-mock-theme') || 'dark'
  setTheme(t0)
  $$('[data-theme-btn]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.dataset.themeBtn) }) })

  // ---- fit a fixed-size mock to its container
  function fit() {
    $$('.fitbox').forEach(function (box) {
      var w = +box.dataset.w, h = +box.dataset.h, inner = box.firstElementChild
      var avail = box.parentElement.clientWidth - 2
      var s = Math.min(1, avail / w)
      inner.style.transform = 'scale(' + s + ')'
      box.style.width = Math.round(w * s) + 'px'
      box.style.height = Math.round(h * s) + 'px'
    })
  }
  window.addEventListener('resize', fit)
  window.addEventListener('load', fit)
  setTimeout(fit, 0)

  // ---- before / after toggles
  $$('[data-ba]').forEach(function (root) {
    var set = function (v) { root.setAttribute('data-view', v); $$('[data-set]', root).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.set === v)) }); setTimeout(fit, 0) }
    $$('[data-set]', root).forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.set) }) })
    set(root.getAttribute('data-view') || 'after')
  })

  // ---- the proposed shell: sections, run view, width
  var shell = $('#shell')
  if (shell) {
    var secs = { sermons: 'Search sermons', bible: 'John 3', songs: 'Songs', media: 'Pictures and video', tape: 'Tape', queue: 'Queue' }
    var pick = function (s) {
      $$('[data-sec]', shell).forEach(function (p) { p.hidden = p.dataset.sec !== s })
      $$('[data-go]', shell).forEach(function (b) { b.classList.toggle('on', b.dataset.go === s) })
      var run = s === 'run'
      shell.querySelector('.body').classList.toggle('noq', s === 'run' || s === 'queue')
    }
    $$('[data-go]', shell).forEach(function (b) { b.addEventListener('click', function () { pick(b.dataset.go) }) })
    pick('bible')
    var live = false
    var setLive = function (v) {
      live = v
      $$('[data-live-on]', shell).forEach(function (e) { e.hidden = !live })
      $$('[data-live-off]', shell).forEach(function (e) { e.hidden = live })
      shell.classList.toggle('is-live', live)
    }
    $$('[data-toggle-live]').forEach(function (b) { b.addEventListener('click', function () { setLive(!live) }) })
    setLive(true)
    var menu = $('#cog-menu', shell)
    $$('[data-cog]', shell).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden }) })
    document.addEventListener('click', function () { if (menu) menu.hidden = true })
    $$('[data-size]').forEach(function (b) { b.addEventListener('click', function () {
      var a = $('.app', shell); a.className = 'app ' + b.dataset.size
      var w = b.dataset.size === 's1040' ? 1040 : b.dataset.size === 's1920' ? 1920 : 1366, h = b.dataset.size === 's1040' ? 640 : b.dataset.size === 's1920' ? 1080 : 768
      var box = a.parentElement; box.dataset.w = w; box.dataset.h = h
      $$('[data-size]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)) }); fit()
    }) })
    // pretend tape
    var pos = 42, playing = false
    var tick = function () { if (playing) pos = (pos + 1) % 120; $$('[data-clock]', shell).forEach(function (e) { e.textContent = Math.floor(pos / 60) + ':' + ('0' + (pos % 60)).slice(-2) }); $$('[data-seekfill]', shell).forEach(function (e) { e.style.width = (pos / 1.2) + '%' }) }
    setInterval(tick, 1000)
    $$('[data-play]', shell).forEach(function (b) { b.addEventListener('click', function () { playing = !playing; $$('[data-play]', shell).forEach(function (x) { x.textContent = playing ? '❚❚' : '▶' }) }) })
  }

  // ---- the review board
  var board = $('#board')
  if (board) {
    var KEY = 'ba-ux-review-decisions-v1'
    var saved = {}
    try { saved = JSON.parse(store.get(KEY) || '{}') } catch (e) { saved = {} }
    var cards = $$('[data-pid]', board)
    var save = function () { store.set(KEY, JSON.stringify(saved)) }
    var summary = function () {
      var c = { approve: 0, reject: 0, discuss: 0, open: 0 }
      cards.forEach(function (card) { var d = saved[card.dataset.pid]; c[d && d.v ? d.v : 'open']++ })
      $('#sum-approve').textContent = c.approve; $('#sum-reject').textContent = c.reject; $('#sum-discuss').textContent = c.discuss; $('#sum-open').textContent = c.open
    }
    cards.forEach(function (card) {
      var id = card.dataset.pid
      var d = saved[id] = saved[id] || { v: '', n: '' }
      var show = function () { $$('[data-v]', card).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === d.v)) }) }
      show(); $('textarea', card).value = d.n || ''
      $$('[data-v]', card).forEach(function (b) { b.addEventListener('click', function () { d.v = d.v === b.dataset.v ? '' : b.dataset.v; show(); save(); summary() }) })
      $('textarea', card).addEventListener('input', function (e) { d.n = e.target.value; save() })
    })
    summary()
    $('#copy').addEventListener('click', function () {
      var lines = ['My decisions on the Born Again UX review proposals:']
      cards.forEach(function (card) {
        var d = saved[card.dataset.pid] || {}
        lines.push(card.dataset.pid + ' ' + card.dataset.title + ' — ' + ({ approve: 'APPROVE', reject: 'REJECT', discuss: 'DISCUSS' }[d.v] || 'NO DECISION') + (d.n ? ' — ' + d.n.replace(/\s+/g, ' ') : ''))
      })
      var txt = lines.join('\n')
      var out = $('#out'); out.value = txt; out.hidden = false; out.select()
      var done = function () { $('#copied').textContent = 'Copied — paste it back to Claude.' }
      try { navigator.clipboard.writeText(txt).then(done, function () { $('#copied').textContent = 'Select the text below and copy it.' }) } catch (e) { $('#copied').textContent = 'Select the text below and copy it.' }
    })
    $('#reset').addEventListener('click', function () { if (confirm('Clear all decisions on this page?')) { saved = {}; save(); location.reload() } })
  }
})()

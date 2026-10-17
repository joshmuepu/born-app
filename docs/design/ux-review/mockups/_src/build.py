#!/usr/bin/env python3
"""Builds the UX-review mockups (index.html = the Review board, proposals.html, shell.html, live-compare.html) and ../03-proposals.md.
Run from this folder: python3 build.py. Placeholder content only (public-domain KJV, hymn titles, a sample message)."""
import os, re, html
from proposals import P, ORDER

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
TOK = open(os.path.join(HERE, '..', '..', '..', 'tokens.css')).read()
TOK = re.sub(r"@font-face \{.*?\n\}\n", "", TOK, flags=re.S)   # fonts come from the system in the mockups
CSS = open(os.path.join(HERE, 'mock.css')).read()
JS = open(os.path.join(HERE, 'mock.js')).read()
esc = html.escape

def page(title, body, nav='', extra_head=''):
    return f"""<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title>
<style>{TOK}
{CSS}</style>{extra_head}</head><body>{nav}{body}<script>{JS}</script></body></html>"""

def topnav(cur):
    items = [('index.html', 'Review board'), ('proposals.html', 'All proposals, before / after'), ('shell.html', 'Proposed app shell'), ('live-compare.html', 'Busy live view: current vs proposed')]
    links = ''.join(f'<a href="{h}" class="{"on" if h == cur else ""}">{t}</a>' for h, t in items)
    return f"""<div class="topnav"><b>Born Again · UX review</b>{links}<span class="sp"></span><span class="seg" role="group" aria-label="Theme"><button data-theme-btn="dark" aria-pressed="true">Dark</button><button data-theme-btn="light" aria-pressed="false">Light</button><button data-theme-btn="contrast" aria-pressed="false">High contrast</button></span></div>"""

# ------------------------------------------------------------------ mocked app pieces
VERSES = [
 ('1', 'The LORD is my shepherd; I shall not want.'),
 ('2', 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.'),
 ('3', 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.'),
 ('4', 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me.'),
]
QUEUE = [('Psalm 23:1 · KJV', 'The LORD is my shepherd; I shall not want.', 'bible'),
         ('Amazing Grace', 'Verse 1 — Amazing grace, how sweet the sound', 'song'),
         ('A Sample Message', 'Tape · paragraph 12', 'tape'),
         ('Welcome slide', 'Picture · Welcome.jpg', 'media'),
         ('Psalm 23:4 · KJV', 'Yea, though I walk through the valley…', 'bible'),
         ('How Great Thou Art', 'Verse 1 — O Lord my God, when I in awesome wonder', 'song'),
         ('Offering', 'Picture · Offering.jpg', 'media'),
         ('Psalm 100:1 · KJV', 'Make a joyful noise unto the LORD…', 'bible'),
         ('Benediction', 'Quote · placeholder', 'quote')]
ICON = {'bible': '▤', 'song': '♪', 'tape': '◖◗', 'media': '▣', 'quote': '❝'}

def hdr_current(live=True, w=''):
    live_btns = '<span class="hb">◉ Hide screen</span><span class="hb">Message</span>' if live else ''
    proj = '<span class="hb live">Close projection</span>' if live else '<span class="hb pri">Open projection</span>'
    return f"""<div class="hdr"><span class="logo"><i>◆</i>Born <span>Again</span></span><span class="hb ic q">‹</span><span class="hb ic q">›</span><span class="hb srch">⌕ Search everything <kbd>⌘K</kbd></span><span class="hb ic q">☀</span><span class="hb ic q">◐</span><span class="hb q">Help</span><span class="hb q">Shortcuts</span><span class="grow"></span>{live_btns}<span class="hb"><span class="dot ok"></span> Screens <kbd>3</kbd> ▾</span><span class="hb">▯ Remote</span>{proj}</div>"""

def hdr_proposed(live=True, menu=False):
    cl = 'onair' if live else ''
    live_btns = '<span class="hb" style="height:28px">◉ Hide screen</span><span class="hb" style="height:28px">Message</span>' if live else ''
    proj = '<span class="hb live" style="height:28px">Close projection</span>' if live else '<span class="hb pri" style="height:28px">Open projection</span>'
    pop = ''
    if menu:
        pop = """<div class="pop" style="right:14px;top:50px;width:280px"><h4>Appearance</h4><div class="it">Theme <span class="seg"><button aria-pressed="true">Dark</button><button aria-pressed="false">Light</button></span></div><div class="it">Contrast <span class="seg"><button aria-pressed="true">Normal</button><button aria-pressed="false">High</button></span></div><div class="it">Interface size <span class="k">Auto ▾</span></div><h4 style="margin-top:8px">Help</h4><div class="it">Manual <span class="k">F1</span></div><div class="it">Keyboard shortcuts <span class="k">?</span></div></div>"""
    return f"""<div class="hdr"><span class="logo"><i>◆</i>Born <span>Again</span></span><span class="hb ic q">‹</span><span class="hb ic q">›</span><span class="hb srch" style="min-width:200px">⌕ Search everything <kbd>⌘K</kbd></span><span class="grow"></span><span class="cluster {cl}"><span class="dot {'live' if live else ''}"></span><b style="font-size:11px;letter-spacing:.08em;color:{'var(--ba-live)' if live else 'var(--ba-text-3)'}">{'ON AIR' if live else 'OFF AIR'}</b><span class="hb" style="height:28px"><span class="dot ok"></span> Screens ▾</span>{live_btns}{proj}</span><span class="hb">▯ Remote</span><span class="hb ic" data-cog>⚙</span>{pop}</div>"""

def rail_current(active='bible', queue_n=9):
    def b(k, g, label, cls=''):
        on = ' on ' + cls if k == active else ''
        return f'<span class="rb{on}"><span class="g">{g}</span>{label}</span>'
    return f"""<div class="rail">{b('sermons','🎙','Sermons')}{b('bible','▤','Bible','c-bible')}{b('songs','♪','Songs','c-songs')}{b('media','▣','Media','c-media')}{b('tape','◖◗','Tape')}<span class="rgrow"></span>{b('saved','☆','Saved')}{b('open','▱','Open')}<span class="rb {'on c-queue' if active=='queue' else ''}"><span class="g">☰</span>Queue<span class="bdg">{queue_n}</span></span></div>"""

def rail_proposed(active='bible', queue_n=9, go=False):
    def b(k, g, label):
        on = ' on neutral' if k == active else ''
        d = f' data-go="{k}"' if go else ''
        return f'<button class="rb{on}"{d}><span class="g">{g}</span>{label}</button>'
    return f"""<div class="rail"><div class="rlab">Find</div>{b('sermons','🎙','Sermons')}{b('bible','▤','Bible')}{b('songs','♪','Songs')}{b('media','▣','Media')}<span class="rsep"></span><div class="rlab">Listen</div>{b('tape','◖◗','Tape')}<span class="rgrow"></span><span class="rsep"></span><div class="rlab">Service</div><button class="rb{' on neutral' if active in ('queue','run') else ''}"{' data-go="run"' if go else ''}><span class="g">☰</span>Queue<span class="bdg">{queue_n}</span></button></div>"""

def qrows(n, live_idx=None, up_idx=0, compact=False):
    out = ''
    for i, (t, s, k) in enumerate(QUEUE[:n]):
        cls = 'live' if i == live_idx else ('up' if i == up_idx else '')
        tag = '<span class="tag live">LIVE</span>' if i == live_idx else ('<span class="tag up">UP NEXT</span>' if i == up_idx else '')
        out += f'<div class="qrow {cls}"><span>{ICON[k]}</span><div><b>{esc(t)}</b><small>{esc(s)}</small></div>{tag}</div>'
    return out

def queue_current(live=True, rows=6):
    return f"""<div class="queue"><div class="qh">Service queue</div><div class="qtools"><span>New</span><span>Open</span><span>Import</span><span>Save</span><span class="dis">Save + pictures</span><span>Open pack</span><span>Check</span></div><div class="qlist">{qrows(rows, live_idx=None, up_idx=0)}</div>{livebox_current(live)}</div>"""

def livebox_current(live=True):
    lv = '<div class="scr live">“The LORD is my shepherd; I shall not want.”</div>' if live else '<div class="scr empty">Nothing live</div>'
    return f"""<div class="pl"><div class="pv"><div><div class="lbl">Preview</div><div class="scr">“Yea, though I walk through the valley…”</div></div><span style="color:var(--ba-text-3)">›</span><div><div class="lbl"><span class="dot {'live' if live else ''}"></span> Live</div>{lv}</div></div>
<div class="row2 c3"><div class="big2 pri">Take next</div><div class="big2"><span style="opacity:.7">⌀</span>&nbsp;Clear</div></div><div class="row2 c2"><div class="big2 dim">‹ Back</div><div class="big2 pri">Next ›</div></div></div>"""

def status_current(live=True, n=9):
    return f"""<div class="status"><span>Born Again v2.0.0-dev.1</span><span class="r"><span class="{'live' if live else ''}">● {'On air' if live else 'Projection off'}</span><span>3 displays</span><span>{n} in queue</span></span></div>"""

def tbar(playing=True):
    return f"""<div class="tbar"><div class="ti"><small>Tape</small><b>A Sample Message · ¶12</b></div><span class="cb">⏮</span><span class="cb">↺10</span><span class="cb play">{'❚❚' if playing else '▶'}</span><span class="cb">10↻</span><span class="cb">⏭</span><span class="k">0:42</span><div class="seek"><i></i></div><span class="k">−1:21</span><span class="pill" style="margin:0;color:var(--ba-ok);border-color:var(--ba-ok)">In sync</span><span class="cb">🔈</span><span class="hb">System default</span><span class="hb">Text: not on the screens</span></div>"""

def bible_pane_current():
    rows = ''
    for n, t in VERSES:
        sel = ' sel' if n == '1' else ''
        rows += f'<div class="verse{sel}"><span class="n">{n}</span><span>{esc(t)}</span><span class="a"><span class="sm q">+ Queue</span></span><span class="a"><span class="sm">Project</span></span></div>'
    return f"""<div class="tabs"><span class="tab on">Search</span><span class="tab">Browse</span><span class="grow"></span><span class="k">Tap a verse to put it on screen</span></div><div class="drill"><div class="col">{''.join(f'<span class="chbtn" style="display:flex;align-items:center;justify-content:center">{i}</span>' for i in range(1, 17))}</div><div class="read"><div class="lbl" style="margin-bottom:6px">Psalm 23 · KJV</div>{rows}</div></div>"""

def bible_pane_proposed(go=False):
    rows = ''
    for n, t in VERSES:
        sel = ' sel' if n == '1' else ''
        act = '<span class="a"><span class="sm q">Queue</span><span class="sm hot">Show ⏎</span></span>' if n == '1' else '<span class="a"></span>'
        rows += f'<div class="verse{sel}" style="grid-template-columns:26px 1fr auto"><span class="n">{n}</span><span>{esc(t)}</span>{act}</div>'
    return f"""<div class="tabs"><span class="tab on">Search</span><span class="tab">Browse</span><span class="grow"></span><span class="k">Click selects · Enter shows · Q queues</span></div><div class="drill"><div class="col">{''.join(f'<span class="chbtn" style="display:flex;align-items:center;justify-content:center">{i}</span>' for i in range(1, 17))}</div><div class="read"><div class="lbl" style="margin-bottom:6px">Psalm 23 · KJV</div>{rows}</div></div>"""

def app_current(live=True, size='', section='bible'):
    return f"""<div class="app {size}">{hdr_current(live)}<div class="body">{rail_current(section)}<div class="main">{bible_pane_current()}</div>{queue_current(live, 6)}</div><div>{tbar()}{status_current(live)}</div></div>"""

# the proposed pieces
def queue_proposed(live=True, rows=8):
    lv = '<div class="scr live">“The LORD is my shepherd; I shall not want.”</div>' if live else '<div class="scr empty">Nothing on screen</div>'
    return f"""<div class="queue"><div class="qh" style="display:flex;align-items:center;gap:8px">Service queue<span class="grow"></span><span class="sm">File ▾</span><span class="sm">Edit</span><span class="sm hot" style="border-color:var(--ba-ok);color:var(--ba-ok)">✓ Ready</span></div><div class="qlist">{qrows(rows, up_idx=0)}</div><div class="pl"><div class="pv"><div><div class="lbl">Preview <span class="k" style="margin-left:auto">‹ 2 of 9 ›</span></div><div class="scr">“Yea, though I walk through the valley…”</div></div><span style="color:var(--ba-text-3)">›</span><div><div class="lbl"><span class="dot {'live' if live else ''}"></span> Live</div>{lv}</div></div><div class="row2 c3"><div class="big2 pri">Show next ▸</div><div class="big2">Hide screen</div></div></div></div>"""

def dock_proposed(live=True, n=9):
    lz = '<div class="live-z"><span class="dot live"></span><div><b>Psalm 23:1 · KJV</b><small>On screen 0:42</small></div><span class="grow"></span><span class="sm">Hide screen</span></div>' if live else '<div class="live-z off"><span class="dot"></span><div><b>Nothing on screen</b><small>Screens off · 3 displays ready</small></div></div>'
    return f"""<div class="dock">{lz}<div class="tape-z"><span class="cb">↺10</span><span class="cb play" data-play>❚❚</span><span class="cb">10↻</span><div style="min-width:130px"><b style="font-size:12.5px">A Sample Message · ¶12</b></div><span class="k" data-clock>0:42</span><div class="tbar" style="padding:0;border:0;min-height:0;background:none;flex:1"><div class="seek"><i data-seekfill></i></div></div><span class="cb">🔈</span></div><div class="chips"><span><span class="dot ok"></span> Screens</span><span><span class="dot ok"></span> Stage</span><span><span class="dot ok"></span> Phone 1</span><span><span class="dot ok"></span> Output</span></div></div>"""

def app_proposed(live=True, size='', section='bible', menu=False, shell=False):
    return f"""<div class="app {size}">{hdr_proposed(live, menu)}<div class="body">{rail_proposed(section, go=shell)}<div class="main">{bible_pane_proposed()}</div>{queue_proposed(live, 8)}</div>{dock_proposed(live)}</div>"""

def fit(inner, w=1366, h=768):
    return f'<div class="fitbox" data-w="{w}" data-h="{h}"><div class="scale">{inner}</div></div>'

# ------------------------------------------------------------------ per-proposal before / after fragments
def frag(pid):
    if pid == 'P-01':
        b = f'<div class="app" style="height:60px;display:block;width:1120px"><div style="height:52px">{hdr_current(True)}</div></div>'
        a = f'<div class="app" style="height:60px;display:block;width:1120px;overflow:visible"><div style="height:52px">{hdr_proposed(True, False)}</div></div>'
        a2 = f'<div class="app" style="height:330px;display:block;width:1120px;overflow:visible"><div style="height:52px">{hdr_proposed(True, True)}</div></div>'
        return (fit(b, 1120, 60) + '<p class="k">Today at 1040 px with the screens live: 13 controls (this shows the intended, un-squeezed layout).</p>',
                fit(a, 1120, 60) + fit(a2, 1120, 330) + '<p class="k">Proposed: search · ON AIR cluster · Remote · ⚙ menu (second row shows the menu open).</p>')
    if pid == 'P-02':
        before = """<table class="glos"><tr><th>Where</th><th>What it calls "send to the screens"</th></tr><tr><td>Verse / paragraph button</td><td>Project</td></tr><tr><td>Live box</td><td>Take next</td></tr><tr><td>Hint under the Bible</td><td>“Tap a verse to put it on screen”</td></tr><tr><td>Tape place</td><td>Put on the screens</td></tr><tr><td>Header</td><td>Hide screen / Show screen · Close projection</td></tr><tr><td>Live box</td><td>Clear (the text) · Back / Next (the queue)</td></tr><tr><td>Phone</td><td>Blank · Prev / Next</td></tr><tr><td>Keys</td><td>Esc = hide screen · B · Space = next</td></tr></table>"""
        after = """<table class="glos"><tr><th>Word</th><th>Means</th><th>Used on</th></tr><tr><td><b>Show</b></td><td>send this to the screens now</td><td>rows, live box, Tape, phone</td></tr><tr><td><b>Next / Back</b></td><td>step through the queue</td><td>live box, phone, keys</td></tr><tr><td><b>Hide screen / Show screen</b></td><td>the blackout (Esc)</td><td>header, dock, phone</td></tr><tr><td><b>Clear</b></td><td>remove the text, keep the screens on</td><td>live box</td></tr><tr><td><b>Projection</b></td><td>the window: Open / Close</td><td>header, menus</td></tr><tr><td colspan="3" class="k">“Project” and “Take” are retired from the UI; the command palette still finds “Show” when you type “project”.</td></tr></table>"""
        return before, after
    if pid == 'P-03':
        b = '<div class="app" style="width:340px;height:auto;display:block"><div class="queue" style="border:0"><div class="qh">Service queue</div><div class="qtools"><span>New</span><span>Open</span><span>Import</span><span>Save</span><span class="dis">Save + pictures</span><span>Open pack</span><span>Check</span></div><div class="qlist" style="height:150px">' + qrows(3) + '</div></div></div>'
        a = '<div class="app" style="width:340px;height:auto;display:block"><div class="queue" style="border:0"><div class="qh" style="display:flex;align-items:center;gap:8px">Service queue<span class="grow"></span><span class="sm">File ▾</span><span class="sm">Edit</span><span class="sm" style="border-color:var(--ba-warn);color:var(--ba-warn)">⚠ 2 to fix</span></div><div class="qlist" style="height:184px">' + qrows(4) + '</div></div></div>'
        return b + '<p class="k">Two rows of text buttons (~70 px): 6 rows visible at 1366×768, 2 at 1040×640.</p>', a + '<p class="k">One row (~34 px) with a readiness chip: +2 queue rows. File ▾ lists New, Open…, Import…, Save, Save + pictures, Open pack….</p>'
    if pid == 'P-04':
        b = '<div class="app" style="width:90px;height:420px;display:block">' + rail_current('bible').replace('class="rail"', 'class="rail" style="height:420px"') + '</div>'
        a = '<div class="app" style="width:90px;height:420px;display:block">' + rail_proposed('bible').replace('class="rail"', 'class="rail" style="height:420px"') + '</div>'
        return b + '<p class="k">Bible green, Songs orange, Media teal, Queue plum, Tape white.</p>', a + '<p class="k">Three groups, one selection colour; Saved/Open move into File ▾ (P-03).</p>'
    if pid == 'P-05':
        b = '<div class="app" style="width:1040px;height:auto;display:block;overflow:hidden">' + tbar() + status_current() + '</div>'
        a = '<div class="app" style="width:1040px;height:auto;display:block;overflow:hidden">' + dock_proposed().replace('data-play', '') + '</div>'
        return fit(b, 1040, 100) + '<p class="k">Two strips: tape bar 57 px + status bar ~30 px. “On air” is a small word at the right.</p>', fit(a, 1040, 76) + '<p class="k">One 56 px dock: LIVE (what, since when, Hide screen) · tape · connections.</p>'
    if pid == 'P-06':
        run = f"""<div class="app">{hdr_proposed(True)}<div class="body noq" style="grid-template-columns:68px 1.1fr 1fr">{rail_proposed('queue')}<div class="main" style="padding:12px 14px;gap:8px"><div class="lbl">Service queue · 3 of 9</div><div class="qlist" style="padding:0">{qrows(9, live_idx=0, up_idx=1)}</div></div><div class="queue" style="padding:12px 14px;gap:10px"><div class="lbl">Preview · next</div><div class="scr" style="font-size:14px;aspect-ratio:auto;height:118px">“Amazing grace, how sweet the sound…”</div><div class="lbl"><span class="dot live"></span> Live</div><div class="scr live" style="font-size:14px;aspect-ratio:auto;height:118px">“The LORD is my shepherd; I shall not want.”</div><div class="big2 pri" style="height:56px;font-size:17px">Show next ▸ <span class="k" style="margin-left:8px">Space</span></div><div class="row2 c3"><div class="big2" style="height:46px">‹ Back</div><div class="big2" style="height:46px">Hide screen</div></div><div class="sm" style="align-self:flex-start">⌕ Find something else… <span class="k" style="margin-left:6px">⌘K</span></div></div></div>{dock_proposed(True).replace('data-play','')}</div>"""
        return '<p class="lead">Today the same moment is the Prepare layout (see “Busy live view”).</p>', fit(run, 1366, 768)
    if pid == 'P-07':
        b = livebox_current(True)
        a = """<div class="pl"><div class="pv"><div><div class="lbl">Preview <span class="k" style="margin-left:auto">‹ 2 of 9 ›</span></div><div class="scr">“Yea, though I walk through the valley…”</div></div><span style="color:var(--ba-text-3)">›</span><div><div class="lbl"><span class="dot live"></span> Live</div><div class="scr live">“The LORD is my shepherd…”</div></div></div><div class="row2 c3"><div class="big2 pri">Show next ▸</div><div class="big2">Hide screen</div></div></div>"""
        w = lambda x: '<div class="app" style="width:340px;height:auto;display:block;overflow:hidden"><div class="queue" style="border:0">' + x + '</div></div>'
        return w(b) + '<p class="k">Two purple primaries + Back + Clear: four big buttons.</p>', w(a) + '<p class="k">One primary; steps are the small arrows; Hide screen on the live side. Same keys.</p>'
    if pid == 'P-08':
        rows_b = ''.join(f'<div class="verse{" sel" if n=="1" else ""}"><span class="n">{n}</span><span>{esc(t)}</span><span class="a"><span class="sm q">+ Queue</span></span><span class="a"><span class="sm">Project</span></span></div>' for n, t in VERSES[:3])
        rows_a = ''.join(f'<div class="verse{" sel" if n=="1" else ""}" style="grid-template-columns:26px 1fr auto"><span class="n">{n}</span><span>{esc(t)}</span>' + ('<span class="a"><span class="sm q">Queue</span><span class="sm hot">Show ⏎</span></span>' if n == '1' else '<span class="a"></span>') + '</div>' for n, t in VERSES[:3])
        w = lambda x: '<div class="app" style="width:620px;height:auto;display:block;padding:8px">' + x + '</div>'
        return w(rows_b) + '<p class="k">Three ways to send, two buttons on every row.</p>', w(rows_a) + '<p class="k">Click selects, Enter shows, actions appear on the selected / hovered row.</p>'
    if pid == 'P-09':
        def btns(h, label):
            return ''.join(f'<span class="hb" style="height:{x}px">{label} {x}px</span> ' for x in h)
        return '<div class="app" style="width:520px;height:auto;display:block;padding:10px"><p class="k">Measured today at 1366×768:</p>' + btns([22, 28], 'Help / Open projection') + '</div>', '<div class="app" style="width:520px;height:auto;display:block;padding:10px"><p class="k">Proposed minimums:</p>' + btns([32, 40], 'Normal / Show-Hide-Play') + '</div>'
    if pid == 'P-10':
        b = '<div class="app" style="width:620px;height:auto;display:block;padding:12px"><p>Tab order today (Sermons): Filters ← footer · logo · Back · Forward · Search · theme · contrast · Help · Shortcuts · Hide screen · Message · Screens · Remote · Close projection · <b>Sermons · Bible · Songs · Media · Tape · Saved · Open · Queue</b> · Search · Date · Series · Location · Recently Played · <b>the search box</b> (stop 27).</p></div>'
        a = '<div class="app" style="width:620px;height:auto;display:block;padding:12px"><p><span class="hb pri" style="height:28px">Skip to content</span> <span class="hb" style="height:28px">Skip to the queue</span> <span class="hb" style="height:28px">Skip to the live controls</span><br><br>First Tab stop: Skip to content (visible on focus). <span class="k">F6</span> cycles Header → Rail → Content → Queue → Dock. One h1 per section.</p></div>'
        return b, a
    if pid == 'P-11':
        b = '<div class="app" style="width:520px;height:auto;display:block;padding:10px"><span class="hb ic q">☀</span> <span class="hb ic q">◐</span> <span class="k">two unlabeled icon buttons; interface size is only in the command palette (“Interface size: 125%”).</span></div>'
        a = '<div class="app" style="width:520px;height:230px;display:block;position:relative"><div class="pop" style="left:20px;top:10px;width:280px"><h4>Appearance</h4><div class="it">Theme <span class="seg"><button aria-pressed="true">Dark</button><button aria-pressed="false">Light</button></span></div><div class="it">Contrast <span class="seg"><button aria-pressed="true">Normal</button><button aria-pressed="false">High</button></span></div><div class="it">Interface size <span class="k">Auto ▾</span></div><h4 style="margin-top:8px">Help</h4><div class="it">Manual <span class="k">F1</span></div><div class="it">Keyboard shortcuts <span class="k">?</span></div></div></div>'
        return b, a
    if pid == 'P-12':
        b = '<div class="app" style="width:340px;height:200px;display:block"><div class="queue" style="border:0;height:100%;align-items:center;justify-content:center;text-align:center;padding:16px"><b>New service</b><p class="k">Add quotes, Bible passages and songs from the left — they line up here in order, ready to project.</p><span class="sm">Open a saved service…</span></div></div>'
        a = '<div class="app" style="width:340px;height:auto;display:block"><div class="queue" style="border:0;padding:14px;gap:8px"><b>Set up Sunday</b><div class="qrow"><span>1</span><div><b>Choose your screens</b><small>Screens ▾ · test pattern</small></div><span class="tag">Do it</span></div><div class="qrow"><span>2</span><div><b>Add tonight’s items</b><small>or start from a template</small></div><span class="tag">Do it</span></div><div class="qrow"><span>3</span><div><b>Is tonight ready?</b><small>one check before service</small></div><span class="tag">Do it</span></div><div class="row2 c2"><span class="sm">Sunday morning</span><span class="sm">Midweek</span></div></div></div>'
        return b, a
    if pid == 'P-13':
        def phone(blank, tabs):
            return f"""<div class="app" style="width:300px;height:560px;display:flex;flex-direction:column;border-radius:22px"><div class="hdr"><span class="logo"><i>◆</i>Born <span>Again</span></span><span class="grow"></span><span class="k"><span class="dot ok"></span> Connected</span></div>{'<div style="background:var(--ba-warn);color:#1a0d02;font-weight:700;padding:10px;text-align:center">SCREEN HIDDEN — tap to show</div>' if blank else ''}<div style="padding:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px"><div class="big2" style="height:56px">‹ Prev</div><div class="big2 pri" style="height:56px">Next ›</div><div class="big2" style="height:{'56' if blank else '44'}px;color:var(--ba-warn);border-color:var(--ba-warn)">{'Show' if blank else 'Blank'}</div></div><div style="padding:0 10px"><div class="lbl"><span class="dot live"></span> On screen</div><div class="scr live" style="aspect-ratio:auto;height:96px;margin:4px 0 8px">“The LORD is my shepherd; I shall not want.”</div><div class="lbl">Next</div><div class="scr" style="aspect-ratio:auto;height:70px;margin-top:4px">“He maketh me to lie down…”</div></div><div class="grow"></div><div class="rail" style="flex-direction:row;border:0;border-top:1px solid var(--ba-line);justify-content:space-around">{tabs}</div></div>"""
        t4 = ''.join(f'<span class="rb" style="padding:6px 4px"><span class="g">{g}</span>{l}</span>' for g, l in [('☰', 'Queue'), ('🎙', 'Sermons'), ('▤', 'Bible'), ('♪', 'Songs')])
        t6 = ''.join(f'<span class="rb" style="padding:6px 2px"><span class="g">{g}</span>{l}</span>' for g, l in [('☰', 'Queue'), ('🎙', 'Sermons'), ('▤', 'Bible'), ('♪', 'Songs'), ('▣', 'Media'), ('◖◗', 'Tape')])
        return phone(False, t4), phone(True, t6)
    return '', ''

# ------------------------------------------------------------------ pages
def proposals_page():
    secs = ''
    for p in P:
        b, a = frag(p['id'])
        secs += f"""<section id="{p['id']}" class="card" data-ba data-view="after"><h3>{p['id']} · {esc(p['title'])}</h3><div class="meta"><span class="pill {p['effort'].lower()}">Effort {p['effort']}</span><span class="pill">Risk {p['risk']}</span><span class="pill hi">Impact {p['impact']}</span></div><p class="lead">{esc(p['one'])}</p>
<div class="ba-toggle"><span class="seg"><button data-set="before" aria-pressed="false">Before (today)</button><button data-set="after" aria-pressed="true">After (proposed)</button></span></div>
<div class="stage"><div class="before">{b}</div><div class="after">{a}</div></div>
<p><b>Problem.</b> {esc(p['problem'])}</p><p><b>Change.</b> {esc(p['change'])}</p><p><b>Benefit.</b> {esc(p['benefit'])}</p></section>"""
    body = f'<div class="page"><h1>All proposals — before and after</h1><p class="lead">Each block has a Before / After switch. Everything is pretend data (public-domain Bible text, hymn titles, a sample message). Nothing here is built. Decide on the <a href="index.html">Review board</a>.</p>{secs}</div>'
    return page('All proposals — before and after', body, topnav('proposals.html'))

def board_page():
    by = {p['id']: p for p in P}
    cards = ''
    for pid in ORDER:
        p = by[pid]
        cards += f"""<section class="card" data-pid="{pid}" data-title="{esc(p['title'])}"><h3>{pid} · {esc(p['title'])}</h3><div class="meta"><span class="pill {p['effort'].lower()}">Effort {p['effort']}</span><span class="pill">Risk {p['risk']}</span><span class="pill hi">Impact {p['impact']}</span> <a href="proposals.html#{pid}">before / after →</a></div><p class="lead" style="margin:4px 0 10px">{esc(p['one'])}</p>
<div class="cols" style="margin-bottom:10px"><div><div class="lbl">Before (today)</div><a href="proposals.html#{pid}"><img src="png/{pid}.before.png" alt="Before: {esc(p['title'])}" style="width:100%;border:1px solid var(--ba-line);border-radius:8px;background:var(--ba-bg-1)"></a></div><div><div class="lbl">After (proposed)</div><a href="proposals.html#{pid}"><img src="png/{pid}.after.png" alt="After: {esc(p['title'])}" style="width:100%;border:1px solid var(--ba-line);border-radius:8px;background:var(--ba-bg-1)"></a></div></div>
<div class="cols"><div><span class="seg approve" role="group" aria-label="Decision for {pid}"><button data-v="approve" aria-pressed="false">Approve</button><button data-v="discuss" aria-pressed="false">Discuss</button><button data-v="reject" aria-pressed="false">Reject</button></span></div><div><label class="sr" for="n-{pid}">Notes for {pid}</label><textarea class="note" id="n-{pid}" placeholder="Notes (optional)"></textarea></div></div></section>"""
    body = f"""<div class="page" id="board"><h1>Review board</h1><p class="lead">13 proposals from the full UX review, in the recommended build order. <b>No proposal is built.</b> Bug fixes already made are listed in <code>docs/design/ux-review/02-fixed-bugs.md</code>. For each: <b>Approve</b>, <b>Discuss</b> or <b>Reject</b>, add a note if you like, then press <b>Copy my decisions</b> and paste the text back to Claude. Your choices are kept in this browser.</p>
<p class="lead">Also open: <a href="shell.html">the proposed app shell (clickable)</a> · <a href="live-compare.html">the busiest service view, current vs proposed</a> · <a href="proposals.html">every before/after on one page</a>.</p>
<div class="summary"><b>Running summary</b><span class="pill s">Approved <span id="sum-approve">0</span></span><span class="pill m">Discuss <span id="sum-discuss">0</span></span><span class="pill l">Rejected <span id="sum-reject">0</span></span><span class="pill">No decision <span id="sum-open">13</span></span><span class="grow"></span><button class="big" id="copy">Copy my decisions</button><button class="sm" id="reset">Clear</button></div><span id="copied" class="k" role="status"></span><textarea id="out" class="note" style="min-height:180px" hidden readonly aria-label="Your decisions as text"></textarea>
{cards}</div>"""
    return page('Review board — Born Again UX review', body, topnav('index.html'))

def shell_page():
    live_sections = {
     'sermons': f'<div class="tabs"><span class="tab on">Search</span><span class="tab">Date</span><span class="tab">Series</span><span class="tab">Location</span><span class="tab">Recently Played</span></div><div class="cont"><span class="hb srch" style="width:100%;justify-content:flex-start">⌕ Search for a word or phrase — e.g. Holy Spirit</span><p class="k">Recent searches: <span class="sm">A Sample Message</span></p></div>',
     'bible': bible_pane_proposed(),
     'songs': '<div class="tabs"><span class="tab on">Search</span><span class="tab">Browse</span></div><div class="cont"><span class="hb srch" style="width:100%;justify-content:flex-start">⌕ Search titles &amp; lyrics…</span><div class="qrow"><span>♪</span><div><b>Amazing Grace</b><small>Verse 1 — Amazing grace, how sweet the sound</small></div><span class="sm q">Queue</span></div><div class="qrow"><span>♪</span><div><b>How Great Thou Art</b><small>Verse 1 — O Lord my God, when I in awesome wonder</small></div><span class="sm q">Queue</span></div></div>',
     'media': '<div class="tabs"><span class="tab on">All media</span><span class="tab">Favorites</span><span class="tab">Recently used</span><span class="tab">Videos</span><span class="tab">Backgrounds</span></div><div class="cont"><div class="row2" style="grid-template-columns:repeat(4,1fr)"><div class="scr">Welcome.jpg</div><div class="scr">Offering.jpg</div><div class="scr">Blue hour.jpg</div><div class="scr">Warm light.jpg</div></div></div>',
     'tape': '<div class="tabs"><span class="tab on">Follow</span><span class="tab">Timing</span><span class="tab">Options</span><span class="tab">Add</span><span class="grow"></span><span class="hb pri" style="height:28px">Show on the screens</span></div><div class="cont"><div class="lbl">A Sample Message · timed</div>' + ''.join(f'<div class="verse" style="grid-template-columns:26px 1fr"><span class="n">{n}</span><span>{esc(t)}</span></div>' for n, t in VERSES) + '</div>',
     'run': '<div class="cont"><div class="lbl">Run view — queue first</div><div class="qlist" style="padding:0">' + qrows(9, live_idx=0, up_idx=1) + '</div></div>',
    }
    panes = ''.join(f'<div data-sec="{k}" class="main" style="flex:1;min-height:0" hidden>{v}</div>' for k, v in live_sections.items())
    shell = f"""<div id="shell" class="app"><div data-live-on>{hdr_proposed(True, False).replace('data-cog','data-cog')}</div><div data-live-off hidden>{hdr_proposed(False, False).replace('data-cog','data-cog')}</div><div class="body">{rail_proposed('bible', go=True)}<div style="display:flex;flex-direction:column;min-height:0;min-width:0">{panes}</div>{queue_proposed(True, 8)}</div><div data-live-on>{dock_proposed(True)}</div><div data-live-off hidden>{dock_proposed(False)}</div><div class="pop" id="cog-menu" hidden style="right:14px;top:50px;width:290px"><h4>Appearance</h4><div class="it">Theme <span class="seg"><button data-theme-btn="dark" aria-pressed="true">Dark</button><button data-theme-btn="light" aria-pressed="false">Light</button></span></div><div class="it">Contrast <span class="seg"><button data-theme-btn="contrast" aria-pressed="false">High</button></span></div><div class="it">Interface size <span class="k">Auto ▾</span></div><h4 style="margin-top:8px">Help</h4><div class="it">Manual <span class="k">F1</span></div><div class="it">Keyboard shortcuts <span class="k">?</span></div></div></div>"""
    # the proposed shell wraps hdr/dock twice for live/off: fix data-cog duplicates handled by JS (all [data-cog])
    body = f"""<div class="page"><h1>Proposed app shell</h1><p class="lead">A clickable pretend app: click the rail to change section, the ⚙ to open the menu, <b>Pretend: screens on / off</b> to see the ON AIR cluster and the Now dock change, Play to run the pretend tape. Switch the window size to see 1040×640 (the small laptop) and 1920×1080. Pretend data only. This is a design — nothing like it is built.</p>
<p><span class="seg" role="group" aria-label="Window size"><button data-size="s1040" aria-pressed="false">1040 × 640</button><button data-size="" aria-pressed="true">1366 × 768</button><button data-size="s1920" aria-pressed="false">1920 × 1080</button></span> <button class="sm" data-toggle-live>Pretend: screens on / off</button></p>
<p class="lead">What changed in the shell: P-01 header zones · P-04 rail groups · P-03 queue File menu + readiness chip · P-07 one primary · P-05 Now dock · P-08 row actions · P-09 target sizes. The Run view (P-06) is the <b>Queue</b> button in the rail.</p>
<div style="overflow:auto">{fit(shell, 1366, 768)}</div></div>"""
    return page('Proposed app shell', body, topnav('shell.html'))

def live_page():
    body = f"""<div class="page"><h1>The busiest view: running a service</h1><p class="lead">Bible open, 9 items queued, screens live, tape playing, at 1366×768. Left to right: <b>today</b> and <b>proposed</b> (P-01, 03, 04, 05, 07, 08). Use the switch for a full-size look.</p>
<div data-ba data-view="side"><div class="ba-toggle"><span class="seg"><button data-set="side" aria-pressed="true">Side by side</button><button data-set="before" aria-pressed="false">Today (full size)</button><button data-set="after" aria-pressed="false">Proposed (full size)</button></span></div>
<style>[data-view='side'] .cmp{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}[data-view='before'] .cmp .pa,[data-view='after'] .cmp .pb{{display:none}}[data-view='before'] .cmp,[data-view='after'] .cmp{{display:block}}.cmp .lab{{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--ba-text-3);margin:6px 0}}</style>
<div class="cmp"><div class="pb"><div class="lab">Today</div>{fit(app_current(True), 1366, 768)}</div><div class="pa"><div class="lab">Proposed</div>{fit(app_proposed(True), 1366, 768)}</div></div></div>
<div class="callout"><b>What to compare.</b> Header: 13 controls vs 7 + a ⚙ menu. Rail: five accent colours vs one. Queue: 6 rows and two toolbar rows vs 8 rows and one. Live box: two purple primaries vs one. Bottom: two strips (87 px) vs one dock (56 px) that says what is on air. Verse rows: two buttons each vs actions on the selected row.</div></div>"""
    return page('Busy live view — current vs proposed', body, topnav('live-compare.html'))

def md():
    by = {p['id']: p for p in P}
    out = ['# 03 · Proposals (nothing here is built)', '',
           'Review them on the clickable **Review board**: `docs/design/ux-review/mockups/index.html` (Approve / Discuss / Reject, a notes box each, and **Copy my decisions**).',
           'Each proposal below has the same content as its card. Bugs already fixed are in `02-fixed-bugs.md`; feature ideas that are not UI fixes are in `04-idea-backlog.md`.', '',
           '| ID | One line | Effort | Risk | Impact |', '|---|---|---|---|---|']
    for pid in ORDER:
        p = by[pid]; out.append(f"| {pid} | {p['title']} | {p['effort']} | {p['risk']} | {p['impact']} |")
    out += ['', '**Recommended order:** ' + ' → '.join(ORDER) + '.', '',
            'Why this order: P-02, P-03, P-09, P-10 are small and independent (words, one toolbar, sizes, keyboard) and every later proposal benefits from the shared vocabulary and sizes. P-04, P-01 and P-11 then reshape the rail and header together (they share the ⚙ menu). P-05 and P-07 change the live strip and live box (most visible, so after the vocabulary is agreed). P-13 and P-08 change the phone and the row gesture. P-12 (first run) and P-06 (Run view, the largest) come last, once the pieces they reuse exist.', '',
            '## A coherent overall app shell', '',
            'If P-01, P-03, P-04, P-05, P-07 and P-08 are all approved they form one shell, shown clickable in `mockups/shell.html` and side by side with today in `mockups/live-compare.html`: a header with three zones, a rail with three labelled groups, a queue pane with a File menu and a readiness chip, one primary button in the live box, and one bottom dock that answers "what is on air?" and carries the tape. The Run view (P-06) is the same shell with the browse columns replaced by the queue.', '',
            '## Build plan (small slices, each with acceptance tests)', '']
    for i, pid in enumerate(ORDER, 1):
        p = by[pid]
        out += [f'{i}. **{pid}** — {p["title"]}. Slice: {p["files"]} Acceptance: {p["accept"]}']
    out += ['', 'Every slice follows the repo rules: typecheck, the full suite, a production build, the regression scripts (`scripts/regression/run-all.sh`), the contrast audit in all three themes, a short real-app run on an isolated profile, then commit and push.', '', '---', '']
    for pid in ORDER:
        p = by[pid]
        out += [f'## {pid} · {p["title"]}', '', f'Effort **{p["effort"]}** · Risk **{p["risk"]}** · Impact **{p["impact"]}**', '',
                f'**In one line.** {p["one"]}', '', f'**Problem and evidence.** {p["problem"]}', '', f'**The change.** {p["change"]}', '',
                f'**Benefit in a service.** {p["benefit"]}', '', f'**Files / modules.** {p["files"]}', '', f'**Migration path.** {p["migration"]}', '',
                f'**Stays for v1 familiarity.** {p["v1"]}', '', f'**Acceptance.** {p["accept"]}', '', f'Mockup: `mockups/proposals.html#{pid}`', '']
    open(os.path.join(OUT, '..', '03-proposals.md').replace('mockups/..', ''), 'w').write('\n'.join(out))

def write(name, content):
    open(os.path.join(OUT, name), 'w').write(content)

if __name__ == '__main__':
    write('index.html', board_page())
    write('proposals.html', proposals_page())
    write('shell.html', shell_page())
    write('live-compare.html', live_page())
    md()
    print('built')

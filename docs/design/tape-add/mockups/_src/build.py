#!/usr/bin/env python3
"""Builds the Tape "Add" redesign mockups (index.html = the Review board, today.html, option-a..d.html, recommended.html, compare.html) into ../ and, with --png, the screenshots into ../png/ (needs Google Chrome).
Run from this folder: python3 build.py [--png]. Placeholder content only (invented titles, public-domain KJV lines)."""
import os, re, sys, subprocess, html
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE)
TOK = open(os.path.join(HERE, '..', '..', '..', 'tokens.css')).read()
TOK = re.sub(r"@font-face \{.*?\n\}\n", "", TOK, flags=re.S)
CSS = open(os.path.join(HERE, 'base.css')).read() + open(os.path.join(HERE, 'tape.css')).read()
JS = open(os.path.join(HERE, 'tape.js')).read()
esc = html.escape
NAV = [('index.html', 'Review board'), ('compare.html', 'Compare'), ('recommended.html', 'Recommended (A)'), ('today.html', 'Today'), ('option-a.html', 'A · One door'), ('option-b.html', 'B · One page'), ('option-c.html', 'C · Find a tape'), ('option-d.html', 'D · Tidy only')]

def page(title, body, cur):
    links = ''.join(f'<a href="{h}" class="{"on" if h == cur else ""}">{t}</a>' for h, t in NAV)
    nav = f"""<div class="topnav"><b>Tape · Add</b>{links}<span class="sp"></span><span class="seg" role="group" aria-label="Theme"><button data-theme-btn="dark" aria-pressed="true">Dark</button><button data-theme-btn="light" aria-pressed="false">Light</button><button data-theme-btn="contrast" aria-pressed="false">High contrast</button></span></div>"""
    return f"""<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><style>{TOK}
{CSS}</style></head><body>{nav}<div class="page">{body}</div><script>{JS}</script></body></html>"""

def demo(key, lead, size_links=False):
    sz = '<p class="faint">Window size: <a href="?size=wide">wide 1366</a> · <a href="?size=narrow">narrow 1040</a></p>' if size_links else ''
    return f"""<p class="lead">{lead}</p>{sz}<div data-opt="{key}"><div class="scen" role="group" aria-label="Situations"></div><div class="demo"><div class="stage"><div class="frame"></div></div><div class="narr" aria-live="polite"></div></div></div>"""

OPTS = {
 'today': ('Today', 'The Add tab as it is in the app now, with its states. Use the situations to see where a volunteer has to stop and think.'),
 'a': ('A · One door (recommended)', 'No Add tab. One <b>＋ Add recording…</b> button at the top of the list (its ▾ offers Download); the Tape audio folder is watched and offers new files in a strip; the folder setting moves to Options; errors are plain and local.'),
 'b': ('B · One page', 'Keep the Add tab but make it one page: a drop zone first, “found in your folder” as a live list (no Look again), Download as one collapsed row.'),
 'c': ('C · Find a tape', 'Sermon-first: a single search where every result carries the one action it needs — Load, Add or Download. Files and the folder show up as rows too.'),
 'd': ('D · Tidy only', 'The smallest change: same tab, two cards instead of three, no duplicate buttons, no Look again, a one-line folder note. Fixes the wording, not the structure.'),
}
for k, (t, lead) in OPTS.items():
    fn = 'today.html' if k == 'today' else f'option-{k}.html'
    open(os.path.join(OUT, fn), 'w').write(page('Tape Add — ' + t, f'<h1>{t}</h1>' + demo(k, lead, size_links=True), fn))

# ---- recommended: option A at higher fidelity, three themes, narrow
shots = ''.join(f'<figure style="margin:0"><a href="png/{n}.png"><img src="png/{n}.png" alt="{c}" style="width:100%;border:1px solid var(--ba-line);border-radius:8px"></a><figcaption class="faint">{c}</figcaption></figure>' for n, c in [
  ('A-empty-dark', 'Empty library · dark'), ('A-populated-dark', 'Three recordings · dark'), ('A-folder-new-light', 'New files found · light'), ('A-download-dark', 'Download dialog · dark'), ('A-added-contrast', 'Added, timing in the background · high contrast'), ('A-narrow-dark', 'Narrow window (1040) · dark'), ('A-narrow-light', 'Narrow window · light'), ('A-errors-dark', 'An error, in plain words · dark')])
rec = f"""<h1>Recommended: A · One door</h1><div class="callout">One place to add from. The Tape audio folder is watched, so new files are <i>offered</i>, never added silently. Download is a small dialog. Everything that is a setting (the folder) moves to Options. Switch theme at the top right; change the size below.</div>{demo('a', 'Walk through every situation with the buttons, or click inside the picture.', size_links=True)}<h2>Screenshots</h2><div class="cols" style="grid-template-columns:repeat(2,1fr)">{shots}</div>"""
open(os.path.join(OUT, 'recommended.html'), 'w').write(page('Tape Add — Recommended', rec, 'recommended.html'))

# ---- compare
def row(*c): return '<tr>' + ''.join(f'<td>{x}</td>' for x in c) + '</tr>'
cmp = """<h1>Side by side</h1><p class="lead">Steps = clicks and choices from the Tape place (the file-picker’s Open counts as one; typing counts as one). “Today” counts the Add tab; its left-hand button already opens the picker directly.</p>
<table class="tbl"><thead><tr><th></th><th>Today</th><th>A · One door ★</th><th>B · One page</th><th>C · Find a tape</th><th>D · Tidy only</th></tr></thead><tbody>""" + ''.join([
 row('Add a file with a date code', '2', '2 (button opens the picker)', '3 (Add tab → Choose → Open)', '3 (search → Add; or drop)', '2'),
 row('A new file appears in the folder', '3 (Add tab → Look again → Add)', '1 (strip → Add)', '2 (dotted tab → Add)', '2 (row → Add)', '2 (line → Add them)'),
 row('Download a tape', '3 (tab, type, Download)', '4 (▾, item, type, Download); 2 from the sermon in the reader', '4 (tab, expand, type, Download)', '2 (type, Download)', '3'),
 row('Add several files', '2', '2', '3', '3', '2'),
 row('First-time volunteer: where do I go?', 'Three equal cards; “Add a recording” appears three times', 'One button; the empty page says what to do', 'One page, drop zone first', 'One search box; very clear, but a new idea', 'Better; still a tab that mixes three jobs'),
 row('Clutter on the page', 'High (3 cards, welcome note, duplicates)', 'Lowest (no Add page at all)', 'Low–medium', 'Low', 'Medium'),
 row('Safety (nothing plays or shows by itself)', 'Kept', 'Kept; folder files are offered, never added silently', 'Kept', 'Kept; Load never plays', 'Kept'),
 row('Mid-service use (find a tape, play it)', 'Slow', 'Good', 'OK', '<b>Best</b>', 'OK'),
 row('Effort', '—', '<b>M</b>', 'M', 'L', 'S'),
 row('Risk', '—', 'Low (same engine; UI moves)', 'Low', 'Medium (new search, per-sermon status)', 'Very low'),
 row('Main files that change', '—', 'TapePlace.tsx, TapeAddPanel.tsx → AddMenu + Download dialog + folder strip; TapeSettingsPanel (folder); tapeService (folder watch)', 'TapePlace.tsx, TapeAddPanel.tsx', 'TapePlace.tsx + new FindTape; sermon search IPC; per-sermon availability', 'TapePlace.tsx, TapeAddPanel.tsx (text only)'),
]) + '</tbody></table>'
open(os.path.join(OUT, 'compare.html'), 'w').write(page('Tape Add — Compare', cmp, 'compare.html'))

# ---- the board
def card(pid, title, body):
    return f"""<div class="card" data-pid="{pid}" data-title="{esc(title)}"><h3>{pid} · {esc(title)}</h3><div class="meta">{body}</div><span class="seg approve" role="group" aria-label="Decision for {pid}"><button data-v="approve" aria-pressed="false">Approve</button><button data-v="reject" aria-pressed="false">Reject</button><button data-v="discuss" aria-pressed="false">Discuss</button></span><textarea class="note" placeholder="Your note (optional)" aria-label="Note for {pid}"></textarea></div>"""
cards = ''.join([
 card('OPT-A', 'Option A · One door (recommended)', 'No Add tab. “＋ Add recording…” on the list (▾ = Download). Folder watched, new files offered in a strip. Folder setting moves to Options. <a href="option-a.html">Open the flow</a> · <a href="recommended.html">Higher fidelity, 3 themes</a>. <span class="pill s">S–M</span><span class="pill m">M</span>'),
 card('OPT-B', 'Option B · One page', 'Keep the tab; one clear page. <a href="option-b.html">Open the flow</a>. <span class="pill m">M</span>'),
 card('OPT-C', 'Option C · Find a tape', 'Search-first; every result has one action. <a href="option-c.html">Open the flow</a>. <span class="pill l">L</span>'),
 card('OPT-D', 'Option D · Tidy only', 'Smallest change. <a href="option-d.html">Open the flow</a>. <span class="pill s">S</span>'),
 card('R1', 'Remove the Add tab (it is not about the selected recording)', 'Follow / Timing / Options are about the selected tape; Add is not. It moves to one button on the list.'),
 card('R2', 'Move the Tape audio folder to Options and watch it automatically', 'The folder is a setting you touch once. “Look again” disappears because BORN reads the folder when the Tape place opens and while it is open.'),
 card('R3', 'New files in the folder are offered in a strip, never added silently', 'One line: “2 new recordings in your Tape audio folder — Add 1 recognised · See both”.'),
 card('R4', 'Download becomes a small dialog (and a progress row), not a card', 'Prefilled with the sermon when started from the reader. In-app download behaviour is unchanged.'),
 card('R5', 'Retire the welcome note', 'It repeats what the page says. (Its “time it once” sentence was already wrong: timing is automatic now — fixed on this branch.)'),
 card('R6', 'Cut the explanatory paragraphs to one line each', 'The “BORN keeps its own copy and never changes your file” promise moves to the Add confirmation and the empty page.'),
 card('R7', 'Rename: “Add a recording…” stays; “Get audio” becomes “Download from the publisher…”', 'Says where it comes from; matches the approved glossary style (one word per job).'),
 card('R8', 'Move “Remove this recording” from Timing to a ⋯ menu on the recording row', 'A destructive action should not live inside a tab named for something else. Remove keeps its confirmation.'),
])
board = f"""<h1>Review board: Tape “Add”</h1><p class="lead">Read the <a href="compare.html">comparison</a>, try the flows, then mark each item. <b>Copy my decisions</b> gives you text to paste back to Claude. My recommendation is <b>A · One door</b>; it is a recommendation, not a decision.</p>
<div class="summary" role="status"><span>Approve <b id="sum-approve">0</b></span><span>Reject <b id="sum-reject">0</b></span><span>Discuss <b id="sum-discuss">0</b></span><span>Open <b id="sum-open">0</b></span><span class="grow"></span><button class="big" id="copy">Copy my decisions</button><button class="btn sm" id="reset">Clear</button><span id="copied" class="faint"></span></div><textarea id="out" class="note" hidden style="min-height:140px" aria-label="Decisions text"></textarea><div id="board">{cards}</div>"""
open(os.path.join(OUT, 'index.html'), 'w').write(page('Tape Add — Review board', board, 'index.html'))

if '--png' in sys.argv:
    chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    jobs = [('A-empty-dark', 'option-a.html', 'dark', 'wide', 'a-empty'), ('A-populated-dark', 'option-a.html', 'dark', 'wide', 'a-start'), ('A-folder-new-light', 'option-a.html', 'light', 'wide', 'a-newfile'),
            ('A-download-dark', 'option-a.html', 'dark', 'wide', 'a-dl-typed'), ('A-added-contrast', 'option-a.html', 'contrast', 'wide', 'a-added'), ('A-narrow-dark', 'option-a.html', 'dark', 'narrow', 'a-start'),
            ('A-narrow-light', 'option-a.html', 'light', 'narrow', 'a-added'), ('A-errors-dark', 'option-a.html', 'dark', 'wide', 'a-err-dl'),
            ('today-add-dark', 'today.html', 'dark', 'wide', 't-add'), ('today-empty-dark', 'today.html', 'dark', 'wide', 't-empty'), ('B-add-dark', 'option-b.html', 'dark', 'wide', 'b-found'), ('C-find-dark', 'option-c.html', 'dark', 'wide', 'c-type'), ('D-add-dark', 'option-d.html', 'dark', 'wide', 'd-found')]
    for name, f, theme, size, screen in jobs:
        url = f'file://{OUT}/{f}?theme={theme}&size={size}&screen={screen}&frame=1'
        out = os.path.join(OUT, 'png', name + '.png')
        subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1380,%d' % (700 if size == 'narrow' else 790), '--virtual-time-budget=3000', f'--screenshot={out}', url], capture_output=True)
        print(name, os.path.getsize(out) if os.path.exists(out) else 'MISSING')

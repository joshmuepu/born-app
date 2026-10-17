from sa_place import *

K = ['Where the transport lives', 'Where the follow-along lives', 'Put on the screens · modes · languages', 'Import · Tape audio folder · sync editor · options',
     'Moving to Songs / Bible / Media mid-tape', 'A verse or announcement goes on the screens mid-tape', 'A video or YouTube item starts', 'Narrow window', 'First-time discovery', 'Keyboard and Esc', 'Phone and stage']

NOTES = {
 'today': [
  ('What this is', 'The CURRENT build, for comparison. Everything about the tape sits at the bottom of the Sermons reader.'),
  (K[0], 'A bar docked under the Sermons reader only. Go to Songs (button above) and it is gone — the tape keeps playing with no control and no sign.'),
  (K[1], 'In the same reader, between the “+ Queue” and “Project” buttons of every paragraph.'),
  (K[2], 'Two more control strips stacked above the transport (mode, colours, “Put on the screens”, text language, options). Play is next to Take.'),
  (K[3], 'Small chips in the reader header open dialogs. There is no list of all recordings.'),
  (K[4], 'Nothing is shown. You must return to Sermons to pause.'),
  (K[5], 'Works (the verse goes live, the tape plays on) but nothing tells the operator the tape text is no longer on the screens.'),
  (K[6], 'The tape pauses and a notice appears — correct behaviour; but the bar that would say “paused for the video” is hidden unless you are in Sermons.'),
  (K[7], 'The three strips take about 38 % of a 1040×640 window; one paragraph is visible.'),
  (K[8], 'A “Tape” chip in the reader header; nothing elsewhere.'),
  (K[9], 'Space plays/pauses only inside the reader. Esc blanks and the tape keeps playing; Shift+Esc also pauses.'),
  (K[10], 'Unchanged in every option: phone Tape card (Play refused until started on the computer, no seek, confirmed jumps); stage monitor layout.')],
 'a': [
  ('Idea', 'Listening gets its own always-visible place: a transport bar at the bottom of EVERY section, and a “Tape” place in the left rail for recordings, follow view, timing and options. The Sermons reader goes back to being a reader.'),
  (K[0], 'App-wide bottom bar (one row, ~64 px) whenever a tape is loaded: title · ¶, ⏮ ⏪10 ⏯ 10⏩ ⏭, time, seek bar with paragraph ticks, sound output, and a “Text: on / not on the screens” button. Hidden when no tape is loaded.'),
  (K[1], 'Sermons reader: the same highlight, plus one small chip “Following the tape · ¶5” (click → Tape place). Clicking the ¶ NUMBER jumps the tape; clicking the paragraph does nothing to it (fewer accidents). The big follow view lives in the Tape place.'),
  (K[2], 'The bar button is the one-click “Put text on the screens”. Projection modes, colours and the Text / Tape language pickers are in the Tape place → Follow tab header and Options tab.'),
  (K[3], 'Tape place (rail): left = recordings list with status chips (Timed · Needs timing · File missing); right tabs = Follow · Timing (timeline, Tap, Suggest, Share) · Options · Add (file, folder, Get audio). Same dialogs/engines as today, new home.'),
  (K[4], 'The bar never moves or changes. The rail icon shows a small equaliser while playing. Everything else works exactly as before.'),
  (K[5], 'The verse goes live; the tape keeps playing. The bar button flips to “Text: not on the screens” and a toast offers “Back to the tape text”. Nothing changes what is live unless the operator takes it.'),
  (K[6], 'The tape pauses (existing rule). The bar shows “Paused for the video — Play to resume”.'),
  (K[7], 'Bar collapses to a compact row (title · ¶, play, time, screens button); the queue column hides behind a button; Tape place becomes one column.'),
  (K[8], 'Tape rail icon; a sermon without a recording shows “Add a recording” in its header; the Tape place has a friendly empty state with the three ways to add one.'),
  (K[9], 'Space plays/pauses when the bar or the Tape place is focused; ⌘/Ctrl+Shift+P toggles from anywhere. Esc blanks, the tape keeps playing; Shift+Esc also pauses (shown as a hint in the bar tooltip).'),
  (K[10], 'Unchanged: phone Tape card and rules; stage monitor layout; the bar mirrors what the phone can do plus seek.')],
 'b': [
  ('Idea', 'The tape is a MODE the operator enters: a dedicated “Tape service” workspace started from a sermon, with a big follow-along transcript and everything for the tape in one screen. Outside it, only a small mini-bar remains.'),
  (K[0], 'Inside the workspace: large transport at the bottom. Elsewhere: a mini-bar in the top bar (⏯, ¶, time); click it to return. No seek or skip outside the workspace — deliberately minimal.'),
  (K[1], 'The workspace IS the follow view (large, centred, one paragraph per row); the Sermons reader has no tape UI except “Open in Tape service”.'),
  (K[2], 'Right panel of the workspace: modes, “Put text on the screens”, jump-to-paragraph, next paragraph with countdown. Language chips in its header.'),
  (K[3], 'Workspace header menus: Recordings ▾, Timing…, Options….'),
  (K[4], 'The mini-bar in the top bar stays; play/pause only. To skip a paragraph the operator must go back to the workspace.'),
  (K[5], 'Verse goes live; the workspace right panel shows “Text off the screens”; mini-bar unchanged.'),
  (K[6], 'The tape pauses; mini-bar shows paused.'),
  (K[7], 'Workspace becomes one column (right panel under the transcript); mini-bar shrinks to an icon.'),
  (K[8], 'Rail item “Tape” and an “Open in Tape service” button on any sermon with a recording; first run opens a short tour inside the workspace.'),
  (K[9], 'Inside: Space play/pause, J/K ±10 s, ←/→ previous/next ¶. Outside: only the mini-bar. Esc as before.'),
  (K[10], 'Unchanged.')],
 'c': [
  ('Idea', 'The tape is a docked panel (inspector) on the right, toggled from any section with a button or the T key. It sits beside the queue as a tab, under which the Preview/Live pair stays.'),
  (K[0], 'Right dock tab “Tape” (340 px): large transport, seek bar, now-playing paragraph, next six paragraphs to jump to. Collapsed, the tab shows an equaliser and play state.'),
  (K[1], 'Sermons reader highlights the paragraph (as today, without the control strips); the dock shows the same paragraph and the next ones.'),
  (K[2], 'In the dock: mode buttons and “Put text on the screens”. Language pickers and options in the dock footer menu.'),
  (K[3], 'Dock footer: Recordings…, Timing…, Options… (sheets/dialogs, as today).'),
  (K[4], 'The dock is available in every section, but it shares the right column with the queue: you see the queue OR the tape, with the other as a slim tab.'),
  (K[5], 'The Preview/Live pair sits right under the dock, so the operator sees the verse go live next to the tape controls.'),
  (K[6], 'The tape pauses; the dock says so.'),
  (K[7], 'The right column hides at narrow widths; the dock becomes a bottom sheet toggled by T.'),
  (K[8], 'A “Tape” button in the top bar; hint on the first recording.'),
  (K[9], 'T toggles the dock; Space controls the tape when the dock has focus. Esc as before.'),
  (K[10], 'Unchanged.')],
 'd': [
  ('Idea', 'The tape is an ITEM in the service plan, where the operator already runs the order of service (Welcome → Song → Scripture → Tape → Offering). The plan is visible in every section, so the tape controls are too.'),
  (K[0], 'The tape item in the queue expands into a transport (play/pause, ¶ skip, seek, sync pill). The queue column is always on the right; no new global bar.'),
  (K[1], 'Sermons reader highlights the paragraph and shows “Tape is in the plan · ¶5”. The plan row shows the current ¶.'),
  (K[2], 'On the tape row: mode buttons and “Put text on the screens”; languages in the row menu.'),
  (K[3], 'Media gets a “Recordings” tab (library, add, folder). Row menu: Timing…, Options…, Replace recording. “+ Add to plan → Tape recording”.'),
  (K[4], 'The plan stays visible in every section, with the tape row playing.'),
  (K[5], 'A verse is another plan item; taking it puts it live and the tape row shows “playing in the background”.'),
  (K[6], 'The tape pauses; its row says so.'),
  (K[7], 'The plan collapses to a bottom drawer; the tape row becomes a one-line mini-bar.'),
  (K[8], 'It appears where the operator plans the service; first-time hint on “+ Add to plan”.'),
  (K[9], 'Next/Previous walk the plan; Space plays/pauses the tape when its row is focused.'),
  (K[10], 'The phone queue shows the tape item with the phone controls. Needs a new queue item kind, so older BORN files need the “unknown item” safety.')]
}

SLUG = {'today': '12-placement-today', 'a': '13-option-a-now-playing-bar', 'b': '14-option-b-tape-workspace', 'c': '15-option-c-docked-panel', 'd': '16-option-d-service-plan'}

def option_page(opt):
    return build(opt, NOTES[opt])

CRIT = ['Reachable from any section mid-service', 'Play kept apart from Take / Project', 'Reader stays a clean reader', 'Fits the app’s existing structure', 'Setup and library easy to find', 'Works at 1040×640', 'Easy to discover']
SCORES = {'today': [1, 1, 1, 2, 2, 1, 2], 'a': [5, 5, 5, 4, 5, 4, 5], 'b': [3, 5, 5, 3, 4, 4, 3], 'c': [4, 4, 4, 3, 3, 3, 4], 'd': [4, 3, 4, 5, 3, 3, 3]}
EFFORT = {'today': ('—', '—'), 'a': ('M', 'Low'), 'b': ('M–L', 'Medium'), 'c': ('S–M', 'Medium'), 'd': ('L', 'Medium–high')}
SUMMARY = {'today': 'Tape controls only inside the Sermons reader.',
           'a': 'Bottom transport bar in every section + a “Tape” place in the rail. Reader stays clean.',
           'b': 'A focused “Tape service” workspace; a mini-bar elsewhere.',
           'c': 'A right-hand dock (T) beside the queue.',
           'd': 'The tape is an item in the service plan.'}

def dots(n):
    return '<span class="dots">' + ''.join('<i class="%s"></i>' % ('f' if k < n else '') for k in range(5)) + '</span>'

COMPARE_CSS = r"""
body{overflow:auto}.cmp{max-width:1440px;margin:0 auto;padding:22px 20px 70px}
.cmp h1{font-size:26px;margin:0 0 4px}.cmp .lead{color:var(--ba-text-2);max-width:900px;margin:0 0 18px}
.cmp .scn{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}.cmp .scn button{height:30px;padding:0 12px;border-radius:15px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);color:var(--ba-text-1);font:600 13px var(--ba-font);cursor:pointer}.cmp .scn button.on{background:var(--ba-accent);color:var(--ba-on-accent);border-color:var(--ba-accent)}.cmp .scn .th{margin-left:auto;display:flex;gap:4px}
.cmp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.cmp-col{background:var(--ba-bg-1);border:1px solid var(--ba-line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}
.cmp-col.rec{border-color:var(--ba-accent);box-shadow:0 0 0 1px var(--ba-accent)}
.cmp-col h3{font-size:14px;margin:0}.cmp-col p{margin:0;color:var(--ba-text-2);font-size:12.5px;min-height:34px}
.cmp-view{width:100%;aspect-ratio:1360/820;overflow:hidden;border-radius:8px;border:1px solid var(--ba-line-strong);position:relative;display:block}
.cmp-view iframe{width:1360px;height:820px;border:0;transform-origin:0 0;pointer-events:none;background:var(--ba-bg-0)}
.cmp table{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:22px;font-size:14px}.cmp th,.cmp td{padding:9px 10px;border-bottom:1px solid var(--ba-line);text-align:left}.cmp th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ba-text-3)}.cmp td.c,.cmp th.c{text-align:center}
.dots{display:inline-flex;gap:3px}.dots i{display:block;flex:none;width:9px;height:9px;border-radius:50%;background:var(--ba-bg-4);border:1px solid var(--ba-line-strong)}.dots i.f{background:var(--ba-accent);border-color:var(--ba-accent)}
.rec-col{background:var(--ba-accent-wash)}
"""

def compare_page():
    cols = ''
    for o in ['a', 'b', 'c', 'd', 'today']:
        slug = SLUG[o]
        cols += (f'<div class="cmp-col{" rec" if o == "a" else ""}"><h3>{OPT_NAMES[o]}{" ★" if o == "a" else ""}</h3><p>{SUMMARY[o]}</p>'
                 f'<a class="cmp-view" href="{slug}.html" target="_blank"><iframe data-slug="{slug}" title="{OPT_NAMES[o]}" loading="lazy"></iframe></a></div>')
    rows = ''.join('<tr><td>%s</td>%s</tr>' % (c, ''.join('<td class="c%s">%s</td>' % (' rec-col' if o == 'a' else '', dots(SCORES[o][k])) for o in ['a', 'b', 'c', 'd', 'today'])) for k, c in enumerate(CRIT))
    rows += '<tr><td>Build effort (S / M / L)</td>' + ''.join('<td class="c%s">%s</td>' % (' rec-col' if o == 'a' else '', EFFORT[o][0]) for o in ['a', 'b', 'c', 'd', 'today']) + '</tr>'
    rows += '<tr><td>Risk to existing code and files</td>' + ''.join('<td class="c%s">%s</td>' % (' rec-col' if o == 'a' else '', EFFORT[o][1]) for o in ['a', 'b', 'c', 'd', 'today']) + '</tr>'
    head = '<tr><th></th>' + ''.join('<th class="c">%s</th>' % OPT_NAMES[o].split(' · ')[0] for o in ['a', 'b', 'c', 'd', 'today']) + '</tr>'
    body = (f'<div class="cmp"><h1>Where does the tape live? — side by side</h1><p class="lead">The same moment in every option: the tape is playing and the operator has moved on. Pick a situation; each frame is the real clickable mockup (click a frame to open it). ★ = recommended.</p>'
            f'<div class="scn"><button data-s="songs" class="on">Tape playing, operator on Songs</button><button data-s="verse">A verse goes on the screens mid-tape</button><button data-s="video">A video starts</button><button data-s="narrow">Narrow window (1040×640)</button>'
            f'<span class="th"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></span></div>'
            f'<div class="cmp-grid">{cols}</div><table>{head}{rows}</table>'
            f'<p class="lead" style="margin-top:14px">Dots = how well the option does (5 is best). Effort and risk are for rebuilding the tape UI from today’s build; the audio engine, sync maps, aligner, projection pages and phone/API rules are reused unchanged in every option.</p></div>'
            '''<script>
const F=[...document.querySelectorAll('iframe')];
function load(s,theme){F.forEach(f=>{const q=s==='narrow'?'scene=songs&narrow=1':'scene='+s;f.src=f.dataset.slug+'.html?'+q+'&embed=1&theme='+(theme||document.documentElement.dataset.theme);const v=f.parentElement;f.style.transform='scale('+((v.getBoundingClientRect().width||440)/1360)+')'})}
let cur='songs';
document.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{cur=b.dataset.s;document.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('on',x===b));load(cur)}));
document.querySelectorAll('.th button').forEach(b=>b.addEventListener('click',()=>{document.documentElement.dataset.theme=b.dataset.themeBtn;document.querySelectorAll('.th button').forEach(x=>x.classList.toggle('on',x===b));load(cur,b.dataset.themeBtn)}));
const qs=new URLSearchParams(location.search);if(qs.get('s'))cur=qs.get('s');if(qs.get('theme')){document.documentElement.dataset.theme=qs.get('theme')}
window.addEventListener('load',()=>load(cur));window.addEventListener('resize',()=>load(cur));
</script>''')
    return page_html('Where does the tape live? — compared', body, COMPARE_CSS)

def page_html(title, body, css):
    body = body + "<script>(function(){var t=document.documentElement.dataset.theme||'dark';document.querySelectorAll('[data-theme-btn]').forEach(function(b){b.classList.toggle('on',b.dataset.themeBtn===t)})})()</script>"
    return page(title, body, theme='dark', cls='', extra_css=SA_CSS + css)

# ---------------- recommended option (A) at higher fidelity ----------------
def bar_static(kind):
    k = {
     'stopped': dict(t='No tape loaded', sub='Choose a recording in the Tape place', play=False, pill=('', ''), time=('–:––:––', '–:––:––'), dis=True),
     'playing': dict(t=TITLE.split(' (')[0] + ' · ¶5', sub='Playing · 1×', play=True, pill=('ok', 'In sync'), time=('0:07:43', '-1:44:03')),
     'paused': dict(t=TITLE.split(' (')[0] + ' · ¶5', sub='Paused', play=False, pill=('ok', 'In sync'), time=('0:07:43', '-1:44:03')),
     'stalled': dict(t=TITLE.split(' (')[0] + ' · ¶5', sub='The sound has stopped moving', play=True, pill=('warn', 'Sound stopped'), time=('0:07:43', '-1:44:03'), note='Press Pause, then Play. If it does not recover, check the sound output.'),
     'device': dict(t=TITLE.split(' (')[0] + ' · ¶5', sub='Paused — the sound output was unplugged', play=False, pill=('bad', 'Output lost'), time=('0:07:43', '-1:44:03'), note='“Sanctuary speakers” is not connected. Plug it in, choose it again, press Play.', out='Choose output…'),
     'video': dict(t=TITLE.split(' (')[0] + ' · ¶5', sub='Paused for the video — Play to resume', play=False, pill=('warn', 'Paused for video'), time=('0:07:43', '-1:44:03')),
     'notiming': dict(t='Sunday message · no timing', sub='Plays, but the text cannot follow it', play=False, pill=('warn', 'No timing'), time=('0:00:00', '-0:48:10'), note='Open the Timing tab to tap-sync it, or let Suggest timing propose it.'),
    }[kind]
    dis = ' disabled style="opacity:.45"' if k.get('dis') else ''
    pill = f'<span class="sync {k["pill"][0]}"><span class="dot"></span>{k["pill"][1]}</span>' if k['pill'][1] else ''
    play = ic('pause') if k['play'] else ic('play')
    note = f'<div style="padding:0 16px 8px;font-size:13px;color:var(--ba-{"danger" if kind=="device" else "warn"})">{k["note"]}</div>' if k.get('note') else ''
    out = k.get('out', 'Sanctuary speakers')
    return (f'<div style="background:var(--ba-bg-1);border:1px solid var(--ba-line);border-radius:10px;overflow:hidden"><div style="display:flex;align-items:center;gap:14px;padding:8px 16px">'
            f'<div style="min-width:230px"><div class="caps" style="display:flex;gap:6px;align-items:center">{ic("headphones","sm")} Tape</div><div style="font-weight:700;white-space:nowrap">{k["t"]}</div><div class="sub-i">{k["sub"]}</div></div>'
            f'<div class="row" style="gap:8px"><button class="sk"{dis}>{ic("prev")}</button><button class="sk"{dis}>{ic("back10")}10</button><button class="play"{dis}>{play}</button><button class="sk"{dis}>10{ic("fwd10")}</button><button class="sk"{dis}>{ic("next")}</button></div>'
            f'<span class="tc">{k["time"][0]}</span><div class="seek" style="flex:1"><div class="trk"></div><div class="fill" style="width:{0 if k.get("dis") else 7}%"></div></div><span class="tc r">{k["time"][1]}</span>{pill}'
            f'<span class="chip">{ic("speaker","sm")} {out}</span><button class="btn sm"{dis}>{ic("monitor","sm")} Text: not on the screens</button></div>{note}</div>')

REC_CSS = r"""
body{overflow:auto}.wrap{max-width:1360px;margin:0 auto;padding:22px 24px 70px;display:flex;flex-direction:column;gap:18px}
h1{font-size:26px;margin:0}.lead{color:var(--ba-text-2);max-width:940px;margin:0}
.th{display:flex;gap:4px;margin-left:auto}.th button{height:26px;padding:0 10px;border-radius:13px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);color:var(--ba-text-1);font:700 11px var(--ba-font);cursor:pointer}.th button.on{background:var(--ba-accent);color:var(--ba-on-accent);border-color:var(--ba-accent)}
.lab{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ba-text-3);font-weight:700;margin:2px 0 6px}
.frame{border:1px solid var(--ba-line-strong);border-radius:10px;overflow:hidden;background:var(--ba-bg-0)}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.cardx{background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-md);padding:12px 14px}.cardx.cur{border-color:var(--ba-accent);background:var(--ba-accent-wash)}
.lvbox{background:#000;border:1px solid var(--ba-line-strong);border-radius:8px;height:130px;overflow:hidden;color:#f4f2ee;padding:12px 14px;font:400 15px/1.45 var(--ser);position:relative}.lvbox.live{border-color:var(--ba-live)}
.mlab{display:flex;align-items:center;gap:6px;font:700 10.5px var(--ba-font);letter-spacing:.08em;text-transform:uppercase;color:var(--ba-text-3);margin-bottom:4px}.mlab.lv{color:var(--ba-live)}
.row{display:flex;align-items:center;gap:10px}.sp1{flex:1}.sub-i{font-size:12px;color:var(--ba-text-3)}
.tick{background:var(--ba-line-strong)}
.pphone{width:340px;border:1px solid var(--ba-line-strong);border-radius:34px;padding:14px;background:var(--ba-bg-0);box-shadow:var(--ba-shadow-3);display:flex;flex-direction:column;gap:10px}
.tbtn2{flex:none;height:46px;border-radius:12px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);color:var(--ba-text-1);font:700 14px var(--ba-font);flex:1}
.tbtn2.main{width:100%;background:var(--ba-accent);color:var(--ba-on-accent);border-color:var(--ba-accent);font-size:17px;height:52px}
"""

def rec_states():
    order = [('stopped', 'Stopped / nothing loaded'), ('playing', 'Playing'), ('paused', 'Paused'), ('stalled', 'Stalled (the sound stopped moving)'), ('device', 'Sound output lost'), ('video', 'Paused for a video'), ('notiming', 'Recording without timing')]
    bars = ''.join(f'<div><div class="lab">{t}</div>{bar_static(k)}</div>' for k, t in order)
    empty = (f'<div class="frame" style="padding:40px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center"><div style="width:64px;height:64px;border-radius:16px;background:var(--ba-bg-3);display:grid;place-items:center">{ic("headphones","lg")}</div>'
             f'<div class="h">No recordings yet</div><div class="dim" style="max-width:520px">Add a recorded sermon and Born Again will play it and keep the text in step — on your screen, the congregation screen, the stage monitor and the phone. Everything stays on this computer.</div>'
             f'<div class="row"><button class="btn pri">{ic("folder","sm")} Choose a file…</button><button class="btn">Look in my Tape audio folder</button><button class="btn ghost">{ic("globe","sm")} Get audio</button></div><div class="sub-i">Tip: file names like “65-0418M It Is The Rising Of The Sun.m4a” are matched to the sermon automatically.</div></div>')
    return page_html('Recommended: transport states and first-time state', f'<div class="wrap"><div class="row"><h1>Recommended (A) — transport states and the first-time state</h1><div class="th"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></div></div><p class="lead">The bottom bar is the same one-row control in every section. Colour carries meaning (green = fine, amber = needs a look, red = lost); words always say it too.</p>{bars}<div class="lab">First-time empty state (Tape place, no recordings)</div>{empty}</div><script>document.addEventListener("click",e=>{{const t=e.target.closest("[data-theme-btn]");if(t){{document.documentElement.dataset.theme=t.dataset.themeBtn;document.querySelectorAll("[data-theme-btn]").forEach(b=>b.classList.toggle("on",b===t))}}}});var q=new URLSearchParams(location.search).get("theme");if(q)document.documentElement.dataset.theme=q</script>', REC_CSS)

def rec_library():
    rows = [('A Sample Message (placeholder text)', '99-0101M', '1:52:46', 'M4A · on this computer', 'ok', 'Timed'), ('Sunday message (placeholder)', '00-0001M', '0:48:10', 'MP3 · on this computer', 'warn', 'Needs timing'), ('Wednesday evening (placeholder)', '00-0002M', '1:15:02', 'FLAC · USB drive not connected', 'bad', 'File missing'), ('Easter message (placeholder)', '00-0003M', '1:31:40', 'WAV · on this computer', 'ok', 'Timed')]
    trs = ''.join(f'<tr><td>{ic("headphones","sm")} <b>{n}</b><div class="sub-i">{c}</div></td><td class="mono">{d}</td><td class="dim">{f}</td><td><span class="chip {s}">{ic("check" if s=="ok" else "warn","sm")} {l}</span></td><td><button class="btn sm">{"Open" if s=="ok" else "Fix…"}</button></td></tr>' for n, c, d, f, s, l in rows)
    lib = (f'<div class="frame"><div style="padding:14px 18px;border-bottom:1px solid var(--ba-line);display:flex;align-items:center;gap:12px"><div><div class="caps">Tape</div><div class="h">Recordings</div></div><span class="sp1"></span><button class="btn pri">{ic("folder","sm")} Add a recording</button><button class="btn">Tape audio folder…</button></div>'
           f'<table class="tbl" style="width:100%"><tr><th>Recording</th><th>Length</th><th>File</th><th>Status</th><th></th></tr>{trs}</table>'
           f'<div style="padding:12px 18px;border-top:1px solid var(--ba-line)"><div class="caps" style="margin-bottom:6px">Your “Tape audio” folder · /Users/you/Tape audio</div><div class="row"><span class="chip ok">{ic("check","sm")} 3 files matched by their date code</span><span class="chip warn">{ic("warn","sm")} 1 needs you to confirm</span><span class="sp1"></span><button class="btn sm ghost">Look again</button></div></div></div>')
    detail = (f'<div class="grid2"><div><div class="lab">Recording detail · Add tab</div><div class="cardx"><b>Add a recording</b><div class="dim" style="margin:6px 0 10px">Drop a file here, choose your Tape audio folder, or open the publisher’s page to get one. Born Again keeps its own copy, so a missing USB stick never breaks a service.</div><div class="row"><button class="btn sm pri">Choose a file…</button><button class="btn sm">Look in my Tape audio folder</button><button class="btn sm ghost">{ic("globe","sm")} Get audio</button></div>'
              f'<div class="cardx" style="margin-top:12px"><b>Checking 99-0101M A Sample Message.m4a</b><div class="row" style="margin-top:6px;flex-wrap:wrap;gap:12px">{"".join(f"<span class=chip>{ic(chr(99)+chr(104)+chr(101)+chr(99)+chr(107),chr(115)+chr(109))} {x}</span>" for x in ["The file is there","Whole file (not cut short)","Length 1:52:46 fits the sermon","Timing for 20 paragraphs"])}</div></div></div></div>'
              f'<div><div class="lab">Recording detail · Timing tab</div><div class="cardx"><div class="caps">Timeline</div><div style="height:70px;position:relative;background:var(--ba-bg-1);border:1px solid var(--ba-line);border-radius:8px;overflow:hidden;margin:8px 0">'
              + ''.join(f'<i style="position:absolute;bottom:0;left:{p[0]/TOTAL*100:.2f}%;width:3px;height:{20+(k*37)%40}px;background:var(--ba-text-3);opacity:.5"></i>' for k, p in enumerate(PARAS)) + f'<b style="position:absolute;top:0;bottom:0;left:7%;width:2px;background:var(--ba-accent)"></b></div><div class="row"><button class="btn sm pri">{ic("tap","sm")} Tap to sync</button><button class="btn sm">{ic("wand","sm")} Suggest timing</button><button class="btn sm ghost">Share timing</button><span class="sp1"></span><span class="sync"><span class="dot"></span>20 of 20 timed</span></div></div></div></div>')
    return page_html('Recommended: the Tape place — recordings library', f'<div class="wrap"><div class="row"><h1>Recommended (A) — the Tape place: recordings library</h1><div class="th"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></div></div><p class="lead">One place that lists every recording, whether it is ready, and where to add, time or fix it. It replaces the small chips and dialogs hidden in the reader.</p>{lib}{detail}</div><script>document.addEventListener("click",e=>{{const t=e.target.closest("[data-theme-btn]");if(t){{document.documentElement.dataset.theme=t.dataset.themeBtn;document.querySelectorAll("[data-theme-btn]").forEach(b=>b.classList.toggle("on",b===t))}}}});var q=new URLSearchParams(location.search).get("theme");if(q)document.documentElement.dataset.theme=q</script>', REC_CSS)

def rec_live():
    def pair(title, cur, nxt, kind, note):
        return (f'<div class="cardx" style="display:flex;flex-direction:column;gap:10px"><div class="caps">{title}</div><div class="grid2" style="gap:10px"><div><div class="mlab">Preview · next</div><div class="lvbox">{nxt}</div></div><div><div class="mlab lv"><span class="dot"></span>Live · Main <span class="sp1"></span><span class="chip" style="height:20px;font-size:11px">{kind}</span></div><div class="lvbox live">{cur}</div></div></div>'
                f'<div class="row"><button class="btn pri" style="flex:1;justify-content:center">Take</button><button class="btn" style="flex:1;justify-content:center">Clear</button></div><div class="sub-i">{note}</div></div>')
    a = pair('1 · The tape’s text is on the screens', DATA_P(4), 'Next: ' + DATA_P(5, 90), 'Tape text', 'Live shows the paragraph being spoken, exactly as the screens do. Preview shows what comes next. Play lives in the bottom bar, far from Take.')
    b = pair('2 · A verse is taken mid-tape', '“For God so loved the world, that he gave his only begotten Son…” — John 3:16', 'Next: the tape’s text, ¶6', 'Verse', 'The tape keeps playing. Nothing puts the tape text back unless the operator takes it. The bar button says “Text: not on the screens”.')
    bar_a = f'<div class="lab">Bar in state 1</div>{bar_static("playing").replace("Text: not on the screens", "Text: on the screens")}'
    bar_b = f'<div class="lab">Bar in state 2</div>{bar_static("playing")}'
    return page_html('Recommended: Preview / Live with a tape', f'<div class="wrap"><div class="row"><h1>Recommended (A) — Preview / Live with a tape running</h1><div class="th"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></div></div><p class="lead">Take is for what the congregation sees; Play is for sound. They are different controls in different places, so one cannot be mistaken for the other under pressure.</p><div style="display:flex;flex-direction:column;gap:14px">{a}{bar_a}<div style="height:8px"></div>{b}{bar_b}</div></div><script>document.addEventListener("click",e=>{{const t=e.target.closest("[data-theme-btn]");if(t){{document.documentElement.dataset.theme=t.dataset.themeBtn;document.querySelectorAll("[data-theme-btn]").forEach(b=>b.classList.toggle("on",b===t))}}}});var q=new URLSearchParams(location.search).get("theme");if(q)document.documentElement.dataset.theme=q</script>', REC_CSS)

def DATA_P(i, n=170):
    t = PARAS[i][1]
    return t[:n] + ('…' if len(t) > n else '')

def rec_phone_ready():
    ph = (f'<div class="pphone"><div class="row"><b>Born <span style="color:var(--ba-accent);font-weight:300">Again</span></b><span class="sp1"></span><span class="sync"><span class="dot"></span>Connected</span></div>'
          f'<div class="cardx"><div class="row"><span class="caps">Tape</span><span class="sync"><span class="dot"></span>In sync</span><span class="sp1"></span><b class="mono">0:07:43 −1:44:03</b></div></div>'
          f'<button class="tbtn2 main">Pause</button><div class="row"><button class="tbtn2">¶ ‹</button><button class="tbtn2">−10 s</button><button class="tbtn2">+10 s</button><button class="tbtn2">› ¶</button></div>'
          f'<div class="row"><button class="tbtn2">−</button><span class="dim" style="flex:2;text-align:center">Volume 60%</span><button class="tbtn2">+</button></div>'
          + ''.join(f'<div class="cardx{" cur" if k == 4 else ""}" style="padding:8px 10px;font-size:13px"><b>¶{k+1}</b> {PARAS[k][1][:54]}…</div>' for k in range(2, 8)) + '<div class="sub-i" style="text-align:center">Play stays off until it has been started on the computer. No seek bar. A tap on a paragraph asks first.</div></div>')
    ready = (f'<div class="frame" style="padding:16px 18px;display:flex;flex-direction:column;gap:10px"><div class="row"><div class="h">Is tonight ready?</div><span class="sp1"></span><span class="chip warn">{ic("warn","sm")} 2 to check</span></div>'
             f'<div class="cardx row"><span class="chip ok">{ic("check","sm")} OK</span><div><b>Song · Amazing Grace</b><div class="sub-i">Words and key are there</div></div></div>'
             f'<div class="cardx row"><span class="chip ok">{ic("check","sm")} OK</span><div><b>Tape for “A Sample Message”</b><div class="sub-i">The recording is there · whole file · length fits · timing for 20 paragraphs · sound output “Sanctuary speakers” is plugged in</div></div></div>'
             f'<div class="cardx row" style="border-color:var(--ba-warn)"><span class="chip warn">{ic("warn","sm")} Check</span><div style="flex:1"><b>Tape for “Sunday message”: it has no timing yet</b><div class="sub-i">It will play, but the text cannot follow it.</div></div><button class="btn sm">Open Timing</button></div>'
             f'<div class="cardx row" style="border-color:var(--ba-danger)"><span class="chip bad">{ic("warn","sm")} Fix</span><div style="flex:1"><b>Tape for “Wednesday evening”: the recording file cannot be found</b><div class="sub-i">Its USB drive is not connected.</div></div><button class="btn sm">Find the file…</button></div></div>')
    return page_html('Recommended: phone and Is tonight ready', f'<div class="wrap"><div class="row"><h1>Recommended (A) — the phone and “Is tonight ready?”</h1><div class="th"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></div></div><p class="lead">The phone and the readiness check do not change with the placement — they are shown here so the whole feature can be judged together.</p><div style="display:grid;grid-template-columns:380px 1fr;gap:24px;align-items:start"><div><div class="lab">Phone</div>{ph}</div><div><div class="lab">Is tonight ready? (tape rows)</div>{ready}</div></div></div><script>document.addEventListener("click",e=>{{const t=e.target.closest("[data-theme-btn]");if(t){{document.documentElement.dataset.theme=t.dataset.themeBtn;document.querySelectorAll("[data-theme-btn]").forEach(b=>b.classList.toggle("on",b===t))}}}});var q=new URLSearchParams(location.search).get("theme");if(q)document.documentElement.dataset.theme=q</script>', REC_CSS)

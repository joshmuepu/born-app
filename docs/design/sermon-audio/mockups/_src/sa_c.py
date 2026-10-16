from sa_common import *

def states():
    cards = [
     ('Audio file missing', 'danger', 'blank', 'The tape file isn’t on this computer any more (the drive may be unplugged). The screens keep showing the last paragraph.', 'Find the file…', 'Preflight, operator bar, phone'),
     ('File cut short', 'danger', 'warn', 'This recording is incomplete (1:12:03 of 1:52:46). It will play up to there. Download it again from the source, or play what there is.', 'Choose another file…', 'Attach dialog, preflight'),
     ('Text and tape don’t match', 'warn', 'flag', 'From paragraph 113 the tape and the text may not line up (the text has 2 fewer paragraphs). Check the list before the service.', 'See the differences', 'Preflight, sync editor'),
     ('Sound device lost', 'danger', 'unplug', '“Sanctuary speakers” was unplugged. The tape paused so nothing plays into the wrong room. Choose where to play it.', 'Choose output…', 'Operator bar, phone'),
     ('Out of step (drift)', 'warn', 'clock', 'The screens were 2.4 s away from the sound for 10 s. They have been put back in step. If it happens again, check the computer’s load.', 'Re-sync now', 'Operator bar, stage monitor'),
     ('Screens blanked, tape playing', 'warn', 'blank', 'Someone pressed Esc. The words are hidden; the tape is still playing at 0:21:04. Esc again shows them where the tape is now.', 'Show the screens', 'Operator bar, phone, stage'),
     ('Tape ended', 'ok', 'check', 'The tape finished at 1:52:46. The last paragraph stays on the screen until you clear it.', 'Clear the screen', 'Operator bar'),
     ('No timing for this recording', 'warn', 'tap', 'This tape has no paragraph timing yet, so the text can’t follow it. You can still play it, or sync it now (about 10 minutes the first time).', 'Tap to sync…', 'Attach dialog, preflight, reader'),
    ]
    html = ''.join(f'<div class="cardfix" style="--c:var(--ba-{c})"><div class="hd">{ic(i)} {t}</div><p>{m}</p><div class="ft"><button class="btn sm pri">{f}</button><span class="where">Shown in: {w}</span></div></div>' for t, c, i, m, f, w in cards)
    return full_page('Error and warning states', f'<div class="sheet"><div class="cap"><b>Warnings and errors — plain words, one button each.</b> Each says what happened, what the screens are doing now, and the one thing to press. Nothing here changes what is live by itself.</div><div class="row4" style="grid-template-columns:repeat(4,1fr)">{html}</div></div>')

def settings():
    row = lambda l, c: f'<label>{l}</label><div>{c}</div>'
    seg = lambda *a: '<span class="seg">' + ''.join(f'<button{" class=on" if k==0 else ""}>{x}</button>' for k, x in enumerate(a)) + '</span>'
    rng = lambda p: f'<span class="range"><i style="width:{p}%"></i><b style="left:{p}%"></b></span>'
    body = f"""<div class="sheet" style="max-width:1100px"><div class="cap"><b>Settings → Tape service.</b> Defaults are the safe ones. Every option applies to the next tape, never to what is on the screen right now.</div>
<div class="row2" style="align-items:start"><div class="scard"><h3>{ic("eye")} How the screens follow</h3><div class="kv">
{row('Projector view', seg('Highlight','One at a time','Lower third'))}
{row('Show next paragraph early', rng(40) + ' <b>4 s</b>')}
{row('Highlight style', seg('Bright + dim','Bar','Number only'))}
{row('Scroll', seg('Glide','Step'))} 
{row('Text size', rng(60) + ' <b>Auto-fit</b>')}
{row('Start the screens when the tape starts', '<span class="toggle on"><i></i>Show the sermon text</span>')}
</div></div>
<div class="scard"><h3>{ic("headphones")} Sound</h3><div class="kv">
{row('Play the tape on', '<div class="f">'+ic("speaker","sm")+' Sanctuary speakers '+ic("chevd","sm")+'</div>')}
{row('Speed range', seg('0.8–1.25×','0.9–1.1×','Off'))}
{row('Volume when a video plays', seg('Tape pauses','Tape off'))}
{row('Auto-resume', '<span class="toggle on"><i></i>Offer to continue where this tape stopped</span>')}
{row('If the sound device is lost', seg('Pause the tape','Switch to default'))}
</div></div>
<div class="scard"><h3>{ic("globe")} Language</h3><div class="kv">
{row('Default text language', '<div class="f">English '+ic("chevd","sm")+'</div>')}
{row('Use another language when numbering differs', seg('Ask me','Never','Always'))}</div></div>
<div class="scard"><h3>{ic("lock")} Safety</h3><div class="kv">
{row('Esc (blank the screens)', seg('Tape keeps playing','Also pauses'))}
{row('Phone: jump to a paragraph', seg('Ask first','Allow'))}
{row('Phone: first Play', '<span class="chip">Operator only</span>')}</div></div></div></div>"""
    return full_page('Tape service settings', body)

def storyboard():
    col = lambda n, t, items, c: f'<div class="scard" style="gap:12px"><div style="display:flex;align-items:center;gap:10px"><span class="step on" style="background:{c}">{n}</span><b class="h2">{t}</b></div>{items}</div>'
    li = lambda i, x, k='': f'<div style="display:flex;gap:10px;align-items:flex-start">{ic(i,"sm")}<span>{x}</span></div>'
    body = f"""<div class="sheet"><div class="cap"><b>A tape service on Sunday.</b> Prepared on Saturday, run with almost no touching, and safe when something goes wrong.</div>
<div class="row4">
{col(1,'Saturday: get ready',li('headphones','Attach the tape file to the sermon (once).')+li('tap','Tap to sync, or accept the proposed timing and check it (once per recording; 10–20 minutes).')+li('globe','Pick the text language.')+li('check','Open <b>Is tonight ready?</b>: file whole, plays, length fits, timing present, sound device found.')+li('play','Test-play 30 seconds on the real speakers.'),'var(--ba-ok)')}
{col(2,'Sunday: start',li('queue' if 'queue' in ICONS else 'list','Sermon with tape is in the queue.')+li('eye','Take it: the text appears on the screen, <b>paused</b>. No sound yet.')+li('play','Press Play. The tape starts; the text follows; the sync pill says <b>In sync</b>.')+li('sliders','Choose Highlight, One at a time or Lower third.'),'var(--ba-accent)')}
{col(3,'Mid-service: you step in',li('tap','Tap a paragraph in the reader (or on the phone): the tape jumps there; the screens follow.')+li('blank','Esc: the screens go blank, the tape keeps playing. Esc again: back, where the tape is.')+li('warn','A sound device unplugged: the tape pauses and says so. Pick the device, press Play.')+li('bell','An alert: shown on the stage monitor and the room as usual.'),'var(--ba-warn)')}
{col(4,'End: finish',li('check','Tape ends: the last paragraph stays until you Clear.')+li('doc','The place is remembered: next time, “Continue from 1:12:03?”.')+li('saved','Save the service: the tape and its timing travel with it.')+li('lock','Nothing was downloaded or streamed during the service.'),'var(--ba-live)')}</div></div>"""
    return full_page('Sunday storyboard', body)

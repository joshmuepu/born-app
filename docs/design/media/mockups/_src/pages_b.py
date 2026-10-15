from lib import *
from pages_a import queue_media, ITEMS, transport_live


# ------------------------------------------------------------------ 06 palette + context menu
def palette():
    base = app('Media', f'<div style="padding:18px"><div class="grid" style="padding:0">'
               + ''.join(f'<div class="card">{thumb(c,"",k,d,l)}<div class="nm">{n}</div><div class="mt">{m}</div></div>' for c, n, k, d, l, m in ITEMS[:6])
               + '</div></div>', queue=queue_media(live_idx=None))
    res = [('image', 'Media', 'Mission Trip — Kenya', '4:12 · Videos', True),
           ('image', 'Media', 'Mother’s Day Honour', 'Slideshow · 12 photos', False),
           ('zap', 'Action', 'Play next video', 'when one is staged', False),
           ('zap', 'Action', 'Show countdown 5:00', 'Timer', False),
           ('zap', 'Action', 'Blank to logo', 'Esc', False),
           ('book', 'Bible', 'Mark 4:39', 'Peace, be still', False)]
    rows = ''.join(f'<div class="mi {"on" if on else ""}" style="height:46px">{ic(i)}<div><div style="font-weight:600">{n}</div><div class="faint" style="font-size:12px">{s}</div></div><span class="chip" style="margin-left:auto">{k}</span></div>' for i, k, n, s, on in res)
    pal = (f'<div style="position:absolute;left:50%;top:92px;transform:translateX(-50%);width:640px" class="menu" >'
           f'<div class="field" style="height:48px;border-radius:10px;margin:2px 2px 8px;color:var(--ba-text-1)">{ic("search","lg")}<span style="font-size:17px">mission</span><span class="chip" style="margin-left:auto">Media · Bible · Songs · Sermons</span></div>'
           f'<div class="caps" style="padding:4px 10px">Best matches</div>{rows}'
           f'<div class="faint" style="padding:8px 10px;font-size:12px;display:flex;gap:14px"><span>↑↓ choose</span><span>Enter open in Preview</span><span>Shift+Enter add to queue</span><span>Opening never goes live</span></div></div>')
    scrim = '<div style="position:absolute;inset:0;background:var(--ba-scrim)"></div>'
    ctx = (f'<div class="menu" style="position:absolute;left:96px;top:330px;z-index:5"><div class="mi">{ic("eye")}Stage in Preview<kbd>Enter</kbd></div>'
           f'<div class="mi">{ic("plus")}Add to queue<kbd>Q</kbd></div><div class="mi">{ic("next")}Add next in queue</div>'
           f'<div class="mi">{ic("play")}Play now…<kbd>⇧ Enter</kbd></div><hr><div class="mi">{ic("image")}Use as background →</div>'
           f'<div class="mi">{ic("star")}Favorite</div><div class="mi">{ic("tag")}Tags…</div><div class="mi">{ic("link")}Show in folder</div><hr>'
           f'<div class="mi dg">{ic("trash")}Remove from library</div></div>')
    n1 = '<div class="note" style="left:96px;top:690px">Right-click, Menu key or Shift+F10. “Play now” asks first if something is live.</div>'
    return page('Palette and menus', f'<div style="position:relative;width:100%;height:100%">{base}{ctx}{n1}{scrim}{pal}</div>')


# ------------------------------------------------------------------ 07 alert / lower third / timer
def designer():
    tabs = '<div class="seg"><button>Lower third</button><button class="on">Countdown</button><button>Alert</button><button>Announcement</button></div>'
    prev = (f'<div class="ph p4" style="aspect-ratio:16/9;width:100%;border:1px solid var(--ba-line-strong)">'
            f'<div style="position:absolute;inset:0;display:grid;place-items:center"><div style="text-align:center;color:#fff"><div style="font-size:15px;letter-spacing:.2em;text-transform:uppercase;opacity:.85">Service begins in</div>'
            f'<div class="mono" style="font-size:110px;font-weight:700;letter-spacing:-.03em;line-height:1.05;text-shadow:0 4px 30px rgba(0,0,0,.5)">04:37</div></div></div>'
            f'<span class="badge tl">Safe area on</span></div>')
    form = (f'<div style="display:flex;flex-direction:column;gap:14px">'
            f'<div><div class="caps">Counts down to</div><div style="display:flex;gap:8px;margin-top:6px"><div class="field mono" style="flex:1">Today 9:30 AM</div><div class="seg"><button class="on">A time</button><button>A length</button></div></div></div>'
            f'<div><div class="caps">Label</div><div class="field" style="margin-top:6px;color:var(--ba-text-1)">Service begins in</div></div>'
            f'<div><div class="caps">When it reaches zero</div><div class="seg" style="margin-top:6px"><button>Show “00:00”</button><button class="on">Go to next item</button><button>Do nothing</button></div></div>'
            f'<div><div class="caps">Show on</div><div style="display:flex;gap:8px;margin-top:6px"><span class="chip on">Congregation</span><span class="chip on">Stage</span><span class="chip">Graphics</span><span class="chip">Overflow</span></div></div>'
            f'<div><div class="caps">Size</div><div class="vol" style="width:100%;margin-top:8px"><div class="bar"><i style="width:68%;background:var(--ba-accent)"></i></div></div></div></div>')
    designer = (f'<div style="flex:1;padding:18px 24px;display:flex;flex-direction:column;gap:16px;min-width:0">'
                f'<div style="display:flex;align-items:center;gap:12px"><span class="h">Designer</span>{tabs}<span style="flex:1"></span><button class="btn">Save as template</button><button class="btn pri">Add to queue</button></div>'
                f'<div style="display:grid;grid-template-columns:1fr 340px;gap:22px">{prev}{form}</div>'
                f'<div class="caps">Templates</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">'
                + ''.join(f'<div class="card {"sel" if i==0 else ""}">{thumb(c,t)}<div class="nm">{n}</div></div>' for i, (c, t, n) in enumerate([('p4', '04:37', 'Countdown — Plain'), ('p1', 'Anna Reyes', 'Lower third — Name'), ('p9', 'Nursery: #14', 'Alert — Nursery'), ('p5', 'Wrap up', 'Stage cue — Wrap up'), ('p6', '5 min', 'Stage cue — Time')]))
                + '</div></div>')
    # operator view on the right
    op = (f'<div style="width:410px;flex:none;border-left:1px solid var(--ba-line);background:var(--ba-bg-1);padding:16px;display:flex;flex-direction:column;gap:12px">'
          f'<div class="h2">Operator view</div><div class="caps">Alerts — one tap, always on top</div>'
          f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
          f'<button class="btn" style="height:58px;justify-content:center;border-color:var(--ba-warn);color:var(--ba-warn)">{ic("bell")} Nursery… <kbd>1</kbd></button>'
          f'<button class="btn" style="height:58px;justify-content:center">{ic("phone")} Silence phones <kbd>2</kbd></button>'
          f'<button class="btn" style="height:58px;justify-content:center">{ic("warn")} Move your car <kbd>3</kbd></button>'
          f'<button class="btn" style="height:58px;justify-content:center">{ic("plus")} Custom…</button></div>'
          f'<div class="banner" style="--c:var(--ba-live)">{ic("bell")}<div class="grow"><b>Alert on screen</b><div class="dim" style="font-size:13px">“Nursery: parents of #14” · clears in 0:08</div></div><button class="btn sm">Clear</button></div>'
          f'<div class="caps" style="margin-top:6px">Countdown</div>'
          f'<div class="panel" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:baseline;gap:10px"><span class="mono" style="font-size:42px;font-weight:700">04:37</span><span class="dim">to 9:30 AM</span></div>'
          f'<div style="display:flex;gap:8px"><button class="btn">{ic("pause")} Pause</button><button class="btn">+1 min</button><button class="btn">−1 min</button><button class="btn pri" style="margin-left:auto">{ic("eye")} Show</button></div></div>'
          f'<div class="caps" style="margin-top:6px">Lower third</div>'
          f'<div class="layer"><div style="flex:1"><b>Anna Reyes</b><div class="faint" style="font-size:12px">Worship leader</div></div><button class="btn sm pri">Show</button></div>'
          f'<div class="layer"><div style="flex:1"><b>Pastor Daniel Okafor</b><div class="faint" style="font-size:12px">Senior pastor</div></div><button class="btn sm">Show</button></div>'
          f'<div class="faint" style="font-size:12px">Layers on screen, bottom to top: background → content → lower third → alert. An alert always wins and always clears itself.</div></div>')
    return page('Alert, lower third and countdown', app('Media', f'<div style="display:flex;flex:1;min-height:0">{designer}{op}</div>'))


# ------------------------------------------------------------------ 08 preflight
def preflight():
    checks = [
        ('ok', 'All 7 items are in place', 'Every file found, thumbnails ready'),
        ('ok', 'Videos will play smoothly', 'Test-played the first and last 3 seconds of 2 videos'),
        ('warn', '“Mission Trip — Kenya” is 4K (3840×2160)', 'The Congregation projector is 1080p. A 1080p copy will play more smoothly.<br><u>Make a 1080p copy</u> · Use as is'),
        ('ok', 'Sound goes to “HDMI — Sanctuary”', 'Test tone available — plays only when you press it'),
        ('ok', 'Displays: Congregation, Stage found', 'Graphics output is running on port 4316'),
        ('bad', '“Easter Sunrise 2024.mp4” is missing', 'Used by “Welcome loop”.<br><u>Relink…</u> · Remove from this service'),
        ('warn', 'Rights: 1 item needs a licence note', '“Great Is Thy Faithfulness” video track — add your licence number, or skip'),
        ('ok', 'Disk space: 214 GB free · Memory fine', ''),
    ]
    col = {'ok': '--ba-ok', 'warn': '--ba-warn', 'bad': '--ba-danger'}
    ico = {'ok': 'check', 'warn': 'warn', 'bad': 'x'}
    rows = ''.join(f'<div class="layer" style="--c:var({col[k]});align-items:flex-start;padding:14px"><span style="color:var(--c);margin-top:1px">{ic(ico[k],"lg")}</span>'
                   f'<div style="flex:1"><div style="font-weight:600">{t}</div><div class="dim" style="font-size:13px;margin-top:2px">{d}</div></div></div>' for k, t, d in checks)
    left = (f'<div style="flex:1;padding:22px 28px;display:flex;flex-direction:column;gap:14px;min-width:0;overflow:hidden">'
            f'<div style="display:flex;align-items:center;gap:14px"><div><div class="h">Ready for Sunday?</div><div class="dim">Sunday service · 9:30 AM · 7 items · checked just now</div></div><span style="flex:1"></span>'
            f'<button class="btn">{ic("play")} Test-play videos</button><button class="btn pri">Check again</button></div>'
            f'<div class="banner" style="--c:var(--ba-danger)">{ic("warn","lg")}<div class="grow"><b>1 problem and 2 suggestions.</b> Fix the missing file, or remove that item — the rest is ready.</div></div>'
            f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">{rows}</div></div>')
    q = queue_media()
    return page('Preflight check', app('Media', left, queue=q.replace('chip ok">' + ic('check', 'sm') + ' Ready', 'chip bad">' + ic('x', 'sm') + ' 1 problem')))


# ------------------------------------------------------------------ 09 remote
def remote():
    def phone_portrait():
        return (f'<div class="phone"><div style="padding:12px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--ba-line)">{FLAME.replace("<svg","<svg width=22 height=22")}<b>Born</b><span style="color:var(--ba-accent)">Again</span><span style="flex:1"></span><span class="chip ok"><span class="dot"></span>Connected</span></div>'
                f'<div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0">'
                f'<div class="mon lv"><div class="lb"><span class="dot"></span> Live · video</div><div class="scr">{thumb("p2","","video")}</div></div>'
                f'<div class="panel" style="padding:12px"><div class="tcs"><div class="big" style="font-size:34px">1:12</div><div class="rem">−3:00</div></div>'
                f'<div class="scrub"><div class="tr"></div><div class="fl" style="width:29%"></div><div class="hd" style="left:29%"></div></div>'
                f'<div style="font-size:12px" class="faint">Seeking from the phone is off — only the booth can scrub.</div></div>'
                f'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr);gap:10px"><button class="btn" style="height:64px;justify-content:center">{ic("prev","lg")}</button>'
                f'<button class="btn pri" style="height:64px;justify-content:center">{ic("pause","lg")} Pause</button><button class="btn" style="height:64px;justify-content:center">{ic("next","lg")}</button></div>'
                f'<button class="btn" style="height:56px;justify-content:center">{ic("blank")} Blank screen</button>'
                f'<div class="banner" style="--c:var(--ba-media)">{ic("vol")}<div class="grow"><b>Sound</b> — volume and mute stay on the computer.</div></div></div>'
                f'<div style="display:flex;border-top:1px solid var(--ba-line);background:var(--ba-bg-1)">'
                + ''.join(f'<div style="flex:1;text-align:center;padding:9px 0 14px;font-size:10.5px;font-weight:600;color:{"var(--ba-media)" if n=="Media" else "var(--ba-text-2)"}">{ic(i)}<br>{n}</div>' for n, i in (('Queue', 'list'), ('Sermons', 'quote'), ('Bible', 'book'), ('Songs', 'music'), ('Media', 'image')))
                + '</div></div>')

    def phone_land():
        return (f'<div class="phone land"><div style="display:grid;grid-template-columns:1.1fr 1fr;gap:14px;padding:14px;height:100%">'
                f'<div style="display:flex;flex-direction:column;gap:8px"><div class="mon lv"><div class="lb"><span class="dot"></span> Live · video</div><div class="scr">{thumb("p2","","video")}</div></div>'
                f'<div class="tcs"><div class="big" style="font-size:26px">1:12</div><div class="rem">−3:00</div></div></div>'
                f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:center">'
                f'<button class="btn" style="height:68px;justify-content:center">{ic("prev","lg")} Back</button><button class="btn" style="height:68px;justify-content:center">{ic("next","lg")} Next</button>'
                f'<button class="btn pri" style="height:68px;justify-content:center;grid-column:1/3">{ic("pause","lg")} Pause</button>'
                f'<button class="btn" style="height:56px;justify-content:center;grid-column:1/3">{ic("blank")} Blank</button></div></div></div>')

    def phone_browse():
        g = ''.join(f'<div class="card">{thumb(c,"",k,d,l)}<div class="nm" style="font-size:12px">{n}</div></div>' for c, n, k, d, l, m in ITEMS[:4])
        return (f'<div class="phone"><div style="padding:12px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--ba-line)">{ic("chev","sm")}<b>Media</b><span style="flex:1"></span><span class="chip warn"><span class="dot"></span>Reconnecting…</span></div>'
                f'<div class="banner" style="--c:var(--ba-warn);margin:10px 12px 0">{ic("warn")}<div class="grow" style="font-size:12.5px">Lost the connection. Controls are paused — the screen is unchanged.</div></div>'
                f'<div style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;opacity:.55">{g}</div>'
                f'<div class="faint" style="padding:0 14px;font-size:12px">The phone can queue and stage media. It cannot import, delete, or change what is live without Take.</div></div>')

    body = (f'<div style="display:flex;gap:40px;align-items:flex-start;padding:60px 70px">{phone_portrait()}<div style="display:flex;flex-direction:column;gap:40px">{phone_land()}'
            f'<div class="faint" style="max-width:520px;font-size:13px">Portrait: transport and Blank only — 64px targets, no scrubbing.<br>Landscape: Back / Next / Pause for the person walking the room.<br>Right: when the connection drops, controls pause and say so; nothing on screen changes.</div></div>{phone_browse()}</div>')
    return page('Phone remote — media', body, cls='phone-sheet').replace('width:1180px', 'width:1440px')


# ------------------------------------------------------------------ 10 stage monitor
def stage():
    body = (f'<div class="stagebg" style="width:100%;height:100%;display:grid;grid-template-columns:2.3fr 1fr;grid-template-rows:auto 1fr auto;gap:0;padding:0">'
            f'<div style="grid-column:1/3;display:flex;align-items:center;gap:30px;padding:20px 36px;border-bottom:1px solid #333">'
            f'<span class="mono" style="font-size:46px;font-weight:700">9:41 AM</span><span style="flex:1"></span>'
            f'<span style="font-size:20px;color:#bbb">SERVICE ELAPSED</span><span class="mono" style="font-size:46px;font-weight:700">0:11:08</span></div>'
            f'<div style="padding:34px 40px;display:flex;flex-direction:column;gap:20px;border-right:1px solid #333">'
            f'<div style="font-size:20px;letter-spacing:.18em;color:#f0983e;font-weight:700">NOW · VIDEO — MISSION TRIP, KENYA</div>'
            f'<div class="ph p2" style="aspect-ratio:16/9;max-width:640px"><span class="play" style="width:60px;height:60px">{ic("play","lg")}</span></div>'
            f'<div style="display:flex;align-items:baseline;gap:24px"><span class="mono" style="font-size:150px;font-weight:700;line-height:1;color:#fff">3:00</span><span style="font-size:30px;color:#bbb">remaining</span></div>'
            f'<div style="height:14px;background:#2a2a2a;border-radius:7px"><i style="display:block;width:29%;height:100%;background:#ff4d4f;border-radius:7px"></i></div></div>'
            f'<div style="padding:34px 30px;display:flex;flex-direction:column;gap:22px">'
            f'<div><div style="font-size:18px;letter-spacing:.18em;color:#999;font-weight:700">NEXT</div><div style="font-size:40px;font-weight:700;margin-top:6px">John 3:16–21</div><div style="font-size:24px;color:#bbb">Bible · KJV · after the video</div></div>'
            f'<div><div style="font-size:18px;letter-spacing:.18em;color:#999;font-weight:700">THEN</div><div style="font-size:30px;margin-top:6px">Offering — QR</div></div>'
            f'<div style="margin-top:auto;border:3px solid #f0983e;border-radius:14px;padding:18px 22px"><div style="font-size:18px;letter-spacing:.18em;color:#f0983e;font-weight:700">FROM THE BOOTH</div><div style="font-size:44px;font-weight:800">WRAP UP — 2 MIN</div></div></div>'
            f'<div style="grid-column:1/3;padding:14px 36px;border-top:1px solid #333;display:flex;gap:30px;font-size:20px;color:#bbb"><span>Audio: HDMI — Sanctuary</span><span style="flex:1"></span><span>Live: Main · Congregation</span></div></div>')
    return page('Stage monitor', body)


# ------------------------------------------------------------------ 11 slides import
def slides_import():
    def stp(n, label, st):
        return f'<div style="display:flex;align-items:center;gap:10px"><span class="step {st}">{ic("check","sm") if st=="done" else n}</span><span style="font-weight:{700 if st=="on" else 500};color:{"var(--ba-text-1)" if st!="" else "var(--ba-text-3)"}">{label}</span></div>'
    steps = f'<div style="display:flex;gap:30px;padding:16px 28px;border-bottom:1px solid var(--ba-line)">{stp(1,"Choose file","done")}{stp(2,"Check the pages","on")}{stp(3,"Add to library","")}</div>'
    pages = ''.join(f'<div class="card {"sel" if i==2 else ""}">{thumb(c, t)}<div class="mt"><span>Slide {i+1}</span>{"<span class=chip warn>video not included</span>" if i==3 else ""}</div></div>'
                    for i, (c, t) in enumerate([('p4', 'Welcome'), ('p1', 'Our mission'), ('p2', 'Where we serve'), ('p6', 'Watch'), ('p3', 'Thank you'), ('p8', 'Questions')]))
    body = (f'<div style="display:flex;flex-direction:column;height:100%">{steps}<div style="display:flex;flex:1;min-height:0">'
            f'<div style="flex:1;padding:22px 28px;display:flex;flex-direction:column;gap:14px;min-width:0">'
            f'<div style="display:flex;align-items:center;gap:12px"><span class="h">Guest-Speaker-Missions.pptx</span><span class="chip">PowerPoint · 18 slides · 42 MB</span></div>'
            f'<div class="banner" style="--c:var(--ba-warn)">{ic("warn","lg")}<div class="grow"><b>Pages are made into pictures so they look exactly like the original.</b><div class="dim" style="font-size:13px">Animations don’t carry over. Slide 4 had an embedded video — add the video file separately.</div></div></div>'
            f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">{pages}</div></div>'
            f'<div style="width:380px;border-left:1px solid var(--ba-line);background:var(--ba-bg-1);padding:20px;display:flex;flex-direction:column;gap:14px">'
            f'<div class="h2">How should it come in?</div>'
            f'<div class="layer" style="border-color:var(--ba-accent)"><div style="flex:1"><b>One slideshow</b><div class="faint" style="font-size:12px">18 pictures, kept in order. Next / Back steps through them.</div></div>{ic("check")}</div>'
            f'<div class="layer"><div style="flex:1"><b>Separate pictures</b><div class="faint" style="font-size:12px">Each slide is its own queue item.</div></div></div>'
            f'<div class="caps">Options</div><div class="field">Folder: Guests ▾</div><div class="field">Tag: missions, guest ▾</div>'
            f'<div class="faint" style="font-size:12px">Imported on this computer. The original stays where it is. Takes about 20 seconds.</div>'
            f'<span style="flex:1"></span><button class="btn pri" style="height:46px;justify-content:center">{ic("plus")} Add 18 slides to library</button><button class="btn" style="justify-content:center">Cancel</button></div></div></div>')
    return page('Slides import', app('Media', body))


# ------------------------------------------------------------------ 12 failures
def failures():
    def card(title, c, ic_, text, actions, scr):
        return (f'<div class="panel" style="padding:14px;display:flex;flex-direction:column;gap:10px;--c:var({c})"><div style="display:flex;gap:10px;align-items:center;color:var(--c)">{ic(ic_,"lg")}<b style="color:var(--ba-text-1)">{title}</b></div>'
                f'{scr}<div class="dim" style="font-size:13px">{text}</div><div style="display:flex;gap:8px;flex-wrap:wrap">{actions}</div></div>')
    blk = f'<div class="ph p9" style="aspect-ratio:16/9"><div class="tt" style="font-size:18px">Screen stays on what it was showing</div></div>'
    logo = f'<div class="ph" style="aspect-ratio:16/9;background:#000;display:grid;place-items:center">{FLAME.replace("<svg","<svg width=44 height=44")}</div>'
    cs = [
        ('Video stalled', '--ba-warn', 'warn', 'Playback stopped for 3 seconds. The picture is frozen on the last frame; audio is muted so nobody hears a glitch.',
         '<button class="btn sm pri">Restart</button><button class="btn sm">Skip to next</button><button class="btn sm">Blank</button>', blk),
        ('File missing at Take', '--ba-danger', 'x', 'Nothing was sent to the screen. Whatever was live is still live.',
         '<button class="btn sm pri">Relink…</button><button class="btn sm">Skip</button>', blk),
        ('Can’t play this format', '--ba-danger', 'x', '“Promo.mkv” isn’t supported. Born Again can make a safe copy (keeps the original).',
         '<button class="btn sm pri">Convert to MP4</button><button class="btn sm">Skip</button>', blk),
        ('Projector unplugged', '--ba-warn', 'unplug', 'Congregation display disappeared. Video paused; it will resume where it was when the display returns — or pick another screen.',
         '<button class="btn sm pri">Use Stage monitor</button><button class="btn sm">Wait</button>', blk),
        ('Low memory', '--ba-warn', 'warn', '4K video needs more than this computer has free. Born Again will use the 1080p copy if it exists.',
         '<button class="btn sm pri">Make 1080p copy</button>', blk),
        ('Panic', '--ba-live', 'blank', 'One key (Esc, or the big Blank button on the phone): pause all video, mute, clear alerts, show black or your logo. Press again to bring it back.',
         '<kbd>Esc</kbd><span class="chip">Black</span><span class="chip on">Logo</span>', logo),
    ]
    body = (f'<div style="padding:22px 26px;display:flex;flex-direction:column;gap:16px"><div class="h">When something goes wrong</div>'
            f'<div class="dim" style="max-width:760px">Rule: a failure never changes what the congregation sees on its own, never makes a sound, and always offers one obvious next step.</div>'
            f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">{"".join(card(*c) for c in cs)}</div></div>')
    return page('Failure states', app('Media', body))

from lib import *

# ------------------------------------------------------------------ 01 library
FOLDERS = [('All media', 'folder', 214, True), ('Backgrounds', 'folder', 58, False), ('Announcements', 'folder', 31, False),
           ('Videos', 'folder', 47, False), ('Events', 'folder', 62, False), ('Countdowns', 'folder', 9, False),
           ('Giving & QR', 'folder', 7, False)]


def tree(on=0, show_smart=True):
    o = ['<div class="tree"><div class="caps" style="padding:4px 10px 8px">Library</div>']
    for i, (n, ico, c, _) in enumerate(FOLDERS):
        o.append(f'<div class="it {"on" if i == on else ""}">{ic(ico)}{n}<span class="n">{c}</span></div>')
    if show_smart:
        o.append('<div class="caps" style="padding:16px 10px 8px">Smart</div>')
        for n, ico in (('Favorites', 'star'), ('Recently used', 'clock'), ('Needs attention', 'warn')):
            c = ' style="color:var(--ba-warn)"' if n == 'Needs attention' else ''
            o.append(f'<div class="it"{c}>{ic(ico)}{n}{"<span class=n>2</span>" if n=="Needs attention" else ""}</div>')
        o.append('<div class="caps" style="padding:16px 10px 8px">Tags</div>')
        for t in ('easter', 'christmas', 'kids', 'loop', 'worship', 'missions'):
            o.append(f'<div class="it">{ic("tag")}{t}</div>')
    o.append('</div>')
    return ''.join(o)


ITEMS = [
    ('p1', 'Embers', 'video', '2:00', True, 'Background · 1080p'),
    ('p4', 'Violet Haze', 'video', '1:30', True, 'Background · 1080p'),
    ('p6', 'Slow Waves', 'video', '3:00', True, 'Background · 4K'),
    ('p3', 'Green Fields', 'image', '', False, 'Still · 3840×2160'),
    ('p2', 'Mission Trip — Kenya', 'video', '4:12', False, 'Video · 1080p'),
    ('p5', 'Baptism Sunday', 'image', '', False, 'Slideshow · 24 photos'),
    ('p8', 'Mother’s Day Honour', 'image', '', False, 'Slideshow · 12 photos'),
    ('p7', 'Welcome loop', 'image', '', True, 'Announcements · 6 slides'),
]


def card(it, sel=False, live=False, missing=False, i=0):
    cls, nm, kind, dur, lp, meta = it
    th = thumb(cls, '', kind, dur, lp, missing=missing)
    cc = 'card' + (' sel' if sel else '') + (' livec' if live else '')
    st = ''
    if missing:
        st = f'<span class="chip warn">{ic("warn","sm")}File missing</span>'
    return f'<div class="{cc}">{th}<div class="nm">{nm}</div><div class="mt">{meta}</div>{st}</div>'


def library():
    cards = ''.join(card(it, sel=(i == 4)) for i, it in enumerate(ITEMS))
    cards += card(('p9', 'Easter Sunrise 2024', 'video', '1:12', False, 'Video · moved or deleted'), missing=True)
    tb = (f'<div class="toolbar"><div class="field" style="flex:1;max-width:420px">{ic("search")}Search media, tags, notes…</div>'
          f'<span class="chip on">{ic("video","sm")} Video</span><span class="chip">{ic("image","sm")} Images</span>'
          f'<span class="chip">{ic("audio","sm")} Audio</span><span class="chip">{ic("slides","sm")} Slides</span>'
          f'<span style="flex:1"></span><div class="seg"><button class="on">{ic("grid","sm")}Grid</button><button>{ic("list","sm")}List</button></div>'
          f'<button class="btn pri">{ic("upload")}Add media</button></div>')
    drop = (f'<div class="drop">{ic("upload","lg")}<div>Drop files or a whole folder here'
            f'<div class="dim" style="font-weight:400;font-size:13px">Born Again checks each file, makes a thumbnail, and keeps the original where it is.</div></div>'
            f'<span style="flex:1"></span><span class="chip">Watching: ~/Church/Media</span></div>')
    main = f'<div class="main" style="flex:1;min-height:0">{tree(0)}<div style="flex:1;min-width:0;display:flex;flex-direction:column">{tb}{drop}<div class="grid">{cards}</div></div></div>'
    return page('Media library — grid', app('Media', main, queue=queue_media(compact=True)))


def queue_media(compact=False, live_idx=None, staged_idx=None, only=None):
    rows = [('Welcome loop', 'p7', 'image', 'Loop · 6 slides', '--ba-media', ''),
            ('Countdown 5:00', 'p9', 'image', 'Timer · ends 9:30', '--ba-media', ''),
            ('Opening worship — Embers', 'p1', 'video', 'Background · loop', '--ba-media', ''),
            ('Great Is Thy Faithfulness', 'p4', 'image', 'Song · 4 sections', '--ba-songs', ''),
            ('Mission Trip — Kenya', 'p2', 'video', 'Video · 4:12 · audio', '--ba-media', ''),
            ('John 3:16–21', 'p3', 'image', 'Bible · KJV', '--ba-bible', ''),
            ('Offering — QR', 'p7', 'image', 'Giving · generated', '--ba-media', '')]
    o = [f'<div class="qh"><span class="h2">Service queue</span><span class="chip">7 items</span><span style="flex:1"></span>'
         f'<span class="chip ok">{ic("check","sm")} Ready</span></div>']
    if only: rows = [rows[j] for j in only]
    for i, (n, c, k, sub, col, _) in enumerate(rows):
        cl = 'qi' + (' live' if i == live_idx else '') + (' staged' if i == staged_idx else '')
        ico = ic('video', 'sm') if 'Video' in sub or 'Background' in sub else ''
        o.append(f'<div class="{cl}" style="--c:var({col})"><span class="k"></span><span class="th">{thumb(c, kind=k)}</span>'
                 f'<div style="flex:1;min-width:0"><div class="nm">{n}</div><div class="sb">{ico}{sub}</div></div><span class="grip">{ic("list","sm")}</span></div>')
    return ''.join(o)


# ------------------------------------------------------------------ 02 library states
def library_states():
    def box(title, inner, h=410):
        return (f'<div class="panel" style="padding:0;overflow:hidden;height:{h}px;display:flex;flex-direction:column">'
                f'<div style="padding:10px 14px;border-bottom:1px solid var(--ba-line)" class="caps">{title}</div>{inner}</div>')
    lst = ''.join(f'<div class="rowl"><div>{thumb(c, "", k, d, l)}</div><div><div style="font-weight:600">{n}</div><div class="faint" style="font-size:12px">{m}</div></div>'
                  f'<div class="mono dim">{d or "—"}</div><div class="mono dim">{s}</div><div><span class="chip">{t}</span></div><div>{ic("star","sm") if f else ""}</div></div>'
                  for (c, n, k, d, l, m), s, t, f in zip(ITEMS[:4], ('84 MB', '121 MB', '640 MB', '5.2 MB'), ('worship', 'worship', 'loop', 'easter'), (1, 0, 0, 1)))
    hd = '<div class="rowl hd caps"><span></span><span>Name</span><span>Length</span><span>Size</span><span>Tag</span><span></span></div>'
    p1 = box('List view', hd + lst)
    p2 = box('Empty library', f'<div style="flex:1;display:grid;place-items:center;text-align:center;padding:30px"><div>'
             f'<div style="width:72px;height:72px;border-radius:20px;background:var(--ba-media-wash);color:var(--ba-media);display:grid;place-items:center;margin:0 auto 14px">{ic("image","xl")}</div>'
             f'<div class="h2">Nothing here yet</div><div class="dim" style="margin:6px 0 16px;max-width:300px">Drop pictures and videos here, or point Born Again at a folder you already use. Nothing is copied unless you ask.</div>'
             f'<div style="display:flex;gap:8px;justify-content:center"><button class="btn pri">{ic("upload")}Add media</button><button class="btn">{ic("folder")}Watch a folder…</button></div></div></div>')
    p3 = box('Missing file — relink', f'<div style="padding:16px;display:flex;flex-direction:column;gap:12px">'
             f'<div class="banner" style="--c:var(--ba-warn)">{ic("warn","lg")}<div class="grow"><b>“Easter Sunrise 2024.mp4” can’t be found.</b><div class="dim" style="font-size:13px">It was in <span class="mono">/Volumes/Church-SSD/Events</span> — that drive isn’t connected.</div></div></div>'
             f'<div class="panel" style="padding:12px;display:flex;gap:12px;align-items:center">{ic("file","lg")}<div style="flex:1"><div style="font-weight:600">Easter Sunrise 2024.mp4</div><div class="faint mono" style="font-size:12px">Found a match · /Users/media/Events/ · same size and length</div></div><button class="btn sm pri">Relink</button></div>'
             f'<div style="display:flex;gap:8px"><button class="btn">{ic("search")}Choose another file…</button><button class="btn">Search the folder for all missing</button><button class="btn ghost danger">Remove from library</button></div>'
             f'<div class="faint" style="font-size:12px">Used in 2 saved services. Those keep their place; the slide shows “media missing” instead of playing.</div></div>')
    prog = ('<div style="padding:16px;display:flex;flex-direction:column;gap:10px">'
            f'<div class="layer">{ic("check")}<div style="flex:1">Baptism-2.jpg + 23 more<div class="faint" style="font-size:12px">24 pictures · thumbnails ready</div></div><span class="chip ok">Done</span></div>'
            f'<div class="layer">{ic("video")}<div style="flex:1">Testimony — Maria.mov<div style="height:5px;background:var(--ba-bg-4);border-radius:3px;margin-top:8px"><i style="display:block;width:62%;height:100%;border-radius:3px;background:var(--ba-media)"></i></div><div class="faint" style="font-size:12px;margin-top:4px">Making a safe copy for playback · 62%</div></div><span class="chip on">Preparing</span></div>'
            f'<div class="layer">{ic("warn")}<div style="flex:1">Promo-final.mkv<div class="faint" style="font-size:12px">Can’t be played in Born Again. <u>Convert to MP4</u> (keeps the original)</div></div><span class="chip bad">Not supported</span></div>'
            f'<div class="layer">{ic("copy")}<div style="flex:1">Welcome-loop.mp4<div class="faint" style="font-size:12px">Same file already in Announcements</div></div><button class="btn sm">Use existing</button><button class="btn sm ghost">Keep both</button></div></div>')
    p4 = box('Import: progress, unsupported, duplicate', prog)
    body = f'<div style="padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px">{p1}{p2}{p3}{p4}</div>'
    return page('Media library — states', app('Media', body), cls='')


# ------------------------------------------------------------------ 03 queue + preview/live with video
def pair_panel(pos='1:12', total='4:12', pct=29, live_t=None):
    prev = (f'<div class="mon pv"><div class="lb">{ic("eye","sm")} Preview</div><div class="scr">{thumb("p2","","video","4:12")}</div>'
            f'<div class="tm"><span>0:00</span><span>4:12</span></div></div>')
    liv = (f'<div class="mon lv"><div class="lb"><span class="dot"></span> Live</div><div class="scr">{thumb("p1","Great Is Thy Faithfulness","image")}</div>'
           f'<div class="tm"><span>Song · Verse 1</span><span></span></div></div>')
    return f'<div class="pair">{prev}{liv}</div>'


def transport_live(pos='1:12', rem='−3:00', pct=29):
    return (f'<div class="transport"><div class="tcs"><div class="big">{pos}</div><div class="rem">{rem} left</div></div>'
            f'<div class="scrub"><div class="tr"></div><div class="fl" style="width:{pct}%"></div><div class="hd" style="left:{pct}%"></div>'
            f'<div class="io" style="left:3%"></div><div class="io" style="left:97%"></div>'
            f'<div class="mk" style="left:50%"></div></div>'
            f'<div class="tbtn"><button class="btn icon">{ic("prev")}</button><button class="btn icon pri">{ic("pause")}</button><button class="btn icon">{ic("next")}</button>'
            f'<span style="flex:1"></span><button class="btn icon on" title="loop">{ic("loop")}</button>'
            f'<div class="vol">{ic("vol")}<div class="bar"><i style="width:70%"></i></div><span class="mono dim" style="font-size:12px">70</span></div></div>'
            f'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="caps">When it ends</span>'
            f'<div class="seg"><button>Stay on last frame</button><button class="on">Go to next item</button><button>Black</button></div></div>'
            f'<div style="display:flex;gap:8px;align-items:center"><span class="caps">Fade</span><div class="seg"><button>None</button><button class="on">1 s</button><button>3 s</button></div>'
            f'<span style="flex:1"></span><span class="chip">{ic("vol","sm")} Main · HDMI audio</span></div></div>')


def queue_preview_live():
    q = queue_media(live_idx=1, only=[3, 4, 5])
    q += f'<div style="flex:1"></div>'
    live_panel = (f'<div class="pair">'
                  f'<div class="mon pv"><div class="lb">{ic("eye","sm")} Preview · next</div><div class="scr">{thumb("p3","John 3:16–21","image")}</div><div class="tm"><span>Bible · KJV</span><span></span></div></div>'
                  f'<div class="mon lv"><div class="lb"><span class="dot"></span> Live · video</div><div class="scr">{thumb("p2","","video")}</div><div class="tm"><span style="color:var(--ba-live)">▶ playing</span><span>−3:00</span></div></div></div>'
                  + transport_live())
    take = f'<div class="take"><button class="btn live">{ic("blank")} Blank</button><button class="btn pri">{ic("play")} Take preview</button></div>'
    queue = f'<div style="display:flex;flex-direction:column;height:100%;overflow:hidden">{q}{live_panel}{take}</div>'
    # the work area shows the media detail for the live item
    big = (f'<div style="padding:22px 26px;display:flex;flex-direction:column;gap:16px;height:100%">'
           f'<div style="display:flex;align-items:center;gap:12px"><span class="chip on">{ic("video","sm")} Video</span><span class="h">Mission Trip — Kenya</span><span class="chip">missions</span><span style="flex:1"></span>'
           f'<span class="chip ok">{ic("check","sm")} Checked for tonight</span></div>'
           f'<div class="ph p2" style="flex:1;aspect-ratio:auto;border:2px solid var(--ba-live)"><span class="play" style="width:64px;height:64px">{ic("pause","lg")}</span>'
           f'<span class="badge tl" style="background:var(--ba-live);color:#fff">● LIVE — playing from 1:12</span>'
           f'<div style="position:absolute;left:0;right:0;bottom:0;height:72px;background:linear-gradient(transparent,rgba(0,0,0,.65))"></div></div>'
           f'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">'
           f'<div class="panel" style="padding:12px"><div class="caps">Plays on</div><div style="font-weight:600;margin-top:4px">Congregation · Graphics</div></div>'
           f'<div class="panel" style="padding:12px"><div class="caps">Audio</div><div style="font-weight:600;margin-top:4px">Sound on · Main HDMI</div></div>'
           f'<div class="panel" style="padding:12px"><div class="caps">Rights note</div><div style="font-weight:600;margin-top:4px">Own footage</div></div>'
           f'<div class="panel" style="padding:12px"><div class="caps">After it ends</div><div style="font-weight:600;margin-top:4px">Go to “John 3:16–21”</div></div></div></div>')
    return page('Queue with media — Preview and Live', app('Media', big, queue=queue))


# ------------------------------------------------------------------ 04 drill-down
def drilldown():
    cols = ''
    # collapsed rails then active list
    def rail_col(label, sel):
        return (f'<div style="width:44px;flex:none;border-right:1px solid var(--ba-line);background:var(--ba-bg-1);display:flex;flex-direction:column;align-items:center;padding-top:14px;gap:10px">'
                f'<span style="writing-mode:vertical-rl;transform:rotate(180deg);font-weight:600;color:var(--ba-text-2)">{label}</span>'
                f'<span class="chip on" style="writing-mode:vertical-rl;transform:rotate(180deg);height:auto;padding:8px 0;width:24px;justify-content:center">{sel}</span></div>')
    lst = ''.join(f'<div class="qi" style="{"background:var(--ba-bg-4)" if i==1 else ""}"><span class="th" style="width:64px">{thumb(c,"",k,d,l)}</span>'
                  f'<div style="flex:1"><div class="nm">{n}</div><div class="sb">{m}</div></div></div>'
                  for i, (c, n, k, d, l, m) in enumerate([ITEMS[1], ITEMS[0], ITEMS[2], ITEMS[7]]))
    mid = (f'<div style="width:320px;flex:none;border-right:1px solid var(--ba-line);background:var(--ba-bg-1);display:flex;flex-direction:column">'
           f'<div class="toolbar" style="gap:6px"><span class="caps">Backgrounds · Worship</span><span style="flex:1"></span>'
           f'<div class="seg"><button class="on">{ic("list","sm")}</button><button>{ic("grid","sm")}</button></div></div>{lst}</div>')
    handle = f'<div style="width:14px;flex:none;display:grid;place-items:center;background:var(--ba-bg-0);border-right:1px solid var(--ba-line);color:var(--ba-text-3)">{ic("chev","sm")}</div>'
    right = (f'<div style="flex:1;min-width:0;padding:22px 26px;display:flex;flex-direction:column;gap:14px">'
             f'<div style="display:flex;gap:10px;align-items:center"><span class="h">Embers</span><span class="chip on">{ic("loop","sm")} loops</span><span class="chip">1080p · 2:00 · 84 MB</span><span style="flex:1"></span>'
             f'<button class="btn">{ic("star")}</button><button class="btn">{ic("plus")} Add to queue</button><button class="btn pri">{ic("eye")} Stage in Preview</button></div>'
             f'<div class="ph p1" style="width:100%;aspect-ratio:16/9;max-height:440px"><span class="play" style="width:64px;height:64px">{ic("play","lg")}</span>'
             f'<div class="tt" style="font-size:44px">Great Is Thy Faithfulness<br><span style="font-size:22px;font-weight:500;opacity:.85">preview with your text on top</span></div></div>'
             f'<div class="scrub" style="height:30px"><div class="tr"></div><div class="fl" style="width:0;background:var(--ba-accent)"></div></div>'
             f'<div style="display:flex;gap:8px"><span class="chip">worship</span><span class="chip">loop</span><span class="chip">no sound</span><span class="chip ok">Own footage</span>'
             f'<span style="flex:1"></span><span class="faint" style="font-size:12px">Used in 6 services · last used Sun</span></div></div>')
    cols = (rail_col('Library', 'All') + rail_col('Folder', 'Backgrounds') + mid + handle + right)
    main = f'<div style="display:flex;flex:1;min-height:0">{cols}</div>'
    return page('Media drill-down', app('Media', main, queue=queue_media(staged_idx=2)))


# ------------------------------------------------------------------ 05 backgrounds
def backgrounds():
    stills = ''.join(f'<div class="card {"sel" if i==0 else ""}">{thumb(c,"Amazing Grace" if i==0 else "")}<div class="nm">{n}</div></div>'
                     for i, (c, n) in enumerate([('p3', 'Green Fields'), ('p4', 'Violet'), ('p5', 'Sunset'), ('p7', 'Slate')]))
    motion = ''.join(f'<div class="card {"livec" if i==0 else ""}">{thumb(c,"", "video", d, True)}<div class="nm">{n}</div></div>'
                     for i, (c, n, d) in enumerate([('p1', 'Embers', '2:00'), ('p6', 'Slow Waves', '3:00'), ('p4', 'Violet Haze', '1:30'), ('p8', 'Rose Drift', '2:20')]))
    left = (f'<div style="flex:1;padding:18px 22px;min-width:0;display:flex;flex-direction:column;gap:14px">'
            f'<div class="h">Backgrounds</div><div class="dim">Sits behind text. Never covers it — your words are always on top.</div>'
            f'<div class="seg" style="align-self:flex-start"><button class="on">All</button><button>Still</button><button>Motion</button><button>Mine</button></div>'
            f'<div class="caps">Motion · quiet loops</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">{motion}</div>'
            f'<div class="caps" style="margin-top:6px">Still</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">{stills}</div>'
            f'<div class="banner" style="--c:var(--ba-media);margin-top:6px">{ic("zap")}<div class="grow"><b>Motion keeps text readable.</b> Born Again dims motion behind lyrics by 35% automatically — you can change it per Destination.</div></div></div>')
    prev = (f'<div class="ph p1" style="aspect-ratio:16/9;border:1px solid var(--ba-line-strong)"><div style="position:absolute;inset:0;background:rgba(0,0,0,.35)"></div>'
            f'<div class="tt" style="font-size:30px;z-index:1">Amazing grace, how sweet the sound<br>That saved a wretch like me</div><span class="badge tl">Main · Congregation</span></div>')
    rows = [('Congregation (main screen)', 'monitor', 'Embers (motion)', 'Dim 35%', 'Full-screen'),
            ('Stage monitor', 'monitor', 'None — black', '—', 'Text only'),
            ('Graphics · OBS', 'globe', 'None — transparent', '—', 'Lower third'),
            ('Overflow room', 'monitor', 'Same as Congregation', 'Dim 35%', 'Full-screen')]
    tb = ''.join(f'<tr><td><div style="display:flex;gap:8px;align-items:center">{ic(i)}<b>{n}</b></div></td><td>{b}</td><td class="mono dim">{d}</td><td><span class="chip">{p}</span></td></tr>' for n, i, b, d, p in rows)
    right = (f'<div style="width:520px;flex:none;border-left:1px solid var(--ba-line);padding:18px 20px;display:flex;flex-direction:column;gap:14px;background:var(--ba-bg-1)">'
             f'<div class="h2">Where it shows</div>{prev}<div class="seg" style="align-self:flex-start"><button class="on">Main</button><button>Spanish (follows Main)</button></div>'
             f'<table class="tbl"><tr><th>Destination</th><th>Background</th><th>Dim</th><th>Profile</th></tr>{tb}</table>'
             f'<div class="faint" style="font-size:12px">A following Channel shows the same background unless you pick a different one. Graphics stays transparent by default so OBS can lay it over a camera.</div></div>')
    return page('Backgrounds', app('Media', f'<div style="display:flex;flex:1;min-height:0">{left}{right}</div>'))

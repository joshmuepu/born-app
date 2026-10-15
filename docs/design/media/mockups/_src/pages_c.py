from lib import *
from pages_a import queue_media, ITEMS

ONLINE = lambda: f'<span class="chip warn" style="--c:var(--ba-screens);border-color:var(--ba-screens);color:var(--ba-screens)">{ic("globe","sm")} Online</span>'


def yt_thumb(cls='p6', dur='3:42', title=''):
    return thumb(cls, title, 'video', dur)


def yt_paste():
    ok = (f'<div class="panel" style="padding:14px;display:flex;gap:14px;align-items:flex-start">'
          f'<div style="width:220px">{yt_thumb("p6","3:42")}</div>'
          f'<div style="flex:1;min-width:0"><div class="h2">How Great Is Our God — Live in Worship</div>'
          f'<div class="dim" style="font-size:13px;margin-top:2px">Example Worship Channel · 3:42</div>'
          f'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><span class="chip ok">{ic("check","sm")} Found</span><span class="chip ok">{ic("check","sm")} Embedding allowed</span>{ONLINE()}</div></div></div>')
    opts = (f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            f'<div><div class="caps">Start at</div><div class="field mono" style="margin-top:6px;color:var(--ba-text-1)">0:12</div></div>'
            f'<div><div class="caps">Stop at</div><div class="field mono" style="margin-top:6px;color:var(--ba-text-1)">3:30</div></div></div>'
            f'<div style="display:flex;flex-direction:column;gap:8px">'
            f'<div class="layer">{ic("mute")}<div style="flex:1"><b>Start muted</b><div class="faint" style="font-size:12px">Sound is turned on by you, in the playback bar. Always on.</div></div><span class="chip on">On</span></div>'
            f'<div class="layer">{ic("play")}<div style="flex:1"><b>Never starts by itself</b><div class="faint" style="font-size:12px">Added items wait in the queue until you Take them.</div></div><span class="chip on">Always</span></div>'
            f'<div class="layer">{ic("loop")}<div style="flex:1"><b>Loop</b><div class="faint" style="font-size:12px">YouTube only supports looping a single video in a limited way — off by default.</div></div><span class="chip">Off</span></div></div>')
    fb = (f'<div><div class="caps">If this fails on the day, show</div><div class="field" style="margin-top:6px;color:var(--ba-text-1)">{ic("video")} Mission Trip — Kenya.mp4 (Media library) {ic("chevd","sm")}</div></div>')
    dlg = (f'<div class="menu" style="width:640px;padding:20px;display:flex;flex-direction:column;gap:14px;position:absolute;left:40px;top:70px;z-index:5">'
           f'<div style="display:flex;align-items:center;gap:10px"><span class="h">Add a YouTube video</span><span style="flex:1"></span>{ic("x")}</div>'
           f'<div class="field" style="height:44px;color:var(--ba-text-1)">{ic("link")}<span class="mono" style="font-size:13px">https://www.youtube.com/watch?v=dQw4w9WgXcQ</span></div>'
           f'{ok}{opts}{fb}'
           f'<div class="banner" style="--c:var(--ba-screens)">{ic("globe")}<div class="grow" style="font-size:13px">Plays from YouTube’s own player, online. Born Again doesn’t download or change it. Ads may appear — <u>test it in Preview first</u>.</div></div>'
           f'<div style="display:flex;gap:8px"><span style="flex:1"></span><button class="btn">Cancel</button><button class="btn">{ic("plus")} Add to queue</button><button class="btn pri">{ic("eye")} Add and stage</button></div></div>')
    err = (f'<div class="menu" style="width:420px;position:absolute;left:720px;top:90px;padding:16px;display:flex;flex-direction:column;gap:10px">'
           f'<div class="caps">Other results of pasting a link</div>'
           f'<div class="banner" style="--c:var(--ba-danger)">{ic("x")}<div class="grow" style="font-size:13px"><b>Embedding is turned off</b> by the owner. It can’t be played here. <u>Add a file instead</u></div></div>'
           f'<div class="banner" style="--c:var(--ba-warn)">{ic("warn")}<div class="grow" style="font-size:13px"><b>Can’t check — you’re offline.</b> You can still add it; it will be checked when you’re back online.</div></div>'
           f'<div class="banner" style="--c:var(--ba-warn)">{ic("clock")}<div class="grow" style="font-size:13px"><b>Live stream or premiere.</b> Added, but it can’t be tested ahead of time.</div></div></div>')
    back = app('Media', f'<div style="padding:18px"><div class="grid" style="padding:0">' + ''.join(f'<div class="card">{thumb(c,"",k,d,l)}<div class="nm">{n}</div></div>' for c, n, k, d, l, m in ITEMS[:8]) + '</div></div>', queue=queue_media())
    return page('Add a YouTube video', f'<div style="position:relative;width:100%;height:100%">{back}<div style="position:absolute;inset:0;background:var(--ba-scrim)"></div>{dlg}{err}</div>')


def yt_queue():
    rows = [('Welcome loop', 'p7', 'image', 'Loop · 6 slides', False),
            ('Opening worship — Embers', 'p1', 'video', 'Background · loop', False),
            ('How Great Is Our God', 'p6', 'video', 'YouTube · 3:42 · muted', True),
            ('Mission Trip — Kenya', 'p2', 'video', 'Video · 4:12', False),
            ('John 3:16–21', 'p3', 'image', 'Bible · KJV', False)]
    o = [f'<div class="qh"><span class="h2">Service queue</span><span class="chip">5 items</span><span style="flex:1"></span><span class="chip warn">{ic("globe","sm")} 1 online</span></div>']
    for i, (n, c, k, sub, online) in enumerate(rows):
        cls = 'qi staged' if online else 'qi'
        badge = ONLINE() if online else ''
        o.append(f'<div class="{cls}" style="--c:var(--ba-media)"><span class="k" {"style=background:var(--ba-screens)" if online else ""}></span><span class="th">{thumb(c,kind=k)}</span>'
                 f'<div style="flex:1;min-width:0"><div class="nm">{n}</div><div class="sb">{sub}</div></div>{badge}</div>')
    pair = (f'<div class="pair"><div class="mon pv"><div class="lb">{ic("eye","sm")} Preview</div><div class="scr">{thumb("p6","How Great Is Our God","video","3:42")}</div>'
            f'<div class="tm"><span>Still image only</span><span>YouTube</span></div></div>'
            f'<div class="mon lv"><div class="lb"><span class="dot"></span> Live</div><div class="scr">{thumb("p1","Great Is Thy Faithfulness")}</div><div class="tm"><span>Song · Verse 1</span><span></span></div></div></div>')
    take = (f'<div style="margin:0 14px 10px" class="banner" style2="" ><span style="color:var(--ba-screens)">{ic("globe")}</span><div class="grow" style="font-size:13px"><b>Online item.</b> Preview shows a still; use <u>Test play</u> to see the real player.</div></div>'
            f'<div class="take"><button class="btn">{ic("play")} Test play</button><button class="btn pri">Take</button></div>')
    queue = f'<div style="display:flex;flex-direction:column;height:100%;overflow:hidden">{"".join(o)}<div style="flex:1"></div>{pair}{take}</div>'
    big = (f'<div style="padding:22px 26px;display:flex;flex-direction:column;gap:16px;height:100%">'
           f'<div style="display:flex;align-items:center;gap:12px"><span class="chip warn" style="border-color:var(--ba-screens);color:var(--ba-screens)">{ic("globe","sm")} YouTube · online</span><span class="h">How Great Is Our God</span><span style="flex:1"></span><span class="chip ok">{ic("check","sm")} Checked 4 min ago</span></div>'
           f'<div class="ph p6" style="flex:1;aspect-ratio:auto;max-height:520px"><span class="play" style="width:64px;height:64px">{ic("play","lg")}</span>'
           f'<span class="badge tl">Preview is a picture · the real player runs on the main output only</span></div>'
           f'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">'
           f'<div class="panel" style="padding:12px"><div class="caps">Plays on</div><div style="font-weight:600;margin-top:4px">Main output only</div><div class="faint" style="font-size:12px">Others show the title</div></div>'
           f'<div class="panel" style="padding:12px"><div class="caps">Start / stop</div><div class="mono" style="font-weight:600;margin-top:4px">0:12 → 3:30</div></div>'
           f'<div class="panel" style="padding:12px"><div class="caps">Sound</div><div style="font-weight:600;margin-top:4px">Muted until you turn it on</div></div>'
           f'<div class="panel" style="padding:12px"><div class="caps">If it fails, show</div><div style="font-weight:600;margin-top:4px">Mission Trip — Kenya.mp4</div></div></div>'
           f'<div class="faint" style="font-size:12px">Born Again uses YouTube’s own player and does not download, store or alter the video. Overlays such as lower thirds are not drawn on top of it.</div></div>')
    return page('YouTube in the queue', app('Media', big, queue=queue))


def yt_preflight():
    col = {'ok': '--ba-ok', 'warn': '--ba-warn', 'bad': '--ba-danger'}
    ico = {'ok': 'check', 'warn': 'warn', 'bad': 'x'}
    rows = [
        ('ok', 'All local files found', '6 of 6 · thumbnails ready'),
        ('ok', 'How Great Is Our God (YouTube) can be played', 'Still exists · public · embedding allowed · checked 4 min ago'),
        ('bad', '“Baptism Testimony” (YouTube) can’t be embedded', 'The owner turned off embedding.<br><u>Use fallback: Baptism-2024.mp4</u> · Remove'),
        ('warn', '“Easter Intro” (YouTube) can’t be checked', 'No internet right now. It will fail if the network is down on Sunday.<br><u>Check again</u> · Set a fallback'),
        ('warn', '“Live Premiere” (YouTube) is a live event', 'Live streams and premieres can’t be tested ahead of time.<br><u>Add a fallback</u>'),
        ('ok', 'Network', 'Internet reachable · 38 Mbps · 24 ms'),
        ('ok', 'Sound goes to “HDMI — Sanctuary”', 'Test tone available'),
        ('warn', 'Ads may appear in YouTube videos', 'Born Again can’t remove them. <u>Test play in Preview</u> to see, or use your own licensed file.'),
    ]
    cards = ''.join(f'<div class="layer" style="--c:var({col[k]});align-items:flex-start;padding:14px"><span style="color:var(--c);margin-top:1px">{ic(ico[k],"lg")}</span>'
                    f'<div style="flex:1"><div style="font-weight:600">{t}</div><div class="dim" style="font-size:13px;margin-top:2px">{d}</div></div></div>' for k, t, d in rows)
    left = (f'<div style="flex:1;padding:22px 28px;display:flex;flex-direction:column;gap:14px;min-width:0;overflow:hidden">'
            f'<div style="display:flex;align-items:center;gap:14px"><div><div class="h">Ready for Sunday?</div><div class="dim">Sunday service · 9:30 AM · 8 items (3 online) · checked just now</div></div><span style="flex:1"></span>'
            f'<button class="btn">{ic("play")} Test play online items</button><button class="btn pri">Check again</button></div>'
            f'<div class="banner" style="--c:var(--ba-danger)">{ic("warn","lg")}<div class="grow"><b>1 problem and 3 suggestions.</b> The online items depend on the internet at showtime; give each a fallback.</div></div>'
            f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">{cards}</div></div>')
    return page('Preflight with YouTube', app('Media', left, queue=queue_media()))


def yt_playbar():
    def state_card(title, tone, state, big, note, body_actions):
        return (f'<div class="panel" style="padding:14px;display:flex;flex-direction:column;gap:10px;--c:var({tone})">'
                f'<div style="display:flex;gap:8px;align-items:center"><b>{title}</b><span style="flex:1"></span><span class="chip" style="border-color:var(--c);color:var(--c)">{state}</span></div>'
                f'<div class="transport" style="margin:0"><div class="tcs"><div class="big">{big[0]}</div><div class="rem">{big[1]}</div></div>'
                f'<div class="scrub"><div class="tr"></div><div class="fl" style="width:{big[2]}%;background:var(--c)"></div><div class="hd" style="left:{big[2]}%"></div></div>'
                f'<div class="tbtn"><button class="btn icon">{ic("prev")}</button><button class="btn icon pri">{ic("pause")}</button><button class="btn icon">{ic("next")}</button><span style="flex:1"></span>'
                f'<span class="chip">{ic("mute","sm")} Muted</span><button class="btn sm">{ic("vol","sm")} Sound on</button></div></div>'
                f'<div class="dim" style="font-size:13px">{note}</div><div style="display:flex;gap:8px;flex-wrap:wrap">{body_actions}</div></div>')
    cards = ''.join([
        state_card('Playing', '--ba-live', 'Player: playing', ('1:21', '−2:09 left', 37), 'Read back from the player every second. The time left also shows on the stage monitor.', '<kbd>Space</kbd> pause <kbd>Esc</kbd> blank'),
        state_card('Buffering', '--ba-warn', 'Player: buffering · 4 s', ('1:21', '−2:09 left', 37), 'The network is slow. The picture may be frozen and the clock keeps its last value — it never guesses.', '<button class="btn sm pri">Wait</button><button class="btn sm">Show fallback</button><button class="btn sm danger">Blank</button>'),
        state_card('Player stalled', '--ba-danger', 'No reply from player · 6 s', ('1:21', 'time unknown', 37), 'The embed stopped answering. Born Again removes it and shows black or your logo; the app itself is fine.', '<button class="btn sm pri">Show fallback</button><button class="btn sm">Reload player</button><button class="btn sm danger">Blank</button>'),
        state_card('Can’t play (error 101 / 150)', '--ba-danger', 'Embedding not allowed', ('0:00', '—', 0), 'The owner doesn’t allow this video in other apps. Nothing reached the screen. Your fallback is ready.', '<button class="btn sm pri">Show “Baptism-2024.mp4”</button><button class="btn sm">Skip</button>'),
        state_card('Can’t identify the app (error 153)', '--ba-danger', 'Player configuration error', ('0:00', '—', 0), 'YouTube didn’t receive an app identity. This is reported to us, not you — use the fallback now.', '<button class="btn sm pri">Show fallback</button><button class="btn sm">Copy details</button>'),
        state_card('Offline', '--ba-warn', 'No internet', ('0:00', '—', 0), 'YouTube items can’t load without a connection. Local media is unaffected.', '<button class="btn sm pri">Show fallback</button><button class="btn sm">Retry</button>'),
    ])
    body = (f'<div style="padding:22px 26px;display:flex;flex-direction:column;gap:14px"><div class="h">YouTube playback bar and failures</div>'
            f'<div class="dim" style="max-width:820px">The bar shows what the player really reports, never what we asked it to do. Blank and Esc work in every state, because they remove the player instead of waiting for it.</div>'
            f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">{cards}</div></div>')
    return page('YouTube playback and failures', app('Media', body))

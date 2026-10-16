from lib import *
from pages_a import queue_media, ITEMS

BIG = ' ' * 0


def backdrop(inner):
    back = app('Media', '<div style="padding:18px"><div class="grid" style="padding:0">' + ''.join(f'<div class="card">{thumb(c, "", k, d, l)}<div class="nm">{n}</div></div>' for c, n, k, d, l, m in ITEMS[:8]) + '</div></div>', queue=queue_media())
    return f'<div style="position:relative;width:100%;height:100%">{back}<div style="position:absolute;inset:0;background:var(--ba-scrim)"></div>{inner}</div>'


def row(label, sub, right, tone=None, th='p1'):
    c = f';--c:var({tone})' if tone else ''
    return (f'<div class="layer" style="gap:12px{c}"><span style="width:56px;flex:none">{thumb(th)}</span>'
            f'<div style="flex:1;min-width:0"><b>{label}</b><div class="faint" style="font-size:12px">{sub}</div></div>{right}</div>')


def pack_export():
    """Save service with pictures — what goes in, how big, progress, cancel."""
    inc = ''.join([
        row('Welcome loop', '6 pictures · slideshow', '<span class="mono dim">38 MB</span>', th='p7'),
        row('Baby dedication', '1 picture', '<span class="mono dim">6.1 MB</span>', th='p2'),
        row('Offering', '1 picture', '<span class="mono dim">2.4 MB</span>', th='p3'),
        row('Backgrounds used on screens', '2 pictures · Congregation, Stage', '<span class="mono dim">9.8 MB</span>', th='p5'),
    ])
    dlg = (f'<div class="menu" style="width:700px;padding:22px;display:flex;flex-direction:column;gap:14px;position:absolute;left:90px;top:60px;z-index:5">'
           f'<div style="display:flex;align-items:center;gap:10px"><span class="h">Save service with pictures</span><span style="flex:1"></span>{ic("x")}</div>'
           f'<div class="dim" style="font-size:13px">One file (<span class="mono">.bornpack</span>) with the queue <b>and</b> the pictures it uses. Open it on another computer and the pictures come with it. A plain <b>Save</b> (<span class="mono">.born</span>) still works the old way and is smaller.</div>'
           f'<div class="caps">What goes in the pack</div>'
           f'<div style="display:flex;flex-direction:column;gap:8px">{inc}</div>'
           f'<div class="panel" style="padding:12px 14px;display:flex;gap:18px;align-items:center"><div><div class="caps">Pictures</div><div class="h2 mono">10</div></div><div><div class="caps">Pack size</div><div class="h2 mono">≈ 56 MB</div></div><div><div class="caps">Free on this drive</div><div class="h2 mono">212 GB</div></div><span style="flex:1"></span><span class="chip ok">{ic("check","sm")} Fits on a USB stick</span></div>'
           f'<div class="banner" style="--c:var(--ba-text-3)">{ic("lock")}<div class="grow" style="font-size:13px">Pictures only — no sermons, songs or settings. Anyone with the file can see the pictures, so share it like a photo album.</div></div>'
           f'<div style="display:flex;gap:8px"><span style="flex:1"></span><button class="btn">Cancel</button><button class="btn pri">{ic("upload")} Choose where to save…</button></div></div>')
    big = (f'<div class="menu" style="width:420px;padding:16px;display:flex;flex-direction:column;gap:10px;position:absolute;left:820px;top:60px;z-index:5">'
           f'<div class="caps">Other states of this dialog</div>'
           f'<div class="banner" style="--c:var(--ba-warn)">{ic("warn")}<div class="grow" style="font-size:13px"><b>This is a big pack — about 1.4 GB.</b> It will take a few minutes to save and may not fit on a small USB stick. <u>See which pictures are biggest</u></div></div>'
           f'<div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:8px;align-items:center"><b>Saving… 14 of 31 pictures</b><span style="flex:1"></span><span class="mono dim">412 MB of 1.4 GB</span></div>'
           f'<div style="height:8px;border-radius:4px;background:var(--ba-bg-4);overflow:hidden"><i style="display:block;height:100%;width:34%;background:var(--ba-media)"></i></div>'
           f'<div style="display:flex;gap:8px"><span class="faint" style="font-size:12px;flex:1">Nothing is written to the final file until it is complete.</span><button class="btn sm">Cancel</button></div></div>'
           f'<div class="banner" style="--c:var(--ba-danger)">{ic("x")}<div class="grow" style="font-size:13px"><b>“Easter banner” is missing.</b> Nothing was saved. Fix it in <u>Check</u>, then save again.</div></div></div>')
    return page('Save service with pictures', backdrop(dlg + big))


def pack_import():
    """Opening a .bornpack: review before anything is copied."""
    def line(n, sub, state, tone, th):
        return row(n, sub, f'<span class="chip" style="border-color:var({tone});color:var({tone})">{state}</span>', tone, th)
    items = ''.join([
        line('Welcome loop', '6 pictures', f'{ic("plus","sm")} 4 new · 2 already here', '--ba-media', 'p7'),
        line('Baby dedication', '1 picture', f'{ic("plus","sm")} New', '--ba-media', 'p2'),
        line('Offering', '1 picture', f'{ic("check","sm")} Already in your library', '--ba-ok', 'p3'),
        line('Easter banner', '1 picture', f'{ic("warn","sm")} Damaged in the file', '--ba-danger', 'p4'),
    ])
    dlg = (f'<div class="menu" style="width:720px;padding:22px;display:flex;flex-direction:column;gap:14px;position:absolute;left:80px;top:50px;z-index:5">'
           f'<div style="display:flex;align-items:center;gap:10px"><span class="h">Open service pack</span><span style="flex:1"></span>{ic("x")}</div>'
           f'<div class="dim" style="font-size:13px"><b>Sunday 20 Oct — Youth takeover.bornpack</b> · made on 18 Oct 2026 · 56 MB · 9 pictures. Nothing has been copied yet.</div>'
           f'<div style="display:flex;gap:10px"><span class="chip on">{ic("plus","sm")} 5 new</span><span class="chip ok">{ic("check","sm")} 3 already here</span><span class="chip bad">{ic("warn","sm")} 1 damaged</span><span class="chip">{ic("check","sm")} Every file checked against its fingerprint</span></div>'
           f'<div style="display:flex;flex-direction:column;gap:8px">{items}</div>'
           f'<div class="banner" style="--c:var(--ba-danger)">{ic("warn")}<div class="grow" style="font-size:13px"><b>“Easter banner” was damaged when the pack was copied.</b> You can still open the service; that item will show as missing until you add the picture. Ask for the pack again if you can.</div></div>'
           f'<div class="banner" style="--c:var(--ba-live)">{ic("stop")}<div class="grow" style="font-size:13px">Opening does <b>not</b> put anything on a screen, and it <b>replaces your current queue</b> (with Undo).</div></div>'
           f'<div style="display:flex;gap:8px"><span style="flex:1"></span><button class="btn">Cancel — change nothing</button><button class="btn pri">{ic("plus")} Add 5 pictures and open</button></div></div>')
    done = (f'<div class="menu" style="width:380px;padding:16px;display:flex;flex-direction:column;gap:10px;position:absolute;left:830px;top:50px;z-index:5">'
            f'<div class="caps">When it finishes</div>'
            f'<div class="banner" style="--c:var(--ba-ok)">{ic("check")}<div class="grow" style="font-size:13px"><b>Service opened.</b> 5 pictures added, 3 were already here, 1 is missing. 2 backgrounds came with it — set them from <u>Media ▸ Backgrounds</u> if you want them.</div></div>'
            f'<div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:8px;align-items:center"><b>Copying… 3 of 5</b><span style="flex:1"></span><span class="mono dim">21 MB of 36 MB</span></div>'
            f'<div style="height:8px;border-radius:4px;background:var(--ba-bg-4);overflow:hidden"><i style="display:block;height:100%;width:58%;background:var(--ba-media)"></i></div>'
            f'<div style="display:flex;gap:8px"><span class="faint" style="font-size:12px;flex:1">Cancel now and your library and queue stay exactly as they were.</span><button class="btn sm">Cancel</button></div></div></div>')
    return page('Open service pack', backdrop(dlg + done))


def pack_errors():
    """Things that can be wrong with a pack, and with pictures linked from a USB drive."""
    def card(title, tone, icon, text, actions):
        return (f'<div class="panel" style="padding:16px;display:flex;flex-direction:column;gap:10px;--c:var({tone})">'
                f'<div style="display:flex;gap:10px;align-items:center">{ic(icon, "lg")}<b>{title}</b></div>'
                f'<div class="dim" style="font-size:13px">{text}</div><div style="display:flex;gap:8px;flex-wrap:wrap">{actions}</div></div>')
    cards = ''.join([
        card('This isn’t a Born Again pack', '--ba-danger', 'x', '“Sunday.zip” doesn’t have a Born Again manifest, so nothing was opened. Nothing was changed.', '<button class="btn sm">OK</button>'),
        card('The pack is cut short', '--ba-danger', 'warn', 'The file ends before it should — probably a copy that didn’t finish. Copy it again from the original and try again. Nothing was changed.', '<button class="btn sm">OK</button><button class="btn sm">Show file</button>'),
        card('Made by a newer Born Again', '--ba-warn', 'warn', 'This pack is version 3 and this app understands version 1. Update Born Again, or ask for a plain <span class="mono">.born</span> file.', '<button class="btn sm">OK</button>'),
        card('The pack is too big to trust', '--ba-danger', 'warn', 'It claims 40,000 pictures. Born Again stops at 5,000 per pack to protect your computer. Nothing was opened.', '<button class="btn sm">OK</button>'),
        card('Not enough space', '--ba-warn', 'unplug', 'The pictures need 1.4 GB and this computer has 0.9 GB free. Free some space and try again. Nothing was copied.', '<button class="btn sm pri">Try again</button><button class="btn sm">Cancel</button>'),
        card('Wrong kind of file inside', '--ba-danger', 'x', 'The pack holds a file that isn’t a picture. For safety the whole pack was refused; nothing was opened or run.', '<button class="btn sm">OK</button>'),
    ])
    drive = (f'<div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:12px;--c:var(--ba-warn)">'
             f'<div style="display:flex;gap:10px;align-items:center">{ic("unplug","lg")}<span class="h2">Reconnect this drive</span><span style="flex:1"></span><span class="chip warn">3 pictures offline</span></div>'
             f'<div class="dim" style="font-size:13px">These pictures are <b>linked</b> from a USB drive (not copied), and the drive isn’t plugged in: <span class="mono">E:\\Youth\\Slides</span>. Plug it in and press Check again — or point Born Again at the folder if the drive now has a different letter.</div>'
             f'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri">{ic("folder")} Find the folder…</button><button class="btn">Check again</button><button class="btn">Copy them into the library once the drive is back</button></div>'
             f'<div class="faint" style="font-size:12px">They show as “offline” (not “damaged”) and Check flags them before Sunday.</div></div>')
    body = (f'<div style="padding:22px 26px;display:flex;flex-direction:column;gap:14px"><div class="h">Service pack — when something is wrong</div>'
            f'<div class="dim" style="max-width:860px">Every refusal says what happened in plain words, and says that nothing was changed. A pack never opens, runs or shows anything except as a picture.</div>'
            f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">{cards}</div>{drive}</div>')
    return page('Service pack errors and reconnect', app('Media', body))

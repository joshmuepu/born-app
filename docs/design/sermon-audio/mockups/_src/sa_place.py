"""Placement mockups: WHERE the tape lives in the app. Full-app, clickable, simulated tape (12x). PLACEHOLDER CONTENT ONLY (public-domain KJV, "Amazing Grace", John 3:16)."""
from sa_common import *
ICONS['grip'] = '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>'

HYMN = [("Amazing grace! how sweet the sound, That saved a wretch like me! I once was lost, but now am found, Was blind, but now I see.", "Verse 1"),
        ("’Twas grace that taught my heart to fear, And grace my fears relieved; How precious did that grace appear The hour I first believed.", "Verse 2"),
        ("Through many dangers, toils, and snares, I have already come; ’Tis grace hath brought me safe thus far, And grace will lead me home.", "Verse 3")]
VERSES = [("For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", "John 3:16"),
          ("For God sent not his Son into the world to condemn the world; but that the world through him might be saved.", "John 3:17"),
          ("He that believeth on him is not condemned: but he that believeth not is condemned already.", "John 3:18")]
OPT_NAMES = {'today': 'Today', 'a': 'A · Now-playing bar + Tape place', 'b': 'B · Tape service workspace + mini-bar', 'c': 'C · Docked tape panel', 'd': 'D · Tape as a block in the service plan'}

PL_CSS = r"""
html,body{height:auto}body{background:var(--ba-bg-0);overflow:auto}
.scn{max-width:1360px;margin:14px auto 8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font:600 13px var(--ba-font)}
.scn .lab{color:var(--ba-text-3);text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin-right:4px}
.scn button{height:32px;padding:0 12px;border-radius:16px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);color:var(--ba-text-1);font:600 13px var(--ba-font);cursor:pointer}
.scn button.on{background:var(--ba-accent);color:var(--ba-on-accent);border-color:var(--ba-accent)}
.scn .th{margin-left:auto;display:flex;gap:4px}.scn .th button{height:26px;font-size:11px;padding:0 10px}
.stage{width:1360px;height:820px;margin:0 auto;border:1px solid var(--ba-line-strong);border-radius:10px;overflow:hidden;position:relative;background:var(--ba-bg-0);box-shadow:var(--ba-shadow-3)}
.stage.narrow{width:1040px;height:640px}
.pa{display:grid;height:100%;grid-template-columns:64px 1fr var(--qw);grid-template-rows:46px 1fr auto 26px;grid-template-areas:"top top top" "rail work q" "rail bar bar" "st st st";--qw:340px}
.narrow .pa{--qw:0px}
.pa>.top .search{flex:1 1 300px;min-width:220px;max-width:420px;white-space:nowrap;overflow:hidden;margin:0 6px;gap:8px}
.pa>.top .spacer{flex:1}
.pa>.top{grid-area:top;display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--ba-bg-1);border-bottom:1px solid var(--ba-line);grid-column:auto}
.pa>.rail{grid-area:rail;width:auto}
.pa>.work{grid-area:work;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
.pa>.qcol{grid-area:q;border-left:1px solid var(--ba-line);background:var(--ba-bg-1);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.narrow .qcol{display:none}
.pa>.gbar{grid-area:bar;display:none}
.pa>.stt{grid-area:st;grid-column:1/4;display:flex;align-items:center;gap:18px;padding:0 14px;background:var(--ba-bg-1);border-top:1px solid var(--ba-line);font-size:12px;color:var(--ba-text-2)}
.pa>.stt .r{margin-left:auto}
.rail a{cursor:pointer;position:relative}
.rail a .eq{position:absolute;top:6px;right:8px;display:none!important;gap:2px;align-items:flex-end;height:10px}
.rail a .eq i{width:2px;background:var(--ba-ok);border-radius:1px;animation:eq .8s ease-in-out infinite}
.rail a .eq i:nth-child(2){animation-delay:.2s}.rail a .eq i:nth-child(3){animation-delay:.4s}
@keyframes eq{0%,100%{height:3px}50%{height:10px}}
.playing .rail a[data-go=tape] .eq{display:flex!important}
.view{display:none;flex:1;min-height:0;flex-direction:column}
.stage[data-view=sermons] .v-sermons,.stage[data-view=songs] .v-songs,.stage[data-view=bible] .v-bible,.stage[data-view=media] .v-media,.stage[data-view=tape] .v-tape{display:flex}
.vh{padding:12px 18px;border-bottom:1px solid var(--ba-line);display:flex;align-items:center;gap:12px;background:var(--ba-bg-1)}
.vh .t{flex:1;min-width:0}
.scroll-y{overflow:auto;flex:1;min-height:0;padding:14px 18px;display:flex;flex-direction:column;gap:10px}
.rd{flex:1;overflow:hidden;position:relative}
.rd .col{width:100%;max-width:760px;margin:0 auto;padding:10px 0 80px;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.pp .acts{grid-column:2;display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
.pp .no{cursor:pointer}
.row{display:flex;align-items:center;gap:10px}
.cardx{background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-md);padding:12px 14px}
.cardx.cur{border-color:var(--ba-accent);background:var(--ba-accent-wash)}
.hl{display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 10px;border-radius:13px;background:var(--ba-accent-wash);border:1px solid var(--ba-accent);color:var(--ba-text-1);font:700 12px var(--ba-font);cursor:pointer}
.hl .dot{background:var(--ba-ok)}
.qh{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--ba-line)}
.qlist{flex:1;overflow:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px;min-height:0}.qit{flex:none}.qlist>*{flex:none}
.qit{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--ba-line);border-radius:var(--ba-r-md);background:var(--ba-bg-2)}
.qit .k{font:700 10px var(--ba-font);letter-spacing:.08em;text-transform:uppercase;color:var(--ba-text-3);width:74px;flex:none}
.qit.live{border-color:var(--ba-live);background:var(--ba-live-wash)}
.pair{padding:10px 12px;border-top:1px solid var(--ba-line);display:flex;flex-direction:column;gap:8px}
.lvbox{background:#000;border:1px solid var(--ba-line-strong);border-radius:8px;aspect-ratio:16/6;overflow:hidden;color:#f4f2ee;padding:8px 12px;font:400 12.5px/1.4 var(--ser);position:relative}
.lvbox.live{border-color:var(--ba-live)}
.lvbox .tag{position:absolute;right:8px;top:6px;font:700 10px var(--ba-font);letter-spacing:.08em;color:var(--ba-text-3);text-transform:uppercase}
.mlab{display:flex;align-items:center;gap:6px;font:700 10.5px var(--ba-font);letter-spacing:.08em;text-transform:uppercase;color:var(--ba-text-3);margin-bottom:4px}
.mlab.lv{color:var(--ba-live)}
.take{display:flex;gap:8px}.take .btn{flex:1;justify-content:center}
.toastx{position:absolute;left:50%;transform:translateX(-50%);bottom:96px;z-index:50;background:var(--ba-bg-3);border:1px solid var(--ba-line-strong);border-radius:12px;padding:10px 16px;font-weight:600;box-shadow:var(--ba-shadow-3);display:none;max-width:70%}
.toastx.show{display:flex;gap:10px;align-items:center}
.mini{display:none;align-items:center;gap:8px;height:32px;padding:0 6px 0 10px;border-radius:16px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2)}
.mini .mt{font:700 12px var(--ba-mono)}
.mini button{width:26px;height:26px;border-radius:50%;border:0;background:var(--ba-accent);color:var(--ba-on-accent);display:grid;place-items:center;cursor:pointer}
.mini button svg{width:14px;height:14px}
.sp1{flex:1}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--ba-line);padding:0 14px}
.tabs button{height:38px;padding:0 14px;border:0;background:none;color:var(--ba-text-2);font:600 13px var(--ba-font);border-bottom:2px solid transparent;cursor:pointer}
.tabs button.on{color:var(--ba-text-1);border-bottom-color:var(--ba-accent)}
.tabc{display:none}.tabc.on{display:flex;flex-direction:column;gap:12px;flex:1;min-height:0}
.notes{max-width:1360px;margin:22px auto 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}
.notes .n{background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-lg);padding:12px 16px}
.notes .n b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ba-text-3);margin-bottom:4px}
.notes .n p{margin:0;color:var(--ba-text-1);font-size:14px;line-height:1.5}
.big-play{width:56px;height:56px}
.pbar2{display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--ba-bg-1);border-top:1px solid var(--ba-line)}
.pbar2 .seek{max-width:520px}
.tl{height:70px;position:relative;background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:8px;overflow:hidden}
.tl i{position:absolute;bottom:0;width:3px;background:var(--ba-text-3);opacity:.5}
.tl b{position:absolute;top:0;bottom:0;width:2px;background:var(--ba-accent)}
.stw{display:none}
.narrow #gbar .chip{display:none}.embed{overflow:hidden}.embed .scn,.embed .notes{display:none}.embed .stage{margin:0}
.sub-i{font-size:12px;color:var(--ba-text-3)}
.eqbars{display:inline-flex;gap:2px;align-items:flex-end;height:12px}.eqbars i{width:3px;background:var(--ba-ok);border-radius:1px;height:4px}
.playing .eqbars i{animation:eq .8s ease-in-out infinite}.playing .eqbars i:nth-child(2){animation-delay:.2s}.playing .eqbars i:nth-child(3){animation-delay:.4s}
@media (prefers-reduced-motion:reduce){.playing .eqbars i,.rail a .eq i{animation:none}}
"""

RAIL_ITEMS = lambda opt: ([('sermons', 'Sermons', 'quote', '--ba-sermons'), ('bible', 'Bible', 'book', '--ba-bible'), ('songs', 'Songs', 'music', '--ba-songs'), ('media', 'Media', 'image', '--ba-media')]
    + ([('tape', 'Tape', 'headphones', '--ba-sermons')] if opt in ('a', 'b') else []))

def rail_html(opt):
    out = ['<nav class="rail">']
    for v, name, icon, col in RAIL_ITEMS(opt):
        out.append(f'<a data-go="{v}" style="--c:var({col})">{ic(icon, "lg")}{name}<span class="eq"><i></i><i></i><i></i></span></a>')
    out.append('<div class="sp"></div>')
    out.append(f'<a>{ic("saved","lg")}Saved</a><a>{ic("monitor","lg")}Screens</a><a>{ic("cog","lg")}Settings</a></nav>')
    return ''.join(out)

def top_html(opt):
    mini = ''
    if opt == 'b':
        mini = (f'<span class="mini" id="mini" title="Open the Tape service">{ic("headphones","sm")}<span class="mt">¶<span class="js-n">1</span> · <span class="js-time">0:00:26</span></span>'
                f'<button data-sim="play" aria-label="Play / pause"><span class="js-play">{ic("play","sm")}</span><span class="js-pause">{ic("pause","sm")}</span></button></span>')
    if opt == 'c':
        mini = (f'<button class="btn sm" id="dockbtn" style="height:32px">{ic("headphones","sm")} Tape <span class="eqbars"><i></i><i></i><i></i></span> <kbd>T</kbd></button>')
    return (f'<header class="top"><div class="brand">{FLAME}<b>Born</b><span>Again</span></div>'
            f'<div class="search">{ic("search")}Search everything…<kbd>Ctrl K</kbd></div>{mini}'
            f'<span class="spacer"></span><span class="pill ok"><span class="dot"></span>Remote · 2 phones</span><span class="pill live" id="livepill"><span class="dot"></span>LIVE · Main</span></header>')

def reader_html(opt, clean=False):
    rows = []
    for i, (t, x) in enumerate(PARAS):
        rows.append(f'<div class="pp" data-para="{i}"><div class="no" title="Jump the tape here">{i+1}</div><div class="tx">{x}</div><span class="tm">{fmt(t)}</span>'
                    f'<div class="acts"><button class="btn sm ghost">+ Queue</button><button class="btn sm pri" data-act="verse">Project</button></div></div>')
    return f'<div class="rd" id="rd"><div class="col" id="col">{"".join(rows)}</div></div>'

def sermons_view(opt):
    chip = ''
    if opt == 'a':
        chip = f'<span class="hl" id="followchip" data-go="tape" title="Open the Tape place"><span class="dot"></span>Following the tape · ¶<span class="js-n">1</span></span>'
    elif opt == 'b':
        chip = f'<button class="btn sm" data-go="tape">{ic("headphones","sm")} Open in Tape service</button>'
    elif opt == 'c':
        chip = f'<span class="chip on">{ic("headphones","sm")} Tape attached · open panel <kbd>T</kbd></span>'
    elif opt == 'd':
        chip = f'<span class="chip on">{ic("headphones","sm")} Tape is in the plan · ¶<span class="js-n">1</span></span>'
    elif opt == 'today':
        chip = f'<span class="chip on">{ic("headphones","sm")} Tape · 1:52:46 · timed</span><button class="btn sm ghost">Edit timing</button>'
    head = (f'<div class="vh"><div class="t"><div class="caps">Sermon · {CODE}</div><div class="h">{TITLE}</div></div>{chip}</div>')
    extra = ''
    if opt == 'today':
        extra = (f'<div class="pbar" style="border-top:1px solid var(--ba-line)"><div class="row" style="gap:10px"><span class="toggle on"><i></i>Reader follows the tape</span><span class="faint">Text</span><span class="f" style="height:30px">English</span>'
                 f'<span class="chip">Tape options…</span></div><div class="row"><span class="seg"><button class="on">Highlight</button><button>One at a time</button></span><span class="f" style="height:30px">Dark</span><button class="btn sm pri">{ic("monitor","sm")} Put on the screens</button></div>'
                 f'<div class="row"><span class="tc js-time">0:00:26</span>{seek_bar()}<span class="tc r js-left">-1:52:20</span></div><div class="row">{play_controls()}<span class="seg"><button>0.9×</button><button class="on">1×</button><button>1.1×</button></span><span class="chip">{ic("speaker","sm")} System default</span></div></div>')
    return f'<div class="view v-sermons">{head}{reader_html(opt)}{extra}</div>'

def songs_view(opt):
    cards = ''.join(f'<div class="cardx"><div class="caps">{lab}</div><div style="font:400 17px/1.5 var(--ser);margin:6px 0 8px">{x}</div><div class="row"><button class="btn sm pri" data-act="verse">Project</button><button class="btn sm ghost">+ Queue</button></div></div>' for x, lab in HYMN)
    return (f'<div class="view v-songs"><div class="vh"><div class="t"><div class="caps">Song</div><div class="h">Amazing Grace</div></div><span class="chip">Key G</span></div>'
            f'<div class="scroll-y">{cards}</div></div>')

def bible_view(opt):
    cards = ''.join(f'<div class="cardx"><div class="caps">{ref} · KJV</div><div style="font:400 17px/1.5 var(--ser);margin:6px 0 8px">{x}</div><div class="row"><button class="btn sm pri" data-act="verse">Project</button><button class="btn sm ghost">+ Queue</button></div></div>' for x, ref in VERSES)
    return (f'<div class="view v-bible"><div class="vh"><div class="t"><div class="caps">Bible</div><div class="h">John 3</div></div></div><div class="scroll-y">{cards}</div></div>')

def media_view(opt):
    tiles = ''.join(f'<div class="cardx" style="width:200px"><div style="height:90px;border-radius:6px;background:linear-gradient(135deg,var(--ba-bg-4),var(--ba-bg-3))"></div><b style="display:block;margin-top:6px">{n}</b><button class="btn sm pri" style="margin-top:6px" data-act="picture">Project</button></div>' for n in ['Welcome', 'Offering', 'Nursery sign', 'Church logo'])
    vid = f'<div class="cardx" style="width:200px"><div style="height:90px;border-radius:6px;background:linear-gradient(135deg,#31404f,#1b2530);display:grid;place-items:center">{ic("play")}</div><b style="display:block;margin-top:6px">Testimony clip · 2:10</b><button class="btn sm pri" style="margin-top:6px" data-act="video">Take (video)</button></div>'
    extra_tabs = ''
    if opt == 'd':
        extra_tabs = '<div class="row" style="gap:6px"><span class="chip">All media</span><span class="chip on">Recordings</span></div>'
    rec = ''
    if opt == 'd':
        rec = f'<div class="cardx" style="width:100%"><div class="caps">Recordings (tapes)</div><div class="row" style="margin-top:8px"><b>{TITLE}</b><span class="chip ok">{ic("check","sm")} Timed</span><span class="mono dim">1:52:46</span><span class="sp1"></span><button class="btn sm">Timing…</button><button class="btn sm">Add to plan</button></div></div>'
    return (f'<div class="view v-media"><div class="vh"><div class="t"><div class="caps">Media</div><div class="h">All media</div></div></div><div class="scroll-y">{extra_tabs}{rec}<div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-start">{tiles}{vid}</div></div></div>')

def live_pair(opt):
    return (f'<div class="pair"><div><div class="mlab">Preview · next</div><div class="lvbox" id="pvbox">…</div></div>'
            f'<div><div class="mlab lv"><span class="dot"></span>Live · Main <span class="sp1"></span><span class="chip" id="livekind" style="height:20px;font-size:11px">Nothing</span></div><div class="lvbox live" id="lvbox"><span class="tag" id="lvtag"></span><div id="lvtxt" style="opacity:.55">Nothing on the screens</div></div></div>'
            f'<div class="take"><button class="btn pri" data-act="takeprev">Take</button><button class="btn" data-act="clear">Clear</button></div></div>')

def queue_col(opt):
    items = [('Song', 'Amazing Grace'), ('Scripture', 'John 3:16–18'), ('Announce', 'Welcome picture')]
    if opt == 'd':
        items = [('Song', 'Amazing Grace'), ('Scripture', 'John 3:16–18'), ('Tape', TITLE.split(' (')[0]), ('Offering', 'Offering picture')]
    rows = []
    for k, n in items:
        if k == 'Tape':
            rows.append(f'<div class="qit" id="tapeitem" style="flex-direction:column;align-items:stretch;gap:6px;padding:8px 10px;flex:none"><div class="row"><span class="k" style="color:var(--ba-sermons)">Tape</span><b style="flex:1;min-width:0">{n}</b><span class="eqbars"><i></i><i></i><i></i></span></div>'
                        f'<div class="row"><span class="mono js-time" style="font-weight:700">0:00:26</span>{seek_bar()}<span class="mono dim js-left">-1:52:20</span></div>'
                        f'<div class="row" style="gap:6px"><button class="sk" data-sim="prevp" style="width:38px;height:32px">{ic("prev")}</button><button class="play" data-sim="play" style="width:38px;height:38px"><span class="js-play">{ic("play","sm")}</span><span class="js-pause">{ic("pause","sm")}</span></button><button class="sk" data-sim="nextp" style="width:38px;height:32px">{ic("next")}</button>'
                        f'<span class="sp1"></span><span class="sync" id="tsync"><span class="dot"></span>¶<span class="js-n">1</span></span></div>'
                        f'<div class="row" style="gap:6px"><span class="seg"><button class="on" style="padding:0 8px">Highlight</button><button style="padding:0 8px">One</button></span><button class="btn sm pri" data-act="tapescreen" style="margin-left:auto">{ic("monitor","sm")} Put text on the screens</button></div>'
                        f'<div class="sub-i" id="tapenote">Sound plays from here. The text is not on the screens yet.</div></div>')
        else:
            rows.append(f'<div class="qit" data-qk="{k}"><span class="k">{k}</span><span style="flex:1;min-width:0">{n}</span>{ic("grip","sm")}</div>')
    dock = ''
    if opt == 'c':
        dock = tape_dock()
    head = f'<div class="qh"><b class="h2">{"Service plan" if opt == "d" else "Queue"}</b><span class="sp1"></span><span class="chip">{len(items)} items</span></div>'
    if opt == 'c':
        head = '<div class="tabs"><button class="on" data-qtab="queue">Queue</button><button data-qtab="tape">Tape <span class="eqbars"><i></i><i></i><i></i></span></button></div>'
    return f'<aside class="qcol">{head}<div class="qlist" id="qlist">{"".join(rows)}</div>{dock}{live_pair(opt)}</aside>'

def tape_dock():
    nexts = ''.join(f'<div class="qit" data-para="{i}" style="cursor:pointer;padding:6px 8px"><span class="k" style="width:30px">¶{i+1}</span><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{PARAS[i][1]}</span></div>' for i in range(1, 4))
    return (f'<div class="qlist" id="dock" style="display:none;gap:8px"><div class="cardx cur" style="padding:8px 10px"><div class="caps">Now · ¶<span class="js-n">1</span></div><div id="docknow" style="font:400 14px/1.4 var(--ser);margin-top:3px;max-height:4.2em;overflow:hidden">…</div></div>'
            f'<div class="row"><span class="mono js-time" style="font-weight:700">0:00:26</span>{seek_bar()}<span class="mono dim js-left">-1:52:20</span></div>'
            f'<div class="row" style="justify-content:center;gap:6px">{play_controls()}</div>'
            f'<div class="row"><span class="seg"><button class="on" style="padding:0 8px">Highlight</button><button style="padding:0 8px">One</button><button style="padding:0 8px">Lower</button></span></div>'
            f'<button class="btn pri" data-act="tapescreen" style="justify-content:center">{ic("monitor","sm")} Put text on the screens</button>'
            f'<div class="sub-i" id="tapenote">Sound plays from here. The text is not on the screens yet.</div>'
            f'<div class="caps">Next paragraphs</div>{nexts}'
            f'<div class="row" style="gap:6px"><button class="btn sm ghost">Recordings…</button><button class="btn sm ghost">Timing…</button><button class="btn sm ghost">Options…</button></div></div>')

def global_bar():
    title = TITLE.split(" (")[0]
    return ('<div class="gbar" id="gbar" style="display:flex;align-items:center;gap:14px;padding:8px 16px;background:var(--ba-bg-1);border-top:1px solid var(--ba-line);grid-area:bar">'
            f'<div style="min-width:200px;cursor:pointer" data-go="tape"><div class="caps" style="display:flex;gap:6px;align-items:center">{ic("headphones","sm")} Tape <span class="eqbars"><i></i><i></i><i></i></span></div><div style="font-weight:700;white-space:nowrap">{title} · ¶<span class="js-n">1</span></div></div>'
            f'<div class="row" style="gap:8px">{play_controls()}</div>'
            f'<div class="row" style="flex:1;min-width:120px;gap:10px"><span class="tc js-time">0:00:26</span>{seek_bar()}<span class="tc r js-left">-1:52:20</span></div>'
            f'<span class="chip" title="Where the sound comes out">{ic("speaker","sm")} Sanctuary speakers</span>'
            f'<button class="btn sm" id="gscreens" data-act="tapescreen">{ic("monitor","sm")} <span id="gscreens-t">Text: not on the screens</span></button></div>')

def tape_place():
    """Option A: the Tape place (library, follow, timing, options)."""
    lib = (f'<div class="cardx cur"><div class="row"><b style="flex:1">{TITLE}</b><span class="chip ok">{ic("check","sm")} Timed</span></div><div class="sub-i">99-0101M · 1:52:46 · M4A · on this computer</div></div>'
           f'<div class="cardx"><div class="row"><b style="flex:1">Sunday message (placeholder)</b><span class="chip warn">{ic("warn","sm")} Needs timing</span></div><div class="sub-i">00-0001M · 0:48:10 · MP3</div></div>'
           f'<div class="cardx"><div class="row"><b style="flex:1">Wednesday evening (placeholder)</b><span class="chip bad">{ic("warn","sm")} File missing</span></div><div class="sub-i">00-0002M · USB drive not connected</div></div>'
           f'<div class="row" style="margin-top:6px"><button class="btn sm">{ic("folder","sm")} Add a recording</button><button class="btn sm ghost">Tape audio folder…</button></div>')
    follow = (f'<div class="rd" id="rd2" style="flex:1;min-height:0"><div class="col" id="col2">{para_rows("pp")}</div></div>')
    timing = (f'<div class="cardx"><div class="caps">Timeline</div><div class="tl" id="tl">' + ''.join(f'<i style="left:{p[0]/TOTAL*100:.2f}%;height:{20+(k*37)%40}px"></i>' for k, p in enumerate(PARAS)) + f'<b class="js-head" style="left:0"></b></div>'
              f'<div class="row" style="margin-top:8px"><button class="btn sm pri">{ic("tap","sm")} Tap to sync</button><button class="btn sm">{ic("wand","sm")} Suggest timing</button><button class="btn sm ghost">Share timing</button></div></div>')
    opts = (f'<div class="cardx kv"><label>Projector view</label><span class="seg"><button class="on">Highlight</button><button>One at a time</button></span><label>Next paragraph early</label><span>4 s</span><label>Esc</label><span>Blanks; the tape keeps playing (Shift+Esc also pauses)</span><label>When a video plays</label><span>Tape pauses</span></div>')
    return (f'<div class="view v-tape"><div class="vh"><div class="t"><div class="caps">Tape</div><div class="h">Recordings</div></div><span class="chip">{ic("globe","sm")} Text: English</span><span class="chip on">Tape: English</span></div>'
            f'<div style="display:grid;grid-template-columns:300px 1fr;flex:1;min-height:0"><div class="scroll-y" style="border-right:1px solid var(--ba-line)">{lib}</div>'
            f'<div style="display:flex;flex-direction:column;min-height:0"><div class="tabs"><button class="on" data-tab="follow">Follow</button><button data-tab="timing">Timing</button><button data-tab="options">Options</button><button data-tab="add">Add</button></div>'
            f'<div class="tabc on" data-tabc="follow"><div class="row" style="padding:10px 14px;gap:10px"><span class="seg"><button class="on">Highlight</button><button>One at a time</button><button>Lower third</button></span><span class="sp1"></span><button class="btn pri" data-act="tapescreen">{ic("monitor","sm")} Put text on the screens</button></div>{follow}</div>'
            f'<div class="tabc" data-tabc="timing" style="padding:14px">{timing}</div><div class="tabc" data-tabc="options" style="padding:14px">{opts}</div>'
            f'<div class="tabc" data-tabc="add" style="padding:14px"><div class="cardx"><b>Add a recording</b><div class="dim" style="margin:6px 0">Drop a file here, choose your Tape audio folder, or open the publisher’s page to get one.</div><div class="row"><button class="btn sm pri">Choose a file…</button><button class="btn sm">Look in my Tape audio folder</button><button class="btn sm ghost">{ic("globe","sm")} Get audio</button></div></div></div>'
            f'</div></div></div>')

def tape_workspace():
    """Option B: the Tape service workspace (a mode)."""
    return (f'<div class="view v-tape"><div class="vh"><div class="t"><div class="caps">Tape service · {CODE}</div><div class="h">{TITLE.split(" (")[0]}</div></div>'
            f'<span class="chip">{ic("globe","sm")} Text: English</span><span class="chip on">Tape: English</span><span class="sync"><span class="dot"></span>In sync</span>'
            f'<button class="btn sm ghost">Recordings ▾</button><button class="btn sm ghost">Timing…</button><button class="btn sm ghost">Options…</button><button class="btn sm" data-go="sermons">Leave</button></div>'
            f'<div style="display:grid;grid-template-columns:1fr 280px;flex:1;min-height:0"><div class="rd" id="rd2"><div class="col" id="col2" style="max-width:820px">{para_rows("pp")}</div></div>'
            f'<div style="border-left:1px solid var(--ba-line);padding:14px;display:flex;flex-direction:column;gap:12px;background:var(--ba-bg-1)"><div class="caps">On the screens</div><span class="seg" style="width:100%"><button class="on" style="flex:1">Highlight</button><button style="flex:1">One</button></span>'
            f'<button class="btn pri" data-act="tapescreen" style="justify-content:center">{ic("monitor","sm")} Put text on the screens</button><div class="sub-i" id="tapenote">Sound plays here. The text is not on the screens yet.</div>'
            f'<div class="caps" style="margin-top:6px">Jump to paragraph</div><div class="row"><span class="f" style="width:80px">14</span><button class="btn sm">Go</button></div>'
            f'<div class="caps" style="margin-top:6px">Next</div><div class="cardx"><div class="caps">¶<span class="js-n2">2</span> in <span class="js-nextin">0:45</span></div><div id="nexttxt" style="font:400 14px/1.4 var(--ser);margin-top:4px">…</div></div></div></div>'
            f'<div class="pbar2" style="padding:12px 16px;gap:14px">{play_controls()}<span class="tc js-time">0:00:26</span>{seek_bar()}<span class="tc r js-left">-1:52:20</span>'
            f'<span class="seg"><button>0.9×</button><button class="on">1×</button><button>1.1×</button></span><span class="chip">{ic("speaker","sm")} Sanctuary speakers</span></div></div>')

PL_JS = r"""
const OPT='%%OPT%%';const stage=document.getElementById('stage');
const S={view:'sermons',screens:'none',narrow:false,video:false,verseOn:false,tapeScreen:false};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function toast(t,btn){const e=$('#toastx');e.innerHTML='<span>'+t+'</span>'+(btn||'');e.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>e.classList.remove('show'),5200)}
function go(v){if(!$('.v-'+v)){return}S.view=v;stage.dataset.view=v;$$('.rail a[data-go]').forEach(a=>a.classList.toggle('on',a.dataset.go===v));render()}
function setNarrow(n){S.narrow=n;stage.classList.toggle('narrow',n);$$('[data-scn=narrow]').forEach(b=>b.classList.toggle('on',n));render()}
function liveText(){if(S.screens==='tape'){const i=idxAt(sim.t);return i>=0?DATA[i].text:''}if(S.screens==='verse')return '“For God so loved the world, that he gave his only begotten Son…” — John 3:16';if(S.screens==='picture')return '[ Welcome picture ]';if(S.screens==='video')return '[ Video: Testimony clip — playing ]';return 'Nothing on the screens'}
function render(){const i=idxAt(sim.t);
 $$('.js-n').forEach(e=>e.textContent=i+1);$$('.js-n2').forEach(e=>e.textContent=i+2);
 const kind={none:'Nothing',tape:'Tape text',verse:'Verse',picture:'Picture',video:'Video'}[S.screens];const lt=$('#livekind');if(lt){lt.textContent=kind}
 const lv=$('#lvtxt');if(lv){lv.textContent=liveText().slice(0,170);lv.style.opacity=S.screens==='none'?.55:1}
 const pv=$('#pvbox');if(pv)pv.textContent=S.screens==='tape'?'Next: '+(DATA[i+1]?DATA[i+1].text.slice(0,90)+'…':''):'“For God sent not his Son into the world to condemn the world…”';
 const note=S.tapeScreen?'The tape’s text is on the screens and follows the tape.':(sim.playing?'Sound is playing. The tape’s text is NOT on the screens — press “Put text on the screens”.':'Sound plays from here. The text is not on the screens yet.');
 $$('#tapenote').forEach(e=>e.textContent=S.screens==='tape'?'The text on the screens follows the tape.':(S.tapeScreen===false&&S.verseOn?'A verse is on the screens, so the tape text is off. The tape keeps playing.':note));
 const gs=$('#gscreens-t');if(gs)gs.textContent=S.screens==='tape'?'Text: on the screens':'Text: not on the screens';const gb=$('#gscreens');if(gb)gb.classList.toggle('pri',S.screens==='tape');
 const mini=$('#mini');if(mini)mini.style.display=(OPT==='b'&&S.view!=='tape')?'inline-flex':'none';
 const gbar=$('#gbar');if(gbar)gbar.style.display='flex';
 if(OPT==='a'){stage.querySelector('.pa').style.gridTemplateRows='46px 1fr auto 26px'}
 ['rd','rd2'].forEach(id=>{const rd=document.getElementById(id);if(!rd||!rd.offsetParent)return;const col=rd.firstElementChild;const pps=[...col.children];pps.forEach((p,k)=>{p.classList.toggle('cur',k===i);p.classList.toggle('past',k<i)});if(i>=0&&(id==='rd2'||follow)){col.style.transform='translateY('+Math.min(0,-(pps[i].offsetTop-rd.clientHeight*0.28))+'px)'}});
 const dn=$('#docknow');if(dn&&i>=0)dn.textContent=DATA[i].text;const nt=$('#nexttxt');if(nt&&DATA[i+1])nt.textContent=DATA[i+1].text.slice(0,110)+'…';
 $('#livepill').className='pill live'+(S.screens==='none'?' ':'');
 $$('.rail a[data-go="tape"]').forEach(a=>a.classList.toggle('on',S.view==='tape'));
}
let follow=true;
onSim((i,t)=>render());
document.addEventListener('click',e=>{
 const g=e.target.closest('[data-go]');if(g&&!e.target.closest('[data-sim]')){go(g.dataset.go)}
 const a=e.target.closest('[data-act]');if(a){const k=a.dataset.act;
  if(k==='verse'){S.screens='verse';S.verseOn=true;S.tapeScreen=false;toast('Verse is on the screens. The tape keeps playing.',OPT==='today'?'':'<button class="btn sm" data-act="tapescreen">Back to the tape text</button>')}
  else if(k==='picture'){S.screens='picture';S.verseOn=true;toast('Picture is on the screens. The tape keeps playing.')}
  else if(k==='video'){S.screens='video';S.verseOn=true;if(sim.playing){sim.playing=false;emit()}toast('Tape paused for the video — press Play to resume it afterwards.')}
  else if(k==='tapescreen'){S.screens='tape';S.tapeScreen=true;S.verseOn=false;toast('The tape’s text is on the screens. It follows the tape; Esc blanks it and the tape keeps playing.')}
  else if(k==='clear'){S.screens='none';S.tapeScreen=false;S.verseOn=false}
  else if(k==='takeprev'){S.screens='verse';S.verseOn=true;toast('Verse is on the screens. The tape keeps playing.')}
  render()}
 const sc=e.target.closest('[data-scn]');if(sc){const k=sc.dataset.scn;scene(k)}
 const tb=e.target.closest('[data-tab]');if(tb){$$('[data-tab]').forEach(b=>b.classList.toggle('on',b===tb));$$('[data-tabc]').forEach(c=>c.classList.toggle('on',c.dataset.tabc===tb.dataset.tab));render()}
 const qt=e.target.closest('[data-qtab]');if(qt){$$('[data-qtab]').forEach(b=>b.classList.toggle('on',b===qt));const tp=qt.dataset.qtab==='tape';$('#dock').style.display=tp?'flex':'none';$('#qlist').style.display=tp?'none':'flex';render()}
 if(e.target.closest('#dockbtn')){const d=$('#dock');const open=d.style.display==='flex';const b=document.querySelector('[data-qtab='+(open?'queue':'tape')+']');if(b)b.click()}
 if(e.target.closest('#mini')&&!e.target.closest('[data-sim]'))go('tape');
 if(e.target.closest('#tapeitem')&&OPT==='d'){}
});
document.addEventListener('keydown',e=>{if(OPT==='c'&&(e.key==='t'||e.key==='T')&&!e.target.matches('input')){const b=$('#dockbtn');if(b)b.click()}});
function scene(k){$$('[data-scn]').forEach(b=>b.classList.toggle('on',b.dataset.scn===k));
 if(k==='narrow'){setNarrow(!S.narrow);return}
 S.screens='none';S.verseOn=false;S.tapeScreen=false;setNarrow(false);sim.playing=true;
 if(k==='playing'){go('sermons')}
 else if(k==='songs'){go('songs');toast('You are on Songs. The tape keeps playing — '+(OPT==='today'?'but nothing here shows it.':OPT==='b'?'its mini-bar is in the top bar.':OPT==='c'?'its panel is one key (T) away.':OPT==='d'?'it is still in your plan on the right.':'its bar is at the bottom.'))}
 else if(k==='verse'){go('bible');S.screens='verse';S.verseOn=true;toast('Verse is on the screens. The tape keeps playing; its text is off the screens.')}
 else if(k==='video'){go('media');S.screens='video';S.verseOn=true;sim.playing=false;toast('Tape paused for the video — press Play to resume it afterwards.')}
 else if(k==='stopped'){sim.playing=false;go('sermons')}
 emit();render()}
const q=new URLSearchParams(location.search);if(q.get('embed'))document.body.classList.add('embed');
$$('.th button').forEach(b=>b.addEventListener('click',()=>{document.documentElement.dataset.theme=b.dataset.themeBtn;$$('.th button').forEach(x=>x.classList.toggle('on',x===b))}));
document.addEventListener('DOMContentLoaded',()=>{});
go('sermons');render();
const sc0=q.get('scene');if(sc0){scene(sc0);if(q.get('narrow')==='1')setNarrow(true)}else{sim.playing=true;emit()}
if(q.get('tab')){const tb=$('[data-tab='+q.get('tab')+']');if(tb)tb.click()}
if(q.get('qtab')){const qt=$('[data-qtab='+q.get('qtab')+']');if(qt)qt.click()}
if(q.get('dock')==='1'){const b=$('#dockbtn');if(b)b.click()}
if(q.get('view'))go(q.get('view'));
"""

def notes_html(rows):
    return '<div class="notes">' + ''.join(f'<div class="n"><b>{k}</b><p>{v}</p></div>' for k, v in rows) + '</div>'

def scenario_bar(opt):
    btn = lambda k, t: f'<button data-scn="{k}">{t}</button>'
    return (f'<div class="scn"><span class="lab">{OPT_NAMES[opt]} · try:</span>{btn("playing","Tape playing in Sermons")}{btn("songs","Go to Songs")}{btn("verse","Put a verse on the screens")}{btn("video","A video starts")}{btn("narrow","Narrow window (1040×640)")}{btn("stopped","Tape stopped")}'
            f'<span class="th"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></span></div>')

def build(opt, notes):
    work = sermons_view(opt) + songs_view(opt) + bible_view(opt) + media_view(opt)
    if opt == 'a':
        work += tape_place()
    elif opt == 'b':
        work += tape_workspace()
    gbar = global_bar() if opt == 'a' else ''
    tail_bar = ''
    app = (f'<div class="pa">{top_html(opt)}{rail_html(opt)}<main class="work">{work}</main>{queue_col(opt)}{gbar}'
           f'<footer class="stt"><span>Main · Congregation ● Stage ● Graphics ●</span><span class="r">Born Again v2.0.0-dev.1 · mockup with a pretend tape (12× speed): Space plays/pauses · click a ¶ number to jump the tape</span></footer></div>'
           f'<div class="toastx" id="toastx"></div>')
    body = (f'{scenario_bar(opt)}<div class="stage" id="stage" data-view="sermons">{app}</div>{notes_html(notes)}'
            + sim_js(26) + '<script>' + PL_JS.replace('%OPT%', opt) + '</script>' + "<script>(function(){var t=document.documentElement.dataset.theme||'dark';document.querySelectorAll('[data-theme-btn]').forEach(function(b){b.classList.toggle('on',b.dataset.themeBtn===t)})})()</script>")
    return full_page(f'Placement — {OPT_NAMES[opt]}', body, PL_CSS)

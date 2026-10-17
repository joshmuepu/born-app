from sa_common import *

SERMON_HEAD = lambda: (f'<div style="padding:14px 22px;border-bottom:1px solid var(--ba-line);display:flex;align-items:center;gap:14px;background:var(--ba-bg-1)">'
    f'<div style="flex:1;min-width:0"><div class="caps">Sermon · {CODE}</div><div class="h" style="margin-top:2px">{TITLE}</div></div>'
    f'<span class="chip">{ic("globe","sm")} Text: English</span><span class="chip on">{ic("headphones","sm")} Tape: English · 1:52:46</span>'
    f'<span class="sync" id="syncpill"><span class="dot"></span>In sync</span></div>')

def reader():
    pb = (f'<div class="pbar"><div class="row"><span class="tc js-time">0:00:26</span>{seek_bar()}<span class="tc r js-left">-1:52:20</span></div>'
          f'<div class="row">{play_controls()}<span style="width:14px"></span>'
          f'<span class="seg"><button>0.9×</button><button class="on">1×</button><button>1.1×</button><button>1.25×</button></span>'
          f'<span class="vol" style="margin-left:6px">{ic("vol","sm")}<span class="bar"><i style="width:80%"></i></span></span>'
          f'<span class="chip" title="Where the sound comes out">{ic("speaker","sm")} Sanctuary speakers</span><span style="flex:1"></span>'
          f'<span class="toggle on" id="followTg"><i></i>Reader follows the tape</span>'
          f'<span class="toggle on"><i></i>Projector follows</span></div></div>')
    main = (SERMON_HEAD() + f'<div class="reader" id="rd"><div class="col" id="col">{para_rows()}</div>'
            f'<div class="demo" style="top:8px;bottom:auto">Simulation: the tape runs 12× faster than real · click a paragraph to jump the tape there · Space = play/pause</div></div>' + pb)
    queue = (f'<div class="qh"><b class="h2">Preview / Live</b></div><div style="padding:14px;display:flex;flex-direction:column;gap:12px">'
             f'<div class="mon lv"><div class="lb"><span class="dot"></span>Live · Main</div><div class="scr" style="background:#000;padding:10px 12px;aspect-ratio:16/9;overflow:hidden;color:#f4f2ee;font:400 13px/1.35 var(--ser);position:relative">'
             f'<div style="opacity:.35" id="lvprev">…</div><div id="lvcur" style="margin-top:4px;font-size:15px"></div></div>'
             f'<div class="tm"><span>Tape mode · highlight view</span><span class="js-time">0:00:26</span></div></div>'
             f'<div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:9px"><div class="caps">Projector view</div>'
             f'<div class="seg" style="width:100%"><button class="on" style="flex:1">Highlight</button><button style="flex:1">One at a time</button><button style="flex:1">Lower third</button></div>'
             f'<div class="faint" style="font-size:12px">Paragraph-at-a-time shows the next paragraph 4 s early.</div></div>'
             f'<div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:6px"><div class="caps">Safety</div>'
             f'<div style="display:flex;gap:8px;align-items:center">{ic("blank","sm")}<span><b>Esc</b> blanks the screens, the tape keeps playing</span></div>'
             f'<div style="display:flex;gap:8px;align-items:center">{ic("stop","sm")}<span><kbd>Shift</kbd>+<kbd>Esc</kbd> also pauses the tape</span></div></div></div>')
    body = app('Sermons', main, queue, topx=themes_buttons()) + sim_js() + """<script>
const col=document.getElementById('col'),rd=document.getElementById('rd');const pps=[...col.children];let follow=true;
document.getElementById('followTg').addEventListener('click',()=>{follow=document.getElementById('followTg').classList.contains('on');if(follow)onSim.last&&onSim.last()});
onSim((i,t)=>{pps.forEach((p,k)=>{p.classList.toggle('cur',k===i);p.classList.toggle('past',k<i)});
 if(follow&&i>=0){const top=pps[i].offsetTop;col.style.transform='translateY('+Math.min(0,-(top-rd.clientHeight*0.28))+'px)'}
 document.getElementById('lvcur').textContent=i>=0?DATA[i].text.slice(0,150)+(DATA[i].text.length>150?'…':''):'';document.getElementById('lvprev').textContent=i>0?DATA[i-1].text.slice(0,60)+'…':'';
});onSim.last=()=>emit();emit();
</script>"""
    return full_page('Sermon reader with follow-along', body)

def attach():
    dlg = f"""<div style="position:absolute;inset:0;background:var(--ba-scrim);display:grid;place-items:center;z-index:20"><div class="panel" style="width:820px;box-shadow:var(--ba-shadow-3);display:flex;flex-direction:column">
<div style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--ba-line)"><div><div class="caps">Sermon {CODE} · {TITLE}</div><div class="h">Add the tape for this sermon</div></div><span style="flex:1"></span><button class="btn icon ghost">{ic("x")}</button></div>
<div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px">
<p class="dim">The tape plays from a <b>file on this computer</b>, so it works with no internet in the middle of a service. Born Again keeps its own copy (like pictures and video).</p>
<div class="row2"><div class="scard" style="border-color:var(--ba-accent);box-shadow:0 0 0 1px var(--ba-accent)"><h3>{ic("folder")} Use a file from this computer <span class="chip on">Recommended</span></h3><div class="dim">MP3, M4A (AAC), WAV, OGG or FLAC. Drag it here or choose it.</div><div style="display:flex;gap:8px"><button class="btn pri">{ic("upload","sm")} Choose a file…</button><button class="btn">Link, don’t copy</button></div></div>
<div class="scard"><h3>{ic("download")} Get the file first</h3><div class="dim">Open the rights holder’s own download page in your browser, save the audio, then choose it on the left. Born Again never downloads it for you.</div><div style="display:flex;gap:8px"><button class="btn">{ic("globe","sm")} Open the download page</button></div></div></div>
<div class="scard" style="opacity:.7"><h3>{ic("zap")} Stream it <span class="chip">Not available yet</span></h3><div class="dim">Streaming needs the internet all service long and the rights holder’s permission. It is listed for a later version.</div></div>
<div><div class="caps" style="margin-bottom:6px">Files Born Again found on this computer</div>
<table class="tbl"><tr><th>File</th><th>Length</th><th>Matches this sermon?</th><th></th></tr>
<tr><td>{ic("audio","sm")} 00-0000-sample-message.m4a</td><td class="mono">1:52:46</td><td><span class="chip ok">{ic("check","sm")} Length fits (text says about 1 h 52 m)</span></td><td><button class="btn sm pri">Use this</button></td></tr>
<tr><td>{ic("audio","sm")} sermon-recording-07.mp3</td><td class="mono">0:48:10</td><td><span class="chip warn">{ic("warn","sm")} Much shorter than expected</span></td><td><button class="btn sm">Use anyway</button></td></tr></table></div>
<div class="scard"><h3>{ic("check")} Checking 00-0000-sample-message.m4a</h3>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px"><span class="chip ok">{ic("check","sm")} The whole file is there (not cut short)</span><span class="chip ok">{ic("check","sm")} It plays on this computer</span><span class="chip ok">{ic("check","sm")} Length 1:52:46 fits the sermon</span><span class="chip warn">{ic("warn","sm")} No paragraph timing yet</span></div>
<div class="banner" style="--c:var(--ba-warn)">{ic("wand")}<span class="grow"><b>Next step: make the text follow the tape.</b> Tap along once while you listen, or let Born Again propose the timing and you correct it. You only do this once per recording.</span><button class="btn sm pri">{ic("tap","sm")} Tap to sync</button><button class="btn sm">{ic("wand","sm")} Propose automatically</button></div></div></div>
<div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--ba-line)"><button class="btn">Not now</button><button class="btn pri">Attach to this sermon</button></div></div></div>"""
    main = SERMON_HEAD().replace('In sync','No timing yet').replace('class="sync"','class="sync warn"') + f'<div class="reader"><div class="col" style="opacity:.5">{para_rows()}</div></div>' + dlg
    return full_page('Attach audio to a sermon', app('Sermons', main, '') + themes_buttons() + sim_js())

def screen_highlight():
    body = f"""<div class="sheet"><div class="cap"><b>Projector view 1 — Highlight.</b> A screenful of the sermon; the paragraph being spoken is bright with a large number, the rest is dimmed, and the text glides to keep the current paragraph in the upper third. Readable from the back of a hall (39 px text on a 720 p frame = about 5.4 % of the screen height).</div>
<div class="screen" id="scr"><div class="fade-t"></div><div class="scroll" id="sc">{para_rows('pj')}</div><div class="fade-b"></div><div class="foot"><span>{TITLE}</span><span class="js-time">0:00:26</span></div></div>
<div class="demo-strip"><div style="display:flex;align-items:center;gap:8px">{play_controls()}</div><span class="chip">Simulation 12× · Space = play/pause · click a paragraph to jump</span>{themes_buttons().replace('class="themes"','class="themes" style="position:static"')}</div></div>"""
    js = """<script>const sc=document.getElementById('sc'),scr=document.getElementById('scr');const pjs=[...sc.children];
onSim((i,t)=>{pjs.forEach((p,k)=>p.classList.toggle('cur',k===i));if(i>=0)sc.style.transform='translateY('+Math.min(0,-(pjs[i].offsetTop-150))+'px)'});emit();</script>"""
    return full_page('Projector view 1 — highlight', body + sim_js() + js)

def screen_single():
    body = f"""<div class="sheet"><div class="cap"><b>Projector view 2 — One paragraph at a time.</b> Each paragraph fills the screen and changes when the tape reaches the next one. <b>“Show next paragraph early”</b> (here 4 s) changes it slightly before the speaker starts it, so the congregation can read ahead; the slim bar at the bottom counts down to the change. A long paragraph is split across pages of the same size the Sermons projector already uses, and moves to the next page by how far the tape is through the paragraph.</div>
<div class="screen"><div style="position:absolute;inset:0;display:grid;grid-template-columns:150px 1fr;padding:80px 90px 120px 40px;align-items:center"><div id="n" style="font:300 150px/1 var(--ba-font);text-align:right;padding-right:34px;color:var(--pj-no)"></div><div id="x" style="font:400 50px/1.4 var(--ser);transition:opacity .35s"></div></div>
<div style="position:absolute;left:60px;right:60px;bottom:52px;display:flex;align-items:center;gap:16px;font:700 15px var(--ba-font);letter-spacing:.06em;color:var(--pj-fg);opacity:.75"><span id="nxt">NEXT ¶ — </span><span style="flex:1;height:5px;border-radius:3px;background:color-mix(in srgb,var(--pj-fg) 20%,transparent);position:relative;overflow:hidden"><i id="bar" style="position:absolute;left:0;top:0;bottom:0;background:var(--pj-no);width:0"></i></span><span id="cd"></span></div></div>
<div class="demo-strip"><div style="display:flex;align-items:center;gap:8px">{play_controls()}</div><span class="dim">Show next early:</span><span class="range"><i style="width:40%"></i><b style="left:40%"></b></span><b>4 s</b>{themes_buttons().replace('class="themes"','class="themes" style="position:static"')}</div></div>"""
    js = """<script>const LEAD=4;let shown=-2;
onSim((i,t)=>{let show=i;const nx=DATA[i+1];if(nx&&nx.t-t<=LEAD)show=i+1;if(show<0)show=0;
 if(show!==shown){shown=show;const x=document.getElementById('x');x.style.opacity=0;setTimeout(()=>{document.getElementById('n').textContent=DATA[show].n;x.textContent=DATA[show].text;x.style.fontSize=DATA[show].text.length>230?'38px':DATA[show].text.length>150?'44px':'52px';x.style.opacity=1},180)}
 const n2=DATA[i+1];document.getElementById('nxt').textContent=n2?'NEXT ¶ '+n2.n:'END OF TEXT';if(n2){const left=n2.t-t,span=n2.t-DATA[i].t;document.getElementById('bar').style.width=(100-left/span*100)+'%';document.getElementById('cd').textContent=left<=LEAD?'changing…':fmt(left)}else{document.getElementById('bar').style.width='100%';document.getElementById('cd').textContent=''}});emit();</script>"""
    return full_page('Projector view 2 — paragraph at a time', body + sim_js() + js)

def lower_stage():
    body = f"""<div class="sheet"><div class="cap"><b>Livestream lower third (OBS / Graphics)</b> and <b>stage monitor</b>. The lower third shows only the current paragraph, two lines at a time, cycling through a long one as the tape moves; the stage monitor tells the speaker or sound desk where the tape is, what comes next, and whether the sync can be trusted.</div>
<div class="row2" style="align-items:start"><div><div class="caps" style="margin-bottom:6px">OBS lower third (transparent over the camera)</div>
<div style="width:620px;height:349px;border-radius:8px;position:relative;overflow:hidden;background:linear-gradient(160deg,#1f4e79,#7fb0d9 55%,#e7c9a0);box-shadow:0 0 0 1px var(--ba-line-strong)"><div style="position:absolute;left:6%;right:6%;bottom:6%;background:rgba(10,8,6,.92);border-radius:10px;padding:12px 18px;color:#fff"><div style="display:flex;gap:10px;align-items:baseline"><span style="font:600 11px var(--ba-font);letter-spacing:.12em;color:#c9a86a">SERMON · ¶ <span id="ln">1</span></span></div><div id="lt" style="font:400 19px/1.35 var(--ser);margin-top:4px"></div></div></div></div>
<div><div class="caps" style="margin-bottom:6px">Stage monitor</div><div style="width:620px;height:349px;border-radius:8px;background:#000;color:#fff;padding:20px 26px;display:flex;flex-direction:column;gap:8px;box-shadow:0 0 0 1px var(--ba-line-strong)">
<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="mono" style="font-size:44px;font-weight:700" class="js-time"><span class="js-time">0:00:26</span></span><span class="mono" style="color:#b2afaa;font-size:20px"><span class="js-left">1:52:20</span></span></div>
<div style="height:5px;background:#27272d;border-radius:3px;position:relative"><i class="js-fill" style="position:absolute;left:0;top:0;bottom:0;background:var(--ba-accent);border-radius:3px"></i></div>
<div style="font:600 12px var(--ba-font);letter-spacing:.1em;color:#8a8782;margin-top:4px">NOW · ¶ <span id="sn">1</span></div><div id="st" style="font:400 22px/1.35 var(--ser)"></div>
<div style="font:600 12px var(--ba-font);letter-spacing:.1em;color:#8a8782;margin-top:6px">NEXT · ¶ <span id="sn2">2</span> in <span id="sin">0:00</span></div><div id="sx" style="font:400 15px/1.35 var(--ser);color:#b2afaa"></div>
<div style="margin-top:auto"><span class="sync"><span class="dot"></span>In sync</span></div></div></div></div>
<div class="demo-strip"><div style="display:flex;align-items:center;gap:8px">{play_controls()}</div><span class="chip">Simulation 12×</span></div></div>"""
    js = """<script>let pg=0;
onSim((i,t)=>{if(i<0)i=0;const p=DATA[i],nx=DATA[i+1];const L=p.text.length;const pages=Math.max(1,Math.ceil(L/150));const end=nx?nx.t:p.t+60;const f=Math.min(0.999,(t-p.t)/(end-p.t));const k=Math.floor(f*pages);
 const w=p.text.split(' ');const per=Math.ceil(w.length/pages);document.getElementById('lt').textContent=w.slice(k*per,(k+1)*per).join(' ')+(pages>1?'  ('+(k+1)+'/'+pages+')':'');document.getElementById('ln').textContent=p.n;
 document.getElementById('sn').textContent=p.n;document.getElementById('st').textContent=p.text.slice(0,170)+(L>170?'…':'');document.getElementById('sn2').textContent=nx?nx.n:'—';document.getElementById('sin').textContent=nx?fmt(nx.t-t).replace(/^0:/,''):'';document.getElementById('sx').textContent=nx?nx.text.slice(0,90)+'…':'End of the text'});emit();</script>"""
    return full_page('Lower third and stage monitor', body + sim_js() + js)

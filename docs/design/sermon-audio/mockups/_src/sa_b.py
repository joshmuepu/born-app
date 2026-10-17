from sa_common import *
import random

def languages():
    EN, ES, AR = PARAS[0][1], "Jehová es mi pastor; nada me faltará. En lugares de delicados pastos me hará yacer; junto a aguas de reposo me pastoreará.", "الرب راعيّ فلا يعوزني شيء. في مراعٍ خضر يربضني. إلى ماء الراحة يوردني."
    scen = lambda t, d, on=False: f'<div class="scard" style="{"border-color:var(--ba-accent);box-shadow:0 0 0 1px var(--ba-accent)" if on else ""}"><h3>{t}</h3><div class="dim">{d}</div></div>'
    body = f"""<div class="sheet"><div class="cap"><b>Languages.</b> The <b>text language</b> and the <b>tape language</b> are chosen separately. The tape’s timing is stored against <b>paragraph numbers</b>, so it can drive any text language whose numbering matches. When it does not match, Born Again says so before the service and shows where.</div>
<div class="row2" style="align-items:start"><div style="display:flex;flex-direction:column;gap:14px">
<div class="scard"><h3>{ic("globe")} Language for this sermon</h3><div class="kv"><label>Text on screen</label><div class="f">{ic("doc","sm")} Spanish (Español) {ic("chevd","sm")}</div><label>Tape (the recording)</label><div class="f">{ic("headphones","sm")} English · 1:52:46 {ic("chevd","sm")}</div><label>Timing used</label><div class="f" style="border-color:var(--ba-ok);color:var(--ba-ok)">{ic("check","sm")} English tape · by paragraph number</div></div>
<div class="banner" style="--c:var(--ba-warn)">{ic("warn")}<span class="grow"><b>English has 207 paragraphs, the Spanish text has 205.</b> Paragraphs 1–112 match. From 113 the numbers may be off by 2. Check the highlighted list or fix it in the sync editor.</span><button class="btn sm">See the differences</button></div></div>
<div class="scard"><h3>The four ways it is used</h3><div style="display:grid;gap:8px">
{scen('A · English tape, English text','The normal case. Works as soon as the tape is attached and timed. <span class="chip on">Slice 1–5</span>',True)}
{scen('B · English tape, translated text on the screen','A local-language congregation hears the interpreter; the screen follows the English tape in their language. Needs paragraph numbers to match. <span class="chip on">Slice 6</span>')}
{scen('C · A dubbed recording with its own timing','A different recording, so its own sync map; text language is chosen on its own. <span class="chip">Slice 6</span>')}
{scen('D · Two languages side by side','Both texts follow the same tape. <span class="chip">Later slice</span>')}</div></div></div>
<div><div class="caps" style="margin-bottom:6px">D · Side by side on the projector (English tape · English + Arabic text)</div>
<div class="screen" style="width:780px;height:439px"><div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr">
<div style="padding:34px 30px;border-right:1px solid color-mix(in srgb,var(--pj-fg) 18%,transparent)"><div style="font:600 12px var(--ba-font);letter-spacing:.12em;opacity:.6">ENGLISH · ¶ 1</div><div style="font:400 24px/1.45 var(--ser);margin-top:12px">{EN}</div></div>
<div style="padding:34px 30px" dir="rtl"><div style="font:600 12px var(--ba-font);letter-spacing:.12em;opacity:.6">العربية · ¶ ١</div><div style="font:400 26px/1.7 'Geeza Pro','Noto Naskh Arabic',serif;margin-top:12px">{AR}</div></div></div></div>
<div class="caps" style="margin:14px 0 6px">B · Spanish text on the screen, English tape</div>
<div class="screen" style="width:780px;height:439px"><div style="position:absolute;inset:0;padding:50px 60px;display:grid;grid-template-columns:90px 1fr;align-items:center"><div style="font:300 90px/1 var(--ba-font);text-align:right;padding-right:22px;color:var(--pj-no)">1</div><div style="font:400 32px/1.45 var(--ser)">{ES}</div></div></div>
<div class="cap" style="margin-top:10px">Right-to-left text lines up from the right and keeps its own font; side-by-side keeps each column’s own direction. The player bar’s language button opens this picker instead of switching the tape.</div></div></div></div>"""
    return full_page('Languages', body, cls='tall')

def sync_editor():
    random.seed(7)
    bars = ''.join(f'<rect x="{i*3}" y="{40-h}" width="2" height="{h*2}" fill="currentColor" opacity=".55"/>' for i, h in enumerate(int(4+abs(random.gauss(0,1))*(8 if 20 < i % 200 < 150 else 3)) for i in range(0, 400)))
    W = 1200
    mk = ''.join(f'<div class="mkr" data-i="{i}" style="left:{p[0]/1290*100:.2f}%"><span>{i+1}</span></div>' for i, p in enumerate(PARAS[:9]))
    css = """.wave{position:relative;height:96px;background:var(--ba-bg-1);border:1px solid var(--ba-line);border-radius:var(--ba-r-md);overflow:hidden;color:var(--ba-text-3);cursor:pointer}
.wave svg{position:absolute;left:0;top:8px;width:100%;height:80px}.wave .nt{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,var(--ba-bg-3) 0 8px,var(--ba-bg-4) 8px 16px);opacity:.8}
.mkr{position:absolute;top:0;bottom:0;width:2px;background:var(--ba-accent)}.mkr span{position:absolute;top:2px;left:3px;font:700 11px var(--ba-mono);color:var(--ba-accent);background:var(--ba-bg-1);padding:0 3px;border-radius:3px}
.mkr.new{background:var(--ba-ok)}.mkr.new span{color:var(--ba-ok)}
.wave .ph2{position:absolute;top:0;bottom:0;width:2px;background:var(--ba-text-1);z-index:3}
.srow{display:grid;grid-template-columns:36px 90px 1fr 140px 120px;gap:10px;align-items:center;padding:7px 12px;border-bottom:1px solid var(--ba-line)}
.srow.un{opacity:.55}.srow.cur{background:var(--ba-accent-wash)}.srow .tx{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--ser);color:var(--ba-text-2)}"""
    rows = ''
    for i, (t, x) in enumerate(PARAS[:14]):
        st = 'ok' if i < 9 else 'un'
        t_s = fmt(t) if i < 9 else '—'
        flag = ''
        if i == 12: flag = f'<span class="chip warn">{ic("flag","sm")} Tape differs here</span>'
        if i == 4: flag = f'<span class="chip">{ic("wand","sm")} auto · 92 %</span>'
        rows += f'<div class="srow {"" if i<9 else "un"}" id="sr{i}"><b class="mono">{i+1}</b><span class="mono" id="st{i}">{t_s}</span><span class="tx">{x[:70]}…</span><span>{flag}</span><span style="display:flex;gap:4px"><button class="btn sm icon" title="−0.1 s">−</button><button class="btn sm icon" title="+0.1 s">+</button><button class="btn sm icon" title="Play from here">{ic("play","sm")}</button></span></div>'
    body = f"""<div class="sheet"><div class="cap"><b>Sync editor (tap to sync / correct).</b> Listen, press <kbd>Space</kbd> (or Tap) at the start of each numbered paragraph. Nudge by 0.1 s, drag markers, undo, play from any marker. Mark places where the tape has <b>no text</b> (intro, songs, prayer) or <b>differs</b> from the text. Auto-proposed times show how sure Born Again was; low-confidence ones are listed first for review.</div>
<div class="scard"><div style="display:flex;align-items:center;gap:12px"><b class="h2">Timeline 0:00 – 21:30</b><span class="chip on">9 of 20 paragraphs timed</span><span style="flex:1"></span><span class="chip">{ic("wave","sm")} Zoom · −  +</span></div>
<div class="wave" id="wv"><svg viewBox="0 0 1200 80" preserveAspectRatio="none">{bars}</svg><div class="nt" style="left:0;width:2%"></div><div class="nt" style="left:62%;width:4%"></div>{mk}<div class="ph2" id="ph"></div></div>
<div style="display:flex;align-items:center;gap:12px">{play_controls()}<span class="mono" style="font-size:18px;font-weight:700"><span class="js-time">0:00:26</span></span><span style="flex:1"></span>
<button class="btn pri" id="tapbtn" style="height:46px;font-size:16px">{ic("tap")} Tap = start of ¶ <b id="nextn">10</b> <kbd>Space</kbd></button><button class="btn" id="undobtn">{ic("undo","sm")} Undo</button><button class="btn">{ic("skip","sm")} No text here</button><button class="btn">{ic("flag","sm")} Tape differs</button></div></div>
<div class="row2" style="grid-template-columns:2fr 1fr;align-items:start"><div class="scard" style="padding:0"><div class="srow" style="color:var(--ba-text-3);font-weight:700;font-size:12px"><span>¶</span><span>START</span><span>TEXT</span><span>STATUS</span><span>ADJUST</span></div>{rows}</div>
<div style="display:flex;flex-direction:column;gap:12px"><div class="scard"><h3>{ic("wand")} Proposal review</h3><div class="dim">Automatic timing proposed 20 start times. <b>3</b> are low-confidence.</div><button class="btn">Review the 3 first</button></div>
<div class="scard"><h3>{ic("flag")} Differences found</h3><div class="dim">¶ 13: about 30 s of singing with no text. Keep the singing as a “no text here” region so the screen does not jump.</div></div>
<div class="scard"><h3>{ic("save" if 'save' in ICONS else 'saved')} Save</h3><div class="dim">Saved with this recording. Export a small timing file to share with another church (it holds times only, no text and no audio).</div><div style="display:flex;gap:8px"><button class="btn pri">Save</button><button class="btn">Export timing…</button></div></div></div></div></div>"""
    js = """<script>let next=9;const mkc=document.getElementById('wv');const ph=document.getElementById('ph');const st=[];
function place(){document.getElementById('nextn').textContent=next+1}
window.onSpace=()=>{if(next>=14){return}const t=sim.t;const m=document.createElement('div');m.className='mkr new';m.style.left=(t/1290*100)+'%';m.innerHTML='<span>'+(next+1)+'</span>';mkc.appendChild(m);document.getElementById('st'+next).textContent=fmt(t);document.getElementById('sr'+next).classList.remove('un');st.push(m);next++;place()};
document.getElementById('tapbtn').onclick=()=>window.onSpace();document.getElementById('undobtn').onclick=()=>{const m=st.pop();if(m){m.remove();next--;document.getElementById('st'+next).textContent='—';document.getElementById('sr'+next).classList.add('un');place()}};
onSim((i,t)=>{ph.style.left=(t/1290*100)+'%'});mkc.addEventListener('click',e=>{const r=mkc.getBoundingClientRect();seek((e.clientX-r.left)/r.width*1290)});place();emit();</script>"""
    return full_page('Sync editor', body, css, cls='tall') .replace('</body>', sim_js(560) + js + '</body>')

def phone():
    css = """.pmock .pp .tm{display:none}.pmock{width:340px;height:780px;border-radius:40px;background:var(--ba-bg-0);border:2px solid var(--ba-line-strong);box-shadow:0 0 0 8px #000;overflow:hidden;display:flex;flex-direction:column;position:relative}
.pmock .hd{padding:16px 18px 8px;display:flex;justify-content:space-between;align-items:center}.pmock .list{flex:1;overflow:hidden;position:relative}.pmock .list .c{position:absolute;left:0;right:0;transition:transform .5s}
.pmock .pp{grid-template-columns:34px 1fr;padding:9px 12px}.pmock .pp .no{font-size:22px;padding-right:6px}.pmock .pp .tx{font-size:15px;line-height:1.45}
.pmock .ctl{border-top:1px solid var(--ba-line);background:var(--ba-bg-1);padding:12px 14px 20px;display:flex;flex-direction:column;gap:10px}
.pmock .big{height:54px;border-radius:14px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);display:grid;place-items:center;cursor:pointer;font-weight:700}
.pmock .big.pr{background:var(--ba-accent);color:var(--ba-on-accent);border-color:var(--ba-accent)}.pmock .big svg{width:24px;height:24px}"""
    ph = lambda inner: f'<div class="pmock">{inner}</div>'
    main = f"""<div class="hd"><div><div class="caps">Tape service</div><b>{TITLE}</b></div><span class="sync"><span class="dot"></span>In sync</span></div>
<div class="list" id="pl"><div class="c" id="pc">{para_rows()}</div></div>
<div class="ctl"><div style="display:flex;justify-content:space-between;font:600 13px var(--ba-mono)"><span class="js-time">0:00:26</span><span class="js-left" style="color:var(--ba-text-2)">-1:52:20</span></div>{seek_bar().replace('class="seek"','class="seek" style="pointer-events:none"')}
<div style="display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:10px"><button class="big" data-sim="back">{ic("back10")} 10</button><button class="big pr" data-sim="play"><span class="js-play">{ic("play")}</span><span class="js-pause">{ic("pause")}</span></button><button class="big" data-sim="fwd">10 {ic("fwd10")}</button></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><button class="big" data-sim="prevp">{ic("prev")} ¶</button><button class="big" data-sim="nextp">¶ {ic("next")}</button><button class="big" style="color:var(--ba-live)">{ic("blank")} Blank</button></div>
<div style="display:flex;align-items:center;gap:10px;color:var(--ba-text-2)">{ic("vol","sm")}<span class="range" style="flex:1;width:auto"><i style="width:80%"></i><b style="left:80%"></b></span></div></div>"""
    t2 = f"""<div class="hd"><b>Jump to paragraph 14?</b></div><div style="padding:0 18px;display:flex;flex-direction:column;gap:14px;flex:1"><p class="dim">The tape is at ¶ 9 (0:08:48). Jumping moves the tape <b>and</b> the screens to ¶ 14 (0:14:02).</p><div class="pp cur" style="grid-template-columns:34px 1fr"><div class="no">14</div><div class="tx" style="font-size:15px">I will lift up mine eyes unto the hills…</div></div>
<div class="banner" style="--c:var(--ba-warn)">{ic("warn")}<span class="grow">Asked on the phone so a slip of the thumb cannot move the tape. The operator can undo.</span></div></div><div class="ctl"><button class="big pr">Jump</button><button class="big">Cancel</button></div>"""
    t3 = f"""<div class="hd"><b>Tape service</b><span class="sync warn"><span class="dot"></span>Paused · screens blank</span></div><div style="padding:20px 18px;display:flex;flex-direction:column;gap:14px;flex:1"><div class="banner" style="--c:var(--ba-warn)">{ic("blank")}<span class="grow"><b>The screens are blank.</b> The tape is still playing at 0:21:04.</span></div><div class="dim">Blank only hides the words. It never stops the sound — that stays with the operator.</div></div><div class="ctl"><button class="big pr">Show the screens again</button><button class="big" disabled style="opacity:.5">Stop the tape (computer only)</button></div>"""
    body = f"""<div class="sheet" style="align-items:center"><div class="cap" style="max-width:1100px"><b>Phone remote — tape control.</b> Play/pause, back or forward 10 s, previous/next paragraph, volume and Blank; a paragraph list that follows the tape. Jumping to a paragraph asks first. No seeking by dragging, no first start with sound (Play is refused until the operator has started the tape once — the same safety rules as video). Left: the live screen. Middle: the jump confirmation. Right: after Blank.</div>
<div style="display:flex;gap:28px;align-items:flex-start;margin-top:6px">{ph(main)}{ph(t2)}{ph(t3)}</div></div>"""
    js = """<script>const pc=document.getElementById('pc'),pl=document.getElementById('pl');const pps=[...pc.children];
onSim((i,t)=>{pps.forEach((p,k)=>{p.classList.toggle('cur',k===i);p.classList.toggle('past',k<i)});if(i>=0)pc.style.transform='translateY('+Math.min(0,-(pps[i].offsetTop-60))+'px)'});emit();</script>"""
    return page('Phone remote — tape control', body + sim_js() + js, cls='phone-sheet', extra_css=SA_CSS + css)

"""Shared pieces for the Sermon-audio ("tape service") mockups. Reuses the Born Again mockup library (tokens, fonts, shell, icons)
from docs/design/media/mockups/_src. Every page is a self-contained static HTML file; the interactive ones run a simulated tape clock.

PLACEHOLDER CONTENT ONLY: the text below is the public-domain King James Bible (and PD Spanish/Arabic Bible translations in page 06). No sermon text,
no sermon audio. The 'tape' is a pretend recording: 1:52:46 long, played at 12x speed in the demos so the highlight moves while you watch.
"""
import json, pathlib, sys, random
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2] / 'media' / 'mockups' / '_src'))
import lib  # noqa: E402
from lib import ic, page, app, ICONS, FLAME, rail, top, status  # noqa: E402

ICONS['back10'] = '<path d="M4 12a8 8 0 108-8H7M7 4L4 7l3 3"/>'
ICONS['fwd10'] = '<path d="M20 12a8 8 0 11-8-8h5M17 4l3 3-3 3"/>'
ICONS['headphones'] = '<path d="M4 15v-3a8 8 0 0116 0v3M4 15h3v5H5a1 1 0 01-1-1zM20 15h-3v5h2a1 1 0 001-1z"/>'
ICONS['speaker'] = '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="14" r="3.2"/><circle cx="12" cy="7.5" r="1"/>'
ICONS['wave'] = '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>'
ICONS['tap'] = '<path d="M9 11V5a2 2 0 014 0v6M13 10a2 2 0 014 0v3a6 6 0 01-6 6h-1a5 5 0 01-4-2l-2-3a2 2 0 013-2l1 1"/>'
ICONS['flag'] = '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
ICONS['download'] = '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'
ICONS['wand'] = '<path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>'
ICONS['split'] = '<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>'
ICONS['undo'] = '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>'
ICONS['skip'] = '<path d="M5 5l9 7-9 7zM17 5v14"/>'

# ---- placeholder "sermon": 20 numbered paragraphs (public-domain KJV), each with a pretend tape start time in seconds ----
PARAS = [
 (26,  "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters."),
 (71,  "He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake. Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me."),
 (138, "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over. Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever."),
 (205, "In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters."),
 (262, "And God said, Let there be light: and there was light. And God saw the light, that it was good: and God divided the light from the darkness."),
 (330, "Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding."),
 (391, "He giveth power to the faint; and to them that have no might he increaseth strength. But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."),
 (470, "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."),
 (528, "For God sent not his Son into the world to condemn the world; but that the world through him might be saved."),
 (601, "And we know that all things work together for good to them that love God, to them who are the called according to his purpose."),
 (655, "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come, nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord."),
 (733, "Now faith is the substance of things hoped for, the evidence of things not seen."),
 (790, "But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him."),
 (842, "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth."),
 (899, "After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name. Thy kingdom come, Thy will be done in earth, as it is in heaven."),
 (957, "Give us this day our daily bread. And forgive us our debts, as we forgive our debtors. And lead us not into temptation, but deliver us from evil."),
 (1030,"Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil; rejoiceth not in iniquity, but rejoiceth in the truth; beareth all things, believeth all things, hopeth all things, endureth all things."),
 (1108,"And now abideth faith, hope, charity, these three; but the greatest of these is charity."),
 (1151,"Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."),
 (1219,"And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away."),
]
TOTAL = 6766  # 1:52:46
TITLE = "A Sample Message (placeholder text)"
CODE = "00-0000"

DATA_JSON = json.dumps([{"n": i + 1, "t": t, "text": x} for i, (t, x) in enumerate(PARAS)])

def fmt(s):
    s = int(s); return f"{s//3600}:{(s%3600)//60:02d}:{s%60:02d}"

SA_CSS = r"""
:root{--ser:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;--hl:var(--ba-accent)}
.reader{flex:1;overflow:hidden;position:relative;background:var(--ba-bg-0)}
.reader .col{width:760px;margin:0 auto;padding:18px 0 140px;position:relative;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.pp{display:grid;grid-template-columns:62px 1fr;gap:6px;padding:12px 18px;border-radius:var(--ba-r-md);cursor:pointer;position:relative;transition:background .25s,color .25s}
.pp .no{font:300 34px/1.1 var(--ba-font);color:var(--ba-text-3);text-align:right;padding-right:12px}
.pp .tx{font:400 20px/1.55 var(--ser);color:var(--ba-text-3)}
.pp .tm{position:absolute;right:14px;top:10px;font:600 11px var(--ba-mono);color:var(--ba-text-3);opacity:0;transition:opacity .2s}
.pp:hover .tm{opacity:1}
.pp.past .tx{color:var(--ba-text-2)}
.pp.cur{background:var(--ba-accent-wash);box-shadow:inset 3px 0 0 var(--hl)}
.pp.cur .tx{color:var(--ba-text-1)}.pp.cur .no{color:var(--hl);font-weight:400}
.pp.cur .tm{opacity:1;color:var(--ba-accent)}
.pbar{border-top:1px solid var(--ba-line);background:var(--ba-bg-1);padding:12px 18px 14px;display:flex;flex-direction:column;gap:10px}
.pbar .row{display:flex;align-items:center;gap:12px}
.pbar .tc{font:600 15px var(--ba-mono);color:var(--ba-text-1);min-width:68px}
.pbar .tc.r{text-align:right;color:var(--ba-text-2)}
.seek{position:relative;flex:1;height:30px;cursor:pointer}
.seek .trk{position:absolute;left:0;right:0;top:12px;height:6px;border-radius:3px;background:var(--ba-bg-4)}
.seek .fill{position:absolute;left:0;top:12px;height:6px;border-radius:3px;background:var(--ba-accent)}
.seek .tick{position:absolute;top:8px;width:1px;height:14px;background:var(--ba-line-strong)}
.seek .head{position:absolute;top:6px;width:4px;height:18px;border-radius:2px;background:var(--ba-text-1);margin-left:-2px;box-shadow:0 0 0 2px var(--ba-bg-1)}
.play{width:46px;height:46px;border-radius:50%;background:var(--ba-accent);color:var(--ba-on-accent);border:0;display:grid;place-items:center;cursor:pointer}
.play svg{width:22px;height:22px}
.sk{display:inline-flex;align-items:center;justify-content:center;gap:2px;width:50px;height:38px;border-radius:var(--ba-r-md);border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);cursor:pointer;font:700 12px var(--ba-mono)}
.sk svg{width:18px;height:18px}
.js-pause{display:none}.playing .js-play{display:none}.playing .js-pause{display:block}
.toggle{display:inline-flex;align-items:center;gap:10px;font-weight:600;cursor:pointer;user-select:none}
.toggle i{width:42px;height:24px;border-radius:12px;background:var(--ba-bg-4);position:relative;border:1px solid var(--ba-line-strong);transition:.2s}
.toggle i::after{content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:var(--ba-text-2);transition:.2s}
.toggle.on i{background:var(--ba-accent);border-color:var(--ba-accent)}.toggle.on i::after{left:20px;background:var(--ba-on-accent)}
.sync{display:inline-flex;align-items:center;gap:7px;height:24px;padding:0 10px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid var(--ba-ok);color:var(--ba-ok)}
.sync.warn{border-color:var(--ba-warn);color:var(--ba-warn)}.sync.bad{border-color:var(--ba-danger);color:var(--ba-danger)}
.demo{position:absolute;left:50%;transform:translateX(-50%);bottom:8px;font-size:11px;color:var(--ba-text-3);background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:12px;padding:3px 12px;z-index:5;white-space:nowrap}
.themes{position:absolute;right:230px;bottom:3px;z-index:30;display:flex;gap:4px}
.themes button{height:22px;padding:0 9px;border-radius:12px;border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);font-size:11px;font-weight:700;cursor:pointer}
.themes button.on{background:var(--ba-accent);color:var(--ba-on-accent);border-color:var(--ba-accent)}
/* projector screens */
.screen{width:1280px;height:720px;background:var(--pj-bg);color:var(--pj-fg);position:relative;overflow:hidden;border-radius:8px;box-shadow:0 0 0 1px var(--ba-line-strong),var(--ba-shadow-3);--pj-bg:#000;--pj-fg:#f4f2ee;--pj-dim:.26;--pj-no:#b9a8f5}
:root[data-theme='light'] .screen{--pj-bg:#fbf8f0;--pj-fg:#16140f;--pj-no:#5b3fb0}
:root[data-theme='contrast'] .screen{--pj-bg:#000;--pj-fg:#fff;--pj-dim:.5;--pj-no:#ffe14d}
.screen .scroll{position:absolute;left:0;right:0;top:0;transition:transform .9s cubic-bezier(.22,.7,.2,1)}
.pj{display:grid;grid-template-columns:130px 1fr;padding:22px 70px 22px 24px;opacity:var(--pj-dim);transition:opacity .6s}
.pj .no{font:300 76px/1 var(--ba-font);text-align:right;padding-right:26px;color:var(--pj-fg)}
.pj .tm{display:none}
.pj .tx{font:400 39px/1.42 var(--ser)}
.pj.cur{opacity:1}.pj.cur .no{color:var(--pj-no);font-weight:400}
.screen .fade-t,.screen .fade-b{position:absolute;left:0;right:0;height:110px;pointer-events:none;z-index:2}
.screen .fade-t{top:0;background:linear-gradient(var(--pj-bg),transparent)}.screen .fade-b{bottom:0;background:linear-gradient(transparent,var(--pj-bg))}
.screen .foot{position:absolute;left:34px;right:34px;bottom:14px;display:flex;justify-content:space-between;font:600 15px var(--ba-font);color:var(--pj-fg);opacity:.55;z-index:3;letter-spacing:.04em}
.demo-strip{display:flex;align-items:center;gap:14px;padding:10px 4px;color:var(--ba-text-2);font-size:13px}
.sheet{padding:26px 36px;display:flex;flex-direction:column;gap:16px;height:100%}
.cap{font-size:13px;color:var(--ba-text-2);max-width:1240px}
.scard{background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-lg);padding:16px 18px;display:flex;flex-direction:column;gap:10px}
.scard h3{font-size:var(--ba-fs-lg);display:flex;align-items:center;gap:10px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.row4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
select.f,.f{height:38px;border-radius:var(--ba-r-md);border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);color:var(--ba-text-1);padding:0 12px;font:600 14px var(--ba-font);display:flex;align-items:center;gap:8px}
.kv{display:grid;grid-template-columns:200px 1fr;gap:10px 18px;align-items:center}
.kv label{color:var(--ba-text-2);font-weight:600}
.range{display:inline-block;vertical-align:middle;margin-right:10px;height:6px;border-radius:3px;background:var(--ba-bg-4);position:relative;width:240px}.range i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ba-accent)}.range b{position:absolute;top:-6px;width:18px;height:18px;border-radius:50%;background:var(--ba-text-1);margin-left:-9px}
.cardfix{display:flex;flex-direction:column;gap:10px;padding:14px 16px;background:var(--ba-bg-2);border:1px solid var(--c,var(--ba-line));border-radius:var(--ba-r-lg)}
.cardfix .hd{display:flex;gap:10px;align-items:center;font-weight:700;color:var(--c)}
.cardfix .ft{display:flex;flex-direction:column;gap:8px;align-items:flex-start}.cardfix p{color:var(--ba-text-1);line-height:1.45}.cardfix .where{font-size:12px;color:var(--ba-text-3)}
@media (prefers-reduced-motion:reduce){.screen .scroll,.reader .col{transition:none}}
"""

# the shared simulated tape clock. 1 real second = RATE tape seconds (12x) so the highlight visibly moves.
SIM_JS = r"""
const DATA=%%DATA%%;const TOTAL=%%TOTAL%%;
const sim={t:%%T0%%,playing:false,rate:12,speed:1,vol:80,fns:[]};
function fmt(s){s=Math.max(0,Math.floor(s));return Math.floor(s/3600)+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function idxAt(t){let i=-1;for(let k=0;k<DATA.length;k++)if(DATA[k].t<=t)i=k;return i}
function onSim(f){sim.fns.push(f)}
function emit(){const i=idxAt(sim.t);document.querySelectorAll('.js-time').forEach(e=>e.textContent=fmt(sim.t));document.querySelectorAll('.js-left').forEach(e=>e.textContent='-'+fmt(TOTAL-sim.t));
 const pc=sim.t/TOTAL*100;document.querySelectorAll('.js-fill').forEach(e=>e.style.width=pc+'%');document.querySelectorAll('.js-head').forEach(e=>e.style.left=pc+'%');
 document.body.classList.toggle('playing',sim.playing);sim.fns.forEach(f=>f(i,sim.t))}
function seek(t){sim.t=Math.max(0,Math.min(TOTAL,t));emit()}
function seekPara(i){seek(DATA[i].t)}
function toggle(){sim.playing=!sim.playing;emit()}
setInterval(()=>{if(sim.playing){sim.t=Math.min(TOTAL,sim.t+0.1*sim.rate*sim.speed);if(sim.t>=TOTAL)sim.playing=false;emit()}},100);
document.addEventListener('click',e=>{const a=e.target.closest('[data-sim]');if(a){const k=a.dataset.sim;if(k==='play')toggle();else if(k==='back')seek(sim.t-10);else if(k==='fwd')seek(sim.t+10);else if(k==='prevp'){const i=idxAt(sim.t-3);seekPara(Math.max(0,i))}else if(k==='nextp'){const i=idxAt(sim.t);seekPara(Math.min(DATA.length-1,i+1))}}
 const s=e.target.closest('.seek');if(s){const r=s.getBoundingClientRect();seek((e.clientX-r.left)/r.width*TOTAL)}
 const p=e.target.closest('[data-para]');if(p)seekPara(+p.dataset.para);
 const th=e.target.closest('[data-theme-btn]');if(th){document.documentElement.dataset.theme=th.dataset.themeBtn;document.querySelectorAll('[data-theme-btn]').forEach(b=>b.classList.toggle('on',b===th))}
 const tg=e.target.closest('.toggle');if(tg&&!tg.dataset.fixed)tg.classList.toggle('on');});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.matches('input,select')){e.preventDefault();if(window.onSpace)window.onSpace();else toggle()}if(e.key==='ArrowLeft')seek(sim.t-10);if(e.key==='ArrowRight')seek(sim.t+10)});
"""

def sim_js(t0=26):
    return "<script>" + SIM_JS.replace('%%DATA%%', DATA_JSON).replace('%%TOTAL%%', str(TOTAL)).replace('%%T0%%', str(t0)) + "</script>"

def themes_buttons():
    return '<div class="themes"><button data-theme-btn="dark" class="on">Dark</button><button data-theme-btn="light">Light</button><button data-theme-btn="contrast">High contrast</button></div>'

def play_controls(big=True):
    return (f'<button class="sk" data-sim="prevp" title="Previous paragraph">{ic("prev")}</button>'
            f'<button class="sk" data-sim="back" title="Back 10 s">{ic("back10")}10</button>'
            f'<button class="play" data-sim="play" title="Play / pause (Space)"><span class="js-play">{ic("play")}</span><span class="js-pause">{ic("pause")}</span></button>'
            f'<button class="sk" data-sim="fwd" title="Forward 10 s">10{ic("fwd10")}</button>'
            f'<button class="sk" data-sim="nextp" title="Next paragraph">{ic("next")}</button>')

def seek_bar():
    ticks = ''.join(f'<i class="tick" style="left:{p[0]/TOTAL*100:.3f}%"></i>' for p in PARAS)
    return f'<div class="seek"><div class="trk"></div>{ticks}<div class="fill js-fill"></div><div class="head js-head"></div></div>'

def para_rows(cls='pp'):
    rows = []
    for i, (t, x) in enumerate(PARAS):
        rows.append(f'<div class="{cls}" data-para="{i}"><div class="no">{i+1}</div><div class="tx">{x}</div><span class="tm">{fmt(t)}</span></div>')
    return ''.join(rows)

def full_page(title, body, extra_css='', theme='dark', cls=''):
    return page(title, body, theme=theme, cls=cls, extra_css=SA_CSS + extra_css)

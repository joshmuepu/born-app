"""Shared pieces for the Born Again media mockups (static HTML, tokens from docs/design/tokens.css).

Run build.py to regenerate every page. Pure Python 3, no dependencies.
"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[5]
FONTS = ROOT / 'src/renderer/src/assets/fonts'


def b64(p):
    return base64.b64encode(p.read_bytes()).decode()


TOKENS = (ROOT / 'docs/design/tokens.css').read_text()
# strip the relative @font-face (we inline fonts below so pages are self-contained)
TOKENS = TOKENS[TOKENS.index(':root,'):]

# Proposed new token: the colour of the "Media" content area (Sermons stone, Bible sage, Songs amber).
MEDIA_TOKENS = """
:root,:root[data-theme='dark']{--ba-media:#4fc3b8;--ba-media-wash:rgba(79,195,184,.14)}
:root[data-theme='light']{--ba-media:#1b756d;--ba-media-wash:rgba(27,117,109,.1)}
:root[data-theme='contrast']{--ba-media:#7ff0e6;--ba-media-wash:rgba(127,240,230,.28)}
"""

FONT_CSS = f"""
@font-face{{font-family:'Inter';font-weight:400 800;src:url(data:font/woff2;base64,{b64(FONTS/'Inter-Variable.woff2')}) format('woff2')}}
@font-face{{font-family:'JetBrains Mono';font-weight:100 800;src:url(data:font/woff2;base64,{b64(FONTS/'JetBrainsMono-Variable.woff2')}) format('woff2')}}
"""

CSS = r"""
*{box-sizing:border-box;margin:0}
html,body{background:var(--ba-bg-0);color:var(--ba-text-1);font:400 14px/1.4 var(--ba-font);-webkit-font-smoothing:antialiased}
body{width:1440px;height:900px;overflow:hidden;position:relative}
body.phone-sheet{width:1180px;height:900px}
body.tall{height:1100px}
button{font:inherit;color:inherit}
svg.i{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
svg.i.sm{width:14px;height:14px}svg.i.lg{width:22px;height:22px}svg.i.xl{width:30px;height:30px}
.mono{font-family:var(--ba-mono);font-variant-numeric:tabular-nums}
.dim{color:var(--ba-text-2)}.faint{color:var(--ba-text-3)}
.caps{font-size:var(--ba-fs-xs);letter-spacing:var(--ba-tracking-caps);text-transform:uppercase;color:var(--ba-text-3);font-weight:600}
/* ---------- shell ---------- */
.app{display:grid;grid-template-columns:64px 1fr;grid-template-rows:48px 1fr 28px;height:100%}
.top{grid-column:1/3;display:flex;align-items:center;gap:12px;padding:0 14px;background:var(--ba-bg-1);border-bottom:1px solid var(--ba-line)}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:-.01em}
.brand svg{width:22px;height:22px}
.brand b{font-weight:800}.brand span{font-weight:300;color:var(--ba-accent)}
.search{flex:1;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:10px;height:34px;padding:0 12px;border-radius:var(--ba-r-md);background:var(--ba-bg-2);border:1px solid var(--ba-line);color:var(--ba-text-3)}
.search kbd{margin-left:auto;font:600 11px var(--ba-mono);border:1px solid var(--ba-line-strong);border-radius:5px;padding:1px 6px;color:var(--ba-text-2)}
.pill{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border-radius:var(--ba-r-pill);border:1px solid var(--ba-line);background:var(--ba-bg-2);font-size:var(--ba-fs-sm);font-weight:600;white-space:nowrap}
.pill.live{border-color:var(--ba-live);color:var(--ba-live);background:var(--ba-live-wash)}
.pill.ok{color:var(--ba-ok)}.pill.warn{color:var(--ba-warn);border-color:var(--ba-warn)}
.dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
.rail{background:var(--ba-bg-1);border-right:1px solid var(--ba-line);display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:6px}
.rail a{width:50px;height:52px;border-radius:var(--ba-r-md);display:flex;flex-direction:column;gap:3px;align-items:center;justify-content:center;font-size:10.5px;font-weight:600;color:var(--ba-text-2);border:1px solid transparent}
.rail a.on{background:var(--ba-bg-3);border-color:var(--ba-line-strong);color:var(--ba-text-1)}
.rail a.on svg{color:var(--c)}
.rail .sp{flex:1}
.status{grid-column:1/3;display:flex;align-items:center;gap:18px;padding:0 14px;background:var(--ba-bg-1);border-top:1px solid var(--ba-line);font-size:var(--ba-fs-xs);color:var(--ba-text-2)}
.status .r{margin-left:auto}
.main{display:flex;min-height:0;min-width:0}
.work{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--ba-bg-0)}
.queue{width:380px;flex:none;background:var(--ba-bg-1);border-left:1px solid var(--ba-line);display:flex;flex-direction:column;min-height:0}
/* ---------- controls ---------- */
.btn{display:inline-flex;align-items:center;gap:8px;height:var(--ba-hit);padding:0 14px;border-radius:var(--ba-r-md);border:1px solid var(--ba-line-strong);background:var(--ba-bg-2);font-weight:600;font-size:var(--ba-fs-md);cursor:pointer;white-space:nowrap}
.btn.sm{height:30px;padding:0 10px;font-size:var(--ba-fs-sm);border-radius:var(--ba-r-sm)}
.btn.pri{background:var(--ba-accent);border-color:var(--ba-accent);color:var(--ba-on-accent)}
.btn.live{background:var(--ba-live);border-color:var(--ba-live);color:#fff}
.btn.ghost{background:transparent;border-color:transparent;color:var(--ba-text-2)}
.btn.danger{border-color:var(--ba-danger);color:var(--ba-danger)}
.btn.icon{width:var(--ba-hit);padding:0;justify-content:center}
.btn.icon.sm{width:30px}
.seg{display:inline-flex;border:1px solid var(--ba-line-strong);border-radius:var(--ba-r-md);overflow:hidden;background:var(--ba-bg-2)}
.seg button{border:0;background:none;height:32px;padding:0 12px;font-size:var(--ba-fs-sm);font-weight:600;color:var(--ba-text-2);display:flex;align-items:center;gap:6px}
.seg button.on{background:var(--ba-bg-4);color:var(--ba-text-1)}
.chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:var(--ba-r-pill);background:var(--ba-bg-3);border:1px solid var(--ba-line);font-size:var(--ba-fs-xs);font-weight:600;color:var(--ba-text-2)}
.chip.on{background:var(--ba-media-wash);border-color:var(--ba-media);color:var(--ba-media)}
.chip.warn{border-color:var(--ba-warn);color:var(--ba-warn)}
.chip.bad{border-color:var(--ba-danger);color:var(--ba-danger)}
.chip.ok{border-color:var(--ba-ok);color:var(--ba-ok)}
.badge{position:absolute;display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 6px;border-radius:5px;background:rgba(6,6,8,.78);color:#f4f2ee;font:600 11px var(--ba-mono)}
kbd{font:600 11px var(--ba-mono);border:1px solid var(--ba-line-strong);border-radius:5px;padding:1px 6px;color:var(--ba-text-2);background:var(--ba-bg-2)}
.field{white-space:nowrap;display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:var(--ba-r-md);background:var(--ba-bg-2);border:1px solid var(--ba-line-strong);color:var(--ba-text-2)}
.panel{background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-lg)}
.h{font-size:var(--ba-fs-xl);font-weight:700;letter-spacing:-.015em}
.h2{font-size:var(--ba-fs-lg);font-weight:700}
/* ---------- fake media (original gradients, no stock photos) ---------- */
.ph{position:relative;border-radius:var(--ba-r-sm);overflow:hidden;aspect-ratio:16/9;background:#222}
.ph::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);border-radius:inherit}
.p1{background:radial-gradient(60% 80% at 25% 90%,#ffb35c 0,#d9622b 35%,transparent 70%),linear-gradient(#1b1b3a,#5a2a52)}
.p2{background:radial-gradient(40% 50% at 70% 35%,#fff3c9 0,#ffd27a 20%,transparent 60%),linear-gradient(#1f4e79,#7fb0d9 60%,#e7c9a0)}
.p3{background:linear-gradient(160deg,#10331f,#2d7a4a 55%,#c6d99a)}
.p4{background:radial-gradient(50% 60% at 50% 40%,#f4e9ff 0,#a58be0 35%,transparent 75%),linear-gradient(#150f2b,#2b1b57)}
.p5{background:linear-gradient(120deg,#3a1d12,#a5522a 50%,#f2c27a)}
.p6{background:radial-gradient(70% 70% at 80% 20%,#9be7ff 0,transparent 55%),linear-gradient(#0a1f33,#0f4c75)}
.p7{background:linear-gradient(200deg,#2a2a2e,#6b6b73 55%,#d6d3cc)}
.p8{background:radial-gradient(60% 60% at 30% 30%,#ffd1dc 0,transparent 60%),linear-gradient(#3b1530,#8a3a68)}
.p9{background:repeating-linear-gradient(90deg,#14151a 0 14px,#1b1d24 14px 28px)}
.ph .tt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.55);padding:8%;line-height:1.15}
.ph .play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:rgba(6,6,8,.62);display:grid;place-items:center;color:#fff}
.ph .tl{left:6px;top:6px}.ph .br{right:6px;bottom:6px}.ph .bl{left:6px;bottom:6px}.ph .tr{right:6px;top:6px}
.missing{background:repeating-linear-gradient(45deg,var(--ba-bg-2) 0 10px,var(--ba-bg-3) 10px 20px);display:grid;place-items:center;color:var(--ba-warn)}
/* ---------- library ---------- */
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(184px,1fr));padding:16px 18px}
.card{background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-md);padding:8px;display:flex;flex-direction:column;gap:8px;position:relative}
.card.sel{border-color:var(--ba-accent);box-shadow:0 0 0 1px var(--ba-accent)}
.card.livec{border-color:var(--ba-live);box-shadow:0 0 0 1px var(--ba-live)}
.card .nm{font-weight:600;font-size:var(--ba-fs-md);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .mt{font-size:var(--ba-fs-xs);color:var(--ba-text-3);display:flex;gap:8px;align-items:center}
.rowl{display:grid;grid-template-columns:96px 1fr 90px 90px 130px 60px;gap:14px;align-items:center;padding:8px 18px;border-bottom:1px solid var(--ba-line);min-height:64px}
.rowl.hd{min-height:34px;padding:0 18px;color:var(--ba-text-3)}
.tree{width:240px;flex:none;border-right:1px solid var(--ba-line);background:var(--ba-bg-1);padding:12px 8px;display:flex;flex-direction:column;gap:2px;overflow:hidden}
.tree .it{display:flex;align-items:center;gap:9px;height:34px;padding:0 10px;border-radius:var(--ba-r-sm);color:var(--ba-text-2);font-weight:500}
.tree .it.on{background:var(--ba-bg-4);color:var(--ba-text-1)}
.tree .it.on svg{color:var(--ba-media)}
.tree .it .n{margin-left:auto;font:500 11px var(--ba-mono);color:var(--ba-text-3)}
.tree .sub{padding-left:22px}
.toolbar{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--ba-line);background:var(--ba-bg-1)}
.drop{margin:16px 18px 0;border:1.5px dashed var(--ba-media);border-radius:var(--ba-r-lg);background:var(--ba-media-wash);padding:14px 18px;display:flex;align-items:center;gap:14px;color:var(--ba-media);font-weight:600}
/* ---------- queue ---------- */
.qh{padding:12px 14px;border-bottom:1px solid var(--ba-line);display:flex;align-items:center;gap:10px}
.qi{display:flex;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--ba-line);position:relative}
.qi .k{width:6px;align-self:stretch;border-radius:3px;background:var(--c,var(--ba-line-strong));flex:none}
.qi .th{width:76px;flex:none}
.qi .nm{font-weight:600;font-size:var(--ba-fs-md);line-height:1.25}
.qi .sb{font-size:var(--ba-fs-xs);color:var(--ba-text-3);display:flex;gap:7px;align-items:center;margin-top:2px}
.qi.live{background:var(--ba-live-wash)}
.qi.staged{background:var(--ba-accent-wash)}
.qi .grip{color:var(--ba-text-3)}
/* ---------- preview/live pair + transport ---------- */
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 14px}
.mon{display:flex;flex-direction:column;gap:6px}
.mon .lb{display:flex;align-items:center;gap:6px;font-size:var(--ba-fs-xs);font-weight:700;letter-spacing:var(--ba-tracking-caps);text-transform:uppercase;color:var(--ba-text-3)}
.mon .scr{border-radius:var(--ba-r-sm);border:2px dashed var(--ba-line-strong)}
.mon.pv .scr{border-color:var(--ba-accent);border-style:solid}
.mon.lv .scr{border:2px solid var(--ba-live)}
.mon.lv .lb{color:var(--ba-live)}
.mon .tm{display:flex;justify-content:space-between;font:600 12px var(--ba-mono);color:var(--ba-text-2)}
.transport{margin:0 14px 12px;padding:12px;background:var(--ba-bg-2);border:1px solid var(--ba-line);border-radius:var(--ba-r-lg);display:flex;flex-direction:column;gap:10px}
.scrub{position:relative;height:36px}
.scrub .tr{position:absolute;left:0;right:0;top:15px;height:6px;border-radius:3px;background:var(--ba-bg-4)}
.scrub .fl{position:absolute;left:0;top:15px;height:6px;border-radius:3px;background:var(--ba-live)}
.scrub .hd{position:absolute;top:8px;width:4px;height:20px;border-radius:2px;background:#fff;margin-left:-2px;box-shadow:0 0 0 2px var(--ba-bg-2)}
.scrub .io{position:absolute;top:10px;width:3px;height:16px;background:var(--ba-media)}
.scrub .mk{position:absolute;top:2px;width:1px;height:8px;background:var(--ba-text-3)}
.tcs{display:flex;justify-content:space-between;align-items:baseline}
.tcs .big{font:700 30px/1 var(--ba-mono);letter-spacing:-.02em}
.tcs .rem{font:600 16px var(--ba-mono);color:var(--ba-text-2)}
.tbtn{display:flex;gap:8px;align-items:center}
.vol{display:flex;align-items:center;gap:8px;width:140px}
.vol .bar{flex:1;height:5px;border-radius:3px;background:var(--ba-bg-4);position:relative}
.vol .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ba-text-2)}
.take{margin:0 14px 14px;display:flex;gap:10px}
.take .btn{flex:1;justify-content:center;height:46px;font-size:var(--ba-fs-lg)}
/* ---------- toast / banners ---------- */
.banner{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--ba-r-md);border:1px solid var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--ba-text-1)}
.banner svg{color:var(--c)}
.banner .grow{flex:1}
.banner b{font-weight:700}
.toast{display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:var(--ba-r-md);background:var(--ba-bg-3);box-shadow:var(--ba-shadow-3);font-weight:600}
/* ---------- menus ---------- */
.menu{width:272px;background:var(--ba-bg-2);border-radius:var(--ba-r-md);box-shadow:var(--ba-shadow-3);padding:6px}
.menu .mi{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:var(--ba-r-sm);font-weight:500}
.menu .mi kbd{margin-left:auto}
.menu .mi.on{background:var(--ba-accent-wash)}
.menu hr{border:0;border-top:1px solid var(--ba-line);margin:5px 0}
.menu .mi.dg{color:var(--ba-danger)}
/* ---------- device frames ---------- */
.phone{width:360px;height:760px;border-radius:38px;background:var(--ba-bg-0);border:2px solid var(--ba-line-strong);box-shadow:0 0 0 8px #000;overflow:hidden;display:flex;flex-direction:column;position:relative}
.phone.land{width:760px;height:360px}
.stagebg{background:#000;color:#fff}
.note{position:absolute;font-size:12px;color:var(--ba-text-2);background:var(--ba-bg-2);border:1px solid var(--ba-line-strong);border-radius:8px;padding:6px 10px;max-width:260px;box-shadow:var(--ba-shadow-2)}
.step{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:var(--ba-bg-4);font-size:12px}
.step.on{background:var(--ba-accent);color:var(--ba-on-accent)}.step.done{background:var(--ba-ok);color:#08140d}
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:var(--ba-fs-xs);letter-spacing:var(--ba-tracking-caps);text-transform:uppercase;color:var(--ba-text-3);text-align:left;font-weight:600;padding:8px 12px;border-bottom:1px solid var(--ba-line)}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--ba-line);vertical-align:middle}
.layer{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--ba-line);border-radius:var(--ba-r-md);background:var(--ba-bg-2)}
.layer .no{width:24px;height:24px;border-radius:6px;background:var(--ba-bg-4);display:grid;place-items:center;font:700 12px var(--ba-mono)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""

ICONS = {
    'play': '<path d="M7 5l12 7-12 7z" fill="currentColor"/>',
    'pause': '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    'next': '<path d="M6 5l9 7-9 7zM18 5v14"/>',
    'prev': '<path d="M18 5l-9 7 9 7zM6 5v14"/>',
    'stop': '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    'loop': '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>',
    'vol': '<path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12"/>',
    'mute': '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
    'folder': '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    'image': '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    'video': '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    'audio': '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'warn': '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
    'check': '<path d="M4 12l5 5L20 6"/>',
    'x': '<path d="M6 6l12 12M18 6L6 18"/>',
    'grid': '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    'list': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    'tag': '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    'cam': '<rect x="3" y="7" width="14" height="11" rx="2"/><path d="M17 11l4-2v8l-4-2"/><circle cx="10" cy="12.5" r="2.5"/>',
    'timer': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    'qr': '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 14h2v6h-4M14 18h2"/>',
    'bell': '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'link': '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    'fade': '<path d="M3 18L21 6M3 18h18"/>',
    'blank': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0121 12a10 10 0 01-2.1 3.1M6.6 6.6A10 10 0 003 12s3.5 7 9 7a8.6 8.6 0 004-1"/>',
    'chev': '<path d="M9 6l6 6-6 6"/>',
    'chevd': '<path d="M6 9l6 6 6-6"/>',
    'upload': '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    'monitor': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    'phone': '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    'sliders': '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    'file': '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    'slides': '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    'book': '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/>',
    'music': '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    'quote': '<path d="M5 18V9a4 4 0 014-4M13 18V9a4 4 0 014-4M5 13h4v5H5zM13 13h4v5h-4z"/>',
    'saved': '<path d="M6 3h12v18l-6-4-6 4z"/>',
    'cog': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    'eye': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'unplug': '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4"/>',
    'copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/>',
    'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    'edit': '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    'doc': '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    'zap': '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
}


def ic(name, cls=''):
    return f'<svg class="i {cls}" viewBox="0 0 24 24">{ICONS[name]}</svg>'


FLAME = ('<svg viewBox="0 0 32 32"><path d="M16 2c1 5 7 8 7 15a7 7 0 01-14 0c0-3 1.6-5 3-6.6.4 2 1.4 3 2.4 3C14 10 14.5 5 16 2z" '
         'fill="var(--ba-accent)"/><path d="M16 17c1.4 1.7 3 2.9 3 5a3 3 0 01-6 0c0-2 1.6-3.3 3-5z" fill="#f4ecd8"/></svg>')

RAIL = [('Sermons', 'quote', '--ba-sermons'), ('Bible', 'book', '--ba-bible'), ('Songs', 'music', '--ba-songs'),
        ('Media', 'image', '--ba-media'), ('Saved', 'saved', '--ba-text-1')]


def rail(active='Media'):
    out = ['<nav class="rail">']
    for name, icon, col in RAIL:
        on = ' on' if name == active else ''
        out.append(f'<a class="{on.strip()}" style="--c:var({col})">{ic(icon, "lg")}{name}</a>')
    out.append('<div class="sp"></div>')
    out.append(f'<a>{ic("monitor","lg")}Screens</a><a>{ic("cog","lg")}Settings</a></nav>')
    return ''.join(out)


def top(live=True, extra=''):
    lv = f'<span class="pill live"><span class="dot"></span>LIVE · Main</span>' if live else '<span class="pill">Nothing live</span>'
    return (f'<header class="top"><div class="brand">{FLAME}<b>Born</b><span>Again</span></div>'
            f'<div class="search">{ic("search")}Search sermons, Bible, songs, media…<kbd>Ctrl K</kbd></div>{extra}'
            f'<span class="pill ok"><span class="dot"></span>Remote · 2 phones</span>{lv}</header>')


def status(left='Main · Congregation ● Stage ● Graphics ●', right='Born Again v2.0.0-dev.1'):
    return f'<footer class="status"><span>{left}</span><span class="r">{right}</span></footer>'


def page(title, body, theme='dark', cls='', extra_css=''):
    return (f'<!doctype html><html lang="en" data-theme="{theme}"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>'
            f'<style>{FONT_CSS}{TOKENS}{MEDIA_TOKENS}{CSS}{extra_css}</style>'
            f'<script>var t=new URLSearchParams(location.search).get("theme");if(t)document.documentElement.dataset.theme=t;</script>'
            f'</head><body class="{cls}">{body}</body></html>')


def app(active, main, queue='', live=True, topx='', st=None):
    q = f'<aside class="queue">{queue}</aside>' if queue else ''
    return (f'<div class="app">{top(live, topx)}{rail(active)}<div class="main"><section class="work">{main}</section>{q}</div>'
            f'{status() if st is None else st}</div>')


def thumb(cls, label='', kind='image', dur='', loop=False, extra='', missing=False):
    if missing:
        return f'<div class="ph missing">{ic("warn","lg")}</div>'
    play = f'<span class="play">{ic("play","sm")}</span>' if kind == 'video' else ''
    d = f'<span class="badge br">{dur}</span>' if dur else ''
    lp = f'<span class="badge tl">{ic("loop","sm")}</span>' if loop else ''
    t = f'<div class="tt">{label}</div>' if label else ''
    return f'<div class="ph {cls}">{t}{play}{d}{lp}{extra}</div>'

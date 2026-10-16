"""Regenerates every sermon-audio mockup (HTML) in ../ — run: python3 build.py ; then shoot.js (Electron) for PNGs."""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import sa_a as A, sa_b as B, sa_c as C
OUT = pathlib.Path(__file__).resolve().parents[1]
PAGES = {
 '01-reader-follow-along': (A.reader, 'Operator: sermon reader with follow-along', 'The reader highlights the paragraph being spoken and glides to it. Click any paragraph to jump the tape; Space plays/pauses; the "Reader follows" switch frees you to browse without losing your place. Dark / light / high-contrast.'),
 '02-attach-audio': (A.attach, 'Attaching audio to a sermon', 'The "Play options" equivalent: a file on this computer (recommended), get the file first, streaming (not yet), and a plain preflight of the chosen file.'),
 '03-projector-highlight': (A.screen_highlight, 'Projector view 1: highlight', 'A screenful of text, current paragraph bright with a large number, the rest dimmed, auto-scrolling. Themes switchable.'),
 '04-projector-one-at-a-time': (A.screen_single, 'Projector view 2: one paragraph at a time', 'Auto-advance with the "show next early" lead and a countdown bar.'),
 '05-lower-third-and-stage': (A.lower_stage, 'Lower third (OBS) and stage monitor', 'The livestream lower third and the stage monitor with time, now/next and the sync pill.'),
 '06-languages': (B.languages, 'Languages', 'Text vs tape language, English tape with translated text, mismatch warning, and side-by-side two-language projection (including right-to-left).'),
 '07-sync-editor': (B.sync_editor, 'Sync editor', 'Tap to sync with a timeline: press Space while the demo plays to place the next marker; undo; nudge; "no text here"; "tape differs"; review of low-confidence proposals.'),
 '08-phone-remote': (B.phone, 'Phone remote', 'Tape controls with a paragraph list that follows; a confirmation before jumping; the screen after Blank.'),
 '09-errors-and-warnings': (C.states, 'Errors and warnings', 'Eight situations, each in plain words with one button.'),
 '10-settings': (C.settings, 'Settings', 'Lead time, follow style, highlight style, speed range, output device, auto-resume, safety.'),
 '11-sunday-storyboard': (C.storyboard, 'Sunday storyboard', 'Before the service, start, mid-service, end.'),
}
for name, (fn, _t, _d) in PAGES.items():
    (OUT / f'{name}.html').write_text(fn(), encoding='utf-8')
    print('wrote', name)
cards = ''.join(f'<a class="c" href="{n}.html"><img src="png/{n}.dark.png" alt="" loading="lazy" onerror="this.style.display=\'none\'"><div><b>{n.split("-")[0]} · {t}</b><p>{d}</p></div></a>' for n, (_f, t, d) in PAGES.items())
(OUT / 'index.html').write_text(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tape service — mockups</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{margin:0;background:#0d0d10;color:#f4f2ee;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}}main{{max-width:1180px;margin:0 auto;padding:36px 24px 60px}}h1{{font-size:30px;margin:0 0 6px}}p.l{{color:#b2afaa;max-width:860px}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;margin-top:26px}}.c{{display:block;background:#16161a;border:1px solid #26262c;border-radius:14px;overflow:hidden;color:inherit;text-decoration:none}}.c:hover{{border-color:#9a80e6}}.c img{{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;background:#08080a;display:block}}.c div{{padding:12px 14px 16px}}.c p{{margin:4px 0 0;color:#b2afaa;font-size:13.5px}}.note{{margin-top:30px;padding:14px 16px;border:1px solid #3a3a42;border-radius:12px;color:#b2afaa;font-size:14px}}
</style></head><body><main><h1>Tape service — clickable mockups</h1><p class="l">The sermon text follows the tape. These are design mockups for <b>Born Again</b> (not built yet). The interactive ones run a <b>pretend tape at 12× speed</b>: press Play (or Space), click a paragraph to jump, switch the theme. All text is public-domain Bible text; there is no sermon text and no audio.</p>
<div class="g">{cards}</div><div class="note">Read next: <a style="color:#c1affa" href="../README.md">README</a> · 01 investigation · 02 product design · 03 visual design · 04 build plan (in the folder above).</div></main></body></html>""", encoding='utf-8')
print('wrote index')

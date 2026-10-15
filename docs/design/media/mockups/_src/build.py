"""Regenerates every mockup page in ../ (HTML) — run: python3 build.py, then shoot.js for PNGs."""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import pages_a as A, pages_b as B, pages_c as C
OUT = pathlib.Path(__file__).resolve().parents[1]
PAGES = {
    '01-library': A.library, '02-library-states': A.library_states, '03-queue-preview-live': A.queue_preview_live,
    '04-drilldown': A.drilldown, '05-backgrounds': A.backgrounds, '06-palette-menus': B.palette,
    '07-alert-lowerthird-timer': B.designer, '08-preflight': B.preflight, '09-phone-remote': B.remote,
    '10-stage-monitor': B.stage, '13-youtube-add': C.yt_paste, '14-youtube-queue': C.yt_queue, '15-youtube-preflight': C.yt_preflight, '16-youtube-playbar': C.yt_playbar, '11-slides-import': B.slides_import, '12-failure-states': B.failures,
}
for name, fn in PAGES.items():
    (OUT / f'{name}.html').write_text(fn(), encoding='utf-8')
    print('wrote', name)

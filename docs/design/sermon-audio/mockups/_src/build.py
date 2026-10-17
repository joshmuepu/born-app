"""Regenerates every sermon-audio mockup (HTML) in ../ — run: python3 build.py ; then shoot.js (Electron) for PNGs."""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import sa_a as A, sa_b as B, sa_c as C
import sa_place_pages as P
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

# ---- placement round: where does the tape live? ----
PLACE = {
 '12-placement-today': (lambda: P.option_page('today'), 'Where does the tape live? · Today', 'The current build for comparison. Use the buttons above the app: go to Songs mid-tape and the tape controls disappear.'),
 '13-option-a-now-playing-bar': (lambda: P.option_page('a'), 'Option A (recommended) · Now-playing bar + Tape place', 'A transport bar at the bottom of every section and a “Tape” place in the rail for recordings, follow, timing and options. The reader stays a reader.'),
 '14-option-b-tape-workspace': (lambda: P.option_page('b'), 'Option B · Tape service workspace + mini-bar', 'A focused workspace the operator enters from a sermon; only a small mini-bar elsewhere.'),
 '15-option-c-docked-panel': (lambda: P.option_page('c'), 'Option C · Docked tape panel', 'A right-hand dock beside the queue, toggled with a button or T from any section.'),
 '16-option-d-service-plan': (lambda: P.option_page('d'), 'Option D · The tape as an item in the service plan', 'The tape is a block in the order of service; its controls live on its row, in the plan that is visible everywhere.'),
 '17-compare-placement': (P.compare_page, 'Side by side', 'The same moment in every option, with ratings against the criteria that matter in a service.'),
 '18-rec-states': (P.rec_states, 'Recommended · transport states and first-time state', 'Stopped, playing, paused, stalled, sound output lost, paused for a video, no timing; and the empty Tape place.'),
 '19-rec-library': (P.rec_library, 'Recommended · the Tape place: recordings library', 'Every recording, its status, and where to add, time or fix it.'),
 '20-rec-preview-live': (P.rec_live, 'Recommended · Preview / Live with a tape', 'Take vs Play kept apart; what happens when a verse is taken mid-tape.'),
 '21-rec-phone-and-ready': (P.rec_phone_ready, 'Recommended · phone and “Is tonight ready?”', 'The phone Tape card and the tape rows of the readiness check.'),
}
for name, (fn, _t, _d) in PLACE.items():
    (OUT / f'{name}.html').write_text(fn(), encoding='utf-8')
    print('wrote', name)
place_cards = ''.join(f'<a class="c{" rec" if "option-a" in n else ""}" href="{n}.html"><img src="png/{n}.dark.png" alt="" loading="lazy" onerror="this.style.display=\'none\'"><div><b>{n.split("-")[0]} · {t}</b><p>{d}</p></div></a>' for n, (_f, t, d) in PLACE.items())
cards = ''.join(f'<a class="c" href="{n}.html"><img src="png/{n}.dark.png" alt="" loading="lazy" onerror="this.style.display=\'none\'"><div><b>{n.split("-")[0]} · {t}</b><p>{d}</p></div></a>' for n, (_f, t, d) in PAGES.items())
(OUT / 'index.html').write_text(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tape service — mockups</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{margin:0;background:#0d0d10;color:#f4f2ee;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}}main{{max-width:1180px;margin:0 auto;padding:36px 24px 60px}}h1{{font-size:30px;margin:0 0 6px}}p.l{{color:#b2afaa;max-width:860px}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;margin-top:26px}}.c{{display:block;background:#16161a;border:1px solid #26262c;border-radius:14px;overflow:hidden;color:inherit;text-decoration:none}}.c:hover{{border-color:#9a80e6}}.c.rec{{border-color:#9a80e6;box-shadow:0 0 0 1px #9a80e6}}.c img{{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;background:#08080a;display:block}}.c div{{padding:12px 14px 16px}}.c p{{margin:4px 0 0;color:#b2afaa;font-size:13.5px}}.note{{margin-top:30px;padding:14px 16px;border:1px solid #3a3a42;border-radius:12px;color:#b2afaa;font-size:14px}}
</style></head><body><main><h1>Tape service — clickable mockups</h1><p class="l">The sermon text follows the tape. These are design mockups for <b>Born Again</b> (not built yet). The interactive ones run a <b>pretend tape at 12× speed</b>: press Play (or Space), click a paragraph to jump, switch the theme. All text is public-domain Bible text; there is no sermon text and no audio.</p>
<h2 style="margin:34px 0 4px;font-size:22px">Where does the tape live?</h2><p class="l">The owner asked to see alternatives to having the audio player inside the Sermons section. Five clickable, full-app mockups (today + four options) and a side-by-side comparison. Start with <a style="color:#c1affa" href="17-compare-placement.html">the comparison</a>, then open each option and press the buttons above the app. <b>Recommended: A.</b> Read <a style="color:#c1affa" href="../05-placement-review.md">05 · placement review</a> and <a style="color:#c1affa" href="../06-placement-proposal.md">06 · placement proposal</a>.</p><div class="g">{place_cards}</div><h2 style="margin:34px 0 4px;font-size:22px">The tape service itself</h2><div class="g">{cards}</div><div class="note">Read next: <a style="color:#c1affa" href="../README.md">README</a> · 01 investigation · 02 product design · 03 visual design · 04 build plan (in the folder above).</div></main></body></html>""", encoding='utf-8')
print('wrote index')

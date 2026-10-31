#!/usr/bin/env python3
"""Decides whether freshly built libraries may become the new library snapshot (the "refresh libraries (manual)" workflow).

Compares the new sermons.db.gz + library.db.gz with the ones release builds use today (the current snapshot, or for the very first
snapshot the libraries inside the latest v1 release):
  sermons  scripts/data/compare-sermon-dbs.py: no sermon missing, no sermon's text different, no sermon left in sections, same counts
  library  every Bible translation, book and verse and every song and slide, compared row by row (a digest per table), same counts
Prints counts and sermon codes only, never text. Writes the result to <check.json> and exits 1 unless it passes.
With --allow-changes (a refresh run on purpose to pick up corrected source text): a missing sermon or one left in sections still fails;
changed text and changed counts are listed and allowed.
    python3 -I scripts/data/check-library-refresh.py <old dir> <new dir> <check.json> <compared-with label> [--allow-changes]
"""
import gzip, hashlib, json, os, shutil, sqlite3, subprocess, sys, tempfile

TABLES = {
    'bible_translations': 'SELECT code, name, sort_order FROM bible_translations ORDER BY code',
    'bible_books': 'SELECT num, name, abbrev FROM bible_books ORDER BY num',
    'bible_verses': 'SELECT translation, book, chapter, verse, text FROM bible_verses ORDER BY translation, book, chapter, verse',
    'songs': 'SELECT title, author, song_key, ccli, source, search_body FROM songs ORDER BY title, search_body',
    'song_slides': 'SELECT s.title, s.search_body, x.slide_index, x.label, x.text FROM song_slides x JOIN songs s ON s.id = x.song_id '
                   'ORDER BY s.title, s.search_body, x.slide_index',
}

def opened(path, tmp):
    out = os.path.join(tmp, os.path.basename(os.path.dirname(path)) + '-' + os.path.basename(path)[:-3])
    with gzip.open(path) as a, open(out, 'wb') as b: shutil.copyfileobj(a, b)
    return sqlite3.connect(out)

def digest(db, sql):
    h, n = hashlib.sha256(), 0
    for row in db.execute(sql):
        h.update(json.dumps(row, ensure_ascii=False).encode()); n += 1
    return n, h.hexdigest()

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    allow = '--allow-changes' in sys.argv
    old_dir, new_dir, out, label = args
    here = os.path.dirname(os.path.abspath(__file__))
    cmp = subprocess.run([sys.executable, '-I', os.path.join(here, 'compare-sermon-dbs.py'),
                          os.path.join(old_dir, 'sermons.db.gz'), os.path.join(new_dir, 'sermons.db.gz')],
                         capture_output=True, text=True, check=True)
    s = json.loads(cmp.stdout)
    c = s['counts']
    tmp = tempfile.mkdtemp(prefix='born-refresh-')
    old_l, new_l = opened(os.path.join(old_dir, 'library.db.gz'), tmp), opened(os.path.join(new_dir, 'library.db.gz'), tmp)
    library = {}
    for t, sql in TABLES.items():
        (no, ho), (nn, hn) = digest(old_l, sql), digest(new_l, sql)
        library[t] = {'old': no, 'new': nn, 'identical': ho == hn}
    verses_by_translation = {}
    for code, in new_l.execute('SELECT code FROM bible_translations ORDER BY code'):
        q = 'SELECT translation, book, chapter, verse, text FROM bible_verses WHERE translation = ? ORDER BY book, chapter, verse'
        a = {r[:4]: r[4] for r in old_l.execute(q, (code,))}
        b = {r[:4]: r[4] for r in new_l.execute(q, (code,))}
        verses_by_translation[code] = {'old': len(a), 'new': len(b), 'changed': sum(1 for k in b if k in a and a[k] != b[k]),
                                       'only_old': sum(1 for k in a if k not in b), 'only_new': sum(1 for k in b if k not in a)}
    shutil.rmtree(tmp, ignore_errors=True)

    problems, changes = [], []
    if s['sermons_missing_in_new']: problems.append(f"{len(s['sermons_missing_in_new'])} sermons missing: {', '.join(map(str, s['sermons_missing_in_new'][:40]))}")
    if s['sermons_still_in_sections']: problems.append(f"sermons still in sections: {', '.join(map(str, s['sermons_still_in_sections']))}")
    if s['counts'].get('version_new') is None: problems.append('no sermon format number')
    if c.get('title_line_lost'): problems.append(f"{c['title_line_lost']} sermons lost their title line")
    if s['sermons_whose_text_differs']: changes.append(f"{s['sermons_whose_text_differs']} sermons whose text differs: {', '.join(map(str, s['differ_codes']))}")
    if c.get('sermons_old') != c.get('sermons_new'): changes.append(f"sermons {c.get('sermons_old')} -> {c.get('sermons_new')}")
    if c.get('rows_old') != c.get('rows_new'): changes.append(f"paragraph rows {c.get('rows_old')} -> {c.get('rows_new')}")
    for t, r in library.items():
        if not r['identical']: changes.append(f"{t}: {r['old']} -> {r['new']} rows, contents differ")
    ok = not problems and (allow or not changes)
    result = {
        'comparedWith': label, 'result': 'pass' if ok else 'fail', 'allowChanges': allow,
        'sermonsOld': c.get('sermons_old'), 'sermonsNew': c.get('sermons_new'), 'paragraphRowsOld': c.get('rows_old'), 'paragraphRowsNew': c.get('rows_new'),
        'sermonsMissing': len(s['sermons_missing_in_new']), 'sermonTextDiffers': s['sermons_whose_text_differs'],
        'sermonTextDiffersCodes': s['differ_codes'], 'sermonsInSections': len(s['sermons_still_in_sections']),
        'library': library, 'versesByTranslation': verses_by_translation, 'problems': problems, 'changes': changes,
    }
    with open(out, 'w') as f: json.dump(result, f, indent=1, ensure_ascii=False)
    print(json.dumps(result, indent=1, ensure_ascii=False))
    print(f"\nlibrary refresh check against {label}: {'PASS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""No-loss check between two sermon libraries (e.g. the section-format one and the rebuilt one-row-per-paragraph one).

For every sermon: the whole text (all rows joined, whitespace collapsed, the source's private-use symbol dropped) must be the same in both,
the title line kept, and the new one must not hold sections. Optionally compares the new rows with a paragraph-per-line copy of the source
(the owner's Branham Library v3 files) for accuracy. Prints counts and sermon codes only, never text.
    python3 -I scripts/data/compare-sermon-dbs.py <old sermons.db or .gz> <new sermons.db or .gz> [v3 sermons dir]
"""
import gzip, json, os, re, shutil, sqlite3, sys, tempfile
from collections import Counter

def opened(path, tmp):
    if path.endswith('.gz'):
        out = os.path.join(tmp, os.path.basename(path)[:-3] + str(len(os.listdir(tmp))))
        with gzip.open(path) as a, open(out, 'wb') as b: shutil.copyfileobj(a, b)
        path = out
    return sqlite3.connect(path)

def norm(t): return re.sub(r'\s+', ' ', (t or '').replace('', '')).strip()

def main():
    tmp = tempfile.mkdtemp(prefix='born-cmp-')
    old, new = opened(sys.argv[1], tmp), opened(sys.argv[2], tmp)
    v3 = sys.argv[3] if len(sys.argv) > 3 else None
    r = Counter(); differ = []; missing = []; still_sections = []
    text = lambda d, sid: [x for x in d.execute('SELECT paragraph_ref, text FROM paragraphs WHERE sermon_id = ? ORDER BY paragraph_index, id', (sid,))]
    new_ids = {x[0] for x in new.execute('SELECT id FROM sermons')}
    r['version_new'] = new.execute('PRAGMA user_version').fetchone()[0]
    for sid, code, title in old.execute('SELECT id, date_code, title FROM sermons'):
        r['sermons_old'] += 1
        if sid not in new_ids: missing.append(code or title); continue
        a, b = text(old, sid), text(new, sid)
        r['rows_old'] += len(a); r['rows_new'] += len(b)
        if norm(' '.join(t for _, t in a)) != norm(' '.join(t for _, t in b)): differ.append(code or title)
        if any(re.fullmatch(r'\d+-\d+', ref or '') for ref, _ in b): still_sections.append(code or title)
        if any(ref == 'header' for ref, _ in a) and not any(ref == 'header' for ref, _ in b): r['title_line_lost'] += 1
    r['sermons_new'] = len(new_ids)
    out = {'counts': r, 'sermons_missing_in_new': missing, 'sermons_whose_text_differs': len(differ), 'differ_codes': differ[:40], 'sermons_still_in_sections': still_sections[:40]}
    if v3:
        files = {}
        for f in os.listdir(v3):
            m = re.search(r'\b(\d\d-\d{4}[A-Za-z]?)\b', open(os.path.join(v3, f), encoding='utf-8').read(3000))
            if m: files.setdefault(m.group(1).upper(), os.path.join(v3, f))
        ok = tot = 0
        for sid, code in new.execute('SELECT id, date_code FROM sermons'):
            f = files.get((code or '').upper())
            if not f: continue
            got = {}
            for ref, t in text(new, sid):
                if re.fullmatch(r'\d+', ref or ''): got.setdefault(int(ref), norm(re.sub(r'^\s*\d+\s+', '', t)))
            for line in open(f, encoding='utf-8').read().split('\n'):
                m = re.match(r'^(\d{1,3})\s+(.*)$', line.strip())
                if m: tot += 1; ok += got.get(int(m.group(1))) == norm(m.group(2))
        out['v3_paragraphs'] = tot; out['identical_to_v3'] = ok; out['identical_pct'] = round(100 * ok / max(tot, 1), 2)
    shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps(out, indent=1, ensure_ascii=False))

if __name__ == '__main__':
    main()

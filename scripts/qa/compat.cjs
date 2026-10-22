/* Old-file compatibility: loads service files written by earlier v1 versions into the real app (through the phone-remote's open-service
 * command, the same renderer path as File > Open) and saves them back (save-queue), then writes what came out.
 * Usage: node scripts/qa/compat.cjs <profileDir> <outJson> [appDir]
 *   appDir = a built checkout to run (default: this one) — run it once on origin/main and once on the branch, then diff the two outJson files.
 * Fixtures use placeholder text only. */
const fs = require('fs'), path = require('path')
const { launch, sleep } = require('./lib.cjs')
const [profile, outJson, appDir] = process.argv.slice(2)
if (!profile || !outJson) { console.error('usage: compat.cjs <profileDir> <outJson> [appDir]'); process.exit(2) }

const { DatabaseSync } = require('node:sqlite')
/** two songs that exist in this profile's seeded library (read at run time; nothing is stored) */
function librarySongs(profileDir) {
  const db = new DatabaseSync(path.join(profileDir, 'library.db'), { readOnly: true })
  const rows = db.prepare('select id, title, author, song_key from songs where id in (select song_id from song_slides group by song_id having count(*) >= 2) order by id limit 2').all()
  return rows.map((r) => ({ ...r, slides: db.prepare('select label, text from song_slides where song_id = ? order by slide_index').all(r.id).map((x) => ({ label: x.label || undefined, text: x.text })) }))
}
const quote = (n) => ({ text: `Placeholder paragraph ${n}.`, sermonTitle: 'Placeholder Sermon', dateCode: '00-0101', sermonId: 1, paragraphIndex: n, paragraphRef: String(n + 1), matchType: 'phrase' })
let SONGS = []
const fixtures = () => ({
  // v1.0.x: a bare list of quotes, before items and slides existed
  'v1.0-bare-quotes': [quote(0), quote(1)],
  // v1.6 - v1.12: items with slides; no per-item source, no songKey
  'v1.12-items': [
    { kind: 'quote', id: 'q-a', quote: quote(2), slides: [{ text: 'Placeholder paragraph 2.', reference: 'Placeholder Sermon 00-0101 ¶3', marker: '3' }] },
    { kind: 'bible', id: 'b-a', translation: 'KJV', reference: 'John 3:16', bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 16, slides: [{ text: 'Placeholder verse text.', reference: 'John 3:16 · KJV', marker: '16' }] },
    { kind: 'song', id: 's-a', songId: SONGS[0].id, title: SONGS[0].title, author: SONGS[0].author || undefined, slides: SONGS[0].slides }
  ],
  // v1.13: with contributor source and the song key carried on the item
  'v1.13-source-and-key': [
    { kind: 'song', id: 's-b', songId: SONGS[1].id, title: SONGS[1].title, author: SONGS[1].author || undefined, songKey: SONGS[1].song_key || 'G', source: { deviceId: 'dev-1', label: 'Song Leader' }, slides: SONGS[1].slides },
    { kind: 'quote', id: 'q-b', quote: quote(5), source: { deviceId: 'dev-2', label: 'Preacher' }, slides: [{ text: 'Placeholder paragraph 5.' }] }
  ],
  // a file from a newer BORN: fields this version does not know must survive a round trip
  'newer-extra-fields': [
    { kind: 'song', id: 's-c', songId: SONGS[0].id, title: SONGS[0].title, slides: SONGS[0].slides, ext: { picture: 'x.png', note: 'kept' }, futureField: [1, 2, 3] }
  ]
})

const post = (port, body) => fetch(`http://127.0.0.1:${port}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

;(async () => {
  const app = await launch({ profile, cwd: appDir, remotePort: 14318, mdns: 'born-remote-v1compat', port: 9358, settle: 6000 })
  const fixDir = path.join(profile, 'fixtures'); fs.mkdirSync(fixDir, { recursive: true })
  SONGS = librarySongs(profile)
  if (SONGS.length < 2) throw new Error('the seeded library has no songs — is resources/library.db.gz in the app being run?')
  const results = {}
  for (const [name, content] of Object.entries(fixtures())) {
    const file = path.join(fixDir, name + '.born')
    fs.writeFileSync(file, JSON.stringify(content, null, 2))
    await post(14318, { action: 'new-service' }); await sleep(600)
    await post(14318, { action: 'open-service', path: file }); await sleep(1200)
    await post(14318, { action: 'save-queue', name: 'out-' + name }); await sleep(1200)
    const outFile = path.join(profile, 'saved-services', `out-${name}.born`)
    results[name] = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { MISSING: true }
    console.log(`${name}: ${fs.existsSync(outFile) ? 'saved ' + (Array.isArray(results[name]) ? results[name].length + ' item(s)' : '') : 'NO OUTPUT'}`)
  }
  // the autosave file as it stands after the last file
  const q = path.join(profile, 'queue.json')
  results['_queue.json after last file'] = fs.existsSync(q) ? JSON.parse(fs.readFileSync(q, 'utf8')) : null
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2))
  await app.kill()
})().catch((e) => { console.error(e); process.exit(2) })

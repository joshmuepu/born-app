#!/usr/bin/env node
/* Seeds an isolated BORN profile with synthetic data for QA. Never touches real data.
 *   node scripts/qa/seed.cjs <fresh|populated|huge> <profileDir> [port]
 * populated: songs (long titles, RTL, CJK, emoji), media (generated pictures + fixtures + a short video), a queue of every kind, saved services, recents, a second channel + a Graphics output,
 *            and (if present) the tape copy at QA_TAPE (default /tmp/born-tape-work/Tape audio/*.m4a) imported by link.
 * huge: populated + 10,000 songs.   legacy profiles are made by copying an older v2 profile (see run.md).  Pictures are generated PNGs; no real sermon text is written to the repo.
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib')
const { launch, sleep } = require('./lib.cjs')
const [mode = 'populated', profile = '/tmp/born-qa-' + (process.argv[2] || 'populated'), port = '9951'] = process.argv.slice(2)

function png(file, w, h, hue) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (hue + x * 255 / w) & 255; raw[o + 1] = (y * 255 / h) & 255; raw[o + 2] = (hue * 2 + 80) & 255 } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0 }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}

const HYMNS = [
  ['Amazing Grace', 'Verse 1', 'Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.'],
  ['Holy, Holy, Holy', 'Verse 1', 'Holy, Holy, Holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, Holy, Holy! merciful and mighty!\nGod in three Persons, blessed Trinity!'],
  ['It Is Well With My Soul', 'Verse 1', 'When peace like a river attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul.'],
  ['Rock of Ages', 'Verse 1', 'Rock of Ages, cleft for me,\nLet me hide myself in Thee;\nLet the water and the blood,\nFrom Thy wounded side which flowed,\nBe of sin the double cure,\nSave from wrath and make me pure.']
]
const WEIRD = [
  ['A Very Long Song Title That Goes On And On Because Someone Pasted A Whole Sentence From A Service Bulletin Into The Title Box (Verses 1-4, with the Bridge, Key of G, 76 bpm)', 'Verse 1', 'Short lyric line one\nShort lyric line two'],
  ['ترنيمة الرب راعيّ', 'Verse 1', 'الرب راعيّ فلا يعوزني شيء\nفي مراعٍ خضر يربضني'],
  ['שיר המעלות', 'Verse 1', 'אשא עיני אל ההרים\nמאין יבוא עזרי'],
  ['主啊，我们赞美你', 'Verse 1', '主啊，我们赞美你\n荣耀归于你的名'],
  ['Gloria 🎶 in Excelsis ✝️', 'Chorus', 'Gloria in excelsis Deo 🙌\nGloria in excelsis Deo'],
  ['Song with a single enormous line', 'Verse 1', 'Thisisonelinewithnospacesatallthatgoesonandonandonandonandonandonandonandonandonandonandonandonandonandonandonandon'],
  ['Sparse', 'Verse 1', 'Hallelujah']
]
const slidesOf = (t) => [{ label: t[1], text: t[2] }, { label: 'Chorus', text: 'Praise Him, praise Him,\nAll ye little children' }]

;(async () => {
  fs.mkdirSync(profile, { recursive: true })
  if (mode === 'fresh') { console.log('fresh profile at', profile, '(empty: the app creates everything on first start)'); return }
  const media = path.join(profile, '_qa-media'); fs.mkdirSync(media, { recursive: true })
  for (let i = 0; i < 12; i++) png(path.join(media, `Picture ${String(i + 1).padStart(2, '0')} ${['Welcome', 'Offering', 'Announcements', 'Baptism', 'Easter', 'Christmas', 'Missions', 'Youth', 'Choir', 'Prayer', 'Thanks', 'Church logo'][i]}.png`), 1920, 1080, i * 20)
  const fx = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'media')
  const files = fs.readdirSync(media).map((f) => path.join(media, f)).concat(['tiny.jpg', 'clip.mp4', 'doc.pdf'].map((f) => path.join(fx, f)).filter(fs.existsSync))
  const app = await launch({ profile, port: +port, remotePort: 4360 + (+port % 40), mdns: 'born-qa-seed' })
  const page = await app.page()
  const ev = (e) => page.ev(e)
  const log = (...a) => console.log(...a)
  try {
    // songs
    const songs = [...HYMNS, ...WEIRD]
    for (const s of songs) await ev(`window.electronAPI.commitReviewedSong({ title: ${JSON.stringify(s[0])}, author: 'QA', songKey: 'G', slides: ${JSON.stringify(slidesOf(s))} })`).catch((e) => log('song fail', s[0], String(e).slice(0, 100)))
    if (mode === 'huge') {
      const t0 = Date.now()
      for (let i = 0; i < 10000; i += 100) await ev(`(async()=>{for(let j=${i};j<${i + 100};j++){await window.electronAPI.commitReviewedSong({title:'Generated Song '+j+' '+['Grace','Mercy','Light','River','Mountain'][j%5],author:'QA',slides:[{label:'Verse 1',text:'Line one of song '+j+'\\nLine two of song '+j},{label:'Chorus',text:'Chorus for '+j}]})}})()`).catch(() => {})
      log('10,000 songs in', Math.round((Date.now() - t0) / 1000), 's')
    }
    // media
    log('media import', JSON.stringify(await ev(`window.electronAPI.mediaImportPaths(${JSON.stringify(files)}, {})`).catch((e) => String(e))).slice(0, 160))
    // a second channel + a Graphics output
    await ev(`window.electronAPI.addChannel('Overflow room')`).catch(() => {})
    await ev(`window.electronAPI.listChannels().then(c=>window.electronAPI.addGraphicsOutput(c[0].id))`).catch(() => {})
    // queue of every kind
    const search = await ev(`window.electronAPI.searchSongs('')`).catch(() => [])
    const sermons = await ev(`window.electronAPI.tapeSermonList()`)
    const pick = (code) => sermons.find((s) => s.dateCode === code) || sermons[10]
    const sm = pick('63-0728'), sm2 = sermons[200]
    const paras = await ev(`window.electronAPI.getSermonParagraphs(${sm2.id}, 'en')`)
    const items = []
    const mk = (p, i) => ({ kind: 'quote', id: 'qa-q' + i, quote: { text: p.text, sermonTitle: p.sermonTitle, dateCode: p.dateCode, sermonId: p.sermonId, paragraphIndex: p.paragraphIndex, paragraphRef: p.paragraphRef, language: 'en' }, slides: [{ text: p.text, reference: p.sermonTitle + ' · ' + p.dateCode, paragraphRef: p.paragraphRef, page: 0 }] })
    paras.slice(2, 6).forEach((p, i) => items.push(mk(p, i)))
    const verse = await ev(`window.electronAPI.lookupPassage('John 3:16','KJV')`).catch(() => null)
    log('bible lookup', JSON.stringify(verse).slice(0, 120))
    if (verse && verse.verses) items.push({ kind: 'bible', id: 'qa-b1', translation: 'KJV', reference: 'John 3:16', bookNum: 43, chapter: 3, verseStart: 16, verseEnd: 16, slides: [{ text: verse.verses.map((v) => v.text).join(' '), reference: 'John 3:16 · KJV', marker: '16' }] })
    const mlist = await ev(`window.electronAPI.mediaList({})`).catch(() => null)
    const mitems = (mlist && (mlist.items || mlist)) || []
    if (Array.isArray(mitems) && mitems[0]) items.push({ kind: 'media', id: 'qa-m1', slides: [{ text: mitems[0].name + ' — picture (made by a newer version of born)' }], quote: { text: mitems[0].name, sermonTitle: mitems[0].name + ' (needs a newer BORN)', dateCode: '', sermonId: -1, paragraphIndex: 0, paragraphRef: '' }, ext: { v: 1, kind: 'media', mediaId: mitems[0].id, mediaKind: 'image', name: mitems[0].name } })
    items.push({ kind: 'quote', id: 'qa-yt1', slides: [{ text: 'Me at the zoo — YouTube video (made by a newer version of born)' }], quote: { text: 'Me at the zoo', sermonTitle: 'Me at the zoo (needs a newer BORN)', dateCode: '', sermonId: -1, paragraphIndex: 0, paragraphRef: '' }, ext: { v: 1, kind: 'youtube', videoId: 'jNQXAC9IVRw', title: 'Me at the zoo', titleAt: Date.now() } })
    if (search && search[0]) for (const s of search.slice(0, 3)) items.push({ kind: 'song', id: 'qa-s' + s.id, songId: s.id, title: s.title, author: 'QA', slides: slidesOf(['', 'Verse 1', 'Line one\nLine two']) })
    fs.writeFileSync(path.join(profile, '_qa-queue.json'), JSON.stringify(items))
    await ev(`window.electronAPI.saveQueue(${JSON.stringify(items)})`)
    await ev(`window.electronAPI.saveServiceNamed('Sunday morning (QA)', ${JSON.stringify(items)})`).catch(() => {})
    await ev(`window.electronAPI.saveServiceNamed('Midweek (QA)', ${JSON.stringify(items.slice(0, 2))})`).catch(() => {})
    // the tape, imported by link (never copied from ~/Downloads)
    const tapeDir = process.env.QA_TAPE_DIR || '/tmp/born-tape-work/Tape audio'
    if (fs.existsSync(tapeDir)) {
      for (const f of fs.readdirSync(tapeDir).filter((n) => /\.m4a$/i.test(n))) {
        const code = (f.match(/^(\d\d-\d{4}[A-Z]?)/) || [])[1]; const s = code && sermons.find((x) => x.dateCode === code)
        if (s) log('tape', f.slice(0, 20), JSON.stringify(await ev(`window.electronAPI.tapeImportPaths([${JSON.stringify(path.join(tapeDir, f))}], {sermonId:${s.id}, language:'en', link:true})`).then((r) => r.map((x) => x.ok)).catch((e) => String(e))))
      }
    }
    await sleep(1500)
    log('seeded', mode, profile)
  } finally { page.close(); await app.kill() }
})().catch((e) => { console.error(e); process.exit(1) })

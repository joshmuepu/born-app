import './keepStatements'
import { describe, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { MediaLibrary, type MediaDecoder } from '../../main/mediaLibrary'
import { exportPack, importPack } from '../../main/servicePack'
import { slideshowToItem, attachMediaRefs, serializeQueue } from '../../shared/queueItem'

// Opt-in numbers for the QA report: BORN_BENCH=1 npx vitest run src/test/main/servicePack.bench.test.ts
const run = process.env.BORN_BENCH ? describe : describe.skip
const dec: MediaDecoder = { async decode() { return { ok: true, width: 4000, height: 3000, hasAlpha: false, thumbs: [{ width: 320, height: 240, ext: 'jpg', data: Buffer.from('t') }, { width: 960, height: 720, ext: 'jpg', data: Buffer.from('t') }] } } }
run('service pack performance (decoder stubbed: decode time is not included)', () => {
  it('exports and imports ~1 GB of pictures', async () => {
    const root = mkdtempSync(join(tmpdir(), 'born-bench-'))
    const A = new MediaLibrary({ dir: join(root, 'A'), decoder: dec })
    const B = new MediaLibrary({ dir: join(root, 'B'), decoder: dec })
    const j = readFileSync(join(__dirname, '../fixtures/media/tiny.jpg'))
    const ids: Array<{ id: string; name: string }> = []
    for (let i = 0; i < 300; i++) {
      const segs: Buffer[] = []
      for (let k = 0; k < 52; k++) { const d = randomBytes(65000); const h = Buffer.alloc(4); h.writeUInt16BE(0xfffe, 0); h.writeUInt16BE(d.length + 2, 2); segs.push(h, d) }
      const p = join(root, `p${i}.jpg`)
      writeFileSync(p, Buffer.concat([j.subarray(0, 2), ...segs, j.subarray(2)]))
      const r = await A.importFile(p)
      if (!r.ok) throw new Error('import ' + JSON.stringify(r))
      ids.push({ id: r.item.id, name: r.item.name })
    }
    const q = serializeQueue(attachMediaRefs([slideshowToItem(ids, 'Big')], (id) => { const r = A.get(id)!; return { id, hash: r.hash, name: r.name, width: 1, height: 1, bytes: r.bytes } }))
    const dest = join(root, 'big.bornpack')
    let t = performance.now()
    const rss0 = process.memoryUsage().rss
    let peak = rss0
    const iv = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss) }, 50)
    const ex = await exportPack(A, q, { dest, title: 'Big', appVersion: 'bench', settings: {} })
    const tEx = (performance.now() - t) / 1000
    t = performance.now()
    const im = await importPack(B, dest)
    const tIm = (performance.now() - t) / 1000
    clearInterval(iv)
    console.log(`BENCH pack ${(statSync(dest).size / 1e9).toFixed(2)} GB, 300 pictures: export ${tEx.toFixed(1)} s (incl. read-back verify), open+verify+copy ${tIm.toFixed(1)} s, peak RSS growth ${Math.round((peak - rss0) / 1048576)} MB`, ex.ok, im.ok)
    A.close(); B.close(); rmSync(root, { recursive: true, force: true })
  }, 600_000)
})

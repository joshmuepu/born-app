// Refreshes resources/series.json: the sermon series list from The Table (the same request Browse > Series makes online), bundled so Series
// works without an internet connection. Names and sermon ids only.   node scripts/data/fetch-series.mjs
import { writeFileSync } from 'node:fs'
const res = await fetch('https://table.branham.org/rest/index/allSeries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Language: 'en' }) })
const data = await res.json()
if (data.Status !== 'Successful' || !Array.isArray(data.Result?.Series) || data.Result.Series.length === 0) throw new Error('The Table did not return the series list')
const series = data.Result.Series.map((s) => ({ i: s.i, n: s.n, s: s.s }))
writeFileSync(new URL('../../resources/series.json', import.meta.url), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: 'table.branham.org /rest/index/allSeries', series }, null, 1) + '\n')
console.log(`${series.length} series, ${series.reduce((n, s) => n + s.s.length, 0)} sermon links`)

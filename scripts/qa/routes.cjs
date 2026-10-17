#!/usr/bin/env node
/* Phone remote / automation HTTP routes: every route the census found is called on a running app (populated profile) and must answer with a sensible status, the right content type, no stack trace or raw error text;
 * bad input must be refused politely (4xx, never 5xx, never a crash).      node scripts/qa/routes.cjs [port]      -> qa-out/routes.json */
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process')
const { launch, sleep, ROOT } = require('./lib.cjs')
const rport = 4556
const req = (method, p, body, headers = {}) => new Promise((res) => { const r = http.request({ host: '127.0.0.1', port: rport, path: p, method, headers: { 'content-type': 'application/json', ...headers } }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => res({ status: x.statusCode, type: x.headers['content-type'] || '', body: d })) }); r.on('error', (e) => res({ status: 0, type: '', body: String(e) })); if (body) r.write(body); r.end() })
;(async () => {
  execSync('rm -rf /tmp/qa-routes; cp -R /tmp/qa-populated /tmp/qa-routes')
  const app = await launch({ profile: '/tmp/qa-routes', port: +(process.argv[2] || 9976), remotePort: rport, mdns: 'born-qa-routes', settle: 7000 })
  const GET = ['/', '/app.css', '/app.js', '/manifest.json', '/sw.js', '/ping', '/state', '/api/search/sermons?q=grace', '/api/search/bible?q=love', '/api/search/songs?q=grace', '/api/bible/books', '/api/bible/chapter?book=43&chapter=3', '/api/media/list', '/api/songs/recent', '/api/songs/recent-keys', '/api/services/recent', '/api/sermons/series', '/api/sermons/by-ids?ids=1,2,3', '/api/sermons/recent', '/api/sermons/on-this-day', '/api/automation/tape', '/api/automation/state', '/api/automation/queue', '/api/tape/paragraphs']
  const out = []; let bad = 0
  const judge = (name, r, expectOk = true) => {
    const text = r.body.slice(0, 4000); const issues = []
    if (expectOk && !(r.status >= 200 && r.status < 300)) issues.push('status ' + r.status)
    if (!expectOk && !(r.status >= 400 && r.status < 500) && r.status !== 200) issues.push('status ' + r.status + ' (wanted a polite 4xx)')
    if (r.status >= 500 || r.status === 0) issues.push('server error')
    if (/at \S+ \(.*:\d+:\d+\)|TypeError|ReferenceError|SqliteError|ENOENT|undefined|\[object Object\]/.test(text) && !/\.(css|js)$/.test(name) && !name.startsWith('/sw.js')) issues.push('technical text in the answer: ' + (text.match(/at \S+ \(.*:\d+:\d+\)|TypeError|ReferenceError|SqliteError|ENOENT|undefined|\[object Object\]/) || [''])[0])
    if (/json/.test(r.type)) { try { JSON.parse(r.body) } catch { issues.push('declared JSON but not parseable') } }
    out.push({ route: name, status: r.status, type: r.type.split(';')[0], bytes: r.body.length, issues }); if (issues.length) bad++
  }
  for (const g of GET) judge('GET ' + g, await req('GET', g))
  // automation: next / prev are safe on a closed projection; a bad command must be refused
  for (const p of ['/api/automation/next', '/api/automation/prev']) judge('POST ' + p, await req('POST', p, '{}'))
  judge('POST /command (valid ping-like)', await req('POST', '/command', JSON.stringify({ type: 'nope' })), false)
  judge('POST /command (not JSON)', await req('POST', '/command', '{ nope'), false)
  judge('POST /command (huge body)', await req('POST', '/command', 'x'.repeat(2_000_000)), false)
  judge('GET /no-such-route', await req('GET', '/no-such-route'), false)
  judge('GET /api/bible/chapter (bad numbers)', await req('GET', '/api/bible/chapter?book=abc&chapter=-5'), false)
  judge('GET /api/sermons/by-ids (junk)', await req('GET', '/api/sermons/by-ids?ids=%00,..,9999999999999999999'), false)
  judge('GET path traversal', await req('GET', '/../../etc/passwd'), false)
  fs.writeFileSync(path.join(ROOT, 'qa-out', 'routes.json'), JSON.stringify(out, null, 1))
  console.log(`${out.length} routes/cases, ${bad} with issues`); for (const o of out.filter((x) => x.issues.length)) console.log(' ', o.route, o.status, o.issues.join('; '))
  await app.kill()
})()

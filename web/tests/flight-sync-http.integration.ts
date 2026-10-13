// Run after flight-sync-live.ts and build:qa; only touches that disposable localhost fixture.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const qa = JSON.parse(await readFile('.data/flight-sync-live-qa.json', 'utf8'))
const origin = 'http://127.0.0.1:3002'
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3002'], { stdio: ['ignore', 'pipe', 'pipe'], env: {
  ...process.env, PAYLOAD_SECRET: qa.secret, DATABASE_URL: 'file:' + qa.directory + '/test.db', MEDIA_DIR: qa.directory + '/media', SERVER_URL: origin,
  NEXT_DIST_DIR: '.next-qa', MERAK_AUTO_MIGRATE: '1', FLIGHT_SYNC_ENABLED: '1', FLIGHT_SYNC_TOKEN: qa.token, FLIGHT_SYNC_VISIBILITY: 'private',
  FR24_TRANSPORT: 'curl_cffi', FR24_PYTHON: resolve('.data/flight-sync-python/bin/python'),
} })
let logs = ''
for (const stream of [server.stdout, server.stderr]) stream.on('data', value => { logs = (logs + String(value)).slice(-3000) })
const auth = { Authorization: 'Bearer ' + qa.token }
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode != null) throw new Error('Isolated server did not start: ' + logs)
    try { const r = await fetch(origin + '/api/flight/pending', { headers: auth }); if (r.status === 200) { ready = true; break } }
    catch { /* Server still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(ready, 'production API is reachable')
  const post = (path: string, body: unknown, headers = auth) => fetch(origin + path, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await post('/api/flight/phase1-init', { flight_number: 'MU9191' }, { Authorization: 'Bearer invalid' })).status, 401)
  const pendingResponse = await fetch(origin + '/api/flight/pending', { headers: auth })
  assert.equal(pendingResponse.headers.get('cache-control'), 'no-store')
  const pending = (await pendingResponse.json()).records.find((row: { record_id: string }) => row.record_id === qa.result.record_id)
  assert.ok(pending)
  const phase1 = await post('/api/flight/phase1-init', { flight_number: pending.flight_number, date: pending.date, origin: pending.origin, destination: pending.destination })
  assert.equal(phase1.status, 200)
  assert.equal((await phase1.json()).record_id, qa.result.record_id)
  const invalidGate = await post('/api/flight/phase2-calibrate', { record_id: pending.record_id, flight_number: pending.flight_number, gate_arrival_time: pending.touchdown })
  assert.equal(invalidGate.status, 422)
  const denied = await fetch(origin + '/api/flight-sync-jobs')
  assert.ok([401, 403].includes(denied.status))
  const login = await post('/api/users/login', { email: 'flight-sync-live@example.invalid', password: 'Local-QA-only-2026!' })
  assert.equal(login.status, 200)
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  assert.ok(cookie)
  const setVisibility = (visibility: string) => fetch(origin + '/api/flights/' + pending.record_id, { method: 'PATCH', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility }) })
  assert.equal((await setVisibility('public')).status, 200)
  try {
    const page = await fetch(origin + '/flights')
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.ok(html.includes('实际接地'))
    assert.ok(html.includes(pending.flight_number))
  } finally { assert.equal((await setVisibility('private')).status, 200) }
  console.log('PASS: production HTTP endpoints, Bearer auth, no-store pending response, real-flight idempotency, 422 gate validation, private queue, admin access, radar-only frontend label and visibility restoration.')
} finally {
  server.kill('SIGTERM')
  await new Promise<void>(resolve => { if (server.exitCode != null) resolve(); else server.once('exit', () => resolve()) })
}

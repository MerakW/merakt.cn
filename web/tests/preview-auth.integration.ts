import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Papa from 'papaparse'
import { importFlights } from '../src/lib/flights/import-endpoint'
import { backfillFlights } from '../src/lib/flights/backfill-endpoint'

const directory = await mkdtemp(join(tmpdir(), 'merak-preview-auth-'))
Object.assign(process.env, {
  PAYLOAD_SECRET: randomUUID() + randomUUID(),
  DATABASE_URL: 'file:' + join(directory, 'test.db'),
  MEDIA_DIR: join(directory, 'media'),
  LOCAL_PREVIEW: '1',
  SERVER_URL: 'http://192.168.1.20:3003',
  FLIGHT_SYNC_ENABLED: '0',
  MERAK_AUTO_MIGRATE: '0',
})
const { getPayload, createLocalReq } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const credentials = { email: 'preview@example.invalid', password: randomUUID() }
  await payload.create({ collection: 'users', data: { name: 'Preview test', ...credentials } })
  const { token } = await payload.login({ collection: 'users', data: credentials })
  assert.ok(token)
  const authenticate = (origin: string) => payload.auth({ headers: new Headers({
    cookie: `${payload.config.cookiePrefix}-token=${token}`, origin,
  }) })
  const admin = (await authenticate(process.env.SERVER_URL!)).user
  assert.ok(admin)
  const invokeFlight = async (origin: string, action: string, backfill = false, authenticated = true, csvOverride?: string) => {
    const csv = csvOverride || `Date,From,To,Flight Flighty ID\n2026-09-21,HGH,HND,${origin}`
    const request = new Request(`${process.env.SERVER_URL}/api/flights/import?action=${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ csv, action }),
    })
    const req = await createLocalReq({ user: authenticated ? admin : undefined }, payload)
    Object.assign(req, { headers: request.headers, body: request.body })
    Object.defineProperty(req, 'url', { value: request.url })
    return backfill ? backfillFlights(req) : importFlights(req)
  }
  for (const origin of ['http://127.0.0.1:3003', 'http://localhost:3003', process.env.SERVER_URL!]) {
    const { user } = await authenticate(origin)
    assert.ok(user, `Cookie authentication failed for ${origin}`)
    const note = await payload.create({ collection: 'notes', user, overrideAccess: false,
      data: { text: 'Preview auth test', date: new Date().toISOString(), _status: 'published' } })
    const updated = await payload.update({ collection: 'notes', id: note.id, user, overrideAccess: false,
      data: { text: 'Updated' } })
    assert.equal(updated.text, 'Updated')
    await payload.delete({ collection: 'notes', id: note.id, user, overrideAccess: false })
    const preview = await invokeFlight(origin, 'preview')
    assert.equal(preview.status, 200)
    assert.equal((await preview.json()).valid, true)
    const commit = await invokeFlight(origin, 'commit')
    assert.equal(commit.status, 200)
    assert.equal((await commit.json()).imported, 1)
    assert.equal((await (await invokeFlight(origin, 'commit')).json()).imported, 0)
    for (const action of ['preview', 'commit']) {
      assert.equal((await invokeFlight(origin, action, true)).status, 200)
    }
  }
  for (const origin of ['', 'https://untrusted.invalid', 'http://127.0.0.1:4000']) {
    for (const backfill of [false, true]) {
      assert.equal((await invokeFlight(origin, 'commit', backfill)).status, 403)
    }
  }
  for (const backfill of [false, true]) {
    assert.equal((await invokeFlight(process.env.SERVER_URL!, 'commit', backfill, false)).status, 401)
  }
  const origin = 'http://127.0.0.1:3003'
  const row = { Date: '2026-09-21', From: 'HGH', To: 'HND', 'Flight Flighty ID': 'review-test',
    'Gate Departure (Scheduled)': '2026-09-21T09:00', 'Gate Arrival (Scheduled)': '2026-09-21T13:00',
    'Gate Arrival (Actual)': '', 'Landing (Actual)': '' }
  assert.equal((await invokeFlight(origin, 'commit', false, true, Papa.unparse([row]))).status, 200)
  const original = (await payload.find({ collection: 'flights', where: { importKey: { equals: 'flighty:review-test' } } })).docs[0]
  await payload.update({ collection: 'flights', id: original.id, data: { visibility: 'public', note: 'Keep editorial note', actualDepartureUTC: '2026-09-21T01:00:00Z', privateDetails: { ...(original.privateDetails as object), pnr: 'PRIVATE-TEST' } } })
  const changed = { ...row, 'Gate Arrival (Actual)': '2026-09-21T13:05', 'Landing (Actual)': '2026-09-21T14:00' }
  const normal = { ...row, 'Flight Flighty ID': 'normal-batch', 'Gate Arrival (Actual)': '2026-09-21T13:00' }
  const response = await invokeFlight(origin, 'commit', false, true, Papa.unparse([changed, normal]))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.imported, 1)
  assert.equal(result.updated, 1)
  const saved = await payload.findByID({ collection: 'flights', id: original.id })
  assert.equal(saved.visibility, 'public')
  assert.equal(saved.note, 'Keep editorial note')
  assert.equal(saved.actualDepartureUTC, '2026-09-21T01:00:00.000Z')
  assert.equal((saved.privateDetails as { pnr: string }).pnr, 'PRIVATE-TEST')
  assert.equal(saved.actualArrivalUTC, '2026-09-21T04:05:00.000Z')
  assert.equal(saved.touchdownUTC, null)
  assert.ok((saved.privateDetails as { importIssues: unknown[] }).importIssues.length)
  const publicRecord = await payload.findByID({ collection: 'flights', id: original.id, overrideAccess: false })
  assert.equal(publicRecord.privateDetails, undefined)
  const repeat = await (await invokeFlight(origin, 'commit', false, true, Papa.unparse([changed, normal]))).json()
  assert.equal(repeat.imported, 0)
  assert.equal(repeat.updated, 0)
  console.log('PASS: conflicting times save with actual gate arrival; normal batch rows import; existing visibility and notes preserved; review flags private; retry idempotent')
  console.log('PASS: Flighty preview, import, duplicate protection and backfill on all preview origins; missing/foreign origins and anonymous requests denied')
  for (const origin of ['https://untrusted.invalid', 'http://127.0.0.1:4000', 'http://192.168.1.21:3003']) {
    const { user } = await authenticate(origin)
    assert.equal(user, null)
    await assert.rejects(payload.create({ collection: 'notes', user, overrideAccess: false,
      data: { text: 'Denied', date: new Date().toISOString() } }))
  }
  console.log('PASS: localhost and configured LAN cookie authentication, authorized create/update/delete, untrusted origins denied')
} finally {
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}

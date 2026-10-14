// Uses a disposable database and synthetic records, including real production migrations.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const directory = await mkdtemp(join(tmpdir(), 'merak-flight-admin-'))
process.env.PAYLOAD_SECRET = randomUUID() + randomUUID()
process.env.DATABASE_URL = 'file:' + join(directory, 'test.db')
process.env.MEDIA_DIR = join(directory, 'media')
process.env.MERAK_AUTO_MIGRATE = '1'
Object.assign(process.env, { NODE_ENV: 'production' })
const { createLocalReq, getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const user = await payload.create({ collection: 'users', data: { email: 'flight-admin@example.invalid', password: 'Local-QA-only-2026!', name: '隔离测试' } })
  const admin = { ...user, collection: 'users' as const }
  const flight = await payload.create({ collection: 'flights', user: admin, overrideAccess: false, data: { date: '2026-10-12', from: 'HGH', to: 'HND', flightNumber: 'QA101', state: 'completed', visibility: 'public', _status: 'published', actualDepartureUTC: '2026-10-12T01:00:00Z', takeoffUTC: '2026-10-12T01:10:00Z', touchdownUTC: '2026-10-12T03:10:00Z', actualArrivalUTC: '2026-10-12T03:20:00Z' } })
  const saved = await payload.findByID({ collection: 'flights', id: flight.id, user: admin, overrideAccess: false })
  assert.equal(saved.touchdownUTC, '2026-10-12T03:10:00.000Z')
  await assert.rejects(payload.update({ collection: 'flights', id: flight.id, user: admin, overrideAccess: false, data: { actualArrivalUTC: '2026-10-12T03:00:00Z' } }), /入位.*接地/)
  await assert.rejects(payload.update({ collection: 'flights', id: flight.id, overrideAccess: false, data: { takeoffUTC: null } }))
  await payload.update({ collection: 'flights', id: flight.id, user: admin, overrideAccess: false, data: { takeoffUTC: null } })
  assert.equal((await payload.findByID({ collection: 'flights', id: flight.id })).takeoffUTC, null)
  await payload.update({ collection: 'flights', id: flight.id, user: admin, data: { state: 'planned', hideSchedule: true } })
  const hidden = await payload.findByID({ collection: 'flights', id: flight.id, overrideAccess: false, select: { touchdownUTC: true, actualArrivalUTC: true } })
  assert.equal(hidden.touchdownUTC, undefined)
  assert.equal(hidden.actualArrivalUTC, undefined)
  await payload.update({ collection: 'flights', id: flight.id, user: admin, data: { state: 'completed', hideSchedule: false } })
  await payload.update({ collection: 'flights', id: flight.id, user: admin, data: { privateDetails: { sourceRow: { Date: '2026-10-12', From: 'HGH', To: 'HND', Flight: 'QA101', 'Gate Departure (Actual)': '2026-10-12T09:00', 'Take off (Actual)': '2026-10-12T09:10', 'Landing (Actual)': '2026-10-12T12:10', 'Gate Arrival (Actual)': '2026-10-12T12:20' } } } })
  const { backfillFlights } = await import('../src/lib/flights/backfill-endpoint')
  async function backfill(action: string, authenticated = true, origin = payload.config.serverURL) {
    const req = await createLocalReq({ user: authenticated ? admin : undefined }, payload)
    req.headers = new Headers({ origin })
    Object.defineProperty(req, 'url', { value: `${payload.config.serverURL}/api/flights/backfill?action=${action}` })
    return backfillFlights(req)
  }
  assert.equal((await backfill('preview', false)).status, 401)
  assert.equal((await backfill('commit', true, 'https://untrusted.invalid')).status, 403)
  assert.equal((await (await backfill('preview')).json()).updates.length, 1)
  assert.equal((await payload.findByID({ collection: 'flights', id: flight.id })).takeoffUTC, null)
  assert.equal((await (await backfill('commit')).json()).updated, 1)
  const recovered = await payload.findByID({ collection: 'flights', id: flight.id })
  assert.equal(recovered.takeoffUTC, '2026-10-12T01:10:00.000Z')
  assert.equal(recovered.visibility, 'public')
  assert.equal(recovered.actualArrivalUTC, '2026-10-12T03:20:00.000Z')
  assert.equal((await (await backfill('commit')).json()).updated, 0)
  await payload.update({ collection: 'flights', id: flight.id, user: admin, draft: true, data: { takeoffUTC: null, note: '尚未发布的修改', _status: 'draft' } })
  assert.equal((await (await backfill('commit')).json()).updated, 1)
  const draft = await payload.findByID({ collection: 'flights', id: flight.id, draft: true })
  assert.equal(draft._status, 'draft')
  assert.equal(draft.takeoffUTC, '2026-10-12T01:10:00.000Z')
  assert.notEqual((await payload.findByID({ collection: 'flights', id: flight.id })).note, '尚未发布的修改')
  await payload.update({ collection: 'flights', id: flight.id, user: admin, data: { note: '', _status: 'published' } })
  await payload.create({ collection: 'checkins', data: { name: '列表审核测试', message: '此留言仅用于本机测试。', status: 'pending' } })
  await mkdir('.data', { recursive: true })
  await writeFile('.data/flight-admin-qa.json', JSON.stringify({ directory, flightId: flight.id, secret: process.env.PAYLOAD_SECRET }), { mode: 0o600 })
  console.log('PASS: migrations, four timestamps, chronology, clearing, privacy, backfill preview/commit, idempotence, anonymous and cross-origin denied. Disposable UI fixture ready.')
} finally { await payload.destroy() }

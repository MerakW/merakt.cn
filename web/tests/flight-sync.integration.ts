import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { initializeSync, calibrateSync, pendingCalibrations, processDueSync, processSyncJob } from '../src/lib/flights/sync-service'
import { phase1Init, phase2Calibrate, listPending } from '../src/lib/flights/sync-endpoints'
import { FlightSyncError, type SyncServices, type FlightFacts } from '../src/lib/flights/sync-provider'

const directory = await mkdtemp(join(tmpdir(), 'merak-flight-sync-'))
Object.assign(process.env, { PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: 'file:' + join(directory, 'test.db'), MEDIA_DIR: join(directory, 'media'), MERAK_AUTO_MIGRATE: '1', NODE_ENV: 'production', FLIGHT_SYNC_ENABLED: '0', FLIGHT_SYNC_VISIBILITY: 'private', FLIGHT_SYNC_TOKEN: randomUUID() + randomUUID() })
const { getPayload, createLocalReq } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
process.env.FLIGHT_SYNC_ENABLED = '1'
const now = new Date('2026-10-12T10:00:00Z')
const tomorrow = new Date('2026-10-13T10:01:00Z')
const facts: FlightFacts = { provider: 'fr24', providerId: 'test-only', flightNumber: 'MU9191', date: '2026-10-12', from: 'HGH', to: 'HND', takeoffUTC: '2026-10-12T01:10:00Z', touchdownUTC: '2026-10-12T03:10:00Z', registration: 'B-TEST', aircraft: 'Synthetic Aircraft', aircraftCode: 'TEST' }
let lookups = 0, pushes = 0
const services: SyncServices = {
  lookup: async () => { lookups++; await new Promise(resolve => setTimeout(resolve, 20)); return facts },
  push: async (number, id) => { assert.equal(number, 'MU9191'); assert.match(id, /^\d+$/); pushes++ },
}
const request = { flight_number: 'MU9191', date: '2026-10-12', origin: 'HGH', destination: 'HND' }
const invoke = async (body: unknown, handler: typeof phase1Init | typeof phase2Calibrate, authorized = true) => {
  const http = new Request(payload.config.serverURL + '/api/flight/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorized ? 'Bearer ' + process.env.FLIGHT_SYNC_TOKEN : 'Bearer invalid' }, body: JSON.stringify(body) })
  const req = await createLocalReq({}, payload)
  Object.assign(req, { headers: http.headers, body: http.body })
  return handler === phase1Init ? phase1Init(req, services) : handler(req)
}
try {
  const [first, concurrent] = await Promise.all([initializeSync(payload, request, services, now), initializeSync(payload, request, services, now)])
  assert.equal(first.sync_job_id, concurrent.sync_job_id)
  assert.equal(lookups, 1)
  const created = await initializeSync(payload, request, services, now)
  assert.equal(created.status, 'Pending_Gate_Calibration')
  assert.ok(created.record_id)
  assert.equal((await payload.count({ collection: 'flights' })).totalDocs, 1)
  let flight = await payload.findByID({ collection: 'flights', id: created.record_id!, context: { internalFlightDates: true } })
  assert.equal(flight.visibility, 'private')
  assert.equal(flight.actualArrivalUTC, null)
  assert.equal(flight.touchdownUTC, '2026-10-12T03:10:00.000Z')
  assert.equal(flight.aircraftCode, 'TEST')
  assert.equal((await payload.find({ collection: 'flights', overrideAccess: false })).totalDocs, 0)
  await assert.rejects(payload.find({ collection: 'flight-sync-jobs', overrideAccess: false }), /无权/)
  await processDueSync(payload, services, now)
  assert.equal(pushes, 0)
  await processDueSync(payload, services, tomorrow)
  assert.equal(pushes, 1)
  assert.equal((await pendingCalibrations(payload)).records[0].record_id, created.record_id)
  const gate = { record_id: created.record_id!, flight_number: 'MU9191', gate_arrival_time: '2026-10-12T12:25:00+09:00' }
  await assert.rejects(calibrateSync(payload, { ...gate, gate_arrival_time: '2026-10-12T12:00:00+09:00' }, tomorrow), /晚于接地/)
  await assert.rejects(calibrateSync(payload, { ...gate, flight_number: 'CA1234' }, tomorrow), /不匹配/)
  await assert.rejects(calibrateSync(payload, { ...gate, gate_arrival_time: '2026-10-12T12:25:00' }, tomorrow), /时区/)
  await assert.rejects(calibrateSync(payload, { ...gate, gate_arrival_time: '2026-10-13T12:25:00+09:00' }, tomorrow), /十二小时/)
  assert.equal((await calibrateSync(payload, gate, tomorrow)).status, 'Archived')
  const versionsBefore = (await payload.findVersions({ collection: 'flights', where: { parent: { equals: flight.id } } })).totalDocs
  assert.equal((await calibrateSync(payload, gate, tomorrow)).unchanged, true)
  assert.equal((await payload.findVersions({ collection: 'flights', where: { parent: { equals: flight.id } } })).totalDocs, versionsBefore)
  assert.equal((await pendingCalibrations(payload)).records.length, 0)
  await calibrateSync(payload, { ...gate, gate_arrival_time: '2026-10-12T12:26:00+09:00' }, tomorrow)
  flight = await payload.findByID({ collection: 'flights', id: flight.id })
  assert.equal(flight.actualArrivalUTC, '2026-10-12T03:26:00.000Z')
  await payload.update({ collection: 'flights', id: flight.id, data: { actualArrivalUTC: '2026-10-12T03:30:00Z' } })
  await assert.rejects(calibrateSync(payload, gate, tomorrow), /其他来源/)

  const differentRequest = { ...request, calendar_event_id: 'second-event-same-flight' }
  process.env.FLIGHT_SYNC_VISIBILITY = 'public'
  const second = await initializeSync(payload, differentRequest, services, now)
  assert.equal(second.record_id, created.record_id)
  assert.equal(second.status, 'Archived')
  assert.equal((await payload.findByID({ collection: 'flights', id: created.record_id! })).visibility, 'private')
  assert.equal((await payload.count({ collection: 'flights' })).totalDocs, 1)

  const autoPublic = await initializeSync(payload, { ...request, flight_number: 'MF101' }, { ...services, lookup: async () => ({ ...facts, flightNumber: 'MF101' }) }, now)
  assert.equal((await payload.findByID({ collection: 'flights', id: autoPublic.record_id! })).visibility, 'public')
  process.env.FLIGHT_SYNC_VISIBILITY = 'private'
  assert.equal((await invoke(request, phase1Init, false)).status, 401)
  assert.equal((await invoke(null, phase1Init)).status, 400)
  assert.equal((await invoke({ flight_number: 'MU9191', calendar_event_id: 'x'.repeat(9000) }, phase1Init)).status, 413)
  assert.equal((await invoke(gate, phase2Calibrate, false)).status, 401)
  const pendingReq = await createLocalReq({}, payload)
  Object.assign(pendingReq, { headers: new Headers({ Authorization: 'Bearer ' + process.env.FLIGHT_SYNC_TOKEN }) })
  assert.equal((await listPending(pendingReq)).status, 200)
  process.env.FLIGHT_SYNC_ENABLED = '0'
  assert.equal((await invoke(request, phase1Init)).status, 503)
  process.env.FLIGHT_SYNC_ENABLED = '1'

  const blocked = await initializeSync(payload, { flight_number: 'CA1234', date: '2026-10-12' }, { ...services, lookup: async () => { throw new FlightSyncError('provider-http-403', '雷达访问受限（403）。') } }, now)
  assert.equal(blocked.status, 'Awaiting_Radar')
  assert.equal(blocked.record_id, null)
  assert.equal(blocked.nextRunAt, '2026-10-12T10:01:00.000Z')
  assert.equal((await payload.count({ collection: 'flights' })).totalDocs, 2)

  // Simulate a process dying after acquiring its lease: an unexpired lease prevents a second fetch.
  await payload.update({ collection: 'flight-sync-jobs', id: Number(blocked.sync_job_id), data: { leaseUntil: '2026-10-12T11:00:00Z', leaseToken: 'simulated-crash' } })
  const before = lookups
  await processSyncJob(payload, Number(blocked.sync_job_id), services, new Date('2026-10-12T10:05:00Z'))
  assert.equal(lookups, before)
  await payload.update({ collection: 'flight-sync-jobs', id: Number(blocked.sync_job_id), data: { leaseUntil: '2026-10-12T09:00:00Z' } })
  await payload.destroy()
  process.env.FLIGHT_SYNC_ENABLED = '0'
  const reopened = execFileSync(process.execPath, ['--import', 'tsx', 'tests/flight-sync-reopen.ts'], { encoding: 'utf8', env: { ...process.env, REOPEN_JOB_ID: blocked.sync_job_id } })
  assert.ok(reopened.includes('FLIGHT_SYNC_REOPEN_OK'))
  console.log('PASS: production migration, concurrent idempotency, private records, 24h Bark timing, gate validation/correction/conflicts, anonymous access denied, bounded JSON, 403 persistence, atomic lease and restart recovery.')
} finally { await payload.destroy() }

// Explicit opt-in smoke test against a public example flight, using a disposable database.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lookupFlight } from '../src/lib/flights/sync-provider'
import { initializeSync } from '../src/lib/flights/sync-service'

const facts = await lookupFlight({ flight_number: 'MU9191' })
const directory = await mkdtemp(join(tmpdir(), 'merak-sync-live-'))
Object.assign(process.env, { PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: 'file:' + join(directory, 'test.db'), MEDIA_DIR: join(directory, 'media'), MERAK_AUTO_MIGRATE: '1', NODE_ENV: 'production', FLIGHT_SYNC_ENABLED: '0', FLIGHT_SYNC_VISIBILITY: 'private' })
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  const result = await initializeSync(payload, { flight_number: facts.flightNumber, date: facts.date, origin: facts.from, destination: facts.to }, { lookup: async () => facts, push: async () => { throw new Error('No real notification in this test') } })
  assert.equal(result.status, 'Pending_Gate_Calibration')
  assert.ok(result.record_id)
  const flight = await payload.findByID({ collection: 'flights', id: result.record_id! })
  assert.equal(flight.registration, facts.registration)
  assert.equal(flight.touchdownUTC, facts.touchdownUTC)
  assert.equal(flight.actualArrivalUTC, null)
  assert.equal(flight.visibility, 'private')
  await payload.create({ collection: 'users', data: { name: '隔离同步测试', email: 'flight-sync-live@example.invalid', password: 'Local-QA-only-2026!' } })
  await mkdir('.data', { recursive: true })
  await writeFile('.data/flight-sync-live-qa.json', JSON.stringify({ directory, secret: process.env.PAYLOAD_SECRET, token: randomUUID() + randomUUID(), result }), { mode: 0o600 })
  const evidence = { provider: facts.provider, capturedAt: new Date().toISOString(), flight_number: facts.flightNumber, date: facts.date, origin: facts.from, destination: facts.to, registration: facts.registration, aircraft: facts.aircraft, aircraftCode: facts.aircraftCode, takeoff: facts.takeoffUTC, touchdown: facts.touchdownUTC, status: result.status, isolatedDatabase: true }
  await mkdir('../docs/flight-admin-qa', { recursive: true })
  await writeFile('../docs/flight-admin-qa/live-fr24-result.json', JSON.stringify(evidence, null, 2) + '\n')
  console.log('LIVE_FR24_OK', JSON.stringify(evidence))
} finally { await payload.destroy() }

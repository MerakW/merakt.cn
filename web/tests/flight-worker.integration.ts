import assert from 'node:assert/strict'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { Temporal } from '@js-temporal/polyfill'
import { initializeSync, calibrateSync, processDueSync } from '../src/lib/flights/sync-service'
import { claimWorkerJob, acceptWorkerResult, workerEndpoint } from '../src/lib/flights/sync-worker'
import { signedHeaders } from '../src/lib/flights/worker-protocol'

const directory = await mkdtemp(join(tmpdir(), 'merak-remote-flight-'))
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const keyFile = join(directory, 'public.pem')
await writeFile(keyFile, publicKey.export({ type: 'spki', format: 'pem' }))
Object.assign(process.env, { PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: 'file:' + join(directory, 'test.db'), MEDIA_DIR: join(directory, 'media'), NODE_ENV: 'production', MERAK_AUTO_MIGRATE: '1', FLIGHT_SYNC_ENABLED: '1', FLIGHT_SYNC_MODE: 'remote', FLIGHT_SYNC_VISIBILITY: 'private', FLIGHT_WORKER_PUBLIC_KEY_FILE: keyFile })
const { getPayload, createLocalReq } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
const now = new Date()
const at = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString()
const date = Temporal.Instant.from(at(-3)).toZonedDateTimeISO('Asia/Shanghai').toPlainDate().toString()
const request = { flight_number: 'MU9191', date, origin: 'HGH', destination: 'HND' }
const facts = { provider: 'fr24', flightNumber: 'MU9191', date, from: 'HGH', to: 'HND', takeoffUTC: at(-3), touchdownUTC: at(-1), aircraftCode: 'C919', registration: 'B-TEST' }
const forbidden = { lookup: async () => { throw new Error('Cloud must not fetch') }, push: async () => { throw new Error('Cloud must not push Bark') } }
async function invoke(raw: string, headers: Record<string, string>) {
  const http = new Request('https://merakt.cn/api/flight/worker', { method: 'POST', body: raw, headers })
  const req = await createLocalReq({}, payload)
  Object.assign(req, { body: http.body, headers: http.headers })
  return workerEndpoint(req)
}
try {
  const check = JSON.stringify({ action: 'check' })
  const headers = signedHeaders(check, privateKey)
  assert.equal((await invoke(check, headers)).status, 200)
  assert.equal((await invoke(check, headers)).status, 409)
  assert.equal((await invoke(check + ' ', signedHeaders(check, privateKey))).status, 401)
  assert.equal((await invoke(check, signedHeaders(check, privateKey, Date.now() - 360000))).status, 401)
  const foreign = generateKeyPairSync('ed25519')
  assert.equal((await invoke(check, signedHeaders(check, foreign.privateKey))).status, 401)
  assert.equal((await invoke('x'.repeat(9000), signedHeaders('x'.repeat(9000), privateKey))).status, 413)
  await assert.rejects(payload.find({ collection: 'flight-worker-replays', overrideAccess: false }))
  const initialized = await initializeSync(payload, request, forbidden, now)
  assert.equal(initialized.status, 'Awaiting_Radar')
  assert.equal((await processDueSync(payload, forbidden, now)).processed, 0)
  const claims = await Promise.all([claimWorkerJob(payload, now), claimWorkerJob(payload, now)])
  assert.equal(claims.filter(Boolean).length, 1)
  const job = claims.find(Boolean)!
  await assert.rejects(acceptWorkerResult(payload, { job_id: job.job_id, lease_token: job.lease_token, ok: true, facts: { ...facts, from: 'SHA' } }, now), /规范/)
  await assert.rejects(acceptWorkerResult(payload, { job_id: job.job_id, lease_token: job.lease_token, ok: true, facts: { ...facts, touchdownUTC: at(1) } }, now), /规范/)
  const body = { action: 'result', job_id: job.job_id, lease_token: job.lease_token, ok: true, facts }
  const raw = JSON.stringify(body)
  const response = await invoke(raw, signedHeaders(raw, privateKey))
  assert.equal(response.status, 200)
  const accepted = await response.json()
  assert.equal(accepted.status, 'Pending_Gate_Calibration')
  assert.equal((await invoke(raw, signedHeaders(raw, privateKey))).status, 409)
  const flight = await payload.findByID({ collection: 'flights', id: accepted.record_id, context: { internalFlightDates: true } })
  assert.equal(flight.visibility, 'private')
  assert.equal(flight.aircraftCode, 'C919')
  assert.equal((await payload.count({ collection: 'flights' })).totalDocs, 1)
  const tomorrow = new Date(at(25))
  const barkJob = await claimWorkerJob(payload, tomorrow)
  assert.equal(barkJob!.phase, 'Pending_Gate_Calibration')
  await acceptWorkerResult(payload, { job_id: barkJob!.job_id, lease_token: barkJob!.lease_token, ok: false, error_code: 'bark-not-configured', error: 'SECRET' }, tomorrow)
  const pending = await payload.findByID({ collection: 'flight-sync-jobs', id: job.job_id })
  assert.ok(!pending.lastError!.includes('SECRET'))
  assert.equal(pending.nextRunAt, at(31))
  // Recover an abandoned claim after its persistent lease expires.
  const retry = await initializeSync(payload, { ...request, flight_number: 'CA1234' }, forbidden, now)
  const lost = await claimWorkerJob(payload, now)
  assert.equal(lost!.job_id, Number(retry.sync_job_id))
  assert.equal(await claimWorkerJob(payload, now), null)
  const recovered = await claimWorkerJob(payload, new Date(now.getTime() + 121000))
  assert.equal(recovered!.job_id, lost!.job_id)
  assert.notEqual(recovered!.lease_token, lost!.lease_token)
  await assert.rejects(acceptWorkerResult(payload, { job_id: lost!.job_id, lease_token: lost!.lease_token, ok: false }, now), /租约/)
  await acceptWorkerResult(payload, { job_id: recovered!.job_id, lease_token: recovered!.lease_token, ok: false, error_code: 'ambiguous-flight' }, new Date(now.getTime() + 121000))
  await calibrateSync(payload, { record_id: accepted.record_id, flight_number: 'MU9191', gate_arrival_time: new Date(now.getTime() - 3000000).toISOString() }, tomorrow)
  assert.equal(await claimWorkerJob(payload, new Date(at(32))), null)
  const faRequest = { ...request, flight_number: 'MF101' }
  await initializeSync(payload, faRequest, forbidden, now)
  const faJob = await claimWorkerJob(payload, now)
  const faResult = await acceptWorkerResult(payload, { job_id: faJob!.job_id, lease_token: faJob!.lease_token, ok: true, facts: { ...facts, flightNumber: 'MF101', provider: 'flightaware', actualDepartureUTC: at(-4), actualArrivalUTC: at(-0.5) } }, now)
  assert.equal(faResult.status, 'Archived')
  const faFlight = await payload.findByID({ collection: 'flights', id: faResult.record_id!, context: { internalFlightDates: true } })
  assert.equal(faFlight.actualDepartureUTC, at(-4))
  assert.equal(faFlight.actualArrivalUTC, at(-0.5))
  await payload.destroy()
  const reopened = execFileSync(process.execPath, ['--import', 'tsx', 'tests/flight-worker-reopen.ts'], { encoding: 'utf8', env: { ...process.env, REPLAY_BODY: check, REPLAY_HEADERS: JSON.stringify(headers) } })
  assert.ok(reopened.includes('WORKER_REPLAY_REOPEN_OK'))
  console.log('PASS: remote queue, Ed25519/tamper/expiry, persistent replay rejection after restart, concurrent claims, bounded body, validated private records, stale results, retry and calibration.')
} finally { await payload.destroy() }

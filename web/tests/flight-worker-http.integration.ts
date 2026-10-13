import assert from 'node:assert/strict'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:https'
import { initializeSync } from '../src/lib/flights/sync-service'
import { workerEndpoint } from '../src/lib/flights/sync-worker'
const run = promisify(execFile)
const dir = await mkdtemp(join(tmpdir(), 'flight-home-http-'))
const pair = generateKeyPairSync('ed25519')
await writeFile(join(dir, 'private.pem'), pair.privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 })
await writeFile(join(dir, 'public.pem'), pair.publicKey.export({ format: 'pem', type: 'spki' }))
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'tls-key.pem'), '-out', join(dir, 'tls-cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' })
Object.assign(process.env, { PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: 'file:' + join(dir, 'test.db'), MEDIA_DIR: join(dir, 'media'), NODE_ENV: 'production', MERAK_AUTO_MIGRATE: '1', FLIGHT_SYNC_ENABLED: '1', FLIGHT_SYNC_MODE: 'remote', FLIGHT_SYNC_VISIBILITY: 'private', FLIGHT_WORKER_PUBLIC_KEY_FILE: join(dir, 'public.pem') })
const { getPayload, createLocalReq } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
let bark = 0
const server = createServer({ key: await readFile(join(dir, 'tls-key.pem')), cert: await readFile(join(dir, 'tls-cert.pem')) }, async (incoming, outgoing) => {
  try {
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString()
    if (incoming.url === '/push') {
      const body = JSON.parse(raw)
      assert.equal(body.device_key, 'test-bark-key')
      assert.equal(body.title, 'FLIGHT_CALIBRATE_NOW')
      assert.equal(body.sound, 'none')
      bark++
      outgoing.writeHead(200, { 'Content-Type': 'application/json' }); outgoing.end('{"code":200}'); return
    }
    const http = new Request('https://merakt.cn/api/flight/worker', { method: 'POST', body: raw, headers: incoming.headers as Record<string, string> })
    const req = await createLocalReq({}, payload)
    Object.assign(req, { headers: http.headers, body: http.body })
    const response = await workerEndpoint(req)
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    outgoing.end(await response.text())
  } catch { outgoing.writeHead(500); outgoing.end('{}') }
})
try {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address() as { port: number }
  const url = 'https://127.0.0.1:' + address.port
  const seconds = Math.floor(Date.now() / 1000)
  const row = { identification: { number: { default: 'MU9191' } }, status: { text: 'Landed' }, airport: { origin: { code: { iata: 'SHA' } }, destination: { code: { iata: 'PKX' } } }, time: { real: { departure: seconds - 7200, arrival: seconds - 3600 }, scheduled: { departure: seconds - 7500 } }, aircraft: { registration: 'B-TEST', model: { code: 'C919', text: 'Synthetic C919' } } }
  const fake = join(dir, 'fixture-python')
  await writeFile(fake, '#!/usr/bin/env python3\nprint(' + JSON.stringify(JSON.stringify({ httpStatus: 200, data: { result: { response: { data: [row] } } } })) + ')\n', { mode: 0o700 })
  await writeFile(join(dir, 'bark-key'), 'test-bark-key')
  const env = { ...process.env, NODE_EXTRA_CA_CERTS: join(dir, 'tls-cert.pem'), FLIGHT_CLOUD_URL: url, FLIGHT_WORKER_PRIVATE_KEY_FILE: join(dir, 'private.pem'), BARK_KEY_FILE: join(dir, 'bark-key'), BARK_SERVER_URL: url, FR24_PYTHON: fake }
  const check = await run(process.execPath, ['.data/flight-logger-home/worker.mjs', '--check'], { env })
  assert.ok(check.stdout.includes('ready'))
  const job = await initializeSync(payload, { flight_number: 'MU9191' })
  await run(process.execPath, ['.data/flight-logger-home/worker.mjs', '--once'], { env })
  const pending = await payload.findByID({ collection: 'flight-sync-jobs', id: Number(job.sync_job_id), depth: 0 })
  assert.equal(pending.phase, 'Pending_Gate_Calibration')
  const flight = await payload.findByID({ collection: 'flights', id: pending.flight as number, context: { internalFlightDates: true } })
  assert.equal(flight.aircraftCode, 'C919'); assert.equal(flight.visibility, 'private')
  await payload.update({ collection: 'flight-sync-jobs', id: pending.id, data: { nextRunAt: new Date().toISOString() } })
  await run(process.execPath, ['.data/flight-logger-home/worker.mjs', '--once'], { env })
  assert.equal(bark, 1)
  const after = await payload.findByID({ collection: 'flight-sync-jobs', id: pending.id })
  assert.equal(after.calibrationAttempts, 1)
  assert.equal(after.leaseToken, null)
  console.log('PASS: packaged home worker over HTTPS, public-key authentication, shared radar parser, result upload, private persistence and local-only Bark delivery.')
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()))
  await payload.destroy()
}

// Disposable DB, synthetic MCP replies, no real provider calls or credentials.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const directory = await mkdtemp(join(tmpdir(), 'merak-paid-query-'))
Object.assign(process.env, { PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: 'file:' + join(directory, 'test.db'), MEDIA_DIR: join(directory, 'media'), MERAK_AUTO_MIGRATE: '1', NODE_ENV: 'production',
  FLIGHT_SYNC_ENABLED: '1', FLIGHT_SYNC_MODE: 'remote', VARIFLIGHT_ENABLED: '1', VARIFLIGHT_DAILY_QUERY_LIMIT: '4', VARIFLIGHT_MONTHLY_QUERY_LIMIT: '20', VARIFLIGHT_API_KEY: 'synthetic-key-never-sent', VARIFLIGHT_PYTHON: 'python3', VARIFLIGHT_CACHE_DB: join(directory, 'cache.db') })
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { quoteProviderQuery: quote, confirmProviderQuery: confirm, claimProviderQuery: claim, acceptProviderQuery: accept, getProviderQuery: status } = await import('../src/lib/flights/provider-queries')
const { providerQueryEndpoint } = await import('../src/lib/flights/provider-query-endpoint')
const { providerHelper, processProviderQuery } = await import('../scripts/flight-provider-worker')
const payload = await getPayload({ config })
const now = new Date('2026-10-20T00:00:00Z')
const request = { flight_number: 'QA101', date: '2026-10-11' }
try {
  const user = await payload.create({ collection: 'users', data: { email: 'paid-query@example.invalid', password: 'Local-QA-paid-2026!', name: '付费查询隔离测试' } })
  const count = async () => (await payload.count({ collection: 'flight-provider-queries', overrideAccess: true })).totalDocs
  const firstOffer = await quote(payload, request, user.id, now)
  const secondOffer = await quote(payload, request, user.id, now)
  assert.equal(await count(), 0, 'Quote/cancel must not reserve a charge')
  assert.equal(firstOffer.costFen, 50)
  await assert.rejects(confirm(payload, firstOffer.token + 'x', user.id, now))
  await assert.rejects(confirm(payload, firstOffer.token, user.id + 1, now))
  await assert.rejects(confirm(payload, firstOffer.token, user.id, new Date(now.getTime() + 6 * 60000)))
  const [a, b] = await Promise.all([confirm(payload, firstOffer.token, user.id, now), confirm(payload, secondOffer.token, user.id, now)])
  assert.equal(a!.id, b!.id)
  assert.equal(await count(), 1)
  assert.equal((await confirm(payload, firstOffer.token, user.id, now))!.id, a!.id)
  assert.equal((await quote(payload, { ...request, refresh: true }, user.id, now)).costFen, 0, 'No second query while one is pending')
  process.env.VARIFLIGHT_DAILY_QUERY_LIMIT = '1'
  const blocked = await quote(payload, { ...request, flight_number: 'QA102' }, user.id, now)
  await assert.rejects(confirm(payload, blocked.token, user.id, now), /上限/)
  process.env.VARIFLIGHT_DAILY_QUERY_LIMIT = '4'
  process.env.VARIFLIGHT_MONTHLY_QUERY_LIMIT = '1'
  await assert.rejects(confirm(payload, blocked.token, user.id, now), /上限/)
  process.env.VARIFLIGHT_MONTHLY_QUERY_LIMIT = '20'
  const [job, duplicateClaim] = await Promise.all([claim(payload, now), claim(payload, now)])
  const held = job || duplicateClaim
  assert.ok(held)
  assert.ok(!job || !duplicateClaim)
  assert.equal((await status(payload, held.id, new Date(now.getTime() + 16 * 60000)))!.status, 'unknown')
  assert.equal(await claim(payload, new Date(now.getTime() + 17 * 60000)), null, 'Unknown/running queries must never be reclaimed')
  const result = { code: 200, data: [{ FlightNo: 'QA101', FlightState: '到达', FlightDepcode: 'HGH', FlightArrcode: 'HND', FlightDeptimePlanDate: '2026-10-11 09:00:00', FlightArrtimePlanDate: '2026-10-11 12:00:00', FlightOutgateTime: '2026-10-11 09:05:00', FlightDeptimeDate: '2026-10-11 09:15:00', FlightArrtimeDate: '2026-10-11 12:10:00', FlightIngateTime: '', org_timezone: '28800', dst_timezone: '32400', AircraftNumber: 'TEST-101', ftype: 'A320' }] }
  await providerHelper({ action: 'pending' })
  const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } })
  execFileSync('python3', ['-c', "import os,sqlite3,time; c=sqlite3.connect(os.environ['VARIFLIGHT_CACHE_DB']); c.execute(\"INSERT INTO calls(id,job,created,status,raw,content_type) VALUES(?,?,?,'response',?,'application/json')\", (int(os.environ['TEST_ID']),os.environ['TEST_JOB'],time.time(),os.environ['TEST_RAW'].encode())); c.commit()"], { env: { ...process.env, TEST_ID: String(held.id), TEST_JOB: JSON.stringify(held), TEST_RAW: raw } })
  let deliveries = 0
  const rpc = async (body: any) => {
    assert.equal(body.action, 'provider-query-result', 'Persisted results must be delivered before claiming another query')
    deliveries++
    if (deliveries === 1) throw new Error('Cloud temporarily offline')
    const response = await accept(payload, body, now)
    if (deliveries === 2) throw new Error('Cloud accepted but acknowledgement was lost')
    return response
  }
  await assert.rejects(processProviderQuery(rpc))
  assert.equal((await providerHelper({ action: 'pending' })).pending.length, 1)
  await assert.rejects(processProviderQuery(rpc))
  assert.equal((await providerHelper({ action: 'pending' })).pending.length, 1)
  await processProviderQuery(rpc)
  assert.equal((await providerHelper({ action: 'pending' })).pending.length, 0)
  assert.equal((await status(payload, held.id, now))!.status, 'completed')
  assert.equal((await quote(payload, request, user.id, now)).costFen, 0)
  const refreshA = await quote(payload, { ...request, refresh: true }, user.id, now)
  const refreshB = await quote(payload, { ...request, refresh: true }, user.id, now)
  assert.equal(refreshA.costFen, 50)
  const refreshed = await Promise.all([confirm(payload, refreshA.token, user.id, now), confirm(payload, refreshB.token, user.id, now)])
  assert.equal(refreshed[0]!.id, refreshed[1]!.id)
  assert.equal(await count(), 2)
  assert.equal((await confirm(payload, refreshA.token, user.id, now))!.id, refreshed[0]!.id)
  const secondJob = await claim(payload, now)
  assert.ok(secondJob)
  await accept(payload, { id: secondJob.id, lease_token: secondJob.lease_token, ok: false, error_code: 'provider-config' }, now)
  const fake = { payload, user: undefined, headers: new Headers() } as any
  assert.equal((await providerQueryEndpoint(fake)).status, 401)
  fake.user = user; fake.headers.set('origin', 'https://untrusted.invalid')
  assert.equal((await providerQueryEndpoint(fake)).status, 403)
  await assert.rejects(payload.create({ collection: 'flight-provider-queries', overrideAccess: false, user: { ...user, collection: 'users' }, data: { key: 'unconfirmed', flightNumber: 'QA999', date: request.date, status: 'queued', costFen: 50, requestedBy: user.id } }))
  await assert.rejects(payload.find({ collection: 'flight-provider-queries', overrideAccess: false }))
  const expiringOffer = await quote(payload, { ...request, flight_number: 'QA103' }, user.id, now)
  const expiringQuery = await confirm(payload, expiringOffer.token, user.id, now)
  const expired = await status(payload, expiringQuery!.id, new Date(now.getTime() + 16 * 60000))
  assert.equal(expired!.errorCode, 'provider-expired')
  assert.equal(expired!.costFen, 0)
  assert.equal(await claim(payload, new Date(now.getTime() + 17 * 60000)), null)
  const flight = await payload.create({ collection: 'flights', data: { date: request.date!, flightNumber: request.flight_number, from: 'HGH', to: 'HND', state: 'unconfirmed', visibility: 'private', _status: 'published' } })
  const fixture = { directory, secret: process.env.PAYLOAD_SECRET, userId: user.id, flightId: flight.id }
  await writeFile(join(directory, 'fixture.json'), JSON.stringify(fixture), { mode: 0o600 })
  await writeFile('.data/provider-query-qa.json', JSON.stringify(fixture), { mode: 0o600 })
  console.log('PASS: no-charge quotes, signed confirmations, double-tab deduplication, actor/expiry checks, daily/monthly limits, no reclaim, durable outbox after cloud outage/lost acknowledgement, free cache, explicitly confirmed refresh, admin/CSRF/access checks. Real provider calls: 0.')
} finally { await payload.destroy() }

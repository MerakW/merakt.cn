import { createPublicKey, verify, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { sql, type SQLiteAdapter } from '@payloadcms/db-sqlite'
import type { Payload, PayloadRequest } from 'payload'
import { Temporal } from '@js-temporal/polyfill'
import { acquire, release, processSyncJob } from './sync-service'
import { signingMessage } from './worker-protocol'
import { FlightSyncError, normalizeSyncRequest, type FlightFacts, type SyncRequest } from './sync-provider'
import { validateActualTimes } from './time'

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
const invalid = () => new FlightSyncError('invalid-result', '家庭端结果不符合航段数据规范。', false)

/** Revalidate signed facts: a trusted worker still cannot write arbitrary database fields. */
export function validateWorkerFacts(input: unknown, request: SyncRequest, now = new Date()): FlightFacts {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid()
  const f = input as Record<string, unknown>
  const normalized = normalizeSyncRequest({ flight_number: f.flightNumber, date: f.date, origin: f.from, destination: f.to })
  if (!normalized.date || !normalized.origin || !normalized.destination || !['fr24', 'flightaware'].includes(String(f.provider)) || normalized.flight_number !== request.flight_number ||
      (request.date && normalized.date !== request.date) || (request.origin && normalized.origin !== request.origin) || (request.destination && normalized.destination !== request.destination)) throw invalid()
  const result: FlightFacts = { provider: f.provider as FlightFacts['provider'], flightNumber: normalized.flight_number, date: normalized.date, from: normalized.origin, to: normalized.destination, touchdownUTC: '' }
  for (const field of ['takeoffUTC', 'touchdownUTC', 'actualDepartureUTC', 'actualArrivalUTC'] as const) {
    if (f[field] == null && field !== 'touchdownUTC') continue
    try {
      if (typeof f[field] !== 'string') throw invalid()
      const instant = Temporal.Instant.from(f[field])
      if (instant.epochMilliseconds > now.getTime() || instant.epochMilliseconds < 0) throw invalid()
      result[field] = instant.toString()
    } catch { throw invalid() }
  }
  if ((!request.date && now.getTime() - Date.parse(result.touchdownUTC) > 48 * 3600000) || (result.takeoffUTC && Date.parse(result.takeoffUTC) >= Date.parse(result.touchdownUTC))) throw invalid()
  for (const field of ['departureLocal', 'arrivalLocal'] as const) if (f[field] != null) {
    if (typeof f[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(f[field])) throw invalid()
    try { Temporal.PlainDateTime.from(f[field], { overflow: 'reject' }) } catch { throw invalid() }
    result[field] = f[field]
  }
  if (result.departureLocal && result.departureLocal.slice(0, 10) !== result.date) throw invalid()
  for (const field of ['providerId', 'registration', 'aircraft', 'aircraftCode'] as const) if (f[field] != null) {
    if (typeof f[field] !== 'string' || !f[field].trim() || f[field].length > 160) throw invalid()
    result[field] = f[field].trim()
  }
  validateActualTimes(result)
  return result
}

export async function claimWorkerJob(payload: Payload, now = new Date()) {
  const due = await payload.find({ collection: 'flight-sync-jobs', depth: 0, overrideAccess: true, limit: 10, sort: 'nextRunAt', where: { and: [
    { phase: { in: ['Awaiting_Radar', 'Pending_Gate_Calibration'] } }, { nextRunAt: { less_than_equal: now.toISOString() } },
    { or: [{ leaseUntil: { exists: false } }, { leaseUntil: { less_than_equal: now.toISOString() } }] },
  ] } })
  for (const job of due.docs) {
    const token = await acquire(payload, job.id, now, true)
    if (!token) continue
    try {
      const recordId = typeof job.flight === 'object' && job.flight ? job.flight.id : job.flight
      if (job.phase === 'Pending_Gate_Calibration') {
        const flight = recordId == null ? null : await payload.findByID({ collection: 'flights', id: recordId, depth: 0, draft: true, overrideAccess: true, context: { internalFlightDates: true } })
        if (!flight || flight.actualArrivalUTC || flight._status === 'draft' || flight.state === 'cancelled' || (job.calibrationAttempts || 0) >= 14 || now.getTime() - Date.parse(job.createdAt) > 7 * 86400000) {
          await processSyncJob(payload, job.id, { lookup: async () => { throw invalid() }, push: async () => {} }, now, false, token)
          continue
        }
      }
      return { job_id: job.id, lease_token: token, phase: job.phase, request: job.request, flight_number: job.flightNumber, record_id: recordId == null ? null : String(recordId) }
    } catch (error) { await release(payload, job.id, token); throw error }
  }
  return null
}

export async function acceptWorkerResult(payload: Payload, body: Record<string, unknown>, now = new Date()) {
  if (!Number.isSafeInteger(body.job_id) || Number(body.job_id) <= 0 || typeof body.lease_token !== 'string') throw invalid()
  const job = await payload.findByID({ collection: 'flight-sync-jobs', id: Number(body.job_id), depth: 0, overrideAccess: true })
  if (!job.leaseToken || job.leaseToken !== body.lease_token || !job.leaseUntil || Date.parse(job.leaseUntil) <= now.getTime()) throw new FlightSyncError('stale-lease', '任务租约已结束，请重新领取。', false)
  if (body.ok !== true && body.ok !== false) throw invalid()
  let facts: FlightFacts | undefined
  if (body.ok && job.phase === 'Awaiting_Radar') facts = validateWorkerFacts(body.facts, job.request as SyncRequest, now)
  const fail = () => {
    // Only codes cross this boundary; never persist exception text containing URLs or keys.
    const code = typeof body.error_code === 'string' && /^(provider-[a-z-]+|provider-http-\d{3}|no-landed-flight|ambiguous-flight|missing-curl-cffi|bark-not-configured|bark-unavailable)$/.test(body.error_code) ? body.error_code : 'provider-unavailable'
    throw new FlightSyncError(code, '家庭端处理未完成，等待重试。', !['ambiguous-flight', 'provider-config', 'provider-auth'].includes(code))
  }
  const resultToken = randomUUID()
  const claimed = await (payload.db as unknown as SQLiteAdapter).drizzle.run(sql`UPDATE flight_sync_jobs SET lease_token = ${resultToken} WHERE id = ${job.id} AND lease_token = ${job.leaseToken} AND lease_until > ${now.toISOString()} RETURNING id;`)
  if (!claimed.rows.length) throw new FlightSyncError('stale-lease', '任务结果已被接收，请重新领取。', false)
  const updated = await processSyncJob(payload, job.id, {
    lookup: async () => { if (!body.ok) fail(); return facts! },
    push: async () => { if (!body.ok) fail() },
  }, now, false, resultToken)
  return { job_id: updated.id, status: updated.phase, record_id: typeof updated.flight === 'object' && updated.flight ? String(updated.flight.id) : updated.flight == null ? null : String(updated.flight) }
}

export async function workerEndpoint(req: PayloadRequest): Promise<Response> {
  if (process.env.FLIGHT_SYNC_ENABLED !== '1' || process.env.FLIGHT_SYNC_MODE !== 'remote' || !process.env.FLIGHT_WORKER_PUBLIC_KEY_FILE) return json({ error: '家庭执行模式尚未配置。' }, 503)
  try {
    const timestamp = req.headers.get('x-flight-timestamp') || '', nonce = req.headers.get('x-flight-nonce') || '', signature = req.headers.get('x-flight-signature') || ''
    const now = new Date()
    if (!/^\d{13}$/.test(timestamp) || Math.abs(now.getTime() - Number(timestamp)) > 300000 || !/^[0-9a-f-]{36}$/i.test(nonce) || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return json({ error: '签名无效或过期。' }, 401)
    if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: '请提交 JSON。' }, 415)
    const reader = req.body?.getReader()
    if (!reader) return json({ error: '缺少请求。' }, 400)
    const chunks: Uint8Array[] = []; let bytes = 0
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      bytes += value.byteLength
      if (bytes > 8192) { await reader.cancel(); return json({ error: '请求超过 8 KB。' }, 413) }
      chunks.push(value)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    const key = createPublicKey(await readFile(process.env.FLIGHT_WORKER_PUBLIC_KEY_FILE))
    if (key.asymmetricKeyType !== 'ed25519' || !verify(null, Buffer.from(signingMessage(raw, timestamp, nonce)), key, Buffer.from(signature, 'base64'))) return json({ error: '签名无效。' }, 401)
    const db = req.payload.db as unknown as SQLiteAdapter
    await db.drizzle.run(sql`DELETE FROM flight_worker_replays WHERE expires_at < ${now.toISOString()};`)
    const inserted = await db.drizzle.run(sql`INSERT INTO flight_worker_replays (nonce, expires_at) VALUES (${nonce}, ${new Date(Number(timestamp) + 300001).toISOString()}) ON CONFLICT (nonce) DO NOTHING RETURNING id;`)
    if (!inserted.rows.length) return json({ error: '请求已处理，请使用新签名。' }, 409)
    let body: Record<string, unknown>
    try { body = JSON.parse(raw); if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid() } catch { return json({ error: 'JSON 无效。' }, 400) }
    if (body.action === 'check') return json({ mode: 'remote', status: 'ready' })
    if (body.action === 'claim') return json({ job: await claimWorkerJob(req.payload, now) })
    if (body.action === 'result') return json(await acceptWorkerResult(req.payload, body, now))
    return json({ error: '未知操作。' }, 400)
  } catch (error) {
    if (error instanceof FlightSyncError) return json({ error: error.message, code: error.code }, error.code === 'stale-lease' ? 409 : 400)
    return json({ error: '家庭端同步暂不可用。' }, 503)
  }
}

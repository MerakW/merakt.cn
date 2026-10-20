import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { sql, type SQLiteAdapter } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'
import { Temporal } from '@js-temporal/polyfill'
import { FlightSyncError, normalizeSyncRequest, type SyncRequest } from './sync-provider'
import { validateProviderFlights } from './variflight'

export const queryCostFen = 50
const table = 'flight-provider-queries' as const
const db = (payload: Payload) => (payload.db as unknown as SQLiteAdapter).drizzle
function fail(code: string, message: string): never { throw new FlightSyncError(code, message, false) }
const configuredLimit = (value: string | undefined, fallback: number) => {
  if (value == null || value === '') return fallback
  if (!/^\d+$/.test(value) || Number(value) > 10000) return fail('provider-config', '付费额度配置无效。')
  return Number(value)
}
export function queryLimits() {
  return { day: configuredLimit(process.env.VARIFLIGHT_DAILY_QUERY_LIMIT, 4), month: configuredLimit(process.env.VARIFLIGHT_MONTHLY_QUERY_LIMIT, 20) }
}
function enabled() {
  if (process.env.VARIFLIGHT_ENABLED !== '1' || process.env.FLIGHT_SYNC_MODE !== 'remote' || process.env.FLIGHT_SYNC_ENABLED !== '1') fail('provider-disabled', '付费查询尚未启用；请先配置云端额度和家庭端 API Key。')
}
const periods = (now: Date) => {
  const local = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO('Asia/Shanghai')
  return { day: new Date(local.startOfDay().epochMilliseconds).toISOString(), month: new Date(local.with({ day: 1 }).startOfDay().epochMilliseconds).toISOString() }
}
const sign = (body: string, payload: Payload) => createHmac('sha256', payload.config.secret).update(body).digest('hex')
const findLatest = async (payload: Payload, request: SyncRequest, completed = false) => (await payload.find({ collection: table, overrideAccess: true, depth: 0, sort: '-id', limit: 1,
  where: { and: [{ flightNumber: { equals: request.flight_number } }, { date: { equals: request.date } }, ...(completed ? [{ status: { equals: 'completed' } }] : [])] } })).docs[0]
export function querySummary(row: Awaited<ReturnType<typeof findLatest>> | undefined) {
  if (!row) return null
  return { id: row.id, flightNumber: row.flightNumber, date: row.date, status: row.status, costFen: row.costFen, flights: row.status === 'completed' ? row.flights : undefined, errorCode: row.errorCode || null, createdAt: row.createdAt }
}
async function expireRunning(payload: Payload, now: Date) {
  await db(payload).run(sql`UPDATE flight_provider_queries SET status = 'failed', error_code = 'provider-expired', cost_fen = 0
    WHERE status = 'queued' AND created_at < ${new Date(now.getTime() - 15 * 60000).toISOString()};`)
  await db(payload).run(sql`UPDATE flight_provider_queries SET status = 'unknown', error_code = 'provider-unknown' WHERE status = 'running' AND started_at < ${new Date(now.getTime() - 15 * 60000).toISOString()};`)
}
export async function quoteProviderQuery(payload: Payload, input: unknown, actor: number, now = new Date()) {
  enabled()
  const request = normalizeSyncRequest(input)
  if (!request.date) fail('invalid-date', '付费查询必须明确填写出发日期。')
  await expireRunning(payload, now)
  const refresh = (input as Record<string, unknown>).refresh === true
  const latest = await findLatest(payload, request)
  const cached = !refresh ? await findLatest(payload, request, true) : undefined
  const reuse = latest && ['queued', 'running'].includes(latest.status) ? latest : cached || (!refresh && latest?.errorCode !== 'provider-expired' ? latest : undefined)
  const offer = { request: { flight_number: request.flight_number, date: request.date }, actor, refresh, base: latest?.id || 0, reuse: reuse?.id || 0,
    costFen: reuse ? 0 : queryCostFen, expires: now.getTime() + 5 * 60000, nonce: randomUUID() }
  const encoded = Buffer.from(JSON.stringify(offer)).toString('base64url')
  return { token: encoded + '.' + sign(encoded, payload), request: offer.request, costFen: offer.costFen, existing: querySummary(reuse), limits: queryLimits() }
}
export async function confirmProviderQuery(payload: Payload, token: unknown, actor: number, now = new Date()) {
  enabled()
  if (typeof token !== 'string' || token.length > 2000) fail('invalid-confirmation', '请重新核对航班信息。')
  const [encoded, signature, extra] = token.split('.')
  const expected = sign(encoded || '', payload)
  if (extra || !signature || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) fail('invalid-confirmation', '确认信息无效，请重新预览。')
  let offer: { request: SyncRequest; actor: number; refresh: boolean; base: number; reuse: number; costFen: number; expires: number }
  try { offer = JSON.parse(Buffer.from(encoded, 'base64url').toString()) } catch { return fail('invalid-confirmation', '确认信息无效。') }
  if (offer.actor !== actor || offer.expires < now.getTime()) fail('confirmation-expired', '确认已过期，请重新核对后提交。')
  const request = normalizeSyncRequest(offer.request)
  if (!request.date || ![0, queryCostFen].includes(offer.costFen)) fail('invalid-confirmation', '确认信息不完整。')
  await expireRunning(payload, now)
  if (offer.reuse) return querySummary(await payload.findByID({ collection: table, id: offer.reuse, overrideAccess: true }))
  const key = createHash('sha256').update(token).digest('hex')
  const prior = (await payload.find({ collection: table, overrideAccess: true, limit: 1, where: { key: { equals: key } } })).docs[0]
  if (prior) return querySummary(prior)
  const limits = queryLimits(), start = periods(now), stamp = now.toISOString()
  // The single SQLite write serializes budget reservation and stale/double-confirm checks.
  const inserted = await db(payload).run(sql`INSERT INTO flight_provider_queries (key, flight_number, date, status, cost_fen, requested_by, created_at, updated_at)
    SELECT ${key}, ${request.flight_number}, ${request.date}, 'queued', ${queryCostFen}, ${actor}, ${stamp}, ${stamp}
    WHERE COALESCE((SELECT MAX(id) FROM flight_provider_queries WHERE flight_number = ${request.flight_number} AND date = ${request.date}), 0) = ${offer.base}
    AND (SELECT COUNT(*) FROM flight_provider_queries WHERE cost_fen > 0 AND created_at >= ${start.day}) < ${limits.day}
    AND (SELECT COUNT(*) FROM flight_provider_queries WHERE cost_fen > 0 AND created_at >= ${start.month}) < ${limits.month}
    AND NOT EXISTS (SELECT 1 FROM flight_provider_queries WHERE flight_number = ${request.flight_number} AND date = ${request.date} AND status IN ('queued','running'))
    ON CONFLICT (key) DO NOTHING RETURNING id;`)
  if (inserted.rows.length) return querySummary(await payload.findByID({ collection: table, id: Number(inserted.rows[0].id), overrideAccess: true }))
  const latest = await findLatest(payload, request)
  if (latest && latest.id !== offer.base) return querySummary(latest)
  fail('provider-budget', '已达到每日或每月付费查询上限，本次未发起请求。')
}
export async function getProviderQuery(payload: Payload, id: unknown, now = new Date()) {
  if (!Number.isSafeInteger(id) || Number(id) <= 0) fail('invalid-request', '查询编号无效。')
  await expireRunning(payload, now)
  return querySummary(await payload.findByID({ collection: table, id: Number(id), overrideAccess: true }))
}
export async function claimProviderQuery(payload: Payload, now = new Date()) {
  if (process.env.VARIFLIGHT_ENABLED !== '1') return null
  await expireRunning(payload, now)
  const token = randomUUID(), stamp = now.toISOString()
  const claimed = await db(payload).run(sql`UPDATE flight_provider_queries SET status = 'running', lease_token = ${token}, started_at = ${stamp}, updated_at = ${stamp}
    WHERE id = (SELECT id FROM flight_provider_queries WHERE status = 'queued' ORDER BY id LIMIT 1) AND status = 'queued' RETURNING id;`)
  if (!claimed.rows.length) return null
  const row = await payload.findByID({ collection: table, id: Number(claimed.rows[0].id), overrideAccess: true })
  return { id: row.id, lease_token: token, request: { flight_number: row.flightNumber, date: row.date } }
}
export async function acceptProviderQuery(payload: Payload, body: Record<string, unknown>, now = new Date()) {
  if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0 || typeof body.lease_token !== 'string' || typeof body.ok !== 'boolean') fail('invalid-result', '查询结果无效。')
  const row = await payload.findByID({ collection: table, id: Number(body.id), overrideAccess: true })
  if (row.leaseToken !== body.lease_token) fail('invalid-result', '查询租约不匹配。')
  if (row.status === 'completed' || row.status === 'failed') return { status: row.status }
  if (!['running', 'unknown'].includes(row.status)) fail('invalid-result', '查询尚未领取。')
  const flights = body.ok ? validateProviderFlights(body.flights, { flight_number: row.flightNumber, date: row.date }, now) : null
  const errorCode = ['provider-unknown', 'provider-response', 'provider-schema', 'provider-budget', 'provider-config'].includes(String(body.error_code)) ? String(body.error_code) : 'provider-unknown'
  const status = body.ok ? 'completed' : errorCode === 'provider-unknown' ? 'unknown' : 'failed'
  await db(payload).run(sql`UPDATE flight_provider_queries SET status = ${status}, flights = ${flights ? JSON.stringify(flights) : null}, error_code = ${body.ok ? null : errorCode}, updated_at = ${now.toISOString()}
    WHERE id = ${row.id} AND lease_token = ${body.lease_token} AND status IN ('running','unknown');`)
  return { status }
}

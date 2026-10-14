import { createHash, randomUUID } from 'node:crypto'
import { Temporal } from '@js-temporal/polyfill'
import { sql, type SQLiteAdapter } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload, type PayloadRequest, type Where } from 'payload'
import type { Flight, FlightSyncJob } from '@/payload-types'
import { flightIdentity } from './airlines'
import { validateActualTimes } from './time'
import { FlightSyncError, syncServices, type FlightFacts, type SyncRequest, type SyncServices } from './sync-provider'

const HOUR = 3600000
const after = (now: Date, delay: number) => new Date(now.getTime() + delay).toISOString()
const flightID = (job: FlightSyncJob) => typeof job.flight === 'object' && job.flight ? job.flight.id : job.flight
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const active: Where = { phase: { in: ['Awaiting_Radar', 'Pending_Gate_Calibration'] } }

function summary(job: FlightSyncJob) {
  return { sync_job_id: String(job.id), record_id: flightID(job) != null ? String(flightID(job)) : null, flight_number: job.flightNumber, status: job.phase, calibrationRunAt: job.calibrationRunAt, nextRunAt: job.nextRunAt, message: job.lastError || null }
}

/** Atomic database lease, shared by web requests and every server process. */
export async function acquire(payload: Payload, id: number, now: Date, dueOnly: boolean): Promise<string | null> {
  const token = randomUUID()
  const db = payload.db as unknown as SQLiteAdapter
  const condition = dueOnly ? sql`AND phase IN ('Awaiting_Radar', 'Pending_Gate_Calibration') AND next_run_at <= ${now.toISOString()}` : sql``
  const result = await db.drizzle.run(sql`UPDATE flight_sync_jobs SET lease_token = ${token}, lease_until = ${after(now, 2 * HOUR / 60)} WHERE id = ${id} AND (lease_until IS NULL OR lease_until <= ${now.toISOString()}) ${condition} RETURNING id;`)
  return result.rows.length ? token : null
}

export async function release(payload: Payload, id: number, token: string) {
  await (payload.db as unknown as SQLiteAdapter).drizzle.run(sql`UPDATE flight_sync_jobs SET lease_token = NULL, lease_until = NULL WHERE id = ${id} AND lease_token = ${token};`)
}

async function transaction<T>(payload: Payload, run: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const id = await payload.db.beginTransaction()
  if (id == null) throw new Error('Transactions unavailable')
  const req = await createLocalReq({ context: { internalFlightDates: true } }, payload)
  req.transactionID = id
  try { const result = await run(req); await payload.db.commitTransaction(id); return result }
  catch (error) { await payload.db.rollbackTransaction(id); throw error }
}

async function applyFacts(payload: Payload, job: FlightSyncJob, facts: FlightFacts, now: Date) {
  return transaction(payload, async req => {
    const request = job.request as SyncRequest
    let flight: Flight | undefined
    if (request.record_id) {
      flight = await payload.findByID({ collection: 'flights', id: request.record_id, depth: 0, draft: true, overrideAccess: true, req })
      if (flight.date !== facts.date || flight.from !== facts.from || flight.to !== facts.to || flightIdentity(flight).label !== facts.flightNumber) throw new FlightSyncError('record-mismatch', '指定记录与抓取的航段不匹配，需要核对。', false)
    } else {
      const candidates = await payload.find({ collection: 'flights', depth: 0, pagination: false, draft: true, overrideAccess: true, req,
        where: { and: [{ date: { equals: facts.date } }, { from: { equals: facts.from } }, { to: { equals: facts.to } }] } })
      let matches = candidates.docs.filter(f => flightIdentity(f).label === facts.flightNumber)
      if (matches.length > 1) matches = matches.filter(f => Boolean(facts.takeoffUTC && f.takeoffUTC === facts.takeoffUTC) || Boolean(facts.departureLocal && f.departureLocal?.slice(0, 16) === facts.departureLocal.slice(0, 16)))
      if (matches.length > 1 || (candidates.docs.filter(f => flightIdentity(f).label === facts.flightNumber).length > 1 && !matches.length)) throw new FlightSyncError('record-ambiguous', '网站中有多个可能的航段，请提供 record_id。', false)
      flight = matches[0]
    }
    if (flight && (flight._status === 'draft' || flight.state === 'cancelled')) throw new FlightSyncError('record-needs-review', '对应记录包含草稿或已取消，不自动覆盖。', false)
    if (flight?.takeoffUTC && facts.takeoffUTC && Math.abs(Date.parse(flight.takeoffUTC) - Date.parse(facts.takeoffUTC)) > 5 * 60000) throw new FlightSyncError('record-mismatch', '已有起飞时间与雷达差异过大，可能是同日的另一航段。', false)
    const recorded = {
      actualDepartureUTC: flight?.actualDepartureUTC || facts.actualDepartureUTC,
      takeoffUTC: flight?.takeoffUTC || facts.takeoffUTC,
      touchdownUTC: flight?.touchdownUTC || facts.touchdownUTC,
      actualArrivalUTC: flight?.actualArrivalUTC || facts.actualArrivalUTC,
    }
    try { validateActualTimes(recorded) } catch { throw new FlightSyncError('radar-conflict', '雷达时间与现有记录冲突，保留原记录等待核对。', false) }
    if (flight) {
      flight = await payload.update({ collection: 'flights', id: flight.id, depth: 0, overrideAccess: true, req, data: {
        takeoffUTC: recorded.takeoffUTC, touchdownUTC: recorded.touchdownUTC, actualDepartureUTC: recorded.actualDepartureUTC, actualArrivalUTC: recorded.actualArrivalUTC,
        registration: flight.registration || facts.registration, aircraft: flight.aircraft || facts.aircraft, aircraftCode: flight.aircraftCode || facts.aircraftCode, state: 'completed',
      } })
    } else {
      flight = await payload.create({ collection: 'flights', depth: 0, overrideAccess: true, req, data: {
        importKey: `flight-sync:${digest([facts.flightNumber, facts.from, facts.to, facts.takeoffUTC || facts.departureLocal || facts.providerId || facts.touchdownUTC].join('|'))}`,
        date: facts.date, from: facts.from, to: facts.to, flightNumber: facts.flightNumber,
        state: 'completed', visibility: process.env.FLIGHT_SYNC_VISIBILITY === 'public' ? 'public' : 'private', _status: 'published',
        departureLocal: facts.departureLocal, arrivalLocal: facts.arrivalLocal,
        takeoffUTC: facts.takeoffUTC, touchdownUTC: facts.touchdownUTC, actualDepartureUTC: facts.actualDepartureUTC, actualArrivalUTC: facts.actualArrivalUTC, registration: facts.registration, aircraft: facts.aircraft, aircraftCode: facts.aircraftCode,
      } })
    }
    const archived = Boolean(flight.actualArrivalUTC)
    return payload.update({ collection: 'flight-sync-jobs', id: job.id, depth: 0, overrideAccess: true, req, data: {
      flight: flight.id, phase: archived ? 'Archived' : 'Pending_Gate_Calibration', attempts: (job.attempts || 0) + 1,
      nextRunAt: archived ? null : new Date(Math.max(now.getTime(), Date.parse(job.calibrationRunAt!))).toISOString(),
      lastError: null, evidence: { radar: { provider: facts.provider, providerId: facts.providerId || null, aircraftCode: facts.aircraftCode || null, capturedAt: now.toISOString() } },
    } })
  })
}

export async function processSyncJob(payload: Payload, id: number, services: SyncServices = syncServices, now = new Date(), force = false, heldToken?: string) {
  const token = heldToken || await acquire(payload, id, now, !force)
  if (!token) return payload.findByID({ collection: 'flight-sync-jobs', id, depth: 0, overrideAccess: true })
  let job: FlightSyncJob | undefined
  try {
    job = await payload.findByID({ collection: 'flight-sync-jobs', id, depth: 0, overrideAccess: true })
    if (job.phase === 'Awaiting_Radar') return await applyFacts(payload, job, await services.lookup(job.request as SyncRequest), now)
    if (job.phase !== 'Pending_Gate_Calibration') return job
    const recordId = flightID(job)
    if (recordId == null) throw new FlightSyncError('missing-record', '校准任务未关联航段，需要核对。', false)
    const flight = await payload.findByID({ collection: 'flights', id: recordId, depth: 0, draft: true, overrideAccess: true, context: { internalFlightDates: true } })
    if (flight._status === 'draft' || flight.state === 'cancelled') throw new FlightSyncError('record-needs-review', '记录已有草稿或已取消，需要核对。', false)
    if (flight.actualArrivalUTC) return await payload.update({ collection: 'flight-sync-jobs', id, overrideAccess: true, data: { phase: 'Archived', nextRunAt: null, lastError: null } })
    if ((job.calibrationAttempts || 0) >= 14 || now.getTime() - Date.parse(job.createdAt) > 7 * 24 * HOUR) throw new FlightSyncError('calibration-expired', '七天内仍未收到有效校准，请核对。', false)
    await services.push(job.flightNumber, String(recordId))
    return await payload.update({ collection: 'flight-sync-jobs', id, depth: 0, overrideAccess: true, data: {
      calibrationAttempts: (job.calibrationAttempts || 0) + 1, nextRunAt: after(now, 6 * HOUR), lastError: '校准通知已发送，等待日历回填。',
    } })
  } catch (error) {
    if (!job) throw error
    const failure = error instanceof FlightSyncError ? error : new FlightSyncError('storage-error', '同步暂未完成，已有航段保持原状，稍后重试。')
    const radar = job.phase === 'Awaiting_Radar'
    const attempts = (radar ? job.attempts || 0 : job.calibrationAttempts || 0) + 1
    const expired = radar ? attempts >= 12 || now.getTime() - Date.parse(job.createdAt) > 48 * HOUR : attempts >= 14 || now.getTime() - Date.parse(job.createdAt) > 7 * 24 * HOUR
    const review = !failure.retryable || expired
    const current = await payload.findByID({ collection: 'flight-sync-jobs', id, overrideAccess: true })
    if (current.phase === 'Archived') return current
    return await payload.update({ collection: 'flight-sync-jobs', id, depth: 0, overrideAccess: true, data: {
      phase: review ? 'Needs_Review' : job.phase, nextRunAt: review ? null : after(now, failure.code === 'bark-not-configured' ? 6 * HOUR : Math.min(6 * HOUR, 60000 * 5 ** Math.min(attempts - 1, 4))),
      [radar ? 'attempts' : 'calibrationAttempts']: attempts, lastError: `${failure.code}: ${failure.message}`,
    } })
  } finally { await release(payload, id, token) }
}

export async function initializeSync(payload: Payload, request: SyncRequest, services: SyncServices = syncServices, now = new Date()) {
  const localDate = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO('Asia/Shanghai').toPlainDate().toString()
  const key = digest(JSON.stringify([request.flight_number, request.date || localDate, request.origin || '', request.destination || '', request.calendar_event_id || '', request.record_id || '']))
  const find = async () => (await payload.find({ collection: 'flight-sync-jobs', depth: 0, overrideAccess: true, where: { key: { equals: key } }, limit: 1 })).docs[0]
  let job = await find()
  if (!job) {
    // Insert atomically without opening two competing Payload transactions for duplicate webhooks.
    await (payload.db as unknown as SQLiteAdapter).drizzle.run(sql`INSERT INTO flight_sync_jobs (key, flight_number, request, phase, calibration_run_at, next_run_at, created_at, updated_at) VALUES (${key}, ${request.flight_number}, ${JSON.stringify(request)}, 'Awaiting_Radar', ${after(now, 24 * HOUR)}, ${now.toISOString()}, ${now.toISOString()}, ${now.toISOString()}) ON CONFLICT (key) DO NOTHING;`)
    job = await find()
    if (!job) throw new Error('Sync job was not persisted')
  }
  if (process.env.FLIGHT_SYNC_MODE !== 'remote' && job.phase === 'Awaiting_Radar' && job.nextRunAt && Date.parse(job.nextRunAt) <= now.getTime()) job = await processSyncJob(payload, job.id, services, now)
  return summary(job)
}

export async function calibrateSync(payload: Payload, input: unknown, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FlightSyncError('invalid-request', '校准请求无效。', false)
  const body = input as Record<string, unknown>
  if (typeof body.record_id !== 'string' || !/^\d+$/.test(body.record_id) || typeof body.flight_number !== 'string' || typeof body.gate_arrival_time !== 'string') throw new FlightSyncError('invalid-calibration', '请提供 record_id、flight_number 和带时区的 gate_arrival_time。', false)
  let gate: Temporal.Instant
  try { gate = Temporal.Instant.from(body.gate_arrival_time) } catch { throw new FlightSyncError('invalid-gate-time', '入位时间必须是带时区的 ISO-8601 时间。', false) }
  const result = await payload.find({ collection: 'flight-sync-jobs', overrideAccess: true, depth: 0, sort: 'createdAt', limit: 1, where: { flight: { equals: body.record_id } } })
  const job = result.docs[0]
  if (!job) throw new FlightSyncError('unknown-record', '未找到此航段的同步任务。', false)
  const token = await acquire(payload, job.id, now, false)
  if (!token) throw new FlightSyncError('busy', '航段正在同步，请稍后重试。')
  try {
    return await transaction(payload, async req => {
      const flight = await payload.findByID({ collection: 'flights', id: body.record_id as string, draft: true, depth: 0, overrideAccess: true, req })
      if (flightIdentity(flight).label !== flightIdentity({ flightNumber: body.flight_number as string }).label) throw new FlightSyncError('record-mismatch', '航班号与记录不匹配。', false)
      if (flight._status === 'draft' || flight.state === 'cancelled') throw new FlightSyncError('record-needs-review', '记录包含草稿或已取消，不自动覆盖。', false)
      if (!flight.touchdownUTC) throw new FlightSyncError('missing-touchdown', '尚无接地时间，暂不归档。')
      const touchdown = Temporal.Instant.from(flight.touchdownUTC)
      const delta = gate.epochMilliseconds - touchdown.epochMilliseconds
      if (delta <= 0 || delta > 12 * HOUR || gate.epochMilliseconds > now.getTime() + 5 * 60000) throw new FlightSyncError('invalid-gate-order', '入位必须晚于接地、在接地后十二小时以内，且不能处于未来。', false)
      try { validateActualTimes({ ...flight, actualArrivalUTC: gate.toString() }) } catch { throw new FlightSyncError('invalid-gate-order', '入位与现有实际时间冲突。', false) }
      if (flight.actualArrivalUTC && !Temporal.Instant.from(flight.actualArrivalUTC).equals(gate)) {
        const evidence = job.evidence as { gate?: { time?: string } } | null
        if (!evidence?.gate?.time || !Temporal.Instant.from(evidence.gate.time).equals(Temporal.Instant.from(flight.actualArrivalUTC))) throw new FlightSyncError('gate-conflict', '已有入位时间来自其他来源，保留原值等待核对。', false)
      }
      const unchanged = Boolean(flight.actualArrivalUTC && Temporal.Instant.from(flight.actualArrivalUTC).equals(gate))
      if (!unchanged) await payload.update({ collection: 'flights', id: flight.id, overrideAccess: true, req, data: { actualArrivalUTC: gate.toString(), state: 'completed' } })
      const jobs = await payload.find({ collection: 'flight-sync-jobs', overrideAccess: true, pagination: false, req, where: { flight: { equals: flight.id } } })
      for (const item of jobs.docs) if (item.phase !== 'Archived' || !unchanged) await payload.update({ collection: 'flight-sync-jobs', id: item.id, overrideAccess: true, req, data: {
        phase: 'Archived', nextRunAt: null, lastError: null, evidence: { ...(item.evidence as Record<string, unknown> || {}), gate: { source: 'flighty-calendar', time: gate.toString(), receivedAt: now.toISOString() } },
      } })
      return { record_id: String(flight.id), flight_number: job.flightNumber, status: 'Archived', gate_arrival_time: gate.toString(), unchanged }
    })
  } finally { await release(payload, job.id, token) }
}

export async function processDueSync(payload: Payload, services: SyncServices = syncServices, now = new Date()) {
  if (process.env.FLIGHT_SYNC_MODE === 'remote') return { processed: 0, jobs: [], mode: 'remote' }
  const due = await payload.find({ collection: 'flight-sync-jobs', overrideAccess: true, depth: 0, limit: 5, sort: 'nextRunAt', where: { and: [active, { nextRunAt: { less_than_equal: now.toISOString() } }, { or: [{ leaseUntil: { exists: false } }, { leaseUntil: { less_than_equal: now.toISOString() } }] }] } })
  const jobs = []
  for (const job of due.docs) jobs.push(summary(await processSyncJob(payload, job.id, services, now)))
  return { processed: jobs.length, jobs }
}

export async function pendingCalibrations(payload: Payload) {
  const jobs = await payload.find({ collection: 'flight-sync-jobs', overrideAccess: true, depth: 0, pagination: false, where: { phase: { in: ['Pending_Gate_Calibration', 'Needs_Review'] } } })
  const records = []
  const seen = new Set<number | string>()
  for (const job of jobs.docs) {
    const id = flightID(job)
    if (id == null || seen.has(id)) continue
    seen.add(id)
    const flight = await payload.findByID({ collection: 'flights', id, overrideAccess: true, depth: 0, context: { internalFlightDates: true } })
    records.push({ ...summary(job), date: flight.date, origin: flight.from, destination: flight.divertedTo || flight.to, touchdown: flight.touchdownUTC })
  }
  return { records }
}

type WorkerState = { timer: ReturnType<typeof setInterval>; running: boolean }
const workerHost = globalThis as typeof globalThis & { merakFlightSyncWorker?: WorkerState }

export function startFlightSyncWorker(payload: Payload) {
  if (process.env.FLIGHT_SYNC_ENABLED !== '1' || process.env.FLIGHT_SYNC_MODE === 'remote' || process.env.NEXT_PHASE === 'phase-production-build' || workerHost.merakFlightSyncWorker) return
  const state: WorkerState = { running: false, timer: setInterval(tick, 60000) }
  workerHost.merakFlightSyncWorker = state
  state.timer.unref()
  async function tick() {
    if (state.running) return
    state.running = true
    try { await processDueSync(payload) } catch { payload.logger.error('Flight Sync 队列暂未完成，将在下一轮重试。') }
    finally { state.running = false }
  }
  void tick()
}

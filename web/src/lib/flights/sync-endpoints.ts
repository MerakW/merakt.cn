import { workerEndpoint } from './sync-worker'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { calibrateSync, initializeSync, pendingCalibrations, processDueSync } from './sync-service'
import { FlightSyncError, normalizeSyncRequest, syncServices, type SyncServices } from './sync-provider'

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

function authorize(req: PayloadRequest): Response | undefined {
  const secret = process.env.FLIGHT_SYNC_TOKEN
  if (!secret || secret.length < 32 || process.env.FLIGHT_SYNC_ENABLED !== '1') return json({ error: '航班同步尚未启用。' }, 503)
  const token = /^Bearer (.+)$/i.exec(req.headers.get('authorization') || '')?.[1] || ''
  const hash = (value: string) => createHash('sha256').update(value).digest()
  if (!timingSafeEqual(hash(token), hash(secret))) return json({ error: '同步凭据无效。' }, 401)
}

export async function readJSON(req: PayloadRequest): Promise<unknown> {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new FlightSyncError('unsupported-type', '请提交 JSON 数据。', false)
  const reader = req.body?.getReader()
  if (!reader) throw new FlightSyncError('invalid-request', '缺少请求内容。', false)
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > 8192) { await reader.cancel(); throw new FlightSyncError('body-too-large', '请求不能超过 8 KB。', false) }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new FlightSyncError('invalid-request', 'JSON 格式无效。', false) }
}

export const errorResponse = (error: unknown) => {
  if (!(error instanceof FlightSyncError)) return json({ error: '同步服务暂不可用，请稍后重试。' }, 503)
  const status = ({ 'unknown-record': 404, busy: 409, 'gate-conflict': 409, 'record-needs-review': 409, 'record-mismatch': 409, 'invalid-gate-order': 422, 'missing-touchdown': 422, 'unsupported-type': 415, 'body-too-large': 413 } as Record<string, number>)[error.code] || 400
  return json({ error: error.message, code: error.code }, status)
}

export async function phase1Init(req: PayloadRequest, services: SyncServices = syncServices): Promise<Response> {
  const rejected = authorize(req)
  if (rejected) return rejected
  try {
    const result = await initializeSync(req.payload, normalizeSyncRequest(await readJSON(req)), services)
    return json(result, result.status === 'Awaiting_Radar' ? 202 : result.status === 'Needs_Review' ? 409 : 200)
  } catch (error) { return errorResponse(error) }
}

export async function phase2Calibrate(req: PayloadRequest): Promise<Response> {
  const rejected = authorize(req)
  if (rejected) return rejected
  try { return json(await calibrateSync(req.payload, await readJSON(req))) } catch (error) { return errorResponse(error) }
}

export async function listPending(req: PayloadRequest): Promise<Response> {
  const rejected = authorize(req)
  if (rejected) return rejected
  try { return json(await pendingCalibrations(req.payload)) } catch (error) { return errorResponse(error) }
}

export async function runDue(req: PayloadRequest, services: SyncServices = syncServices): Promise<Response> {
  const rejected = authorize(req)
  if (rejected) return rejected
  try { return json(await processDueSync(req.payload, services)) } catch (error) { return errorResponse(error) }
}

export const flightSyncEndpoints: Endpoint[] = [
  { path: '/flight/worker', method: 'post', handler: workerEndpoint },
  { path: '/flight/phase1-init', method: 'post', handler: req => phase1Init(req) },
  { path: '/flight/phase2-calibrate', method: 'post', handler: phase2Calibrate },
  { path: '/flight/pending', method: 'get', handler: listPending },
  { path: '/flight/process-due', method: 'post', handler: req => runDue(req) },
]

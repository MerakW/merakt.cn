import { Temporal } from '@js-temporal/polyfill'
import { airportMap } from './airports'
import { flightIdentity } from './airlines'
import { validDate } from './time'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const runPython = promisify(execFile)

export class FlightSyncError extends Error {
  constructor(public code: string, message: string, public retryable = true) { super(message) }
}

export type SyncRequest = { flight_number: string; date?: string; origin?: string; destination?: string; calendar_event_id?: string; record_id?: string }
export type FlightFacts = {
  provider: 'fr24' | 'flightaware'; providerId?: string; flightNumber: string; date: string; from: string; to: string
  takeoffUTC?: string; touchdownUTC: string; actualDepartureUTC?: string; actualArrivalUTC?: string; departureLocal?: string; arrivalLocal?: string
  registration?: string; aircraft?: string; aircraftCode?: string
}

export function normalizeSyncRequest(body: unknown): SyncRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FlightSyncError('invalid-request', '请提供 JSON 对象。', false)
  const input = body as Record<string, unknown>
  if (typeof input.flight_number !== 'string') throw new FlightSyncError('invalid-flight', '请填写航班号。', false)
  const flight_number = flightIdentity({ flightNumber: input.flight_number }).label
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flight_number) || !/[A-Z]/.test(flight_number.slice(0, 2))) throw new FlightSyncError('invalid-flight', '航班号格式应为 MU9191。', false)
  const request: SyncRequest = { flight_number }
  if (input.date != null) {
    if (typeof input.date !== 'string' || !validDate(input.date)) throw new FlightSyncError('invalid-date', '日期格式应为 YYYY-MM-DD。', false)
    request.date = input.date
  }
  for (const field of ['origin', 'destination'] as const) if (input[field] != null) {
    const code = String(input[field]).trim().toUpperCase()
    if (!airportMap.has(code)) throw new FlightSyncError('invalid-airport', '机场代码未收录。', false)
    request[field] = code
  }
  for (const field of ['calendar_event_id', 'record_id'] as const) if (input[field] != null) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > 200) throw new FlightSyncError('invalid-id', '记录标识无效。', false)
    request[field] = input[field].trim()
  }
  if (request.record_id && !/^[1-9]\d*$/.test(request.record_id)) throw new FlightSyncError('invalid-id', 'record_id 应使用网站返回的航段 ID。', false)
  return request
}

const timestamp = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100000000000 ? value : undefined
const instant = (seconds: number) => new Date(seconds * 1000).toISOString()
const wallTime = (seconds: number, zone: string) => Temporal.Instant.from(instant(seconds)).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'second' })

/** Only the small validated fact set crosses the provider boundary; raw responses stay in memory. */
export function parseFR24(payload: unknown, request: SyncRequest, now = new Date()): FlightFacts {
  // FR24 is an external, undocumented schema. Guard each container before extracting facts.
  const root = payload as { result?: { response?: { data?: unknown } } } | null
  const entries = root?.result?.response?.data
  if (!Array.isArray(entries)) throw new FlightSyncError('provider-schema', '雷达返回结构异常，稍后重试。')
  const matches: FlightFacts[] = []
  for (const row of entries) {
    if (!row || typeof row !== 'object') continue
    const status = String(row.status?.text || '').trim()
    if (/^(scheduled|estimated|cancelled|canceled)/i.test(status)) continue
    const arrival = timestamp(row.time?.real?.arrival), departure = timestamp(row.time?.real?.departure)
    if (!/landed/i.test(status) && !arrival) continue
    if (!arrival || (departure && arrival <= departure) || arrival * 1000 > now.getTime()) continue
    const number = row.identification?.number?.default
    if (typeof number === 'string' && flightIdentity({ flightNumber: number }).label !== request.flight_number) continue
    const from = String(row.airport?.origin?.code?.iata || '').toUpperCase()
    const to = String(row.airport?.destination?.code?.iata || '').toUpperCase()
    const origin = airportMap.get(from), destination = airportMap.get(to)
    if (!origin || !destination || (request.origin && from !== request.origin) || (request.destination && to !== request.destination)) continue
    const scheduledDeparture = timestamp(row.time?.scheduled?.departure), scheduledArrival = timestamp(row.time?.scheduled?.arrival)
    const dateTime = scheduledDeparture || departure
    if (!dateTime && !request.date) continue
    const date = dateTime ? wallTime(dateTime, origin.timeZone).slice(0, 10) : request.date!
    if (request.date ? date !== request.date : now.getTime() - arrival * 1000 > 48 * 3600000) continue
    const text = (value: unknown) => typeof value === 'string' && value.trim() && value.length <= 160 ? value.trim() : undefined
    matches.push({ provider: 'fr24', providerId: text(String(row.identification?.id || '')),
      flightNumber: request.flight_number, date, from, to, takeoffUTC: departure ? instant(departure) : undefined, touchdownUTC: instant(arrival),
      departureLocal: scheduledDeparture ? wallTime(scheduledDeparture, origin.timeZone) : undefined,
      arrivalLocal: scheduledArrival ? wallTime(scheduledArrival, destination.timeZone) : undefined,
      registration: text(row.aircraft?.registration), aircraft: text(row.aircraft?.model?.text), aircraftCode: text(row.aircraft?.model?.code),
    })
  }
  if (!matches.length) throw new FlightSyncError('no-landed-flight', '尚未找到匹配的已落地航段，等待雷达数据。')
  const unique = [...new Map(matches.map(f => [`${f.from}:${f.to}:${f.takeoffUTC || f.providerId || f.touchdownUTC}`, f])).values()]
  // ponytail: flight-number-only requests select the latest landing within 48 hours; send date and route for exact matching.
  unique.sort((a, b) => b.touchdownUTC.localeCompare(a.touchdownUTC))
  if (request.date && unique.length > 1 && !(request.origin && request.destination)) throw new FlightSyncError('ambiguous-flight', '同日存在多个航段，请提供起降机场。', false)
  if (request.date && request.origin && request.destination && unique.length > 1) throw new FlightSyncError('ambiguous-flight', '同日同航线存在多个航段，需要人工核对。', false)
  return unique[0]
}

export async function lookupFlight(request: SyncRequest): Promise<FlightFacts> {
  const provider = process.env.FLIGHT_DATA_PROVIDER || 'fr24'
  if (provider === 'flightaware') return (await import('./flightaware-provider')).lookupFlightAware(request)
  if (provider !== 'fr24') throw new FlightSyncError('provider-config', '数据源配置无效。', false)
  return lookupFR24(request)
}

async function lookupFR24(request: SyncRequest): Promise<FlightFacts> {
  if (process.env.FR24_TRANSPORT === 'curl_cffi') {
    let output: string
    try {
      const result = await runPython(process.env.FR24_PYTHON || 'python3', [resolve('src/lib/flights/fr24_fetch.py'), request.flight_number], { timeout: 15000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' })
      output = result.stdout
    } catch { throw new FlightSyncError('provider-transport', 'Chrome 抓取通道不可用，请检查 Python 环境；稍后重试。') }
    let result: { data?: unknown; httpStatus?: number; error?: string }
    try { result = JSON.parse(output) } catch { throw new FlightSyncError('provider-invalid-json', '抓取通道响应无法解析，等待重试。') }
    if (result.error) throw new FlightSyncError(result.error, result.error === 'missing-curl-cffi' ? 'Python 环境尚未安装 curl_cffi。' : 'Chrome 抓取通道暂不可用，等待重试。')
    if (result.httpStatus !== 200) throw new FlightSyncError(`provider-http-${result.httpStatus}`, `雷达访问受限或暂不可用（${result.httpStatus}），等待重试。`)
    return parseFR24(result.data, request)
  }
  if (process.env.FR24_TRANSPORT && process.env.FR24_TRANSPORT !== 'fetch') throw new FlightSyncError('provider-config', '抓取通道配置无效，需要核对。', false)
  const url = new URL('https://api.flightradar24.com/common/v1/flight/list.json')
  url.search = new URLSearchParams({ query: request.flight_number, fetchBy: 'flight', page: '1', limit: '50', token: '' }).toString()
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store', headers: {
      Accept: 'application/json', Referer: `https://www.flightradar24.com/data/flights/${request.flight_number.toLowerCase()}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    } })
  } catch { throw new FlightSyncError('provider-unavailable', '雷达请求超时或网络不可用，等待重试。') }
  if (!response.ok) throw new FlightSyncError(`provider-http-${response.status}`, response.status === 403 ? '雷达访问受限（403），等待重试。' : `雷达暂不可用（${response.status}）。`)
  if (!response.headers.get('content-type')?.includes('json')) throw new FlightSyncError('provider-not-json', '雷达返回了非 JSON 页面，等待重试。')
  try { return parseFR24(await response.json(), request) }
  catch (error) { if (error instanceof FlightSyncError) throw error; throw new FlightSyncError('provider-invalid-json', '雷达响应无法解析，等待重试。') }
}

export async function pushCalibration(flightNumber: string, recordId: string): Promise<void> {
  const key = process.env.BARK_KEY
  if (!key) throw new FlightSyncError('bark-not-configured', 'Bark Key 尚未配置。')
  const server = new URL(process.env.BARK_SERVER_URL || 'https://api.day.app/')
  server.pathname = server.pathname.replace(/\/$/, '') + '/push'
  server.search = ''; server.hash = ''
  try {
    const response = await fetch(server, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      device_key: key, title: 'FLIGHT_CALIBRATE_NOW', body: `${flightNumber}|${recordId}`, group: 'FlightSync', sound: 'none', level: 'passive',
    }) })
    if (!response.ok || (await response.json()).code !== 200) throw new Error('push failed')
  } catch { throw new FlightSyncError('bark-unavailable', '校准通知未确认发送成功，等待重试。') }
}

export type SyncServices = { lookup: typeof lookupFlight; push: typeof pushCalibration }
export const syncServices: SyncServices = { lookup: lookupFlight, push: pushCalibration }

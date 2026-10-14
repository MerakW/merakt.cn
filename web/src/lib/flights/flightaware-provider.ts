import { Temporal } from '@js-temporal/polyfill'
import { airportMap } from './airports'
import { flightIdentity } from './airlines'
import { validateActualTimes } from './time'
import { FlightSyncError, type FlightFacts, type SyncRequest } from './sync-provider'

const actual = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  try { return Temporal.Instant.from(value).toString() } catch { return undefined }
}
const text = (value: unknown) => typeof value === 'string' && value.trim() && value.length <= 160 ? value.trim() : undefined
const wall = (instant: string, zone: string) => Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'second' })

/** AeroAPI OUT/OFF/ON/IN remain four separate facts. Never substitute estimates for actuals. */
export function parseFlightAware(input: unknown, request: SyncRequest, now = new Date()): FlightFacts {
  const rows = (input as { flights?: unknown } | null)?.flights
  if (!Array.isArray(rows)) throw new FlightSyncError('provider-schema', 'FlightAware 响应结构异常。')
  const matches: FlightFacts[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || row.cancelled || row.diverted) continue
    const numbers = [row.ident_iata, row.ident_icao, row.ident].filter((n): n is string => typeof n === 'string')
    if (!numbers.some(n => flightIdentity({ flightNumber: n }).label === request.flight_number)) continue
    const from = row.origin?.code_iata, to = row.destination?.code_iata
    const origin = airportMap.get(from), destination = airportMap.get(to)
    if (!origin || !destination || request.origin && request.origin !== from || request.destination && request.destination !== to) continue
    const takeoffUTC = actual(row.actual_off), touchdownUTC = actual(row.actual_on)
    if (!touchdownUTC || Date.parse(touchdownUTC) > now.getTime()) continue
    const scheduledDeparture = actual(row.scheduled_out) || actual(row.scheduled_off)
    const scheduledArrival = actual(row.scheduled_in) || actual(row.scheduled_on)
    const dateInstant = scheduledDeparture || actual(row.actual_out) || takeoffUTC
    if (!dateInstant) continue
    const date = wall(dateInstant, origin.timeZone).slice(0, 10)
    if (request.date ? request.date !== date : now.getTime() - Date.parse(touchdownUTC) > 48 * 3600000) continue
    const facts: FlightFacts = {
      provider: 'flightaware', providerId: text(row.fa_flight_id), flightNumber: request.flight_number, date, from, to,
      takeoffUTC, touchdownUTC, actualDepartureUTC: actual(row.actual_out), actualArrivalUTC: actual(row.actual_in),
      departureLocal: scheduledDeparture ? wall(scheduledDeparture, origin.timeZone) : undefined,
      arrivalLocal: scheduledArrival ? wall(scheduledArrival, destination.timeZone) : undefined,
      registration: text(row.registration), aircraftCode: text(row.aircraft_type),
    }
    try { validateActualTimes(facts) } catch { continue }
    if (takeoffUTC && Date.parse(takeoffUTC) >= Date.parse(touchdownUTC) || facts.actualArrivalUTC && Date.parse(facts.actualArrivalUTC) > now.getTime()) continue
    matches.push(facts)
  }
  const unique = [...new Map(matches.map(f => [f.providerId || `${f.from}:${f.to}:${f.touchdownUTC}`, f])).values()].sort((a, b) => b.touchdownUTC.localeCompare(a.touchdownUTC))
  if (!unique.length) throw new FlightSyncError('no-landed-flight', 'FlightAware 尚无匹配的已落地航段。')
  if (request.date && unique.length > 1) throw new FlightSyncError('ambiguous-flight', 'FlightAware 同日有多个航段，请核对起降机场。', false)
  return unique[0]
}

export async function lookupFlightAware(request: SyncRequest): Promise<FlightFacts> {
  const key = process.env.FLIGHTAWARE_API_KEY
  if (!key) throw new FlightSyncError('provider-config', '家庭端未配置 FlightAware API Key。', false)
  const url = new URL('https://aeroapi.flightaware.com/aeroapi/flights/' + encodeURIComponent(request.flight_number))
  // One page per attempt; no paid fallback or pagination is triggered silently.
  url.searchParams.set('max_pages', '1')
  if (request.date) {
    const zone = request.origin ? airportMap.get(request.origin)!.timeZone : 'Asia/Shanghai'
    const start = Temporal.PlainDate.from(request.date).toZonedDateTime(zone).startOfDay().toInstant()
    url.searchParams.set('start', start.subtract({ hours: 24 }).toString())
    url.searchParams.set('end', start.add({ hours: 48 }).toString())
  }
  let response: Response
  try { response = await fetch(url, { headers: { 'x-apikey': key, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12000), cache: 'no-store' }) }
  catch { throw new FlightSyncError('provider-unavailable', 'FlightAware 暂时无法连接。') }
  if ([401, 403].includes(response.status)) throw new FlightSyncError('provider-auth', 'FlightAware 凭据或套餐权限无效，请核对。', false)
  if (!response.ok) throw new FlightSyncError(`provider-http-${response.status}`, `FlightAware HTTP ${response.status}。`)
  let data: unknown
  try { data = await response.json() } catch { throw new FlightSyncError('provider-invalid-json', 'FlightAware 响应无法解析。') }
  return parseFlightAware(data, request)
}

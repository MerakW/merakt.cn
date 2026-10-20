import { Temporal } from '@js-temporal/polyfill'
import { airportMap } from './airports'
import { flightIdentity } from './airlines'
import { localToUTC, validateActualTimes } from './time'
import { FlightSyncError, type SyncRequest } from './sync-provider'

export type ProviderFlight = {
  date: string; flightNumber: string; from: string; to: string; airline?: string
  departureLocal?: string; arrivalLocal?: string; actualDepartureUTC?: string; takeoffUTC?: string; touchdownUTC?: string; actualArrivalUTC?: string
  registration?: string; aircraft?: string; aircraftCode?: string
}
const text = (v: unknown) => typeof v === 'string' && v.trim() && v.length <= 160 ? v.trim() : undefined

/** Input has already been unwrapped by the bounded Python JSON/Python-literal reader. */
export function parseVariFlight(input: unknown, request: SyncRequest, now = new Date()): ProviderFlight[] {
  const root = input as { code?: number; data?: unknown } | null
  if (!root || root.code !== 200 || !Array.isArray(root.data)) throw new FlightSyncError('provider-response', '飞常准未返回有效航班数据。', false)
  const flights: ProviderFlight[] = []
  for (const row of root.data) {
    if (!row || typeof row !== 'object') continue
    if (typeof row.FlightNo !== 'string' || flightIdentity({ flightNumber: row.FlightNo }).label !== request.flight_number || /取消|备降|cancel|divert/i.test(String(row.FlightState))) continue
    const from = airportMap.get(String(row.FlightDepcode)), to = airportMap.get(String(row.FlightArrcode))
    if (!from || !to) continue
    const local = (v: unknown) => text(v)?.replace(' ', 'T')
    const departureLocal = local(row.FlightDeptimePlanDate), arrivalLocal = local(row.FlightArrtimePlanDate)
    if (!departureLocal || departureLocal.slice(0, 10) !== request.date) continue
    const actual = (value: unknown, zone: string, offset: unknown) => {
      const valueLocal = local(value)
      if (!valueLocal) return undefined
      const utc = localToUTC(valueLocal, zone)
      const instant = Temporal.Instant.from(utc)
      if (instant.epochMilliseconds > now.getTime()) throw new Error('Future actual timestamp')
      if (offset != null && offset !== '' && Number(offset) !== instant.toZonedDateTimeISO(zone).offsetNanoseconds / 1e9) throw new Error('Source timezone mismatch')
      return utc
    }
    try {
      localToUTC(departureLocal, from.timeZone)
      if (arrivalLocal) localToUTC(arrivalLocal, to.timeZone)
      const flight: ProviderFlight = {
        date: request.date!, flightNumber: request.flight_number, from: from.iata, to: to.iata, departureLocal, arrivalLocal,
        airline: flightIdentity({ flightNumber: request.flight_number }).airline?.iata,
        actualDepartureUTC: actual(row.FlightOutgateTime, from.timeZone, row.org_timezone),
        takeoffUTC: actual(row.FlightDeptimeDate, from.timeZone, row.org_timezone),
        touchdownUTC: actual(row.FlightArrtimeDate, to.timeZone, row.dst_timezone),
        actualArrivalUTC: actual(row.FlightIngateTime, to.timeZone, row.dst_timezone),
        registration: text(row.AircraftNumber), aircraft: text(row.generic), aircraftCode: text(row.ftype),
      }
      validateActualTimes(flight)
      flights.push(flight)
    } catch { /* An inconsistent leg must not populate the form. */ }
  }
  return [...new Map(flights.map(f => [JSON.stringify(f), f])).values()]
}

/** The cloud accepts only normalized, bounded form fields from the signed worker. */
export function validateProviderFlights(input: unknown, request: SyncRequest, now = new Date()): ProviderFlight[] {
  if (!Array.isArray(input) || input.length > 20) throw new FlightSyncError('invalid-result', '查询结果结构无效。', false)
  return input.map(f => {
    if (!f || typeof f !== 'object' || f.flightNumber !== request.flight_number || f.date !== request.date || !airportMap.has(f.from) || !airportMap.has(f.to)) throw new FlightSyncError('invalid-result', '查询结果与确认信息不一致。', false)
    const result: ProviderFlight = { flightNumber: f.flightNumber, date: f.date, from: f.from, to: f.to }
    for (const field of ['registration', 'aircraft', 'aircraftCode', 'airline'] as const) if (f[field] != null) {
      if (!text(f[field])) throw new Error('Invalid provider text')
      result[field] = text(f[field])
    }
    for (const field of ['departureLocal', 'arrivalLocal'] as const) if (f[field] != null) {
      localToUTC(f[field], airportMap.get(field === 'departureLocal' ? f.from : f.to)!.timeZone)
      if (field === 'departureLocal' && f[field].slice(0, 10) !== request.date) throw new Error('Invalid source date')
      result[field] = f[field]
    }
    for (const field of ['actualDepartureUTC', 'takeoffUTC', 'touchdownUTC', 'actualArrivalUTC'] as const) if (f[field] != null) {
      const time = Temporal.Instant.from(f[field])
      if (time.epochMilliseconds < 0 || time.epochMilliseconds > now.getTime()) throw new Error('Invalid actual time')
      result[field] = time.toString()
    }
    validateActualTimes(result)
    return result
  })
}

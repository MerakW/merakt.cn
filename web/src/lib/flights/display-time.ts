import { Temporal } from '@js-temporal/polyfill'
import type { publicFlight } from './public'
/** Actual gate times, converted into the airport's zone; each endpoint falls back independently. */
export function flightTime(f: ReturnType<typeof publicFlight>, side: 'departure' | 'arrival') {
  const actual = side === 'departure' ? f.actualDepartureUTC : f.actualArrivalUTC
  const zone = side === 'departure' ? f.departureTimeZone : f.arrivalTimeZone
  const scheduled = side === 'departure' ? f.departureLocal : f.arrivalLocal
  const fallbackClock = side === 'departure' ? f.departureClock : f.arrivalClock
  const verb = side === 'departure' ? '出发' : '到达'
  if (f.state !== 'planned' && !f.dateHidden && actual && zone) {
    try {
      const local = Temporal.Instant.from(actual).toZonedDateTimeISO(zone).toPlainDateTime().toString({smallestUnit:'minute'})
      return {label: `实际${verb}`, local, clock: local.slice(11,16)}
    } catch { /* Invalid timestamps/zones use the recorded schedule. */ }
  }
  return {label: `计划${verb}`, local: scheduled, clock: fallbackClock || scheduled?.slice(11,16) || '时间未记录'}
}

/** Compare UTC instants so overnight arrivals and time zones do not affect delay. */
export function arrivalDelayMinutes(f: Pick<ReturnType<typeof publicFlight>, 'state' | 'dateHidden' | 'actualArrivalUTC' | 'arrivalUTC'>): number {
  if (f.state !== 'completed' || f.dateHidden || !f.actualArrivalUTC || !f.arrivalUTC) return 0
  const minutes = (Date.parse(f.actualArrivalUTC) - Date.parse(f.arrivalUTC)) / 60000
  return Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
}

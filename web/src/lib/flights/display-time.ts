import { Temporal } from '@js-temporal/polyfill'
import type { publicFlight } from './public'
import { airportMap } from './airports'
/** Gate times take priority; runway facts remain explicitly labelled until calibration arrives. */
export function flightTime(f: ReturnType<typeof publicFlight>, side: 'departure' | 'arrival') {
  const gate = side === 'departure' ? f.actualDepartureUTC : f.actualArrivalUTC
  const runway = side === 'departure' ? f.takeoffUTC : f.touchdownUTC
  const actual = gate || runway
  const zone = side === 'departure' ? f.departureTimeZone : f.arrivalTimeZone
  const scheduled = side === 'departure' ? f.departureLocal : f.arrivalLocal
  const fallbackClock = side === 'departure' ? f.departureClock : f.arrivalClock
  const verb = side === 'departure' ? '出发' : '到达'
  if (f.state !== 'planned' && !f.dateHidden && actual && zone) {
    try {
      const actualZone = side === 'arrival' && f.divertedTo ? airportMap.get(f.divertedTo)?.timeZone || zone : zone
      const local = Temporal.Instant.from(actual).toZonedDateTimeISO(actualZone).toPlainDateTime().toString({smallestUnit:'minute'})
      return {label: gate ? `实际${verb}` : side === 'departure' ? '实际起飞' : '实际接地', local, clock: local.slice(11,16), timeZone: actualZone}
    } catch { /* Invalid timestamps/zones use the recorded schedule. */ }
  }
  return {label: `计划${verb}`, local: scheduled, clock: fallbackClock || scheduled?.slice(11,16) || '时间未记录', timeZone: zone}
}

/** Compare UTC instants so overnight arrivals and time zones do not affect delay. */
export function arrivalDelayMinutes(f: Pick<ReturnType<typeof publicFlight>, 'state' | 'dateHidden' | 'actualArrivalUTC' | 'arrivalUTC'>): number {
  if (f.state !== 'completed' || f.dateHidden || !f.actualArrivalUTC || !f.arrivalUTC) return 0
  const minutes = (Date.parse(f.actualArrivalUTC) - Date.parse(f.arrivalUTC)) / 60000
  return Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
}

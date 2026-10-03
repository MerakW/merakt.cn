import { formatRegistration } from './registration'
import type { FlightRecord } from './types'
import { localDayStartUTC } from './time'
import { Temporal } from '@js-temporal/polyfill'

export function isFlightPublic(flight: FlightRecord, now = new Date()): boolean {
  return flight.visibility === 'public' || (
    flight.visibility === 'scheduled' && Boolean(flight.publishAt) &&
    Number.isFinite(Date.parse(flight.publishAt!)) && Date.parse(flight.publishAt!) <= now.getTime()
  )
}

/** Explicit allowlist: newly added private fields must never silently become public. */
export function publicFlight(flight: FlightRecord) {
  const dateHidden = Boolean(flight.hideSchedule && flight.state === 'planned')
  return {
    dateHidden,
    id: flight.id,
    date: dateHidden ? (/^\d{4}/.exec(flight.date || '')?.[0] || '****') + '-**-**' : flight.date,
    departureClock: flight.departureLocal?.match(/T(\d{2}:\d{2})/)?.[1],
    arrivalClock: flight.arrivalLocal?.match(/T(\d{2}:\d{2})/)?.[1],
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    from: flight.from,
    to: flight.to,
    divertedTo: flight.divertedTo,
    state: flight.state,
    departureLocal: dateHidden ? undefined : flight.departureLocal,
    arrivalLocal: dateHidden ? undefined : flight.arrivalLocal,
    departureUTC: dateHidden ? undefined : flight.departureUTC,
    arrivalUTC: dateHidden ? undefined : flight.arrivalUTC,
    actualDepartureUTC: dateHidden ? undefined : flight.actualDepartureUTC,
    actualArrivalUTC: dateHidden ? undefined : flight.actualArrivalUTC,
    departureTimeZone: dateHidden ? undefined : flight.departureTimeZone,
    arrivalTimeZone: dateHidden ? undefined : flight.arrivalTimeZone,
    aircraft: flight.aircraft,
    registration: formatRegistration(flight.registration) || undefined,
    note: dateHidden ? undefined : flight.note,
  }
}

export function departureInstant(flight: FlightRecord): number | null {
  if (flight.departureUTC) {
    const time = Date.parse(flight.departureUTC)
    return Number.isFinite(time) ? time : null
  }
  if (!flight.departureTimeZone) return null
  try { return Date.parse(localDayStartUTC(flight.date, flight.departureTimeZone)) } catch { return null }
}

export function selectFeaturedFlight(flights: FlightRecord[], now = new Date()) {
  const visible = flights.filter(flight => isFlightPublic(flight, now))
  const upcoming = visible.filter(flight => {
    if (!flight.departureUTC && flight.departureTimeZone) {
      const localToday = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(flight.departureTimeZone).toPlainDate().toString()
      return flight.state === 'planned' && flight.date >= localToday
    }
    const departure = departureInstant(flight)
    return flight.state === 'planned' && departure !== null && departure >= now.getTime()
  }).sort((a, b) => departureInstant(a)! - departureInstant(b)!)
  if (upcoming[0]) return { kind: 'upcoming' as const, flight: publicFlight(upcoming[0]) }
  const history = visible.filter(flight => flight.state === 'completed')
    .sort((a, b) => (b.actualArrivalUTC || b.arrivalUTC || b.date).localeCompare(a.actualArrivalUTC || a.arrivalUTC || a.date))
  return history[0] ? { kind: 'latest' as const, flight: publicFlight(history[0]) } : null
}

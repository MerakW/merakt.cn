import { Temporal } from '@js-temporal/polyfill'
import { airportMap } from '@/lib/flights/airports'
import type { publicFlight } from '@/lib/flights/public'

export default function FlightOperationalTimes({ flight }: { flight: ReturnType<typeof publicFlight> }) {
  if (flight.dateHidden || flight.state === 'planned') return null
  const arrivalZone = flight.divertedTo ? airportMap.get(flight.divertedTo)?.timeZone || flight.arrivalTimeZone : flight.arrivalTimeZone
  const events = [
    ['实际起飞', flight.takeoffUTC, flight.departureTimeZone],
    ['实际接地', flight.touchdownUTC, arrivalZone],
  ].flatMap(([label, instant, zone]) => {
    if (!instant || !zone) return []
    try {
      const local = Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'minute' })
      return [{ label, instant, local, zone }]
    } catch { return [] }
  })
  if (!events.length) return null
  return <>{events.map(event => <div key={event.label}><dt>{event.label}</dt><dd><time dateTime={event.instant}>{event.local.replace('T', ' ')}</time><small>{event.zone}</small></dd></div>)}</>
}

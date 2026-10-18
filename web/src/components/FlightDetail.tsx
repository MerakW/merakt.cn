import Localized from '@/components/Localized'
import ArrowIcon from './ArrowIcon'
import AircraftPortrait from './AircraftPortrait'
import FlightNumber from './FlightNumber'
import FlightOperationalTimes from './FlightOperationalTimes'
import RouteMap from './RouteMap'
import { flightTime, arrivalDelayMinutes } from '@/lib/flights/display-time'
import { flightIdentity } from '@/lib/flights/airlines'
import { landingAirport } from '@/lib/flights/souvenirs'
import type { DisplayFlight } from './FlightBoard'
import type { Airport } from '@/lib/flights/types'

const dateLabel = (date: string) => date.replaceAll('-', '.')
export default function FlightDetail({ flight: f, airports, airportName, id, animate = true }: {
  flight: DisplayFlight; airports: Airport[]; airportName: (code: string) => string; id?: string; animate?: boolean
}) {
  const departure = flightTime(f, 'departure'), arrival = flightTime(f, 'arrival')
  const delayMinutes = arrivalDelayMinutes(f)
  return <Localized><div className="flight-detail archive-detail" id={id}><AircraftPortrait flight={f} detailed animate={animate} /><div className="detail-copy"><p className="kicker"><FlightNumber flight={f} /></p><h3>{airportName(f.from)} <ArrowIcon /> {airportName(landingAirport(f))}</h3><dl><div><dt>{departure.label}</dt><dd>{f.dateHidden ? `${dateLabel(f.date)} ${f.departureClock || "@i18n:ui.timeNotRecorded@"}` : departure.local?.replace('T', ' ') || f.date}<small>{f.departureTimeZone}</small></dd></div><div><dt>{arrival.label}</dt><dd><span className={delayMinutes > 0 && arrival.label === '实际到达' ? 'arrival-time-delayed' : undefined}>{f.dateHidden ? `${dateLabel(f.date)} ${f.arrivalClock || "@i18n:ui.timeNotRecorded@"}` : arrival.local?.replace('T', ' ') || "@i18n:ui.notRecorded@"}{delayMinutes > 0 && arrival.label === '实际到达' && `（+${delayMinutes}min）`}</span><small>{arrival.timeZone}</small></dd></div><FlightOperationalTimes flight={f} />{flightIdentity(f).icao && <div><dt>{"@i18n:ui.callsignIcao@"}</dt><dd>{flightIdentity(f).icao}</dd></div>}{f.registration && <div><dt>{"@i18n:ui.aircraftRegistration@"}</dt><dd>{f.registration}</dd></div>}{f.divertedTo && <div><dt>{"@i18n:ui.scheduledDestination@"}</dt><dd>{airportName(f.to)} / {f.to}</dd></div>}</dl>{f.note && <p data-i18n="off">{f.note}</p>}</div><RouteMap flights={[f]} airports={airports} /></div></Localized>
}

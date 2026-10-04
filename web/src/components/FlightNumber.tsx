import { airlineLogoURL } from '@/lib/assets'
import { flightAlliance } from '@/lib/flights/alliances'
import { flightIdentity } from '@/lib/flights/airlines'

export default function FlightNumber({ flight }: { flight: {airline?: string | null; flightNumber?: string | null; date?: string | null} }) {
  const identity = flightIdentity(flight)
  const alliance = flightAlliance(flight)
  return <span className="flight-number" title={identity.airline?.name}>
    {identity.airline && <img className="airline-logo" src={airlineLogoURL(identity.airline.icao)} alt={identity.airline.name} width="27" height="24" />}
    <span>{identity.label}</span>
    {alliance && <img className={`alliance-logo alliance-${alliance.key}`} src={alliance.src} alt={alliance.name} title={alliance.name} width={alliance.key === 'star' ? 32 : 21} height="21" />}
  </span>
}

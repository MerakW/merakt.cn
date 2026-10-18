import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import PlaneIcon from '@/components/PlaneIcon'
import { airlineLogoURL } from '@/lib/assets'
import AircraftLabel from './AircraftLabel'
import FlightNumber from './FlightNumber'
import AircraftPortrait from './AircraftPortrait'
import { flightIdentity } from '@/lib/flights/airlines'
import { flightAlliance } from '@/lib/flights/alliances'
import { flightSouvenirs, landingAirport } from '@/lib/flights/souvenirs'
import type { DisplayFlight } from './FlightBoard'
const dateLabel = (date: string) => date.replaceAll('-', '.')
export default function FlightSouvenirs({souvenirs,airportName,open,filterRoute}: {
 souvenirs: ReturnType<typeof flightSouvenirs>; airportName:(code:string)=>string;
 open:(flight:DisplayFlight)=>void; filterRoute:(route:string)=>void;
}) {
 const carrier = souvenirs.topAirlineFlight && flightIdentity(souvenirs.topAirlineFlight).airline
 const alliance = souvenirs.topAirlineFlight && flightAlliance(souvenirs.topAirlineFlight)
 return <Localized><>
    {souvenirs.count > 0 && <section className="souvenir-cover" aria-labelledby="souvenir-heading">
      <div className="souvenir-heading"><div><p className="kicker">FLIGHT NOTES</p><h2 id="souvenir-heading">{"@i18n:ui.flightHighlights@"}</h2></div><p><span>{"@i18n:ui.familiarFacesFirstEncounters@"}</span></p></div>
      <div className="souvenir-pieces">
        {souvenirs.familiar && <button className="souvenir-piece familiar-ticket" onClick={() => filterRoute(souvenirs.familiar!.key)}>
          <span className="piece-eyebrow">ON REPEAT <span>{"@i18n:ui.mostFrequentRoute@"}</span></span>
          <span className="piece-route">{souvenirs.familiar.from}<i>↔︎</i>{souvenirs.familiar.to}</span>
          <span className="piece-cities">{airportName(souvenirs.familiar.from)} · {airportName(souvenirs.familiar.to)}</span>
          {souvenirs.mostFlown && <span className="piece-flight"><FlightNumber flight={souvenirs.mostFlown.flight} /><small>{"@i18n:ui.flightsOnThisRoute@ "}{souvenirs.mostFlown.count} {" @i18n:ui.times@"}</small></span>}
          <span className="repeat-count"><strong>{souvenirs.familiar.count}</strong><span>{"@i18n:ui.oneWayFlights@"}<br />{"@i18n:ui.bothDirectionsIncluded@"}</span><small>{"@i18n:ui.viewRecords@"}</small></span>
        </button>}
        {souvenirs.first && <button className="souvenir-piece first-ticket" onClick={() => open(souvenirs.first!)}>
          <span className="piece-eyebrow">FIRST ON RECORD</span><span className="first-ticket-title">{"@i18n:ui.theEarliest@"}<br />{"@i18n:ui.record@"}</span>
          <span className="piece-route">{souvenirs.first.from}<i><ArrowIcon /></i>{landingAirport(souvenirs.first)}</span>
          <span className="piece-flight"><FlightNumber flight={souvenirs.first} /></span><span className="piece-foot"><time>{dateLabel(souvenirs.first.date)}</time><span>{"@i18n:ui.viewFlight@"}</span></span>
        </button>}
        {souvenirs.farthest && <button className="souvenir-piece far-ticket" onClick={() => open(souvenirs.farthest!.flight)}>
          <span className="piece-eyebrow">LONGEST ROUTE <span>{"@i18n:ui.longestFlight@"}</span></span>
          <span className="distance-number">{Math.round(souvenirs.farthest.km).toLocaleString('en-US')}<small>KM</small></span>
          <span className="distance-thread" aria-hidden="true"><svg viewBox="0 0 300 30" preserveAspectRatio="none"><path d="M0 15H138M162 15H300" /></svg><span><PlaneIcon /></span></span>
          <span className="piece-route">{souvenirs.farthest.flight.from}<i><ArrowIcon /></i>{landingAirport(souvenirs.farthest.flight)}</span>
          <span className="piece-flight"><FlightNumber flight={souvenirs.farthest.flight} /></span><span className="piece-foot">{"@i18n:ui.estimatedGreatCircleDistance@"}<span>{"@i18n:ui.viewFlight@"}</span></span>
        </button>}
      </div>
      <div className="flight-facts">{[
        { code: 'PREFERRED CARRIER', kind: 'carrier', model: souvenirs.topAirline?.name === '中国东方航空' ? { aircraft: 'Boeing 777-300', airline: 'CES' } : souvenirs.topAirlineFlight, label: "@i18n:ui.mostFrequentAirline@", value: souvenirs.topAirline?.name, count: souvenirs.topAirline?.count, unit: "@i18n:ui.flights2@", note: i18nMessage('flights.airlineCount', souvenirs.airlineCount) },
        { code: 'FLEET FAVOURITE', kind: 'aircraft', model: { aircraft: souvenirs.topAircraft?.name === 'Airbus A321' ? 'Airbus A321neo LR' : souvenirs.topAircraft?.name }, label: "@i18n:ui.mostFrequentAircraft@", value: souvenirs.topAircraft?.name, count: souvenirs.topAircraft?.count, unit: "@i18n:ui.flights3@", note: "@i18n:ui.basedOnRecordedAircraft@" },
        { code: 'FAMILIAR TAIL', kind: 'tail', model: souvenirs.topRegistrationFlight, label: "@i18n:ui.reunitedWithThisAircraft@", value: souvenirs.topRegistration?.name, count: souvenirs.topRegistration?.count, unit: "@i18n:ui.encounters@", note: "@i18n:ui.basedOnRecordedRegistrations@" },
      ].filter(item => item.value).map(item => <article className={`fact-card fact-${item.kind}`} key={item.label}><header><span>{item.code}</span><i aria-hidden="true" className="fact-plane" /></header><span className="fact-label">{item.label}</span><h3 className={item.kind === 'carrier' ? 'fact-carrier-identity' : undefined}>{item.kind === 'carrier' && carrier ? <>
        <img className={carrier.icao === 'CES' ? 'carrier-wordmark' : 'carrier-mark'} src={airlineLogoURL(carrier.icao, true)} alt={item.value} />
        {alliance && <img className={`carrier-alliance alliance-${alliance.key}`} src={alliance.src} alt={alliance.name} />}
      </> : item.kind === 'aircraft' ? <AircraftLabel aircraft={item.value} /> : item.value}</h3>{item.kind === 'tail' && item.model?.aircraft && <span className="fact-tail-aircraft"><AircraftLabel aircraft={item.model.aircraft} /></span>}{item.model && <AircraftPortrait flight={item.model} />}<div className="fact-tally"><strong>{item.count}</strong><span>{item.unit}</span></div><footer><span>{item.note}</span><i className="fact-barcode" aria-hidden="true" /></footer></article>)}</div>
      <p className="souvenir-method">{"@i18n:ui.basedOnCompletedFlightsLongestFlightUsesEstimated@ "}</p>
    </section>}

</></Localized> }

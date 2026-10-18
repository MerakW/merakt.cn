'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
import { useSearchParams } from 'next/navigation'
import ArrowIcon from '@/components/ArrowIcon'

import { imageURL } from '@/lib/assets'
import AircraftLabel from './AircraftLabel'
import FlightSouvenirs from './FlightSouvenirs'
import AircraftPortrait from './AircraftPortrait'
import { flightTime, arrivalDelayMinutes } from '@/lib/flights/display-time'
import FlightNumber from './FlightNumber'
import TitleReveal from './TitleReveal'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Airport } from '@/lib/flights/types'
import type { publicFlight } from '@/lib/flights/public'
import RouteMap from './RouteMap'
import FlightArchive, { type FlightArchiveHandle } from './FlightArchive'
import FlightCounter from './FlightCounter'
import { flightSouvenirs } from '@/lib/flights/souvenirs'

export type DisplayFlight = ReturnType<typeof publicFlight>
const cityNames: Record<string, string> = {
  HGH: "@i18n:ui.hangzhouXiaoshan2@", HKG: "@i18n:ui.hongKong@", HND: "@i18n:ui.tokyoHaneda@", NRT: "@i18n:ui.tokyoNarita@", KIX: "@i18n:ui.osakaKansai@",
  SHA: "@i18n:ui.shanghaiHongqiao@", PVG: "@i18n:ui.shanghaiPudong@", PEK: "@i18n:ui.beijingCapital@", PKX: "@i18n:ui.beijingDaxing@", CAN: "@i18n:ui.guangzhouBaiyun@",
  TFU: "@i18n:ui.chengduTianfu@", CTU: "@i18n:ui.chengduShuangliu@", CKG: "@i18n:ui.chongqingJiangbei@", XIY: "@i18n:ui.xianXianyang@", SYX: "@i18n:ui.sanyaPhoenix@",
  NGB: "@i18n:ui.ningboLishe@", FOC: "@i18n:ui.fuzhouChangle@", HAK: "@i18n:ui.haikouMeilan@", HRB: "@i18n:ui.harbinTaiping@", CGQ: "@i18n:ui.changchunLongjia@",
  BKK: "@i18n:ui.bangkokSuvarnabhumi@", SIN: "@i18n:ui.singaporeChangi@", AKL: "@i18n:ui.auckland@", LHR: "@i18n:ui.londonHeathrow@", DOH: "@i18n:ui.dohaHamad@",
  CGK: "@i18n:ui.jakarta@", SGN: "@i18n:ui.hoChiMinhCity@", DAD: "@i18n:ui.daNang@", HKT: "@i18n:ui.phuket@", LHW: "@i18n:ui.lanzhouZhongchuan@",
  LYA: "@i18n:ui.luoyangBeijiao@", NBS: "@i18n:ui.changbaishan@", CGD: "@i18n:ui.changdeTaohuayuan@", SJW: "@i18n:ui.shijiazhuangZhengding@", WEH: "@i18n:ui.weihai@",
  WUH: "@i18n:ui.wuhanTianhe@", YNT: "@i18n:ui.yantaiPenglai@",
}

function dateLabel(date: string) { return date.replaceAll('-', '.') }

export default function FlightBoard({ flights, featured, airports, preview = false }: {
  flights: DisplayFlight[]
  featured: { kind: 'upcoming' | 'latest'; flight: DisplayFlight } | null
  airports: Airport[]
  preview?: boolean
}) {
  const archiveRef = useRef<FlightArchiveHandle>(null)
  const flightId=useSearchParams().get('flight')
  useEffect(()=>{if(flightId){const flight=flights.find(f=>String(f.id)===flightId);if(flight)archiveRef.current?.open(flight)}},[flights,flightId])
  const [overview, setOverview] = useState(false)
  const airportIndex = useMemo(() => new Map(airports.map(a => [a.iata, a])), [airports])
  const years = useMemo(() => Array.from(new Set(flights.filter(f => f.date).map(f => f.date.slice(0, 4)))).sort().reverse(), [flights])
  const completed = flights.filter(f => f.state === 'completed')
  const souvenirs = useMemo(() => flightSouvenirs(flights, airports), [flights, airports])
  const airportName = (code: string) => cityNames[code] || airportIndex.get(code)?.city || code
  const spotlight = featured?.flight
  const departure = spotlight && flightTime(spotlight, 'departure'), arrival = spotlight && flightTime(spotlight, 'arrival')
  const showFeatured = () => { if (spotlight) archiveRef.current?.open(spotlight) }

  return <Localized><div className="flight-page">

    <div className="flight-masthead">
      <div><p className="kicker">MERAK’S FLIGHT LOG <span>{"@i18n:flights.title@"}</span></p><h1><TitleReveal text="BETWEEN" /> <em><TitleReveal text="CITIES." /></em></h1></div>
      <div className="masthead-note"><p>{"@i18n:ui.myFlightLog@"}<br /><span>{years.length ? i18nMessage('flights.since', years.at(-1) || '') : "@i18n:ui.departuresAndArrivals@"}</span></p></div>
    </div>
    {spotlight ? <section className="flight-ticket" aria-labelledby="spotlight-heading">
      <div className="departure-board">
      <div className="departure-topline"><h2 id="spotlight-heading"><span className="signal-dot" />{featured.kind === 'upcoming' ? "@i18n:ui.nextDeparture@" : "@i18n:ui.latestArrival@"}</h2>{spotlight.dateHidden ? <span className="private-date">{dateLabel(spotlight.date)}</span> : <time dateTime={spotlight.date}>{dateLabel(spotlight.date)}</time>}</div>
      <div className="airport-pair">
        <div className="airport-heading"><strong>{spotlight.from}</strong><span>{airportName(spotlight.from)}</span></div>
        <div className="flight-thread flight-arc" aria-hidden="true"><svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMid meet"><path d="M10 76 Q150 -32 290 76" pathLength="1"/><circle cx="10" cy="76" r="3"/><circle cx="290" cy="76" r="3"/></svg><span className="aircraft-symbol" /></div>
        <div className="airport-heading arrival"><strong>{spotlight.to}</strong><span>{airportName(spotlight.to)}</span></div>
      </div>
      <div className="spotlight-aircraft"><AircraftPortrait flight={spotlight} animate /></div>
      <div className="departure-bottomline">
        <div><span>{departure?.label} {" @i18n:ui.local@"}</span><strong>{departure?.clock}</strong></div>
        <div><span>{arrival?.label} {" @i18n:ui.local@"}</span><strong className={arrivalDelayMinutes(spotlight) > 0 && arrival?.label === '实际到达' ? 'arrival-time-delayed' : undefined}>{arrival?.clock}{arrivalDelayMinutes(spotlight) > 0 && arrival?.label === '实际到达' && <small>（+{arrivalDelayMinutes(spotlight)}min）</small>}</strong></div>
        <span className="board-stamp">{featured.kind === 'upcoming' ? 'NEXT DEPARTURE' : 'LANDED & LOGGED'}<i aria-hidden="true"><ArrowIcon direction="up-right" /></i></span>
      </div>
      </div>
      <aside className="ticket-stub">
        <div className="stub-owner"><span>PERSONAL FLIGHT ARCHIVE</span><strong>MERAK.</strong><img src={imageURL('/identity/merak-avatar.webp')} alt="@i18n:ui.meraksBlueAndWhiteFoxCharacter@" width={768} height={768} /></div>
        <dl><div><dt>{"@i18n:ui.flight@"}</dt><dd><FlightNumber flight={spotlight} /></dd></div><div><dt>{"@i18n:ui.aircraft@"}</dt><dd><AircraftLabel aircraft={spotlight.aircraft} /></dd></div></dl>
        <button className="ticket-detail-button" onClick={showFeatured}>{"@i18n:ui.viewFlight@"}</button>
      </aside>
    </section> : <section className="departure-board empty-board"><p className="kicker">DEPARTURES / ARRIVALS</p><h2>{"@i18n:ui.noPublicFlightsYet@"}</h2><p>{"@i18n:ui.flightsWillAppearHereOnceTheyAreReady@"}</p></section>}

    <div className="flight-caption"><span>{"@i18n:ui.allTimesAreLocalToEachAirport@"}</span><span>{"@i18n:ui.personalRecordsNotLiveFlightInformation@"}</span></div>

    {souvenirs.count > 0 && <FlightCounter km={souvenirs.totalKm} flights={souvenirs.count} airports={souvenirs.airports.length} airlines={souvenirs.airlineCount} distanceCount={souvenirs.distanceCount} />}

    <FlightSouvenirs souvenirs={souvenirs} airportName={airportName} open={f => archiveRef.current?.open(f)} filterRoute={route => archiveRef.current?.filterRoute(route)} />

    <div className="route-atlas-toggle"><div><span className="atlas-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m3 7 8-3 10 3 8-3v21l-8 3-10-3-8 3Z M11 4v21 M21 7v21"/><path d="M7 19c5-12 10 4 18-7" strokeDasharray="2 2"/></svg></span><p>{"@i18n:ui.routeMap@"}<span>{completed.length} {" @i18n:ui.completedFlights@"}</span></p></div><button className="overview-button" aria-expanded={overview} aria-controls="flight-overview" onClick={() => setOverview(value => !value)}>{overview ? "@i18n:ui.hideRoutes@" : "@i18n:ui.showRoutes@"} <span aria-hidden="true">{overview ? '−' : '+'}</span></button></div>
    {overview && <section className="overview-panel" id="flight-overview" aria-label="@i18n:ui.allRoutes@">
      <div><h2>{"@i18n:ui.routeMap@"}</h2></div>
      <RouteMap flights={completed} airports={airports} overview />
    </section>}

    <FlightArchive ref={archiveRef} flights={flights} airports={airports} airportName={airportName} souvenirs={souvenirs} />
    <div className="flight-page-end">{years.length > 0 && <span>{"@i18n:ui.recordsBeginIn@ "}{years.at(-1)} {" @i18n:ui.message@"}</span>}<p className="flight-page-credit">{"@i18n:ui.aircraftIllustrationCredit@"}<a href="https://www.norebbo.com/" target="_blank" rel="noreferrer">Norebbo</a></p></div>
  </div></Localized>
}

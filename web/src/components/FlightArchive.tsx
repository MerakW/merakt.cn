'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import AircraftLabel from './AircraftLabel'
import FlightDetail from './FlightDetail'
import AutoLoadMore from './AutoLoadMore'
import FlightCollection from './FlightCollection'
import { matchesCollection, type CollectionFilter } from '@/lib/flights/collection'
import { arrivalDelayMinutes } from '@/lib/flights/display-time'

import { useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import type { Airport } from '@/lib/flights/types'
import { flightSouvenirs, landingAirport, routeKey } from '@/lib/flights/souvenirs'
import type { DisplayFlight } from './FlightBoard'
import FlightNumber from './FlightNumber'
import ArchiveTabs from './ArchiveTabs'
import ArchiveDisclosure from './ArchiveDisclosure'
import AircraftPortrait from './AircraftPortrait'

export type FlightArchiveHandle = { open: (flight: DisplayFlight) => void; filterRoute: (route: string) => void }
const labels = { completed: "@i18n:flightStatus.completed@", planned: "@i18n:flightStatus.planned@", cancelled: "@i18n:flightStatus.cancelled@", unconfirmed: "@i18n:flightStatus.unconfirmed@" }
const dateLabel = (date: string) => date.replaceAll('-', '.')
const batchSize = 12

export default function FlightArchive({ flights, airports, airportName, souvenirs, ref }: {
  flights: DisplayFlight[]; airports: Airport[]; airportName: (code: string) => string; ref: Ref<FlightArchiveHandle>
  souvenirs: ReturnType<typeof flightSouvenirs>
}) {
  const ordered = useMemo(() => [...flights].sort((a, b) => Number(b.dateHidden)-Number(a.dateHidden) || (b.departureUTC || b.date).localeCompare(a.departureUTC || a.date)), [flights])
  const years = [...new Set(ordered.filter(f => f.date).map(f => f.date.slice(0, 4)))]
  const [scope, setScope] = useState<'all' | 'planned' | 'history'>('all')
  const [year, setYear] = useState('all')
  const [airport, setAirport] = useState('all')
  const [collectionFilter,setCollectionFilter] = useState<CollectionFilter|null>(null)
  const [route, setRoute] = useState<string | null>(null)
  const [view, setView] = useState<'tags' | 'list'>('tags')
  const [limit, setLimit] = useState(batchSize)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [focusTarget, setFocusTarget] = useState<number | null>(null)
  const [allStamps, setAllStamps] = useState(false)
  const collection = useRef<HTMLElement>(null)
  const entries = ordered.map((flight, index) => ({ flight, index })).filter(({ flight: f }) => (scope === 'all' || (scope === 'planned' ? f.state === 'planned' : f.state !== 'planned')) && (year === 'all' || f.date.startsWith(year)) && (airport === 'all' || f.from === airport || landingAirport(f) === airport) && (!collectionFilter || matchesCollection(f,collectionFilter)) && (!route || (f.state === 'completed' && routeKey(f) === route)))
  const visible = entries.slice(0, limit)
  const resetPage = () => { setLimit(batchSize); setExpanded(null); setFocusTarget(null) }
  const resetFilters = () => { setScope('all'); setYear('all'); setAirport('all'); setRoute(null); setCollectionFilter(null); resetPage() }
  const open = (f: DisplayFlight) => {
    const index = ordered.findIndex(item => item === f || (f.id != null ? item.id === f.id : item.date === f.date && item.from === f.from && item.to === f.to && item.flightNumber === f.flightNumber && item.departureUTC === f.departureUTC))
    if (index < 0) return
    setScope('all'); setYear('all'); setAirport('all'); setRoute(null); setCollectionFilter(null); setLimit(Math.ceil((index + 1) / batchSize) * batchSize); setExpanded(index); setFocusTarget(index)
  }
  useImperativeHandle(ref, () => ({ open, filterRoute: key => { setCollectionFilter(null); setYear('all'); setAirport('all'); setScope('history'); setRoute(key); resetPage(); collection.current?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'}) } }))
  useEffect(() => {
    if (focusTarget === null) return
    const item = document.getElementById(`archive-flight-${focusTarget}`)
    item?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
    item?.querySelector('button')?.focus({ preventScroll: true })
    setFocusTarget(null)
  }, [focusTarget])
  useLayoutEffect(() => {
    const pending = collection.current?.querySelectorAll<HTMLElement>('.baggage-entry:not([data-revealed])')
    if (!pending || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const element = entry.target as HTMLElement
        delete element.dataset.awaiting
        element.dataset.revealed = 'true'
        observer.unobserve(element)
      }
    }, { threshold: .08 })
    pending.forEach(element => { element.dataset.awaiting = 'true'; observer.observe(element) })
    return () => observer.disconnect()
  }, [view, scope, year, airport, route, limit])
  const selectAirport = (code: string) => { setScope('history'); setAirport(airport === code ? 'all' : code); setYear('all'); setRoute(null); setCollectionFilter(null); resetPage() }

  return <Localized><>
    <FlightCollection flights={flights} selected={collectionFilter} onSelect={filter=>{setCollectionFilter(filter);setScope('history');setYear('all');setAirport('all');setRoute(null);resetPage();collection.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}}>
    {souvenirs.airports.length > 0 && <section className="airport-stampbook" aria-labelledby="stamp-heading">
      <div className="stampbook-heading"><div><p className="kicker">AIRPORTS</p><h2 id="stamp-heading">{"@i18n:ui.airportsVisited@"}</h2></div><p>{souvenirs.airports.length} {" @i18n:ui.airports@ "}<span>{"@i18n:ui.selectAnAirportToFilterFlights@"}</span></p></div>
      <div className="airport-stamps">{(allStamps ? souvenirs.airports : souvenirs.airports.slice(0, 10)).map(({ code, count, firstDate }, index) => <button key={code} className={`airport-stamp stamp-${index % 3}`} aria-pressed={airport === code} aria-label={i18nMessage('ui.filterFlightsForValue0Value1', airportName(code), code)} onClick={() => selectAirport(code)}><span className="stamp-ink"><span className="stamp-city">{airportName(code)}</span><strong>{code}</strong><span className="stamp-date">{dateLabel(firstDate)}</span><small>{"@i18n:ui.firstVisit@"}</small></span><span className="stamp-count">{count} {" @i18n:ui.departuresArrivals@"}</span></button>)}</div>
      {souvenirs.airports.length > 10 && <button className="stamp-more" aria-expanded={allStamps} onClick={() => setAllStamps(value => !value)}>{allStamps ? "@i18n:ui.showFewerStamps@" : i18nMessage('ui.value0MoreAirports', souvenirs.airports.length - 10)} <span aria-hidden="true">{allStamps ? '−' : '+'}</span></button>}
    </section>}

    </FlightCollection>
    <section ref={collection} className={`archive-section archive-${view}`} aria-labelledby="archive-heading">
      <div className="archive-heading"><div><p className="kicker">FLIGHT ARCHIVE</p><h2 id="archive-heading">{"@i18n:ui.flightArchive@"}</h2></div><div className="archive-controls"><ArchiveTabs className="archive-view" label="@i18n:ui.archiveDisplay@" value={view} options={[{value:'tags',label:"@i18n:ui.ticketStubs@"},{value:'list',label:"@i18n:ui.list@"}]} onChange={setView} /><label className="year-filter"><span>{"@i18n:ui.year@"}</span><select aria-label="@i18n:ui.year@" value={year} onChange={e => { setYear(e.target.value); resetPage() }}><option value="all">{"@i18n:ui.allYears@"}</option>{years.map(y => <option key={y}>{y}</option>)}</select></label></div></div>
      <ArchiveTabs className="archive-scope" label="@i18n:ui.flightCategory@" value={scope} options={(['all','planned','history'] as const).map(value=>({value,label:<>{({all:"@i18n:common.all@",planned:"@i18n:ui.upcoming@",history:"@i18n:ui.pastFlights@"})[value]}<small>{flights.filter(f=>value==='all'||(value==='planned'?f.state==='planned':f.state!=='planned')).length}</small></>}))} onChange={value=>{setScope(value);resetPage()}} />
      <div className="archive-filter-summary"><p role="status">{collectionFilter ? `${collectionFilter.label} · ` : ''}{airport !== 'all' ? `${airportName(airport)} · ` : ''}{route ? i18nMessage('ui.value0Completed', route) : ''}{year !== 'all' ? `${year} · ` : ''}{entries.length} {" @i18n:ui.records2@ "}<span>{"@i18n:ui.latestDeparturesFirst@"}</span></p>{(airport !== 'all' || route || year !== 'all' || collectionFilter) && <button onClick={resetFilters}>{"@i18n:ui.clearFilters@"}</button>}</div>
      <ol key={`${view}-${scope}-${year}-${airport}-${route}`} className="baggage-tags">{visible.map(({ flight: f, index }, position) => {
        const isOpen = expanded === index
        const delayMinutes = arrivalDelayMinutes(f)
        const delayed = delayMinutes >= 10
        return <li id={`archive-flight-${index}`} key={index} style={{animationDelay:`${Math.min(position % batchSize * 28, 180)}ms`}} className={`baggage-entry${isOpen ? ' is-open' : ''}`}>
          <button className={`baggage-tag tag-${index % 3}${isOpen ? '' : ' ticket-face'}`} aria-expanded={isOpen} aria-controls={`archive-detail-${index}`} aria-label={i18nMessage('ui.value0Value1ToValue2Value3Flight', f.date, airportName(f.from), airportName(landingAirport(f)), isOpen ? "@i18n:ui.collapse@" : "@i18n:ui.expand@")} onClick={() => setExpanded(isOpen ? null : index)}>
            <span className="tag-top">{f.dateHidden ? <span className="private-date">{dateLabel(f.date)}</span> : <time dateTime={f.date}>{dateLabel(f.date)}</time>}<span className={`state-label ${f.state}${delayed ? ' arrival-delayed' : ''}`}>{labels[f.state]}{f.divertedTo && <em className="diversion-label">{"@i18n:ui.diverted@"}</em>}</span></span>
            <span className="tag-route"><span><strong>{f.from}</strong><small>{airportName(f.from)}</small></span><i aria-hidden="true"><ArrowIcon /></i><span><strong>{landingAirport(f)}</strong><small>{airportName(landingAirport(f))}</small></span></span>
            <AircraftPortrait flight={f} />
            <span className="tag-bottom"><span><FlightNumber flight={f} />{!isOpen && <small><AircraftLabel aircraft={f.aircraft} /></small>}</span><span className="tag-open" aria-hidden="true">{isOpen ? "@i18n:ui.collapse@" : "@i18n:ui.details@"}</span></span>
            <span className="tag-perforation" aria-hidden="true" />
          </button>
          <ArchiveDisclosure open={isOpen}><FlightDetail flight={f} airports={airports} airportName={airportName} id={`archive-detail-${index}`} animate={isOpen} /></ArchiveDisclosure>
        </li>
      })}</ol>
      {entries.length === 0 && <p className="empty-list">{"@i18n:ui.noMatchingFlightsTryADifferentYearOr@"}</p>}
      <AutoLoadMore visible={visible.length} total={entries.length} onLoad={() => setLimit(value => Math.min(value + batchSize, entries.length))} />
    </section>
  </></Localized>
}

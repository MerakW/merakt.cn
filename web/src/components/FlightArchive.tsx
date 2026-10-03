'use client'
import AircraftLabel from './AircraftLabel'
import FlightCollection from './FlightCollection'
import { matchesCollection, type CollectionFilter } from '@/lib/flights/collection'
import { flightTime, arrivalDelayMinutes } from '@/lib/flights/display-time'

import { useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import type { Airport } from '@/lib/flights/types'
import { flightSouvenirs, landingAirport, routeKey } from '@/lib/flights/souvenirs'
import type { DisplayFlight } from './FlightBoard'
import FlightNumber from './FlightNumber'
import { flightIdentity } from '@/lib/flights/airlines'
import ArchiveTabs from './ArchiveTabs'
import ArchiveDisclosure from './ArchiveDisclosure'
import RouteMap from './RouteMap'
import AircraftPortrait from './AircraftPortrait'

export type FlightArchiveHandle = { open: (flight: DisplayFlight) => void; filterRoute: (route: string) => void }
const labels = { completed: '已完成', planned: '计划中', cancelled: '已取消', unconfirmed: '待确认' }
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

  return <>
    <FlightCollection flights={flights} selected={collectionFilter} onSelect={filter=>{setCollectionFilter(filter);setScope('history');setYear('all');setAirport('all');setRoute(null);resetPage();collection.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}}>
    {souvenirs.airports.length > 0 && <section className="airport-stampbook" aria-labelledby="stamp-heading">
      <div className="stampbook-heading"><div><p className="kicker">AIRPORTS</p><h2 id="stamp-heading">去过的机场</h2></div><p>{souvenirs.airports.length} 座机场 <span>点击机场筛选航程</span></p></div>
      <div className="airport-stamps">{(allStamps ? souvenirs.airports : souvenirs.airports.slice(0, 10)).map(({ code, count, firstDate }, index) => <button key={code} className={`airport-stamp stamp-${index % 3}`} aria-pressed={airport === code} aria-label={`筛选 ${airportName(code)} ${code} 的航程`} onClick={() => selectAirport(code)}><span className="stamp-ink"><span className="stamp-city">{airportName(code)}</span><strong>{code}</strong><span className="stamp-date">{dateLabel(firstDate)}</span><small>首次到访</small></span><span className="stamp-count">{count} 次起降</span></button>)}</div>
      {souvenirs.airports.length > 10 && <button className="stamp-more" aria-expanded={allStamps} onClick={() => setAllStamps(value => !value)}>{allStamps ? '收起印章' : `还有 ${souvenirs.airports.length - 10} 座机场`} <span aria-hidden="true">{allStamps ? '−' : '+'}</span></button>}
    </section>}

    </FlightCollection>
    <section ref={collection} className={`archive-section archive-${view}`} aria-labelledby="archive-heading">
      <div className="archive-heading"><div><p className="kicker">FLIGHT ARCHIVE</p><h2 id="archive-heading">航程记录</h2></div><div className="archive-controls"><ArchiveTabs className="archive-view" label="记录显示方式" value={view} options={[{value:'tags',label:'登机存根'},{value:'list',label:'列表'}]} onChange={setView} /><label className="year-filter"><span>年份</span><select aria-label="年份" value={year} onChange={e => { setYear(e.target.value); resetPage() }}><option value="all">全部年份</option>{years.map(y => <option key={y}>{y}</option>)}</select></label></div></div>
      <ArchiveTabs className="archive-scope" label="行程分类" value={scope} options={(['all','planned','history'] as const).map(value=>({value,label:<>{({all:'全部',planned:'待出行',history:'过往历史'})[value]}<small>{flights.filter(f=>value==='all'||(value==='planned'?f.state==='planned':f.state!=='planned')).length}</small></>}))} onChange={value=>{setScope(value);resetPage()}} />
      <div className="archive-filter-summary"><p role="status">{collectionFilter ? `${collectionFilter.label} · ` : ''}{airport !== 'all' ? `${airportName(airport)} · ` : ''}{route ? `${route} · 已完成 · ` : ''}{year !== 'all' ? `${year} · ` : ''}{entries.length} 条记录 <span>按出发日期倒序</span></p>{(airport !== 'all' || route || year !== 'all' || collectionFilter) && <button onClick={resetFilters}>清除筛选 ×</button>}</div>
      <ol key={`${view}-${scope}-${year}-${airport}-${route}`} className="baggage-tags">{visible.map(({ flight: f, index }, position) => {
        const isOpen = expanded === index
        const delayMinutes = arrivalDelayMinutes(f)
        const delayed = delayMinutes >= 10
        const departure = flightTime(f, 'departure'), arrival = flightTime(f, 'arrival')
        return <li id={`archive-flight-${index}`} key={index} style={{animationDelay:`${Math.min(position % batchSize * 28, 180)}ms`}} className={`baggage-entry${isOpen ? ' is-open' : ''}`}>
          <button className={`baggage-tag tag-${index % 3}${isOpen ? '' : ' ticket-face'}`} aria-expanded={isOpen} aria-controls={`archive-detail-${index}`} aria-label={`${f.date} ${airportName(f.from)}至${airportName(landingAirport(f))} ${isOpen ? '收起' : '展开'}航程`} onClick={() => setExpanded(isOpen ? null : index)}>
            <span className="tag-top">{f.dateHidden ? <span className="private-date">{dateLabel(f.date)}</span> : <time dateTime={f.date}>{dateLabel(f.date)}</time>}<span className={`state-label ${f.state}${delayed ? ' arrival-delayed' : ''}`}>{labels[f.state]}{f.divertedTo && <em className="diversion-label">备降</em>}</span></span>
            <span className="tag-route"><span><strong>{f.from}</strong><small>{airportName(f.from)}</small></span><i aria-hidden="true">→</i><span><strong>{landingAirport(f)}</strong><small>{airportName(landingAirport(f))}</small></span></span>
            <AircraftPortrait flight={f} />
            <span className="tag-bottom"><span><FlightNumber flight={f} />{!isOpen && <small><AircraftLabel aircraft={f.aircraft} /></small>}</span><span className="tag-open" aria-hidden="true">{isOpen ? '收起' : '详情'}</span></span>
            <span className="tag-perforation" aria-hidden="true" />
          </button>
          <ArchiveDisclosure open={isOpen}><div className="flight-detail archive-detail" id={`archive-detail-${index}`}><AircraftPortrait flight={f} detailed /><div className="detail-copy"><p className="kicker"><FlightNumber flight={f} /></p><h3>{airportName(f.from)} → {airportName(landingAirport(f))}</h3><dl><div><dt>{departure.label}</dt><dd>{f.dateHidden ? `${dateLabel(f.date)} ${f.departureClock || '时刻未记录'}` : departure.local?.replace('T', ' ') || f.date}<small>{f.departureTimeZone}</small></dd></div><div><dt>{arrival.label}</dt><dd><span className={delayMinutes > 0 && arrival.label === '实际到达' ? 'arrival-time-delayed' : undefined}>{f.dateHidden ? `${dateLabel(f.date)} ${f.arrivalClock || '时刻未记录'}` : arrival.local?.replace('T', ' ') || '未记录'}{delayMinutes > 0 && arrival.label === '实际到达' && `（+${delayMinutes}min）`}</span><small>{f.arrivalTimeZone}</small></dd></div>{flightIdentity(f).icao && <div><dt>呼号 / ICAO</dt><dd>{flightIdentity(f).icao}</dd></div>}{f.registration && <div><dt>飞机注册号</dt><dd>{f.registration}</dd></div>}{f.divertedTo && <div><dt>原定目的地</dt><dd>{airportName(f.to)} / {f.to}</dd></div>}</dl>{f.note && <p>{f.note}</p>}</div><RouteMap flights={[f]} airports={airports} /></div></ArchiveDisclosure>
        </li>
      })}</ol>
      {entries.length === 0 && <p className="empty-list">没有符合条件的航程。试试其他年份或机场。</p>}
      <div className="archive-pagination"><span>{visible.length} / {entries.length} 条</span>{visible.length < entries.length && <button onClick={() => { setLimit(value => value + batchSize); setFocusTarget(entries[limit]?.index ?? null) }}>再看 {Math.min(batchSize, entries.length - visible.length)} 条</button>}{visible.length >= entries.length && entries.length > 0 && <span>已显示全部记录</span>}</div>
    </section>
  </>
}

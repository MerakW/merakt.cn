'use client'
import AircraftLabel from './AircraftLabel'
import FlightSouvenirs from './FlightSouvenirs'
import AircraftPortrait from './AircraftPortrait'
import { flightTime, arrivalDelayMinutes } from '@/lib/flights/display-time'
import FlightNumber from './FlightNumber'
import TitleReveal from './TitleReveal'

import { useMemo, useRef, useState } from 'react'
import type { Airport } from '@/lib/flights/types'
import type { publicFlight } from '@/lib/flights/public'
import RouteMap from './RouteMap'
import FlightArchive, { type FlightArchiveHandle } from './FlightArchive'
import FlightCounter from './FlightCounter'
import { flightSouvenirs } from '@/lib/flights/souvenirs'

export type DisplayFlight = ReturnType<typeof publicFlight>
const cityNames: Record<string, string> = {
  HGH: '杭州萧山', HKG: '香港', HND: '东京羽田', NRT: '东京成田', KIX: '大阪关西',
  SHA: '上海虹桥', PVG: '上海浦东', PEK: '北京首都', PKX: '北京大兴', CAN: '广州白云',
  TFU: '成都天府', CTU: '成都双流', CKG: '重庆江北', XIY: '西安咸阳', SYX: '三亚凤凰',
  NGB: '宁波栎社', FOC: '福州长乐', HAK: '海口美兰', HRB: '哈尔滨太平', CGQ: '长春龙嘉',
  BKK: '曼谷素万那普', SIN: '新加坡樟宜', AKL: '奥克兰', LHR: '伦敦希思罗', DOH: '多哈哈马德',
  CGK: '雅加达', SGN: '胡志明市', DAD: '岘港', HKT: '普吉', LHW: '兰州中川',
  LYA: '洛阳北郊', NBS: '长白山', CGD: '常德桃花源', SJW: '石家庄正定', WEH: '威海',
  WUH: '武汉天河', YNT: '烟台蓬莱',
}

function dateLabel(date: string) { return date.replaceAll('-', '.') }

export default function FlightBoard({ flights, featured, airports, preview = false }: {
  flights: DisplayFlight[]
  featured: { kind: 'upcoming' | 'latest'; flight: DisplayFlight } | null
  airports: Airport[]
  preview?: boolean
}) {
  const archiveRef = useRef<FlightArchiveHandle>(null)
  const [overview, setOverview] = useState(false)
  const airportIndex = useMemo(() => new Map(airports.map(a => [a.iata, a])), [airports])
  const years = useMemo(() => Array.from(new Set(flights.filter(f => f.date).map(f => f.date.slice(0, 4)))).sort().reverse(), [flights])
  const completed = flights.filter(f => f.state === 'completed')
  const souvenirs = useMemo(() => flightSouvenirs(flights, airports), [flights, airports])
  const airportName = (code: string) => cityNames[code] || airportIndex.get(code)?.city || code
  const spotlight = featured?.flight
  const departure = spotlight && flightTime(spotlight, 'departure'), arrival = spotlight && flightTime(spotlight, 'arrival')
  const showFeatured = () => { if (spotlight) archiveRef.current?.open(spotlight) }

  return <div className="flight-page">

    <div className="flight-masthead">
      <div><p className="kicker">MERAK’S FLIGHT LOG <span>飞行记录</span></p><h1><TitleReveal text="BETWEEN" /> <em><TitleReveal text="CITIES." /></em></h1></div>
      <div className="masthead-note"><p>我的飞行记录<br /><span>{years.length ? `从 ${years.at(-1)} 年到现在` : "出发与抵达"}</span></p></div>
    </div>
    {spotlight ? <section className="flight-ticket" aria-labelledby="spotlight-heading">
      <div className="departure-board">
      <div className="departure-topline"><h2 id="spotlight-heading"><span className="signal-dot" />{featured.kind === 'upcoming' ? '下一次出发' : '最近一次抵达'}</h2>{spotlight.dateHidden ? <span className="private-date">{dateLabel(spotlight.date)}</span> : <time dateTime={spotlight.date}>{dateLabel(spotlight.date)}</time>}</div>
      <div className="airport-pair">
        <div className="airport-heading"><strong>{spotlight.from}</strong><span>{airportName(spotlight.from)}</span></div>
        <div className="flight-thread flight-arc" aria-hidden="true"><svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMid meet"><path d="M10 76 Q150 -32 290 76" pathLength="1"/><circle cx="10" cy="76" r="3"/><circle cx="290" cy="76" r="3"/></svg><span className="aircraft-symbol" /></div>
        <div className="airport-heading arrival"><strong>{spotlight.to}</strong><span>{airportName(spotlight.to)}</span></div>
      </div>
      <div className="spotlight-aircraft"><AircraftPortrait flight={spotlight} /></div>
      <div className="departure-bottomline">
        <div><span>{departure?.label} · 当地</span><strong>{departure?.clock}</strong></div>
        <div><span>{arrival?.label} · 当地</span><strong className={arrivalDelayMinutes(spotlight) > 0 && arrival?.label === '实际到达' ? 'arrival-time-delayed' : undefined}>{arrival?.clock}{arrivalDelayMinutes(spotlight) > 0 && arrival?.label === '实际到达' && <small>（+{arrivalDelayMinutes(spotlight)}min）</small>}</strong></div>
        <span className="board-stamp">{featured.kind === 'upcoming' ? 'NEXT DEPARTURE' : 'LANDED & LOGGED'}<i aria-hidden="true">↗</i></span>
      </div>
      </div>
      <aside className="ticket-stub">
        <div className="stub-owner"><span>PERSONAL FLIGHT ARCHIVE</span><strong>MERAK.</strong><img src="/identity/merak-avatar.webp" alt="Merak 的蓝白狐狸角色" width={768} height={768} /></div>
        <dl><div><dt>航班 / FLIGHT</dt><dd><FlightNumber flight={spotlight} /></dd></div><div><dt>乘坐机型 / AIRCRAFT</dt><dd><AircraftLabel aircraft={spotlight.aircraft} /></dd></div></dl>
        <button className="ticket-detail-button" onClick={showFeatured}>查看航程</button>
      </aside>
    </section> : <section className="departure-board empty-board"><p className="kicker">DEPARTURES / ARRIVALS</p><h2>暂无公开航程</h2><p>飞行记录整理好后会放在这里。</p></section>}

    <div className="flight-caption"><span>时间均为机场当地时间</span><span>个人记录 · 非实时航班信息</span></div>

    {souvenirs.count > 0 && <FlightCounter km={souvenirs.totalKm} flights={souvenirs.count} airports={souvenirs.airports.length} airlines={souvenirs.airlineCount} distanceCount={souvenirs.distanceCount} />}

    <FlightSouvenirs souvenirs={souvenirs} airportName={airportName} open={f => archiveRef.current?.open(f)} filterRoute={route => archiveRef.current?.filterRoute(route)} />

    <div className="route-atlas-toggle"><div><span className="atlas-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m3 7 8-3 10 3 8-3v21l-8 3-10-3-8 3Z M11 4v21 M21 7v21"/><path d="M7 19c5-12 10 4 18-7" strokeDasharray="2 2"/></svg></span><p>航线地图<span>{completed.length} 段已完成的飞行</span></p></div><button className="overview-button" aria-expanded={overview} aria-controls="flight-overview" onClick={() => setOverview(value => !value)}>{overview ? '收起航线' : '查看航线'} <span aria-hidden="true">{overview ? '−' : '+'}</span></button></div>
    {overview && <section className="overview-panel" id="flight-overview" aria-label="全部航线总览">
      <div><h2>航线地图</h2><p>连线为起终点示意</p></div>
      <RouteMap flights={completed} airports={airports} overview />
    </section>}

    <FlightArchive ref={archiveRef} flights={flights} airports={airports} airportName={airportName} souvenirs={souvenirs} />
    <div className="flight-page-end">{years.length > 0 && <span>记录始于 {years.at(-1)} 年。</span>}<p className="flight-page-credit">机型图 Credit：<a href="https://www.norebbo.com/" target="_blank" rel="noreferrer">Norebbo</a></p></div>
  </div>
}

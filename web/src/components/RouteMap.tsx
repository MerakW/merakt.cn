'use client'

import { useMemo, useState, useId } from 'react'
import { geoMercator, geoNaturalEarth1, geoPath, geoInterpolate } from 'd3-geo'
import type { FeatureCollection, Geometry, LineString } from 'geojson'
import type { Airport } from '@/lib/flights/types'
import type { DisplayFlight } from './FlightBoard'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import landTopology from 'world-atlas/land-110m.json'

const land = feature(landTopology as unknown as Topology, landTopology.objects.land as never)

export default function RouteMap({ flights, airports, overview = false }: { flights: DisplayFlight[]; airports: Airport[]; overview?: boolean }) {
  const [focus, setFocus] = useState('')
  const gridId = useId().replaceAll(':', '')
  const hubs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of flights) for (const code of [f.from, f.divertedTo || f.to]) counts.set(code, (counts.get(code) || 0) + 1)
    return [...counts].sort((a,b) => b[1]-a[1])
  }, [flights])
  const choices = ['HGH', 'PKX', 'PVG']
  const selected = focus || 'HGH'
  const visibleFlights = useMemo(() => !overview || selected === '*' ? flights : flights.filter(f => f.from === selected || (f.divertedTo || f.to) === selected), [flights, overview, selected])
  const geometry = useMemo(() => {
    const map = new Map(airports.map(a => [a.iata, a]))
    const used = new Map<string, Airport>()
    const lines: LineString[] = []
    const seen = new Set<string>()
    for (const flight of visibleFlights) {
      const from = map.get(flight.from), to = map.get(flight.divertedTo || flight.to)
      if (!from || !to || from.iata === to.iata) continue
      const key = [from.iata, to.iata].sort().join('-')
      if (seen.has(key)) continue
      seen.add(key)
      used.set(from.iata, from); used.set(to.iata, to)
      const interpolate = geoInterpolate([from.longitude, from.latitude], [to.longitude, to.latitude])
      lines.push({ type: 'LineString', coordinates: Array.from({ length: 33 }, (_, i) => interpolate(i / 32)) })
    }
    if (!lines.length) return { landPath: null, paths: [], points: [] }
    const features: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: lines.map(line => ({ type: 'Feature', properties: {}, geometry: line })) }
    const projection = overview ? geoNaturalEarth1().rotate([-80, 0]).fitExtent([[45, 40], [755, 350]], features) : geoMercator().fitExtent([[75, 75], [525, 245]], features)
    // Cap close-route zoom so a short flight still reads as a map.
    if (!overview && projection.scale() > 5000) {
      projection.scale(5000)
      const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(features)
      const [tx, ty] = projection.translate()
      projection.translate([tx + 300 - (x0 + x1) / 2, ty + 160 - (y0 + y1) / 2])
    }
    const path = geoPath(projection)
    const labels: [number, number][] = []
    const points = [...used.values()].sort((a,b) => (a.iata === selected ? -1 : b.iata === selected ? 1 : (hubs.find(h=>h[0]===b.iata)?.[1]||0) - (hubs.find(h=>h[0]===a.iata)?.[1]||0))).flatMap(airport => {
      const point = projection([airport.longitude, airport.latitude])
      if (!point) return []
      const labelVisible = !overview || (labels.length < (selected === '*' ? 6 : 9) && !labels.some(([x, y]) => Math.abs(x - point[0]) < 65 && Math.abs(y - point[1]) < 23))
      if (labelVisible) labels.push(point)
      return [{ airport, point, labelVisible }]
    })
    return { landPath: path(land), paths: lines.map(line => path(line)), points }
  }, [visibleFlights, airports, overview, selected, hubs])

  if (geometry.paths.length === 0 && !overview) return <div className="route-map">机场位置尚未整理。</div>
  return <div className="route-map-panel">{overview && <div className="map-toolbar"><div className="map-airport-tabs" role="group" aria-label="从机场看航线">{[...choices, '*'].map(code => <button type="button" key={code} aria-pressed={selected === code} onClick={() => setFocus(code)}>{code === '*' ? '全部' : code}</button>)}</div><span>{geometry.paths.length} 条航线 · 往返合并</span></div>}<div className={`route-map ${overview ? 'overview-map' : ''}`}>
    {overview && !geometry.paths.length && <p className="map-hint" style={{ padding: 20 }}>这座机场暂时没有可显示的航线，可以选择其他机场。</p>}
    <svg viewBox={overview ? '0 0 800 390' : '0 0 600 320'} role="img" aria-label={overview ? '个人航线示意图' : `${flights[0].from} 至 ${flights[0].divertedTo || flights[0].to} 的起终点示意图`}>
      <defs><pattern id={gridId} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".15" /></pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${gridId})`} />
      {geometry.landPath && <path d={geometry.landPath} fill="var(--map-land, #dae5ea)" stroke="var(--map-coast, #b6c9d3)" strokeWidth=".5" />}
      {geometry.paths.map((d, i) => d && <path key={`${selected}-${i}`} d={d} pathLength={1} style={{animationDelay: `${Math.min(i * 35, 600)}ms`}} className="map-route-line" fill="none" opacity={overview ? selected === '*' ? .16 : .55 : 1} />)}
      {geometry.points.map(({ airport, point, labelVisible }, i) => <g key={airport.iata} transform={`translate(${point[0]},${point[1]})`}><title>{airport.iata} · {airport.name}</title><circle className="map-airport-pulse" r={overview ? 6 : 10} /><circle r={overview ? 2.5 : 5} className="map-airport" />{labelVisible && <text x={overview ? 6 : i === 0 ? -10 : 10} y={overview ? -6 : -14} textAnchor={!overview && i === 0 ? 'end' : 'start'}>{airport.iata}</text>}</g>)}
    </svg>
    <span className="map-caption">{overview ? selected === '*' ? 'ALL ROUTES' : `${selected} / ROUTES` : 'ROUTE STUDY'} <span>起终点示意</span></span>
  </div>{overview && <p className="map-hint">一些出发，一些归来。点选机场，看看沿途去过哪里。</p>}</div>
}

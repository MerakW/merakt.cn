'use client'

import { useMemo, useState, useId, useEffect, useRef } from 'react'
import { geoMercator, geoNaturalEarth1, geoPath, geoInterpolate } from 'd3-geo'
import type { FeatureCollection, Geometry, LineString } from 'geojson'
import type { Airport } from '@/lib/flights/types'
import type { DisplayFlight } from './FlightBoard'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import landTopology from 'world-atlas/land-110m.json'

const land = feature(landTopology as unknown as Topology, landTopology.objects.land as never)
type Camera = [number, number, number, number]
const worldCamera: Camera = [0, 0, 800, 390]
const routeKey = (from: string, to: string) => [from, to].sort().join('-')

export default function RouteMap({ flights, airports, overview = false }: { flights: DisplayFlight[]; airports: Airport[]; overview?: boolean }) {
  const [focus, setFocus] = useState('')
  const gridId = useId().replaceAll(':', '')
  const selected = focus || 'HGH'
  const hubs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of flights) for (const code of [f.from, f.divertedTo || f.to]) counts.set(code, (counts.get(code) || 0) + 1)
    return counts
  }, [flights])
  const visibleFlights = useMemo(() => !overview || selected === '*' ? flights : flights.filter(f => f.from === selected || (f.divertedTo || f.to) === selected), [flights, overview, selected])
  const geometry = useMemo(() => {
    const map = new Map(airports.map(a => [a.iata, a]))
    const used = new Map<string, Airport>()
    const lines: { key: string; line: LineString; active: boolean }[] = []
    const seen = new Set<string>()
    const visible = new Set(visibleFlights.map(f => routeKey(f.from, f.divertedTo || f.to)))
    const activeAirports = new Set(visibleFlights.flatMap(f => [f.from, f.divertedTo || f.to]))
    for (const flight of flights) {
      const from = map.get(flight.from), to = map.get(flight.divertedTo || flight.to)
      if (!from || !to || from.iata === to.iata) continue
      const key = routeKey(from.iata, to.iata)
      if (seen.has(key)) continue
      seen.add(key); used.set(from.iata, from); used.set(to.iata, to)
      const interpolate = geoInterpolate([from.longitude, from.latitude], [to.longitude, to.latitude])
      lines.push({ key, active: visible.has(key), line: { type: 'LineString', coordinates: Array.from({ length: 33 }, (_, i) => interpolate(i / 32)) } })
    }
    const features: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: lines.filter(l => l.active).map(({ line }) => ({ type: 'Feature', properties: {}, geometry: line })) }
    // ponytail: a fixed world projection lets the camera move without morphing every route.
    const projection = overview ? geoNaturalEarth1().rotate([-80, 0]).fitExtent([[8, 8], [792, 382]], land) : geoMercator()
    if (!overview && features.features.length) projection.fitExtent([[75, 75], [525, 245]], features)
    if (!overview && projection.scale() > 5000 && features.features.length) {
      projection.scale(5000)
      const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(features)
      const [tx, ty] = projection.translate()
      projection.translate([tx + 300 - (x0 + x1) / 2, ty + 160 - (y0 + y1) / 2])
    }
    const path = geoPath(projection)
    let target: Camera = overview ? worldCamera : [0, 0, 600, 320]
    if (overview && selected !== '*' && features.features.length) {
      const [[x0, y0], [x1, y1]] = path.bounds(features)
      const w = Math.max(150, x1 - x0 + 52, (y1 - y0 + 52) * 800 / 390)
      const h = w * 390 / 800
      target = [(x0 + x1 - w) / 2, (y0 + y1 - h) / 2, w, h]
    }
    const zoom = overview ? target[2] / 800 : 1
    const labels: [number, number][] = []
    const points = [...used.values()].sort((a,b) => (a.iata === selected ? -1 : b.iata === selected ? 1 : (hubs.get(b.iata) || 0) - (hubs.get(a.iata) || 0))).flatMap(airport => {
      const point = projection([airport.longitude, airport.latitude])
      if (!point) return []
      const active = activeAirports.has(airport.iata)
      const labelVisible = active && (!overview || (labels.length < (selected === '*' ? 6 : 9) && !labels.some(([x, y]) => Math.abs(x - point[0]) < 65 * zoom && Math.abs(y - point[1]) < 23 * zoom)))
      if (labelVisible) labels.push(point)
      return [{ airport, point, active, labelVisible }]
    })
    return { landPath: path(land), paths: lines.map(({ key, line, active }) => ({ key, d: path(line), active })), points, target }
  }, [flights, visibleFlights, airports, overview, selected, hubs])

  const [camera, setCamera] = useState<Camera>(() => geometry.target)
  const currentCamera = useRef(camera)
  useEffect(() => {
    const target = geometry.target
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const apply = (value: Camera) => { currentCamera.current = value; setCamera(value) }
    const instant = () => { cancelAnimationFrame(frame); apply(target) }
    if (!overview || reduced.matches || target.every((n, i) => Math.abs(n - currentCamera.current[i]) < .001)) instant()
    else {
      const from = [...currentCamera.current] as Camera, start = performance.now()
      const tick = (time: number) => {
        const t = Math.min(1, (time - start) / 800)
        const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        apply(from.map((value, index) => value + (target[index] - value) * eased) as Camera)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    reduced.addEventListener('change', instant)
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener('change', instant) }
  }, [geometry.target, overview])
  const zoom = overview ? camera[2] / 800 : 1
  const count = geometry.paths.filter(p => p.active).length
  if (!count && !overview) return <div className="route-map">机场位置尚未整理。</div>
  return <div className="route-map-panel">{overview && <div className="map-toolbar"><div className="map-airport-tabs" role="group" aria-label="从机场看航线">{['HGH', 'PVG', 'PKX', '*'].map(code => <button type="button" key={code} aria-pressed={selected === code} onClick={() => setFocus(code)}>{code === '*' ? '全部' : code}</button>)}</div><span>{count} 条航线 · 往返合并</span></div>}<div className={`route-map ${overview ? 'overview-map' : ''}`}>
    {overview && !count && <p className="map-hint" style={{ padding: 20 }}>这座机场暂时没有可显示的航线，可以选择其他机场。</p>}
    <svg viewBox={camera.join(' ')} role="img" aria-label={overview ? '个人航线示意图' : `${flights[0].from} 至 ${flights[0].divertedTo || flights[0].to} 的起终点示意图`}>
      <defs><pattern id={gridId} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".15" /></pattern></defs>
      <rect x="-800" y="-390" width="2400" height="1170" fill={`url(#${gridId})`} />
      {geometry.landPath && <path d={geometry.landPath} fill="var(--map-land, #dae5ea)" stroke="var(--map-coast, #b6c9d3)" strokeWidth=".5" />}
      {geometry.paths.map(({ key, d, active }, i) => d && <path key={key} d={d} pathLength={1} style={{ animationDelay: `${Math.min(i * 35, 600)}ms`, opacity: active ? overview ? selected === '*' ? .25 : .65 : 1 : 0 }} className="map-route-line" fill="none" vectorEffect="non-scaling-stroke" />)}
      {geometry.points.map(({ airport, point, active, labelVisible }, i) => <g className="map-airport-point" key={airport.iata} transform={`translate(${point[0]},${point[1]})`} style={{ opacity: active ? 1 : 0 }}><title>{`${airport.iata} · ${airport.name}`}</title><circle className="map-airport-pulse" r={(overview ? 6 : 10) * zoom} /><circle r={(overview ? 2.5 : 5) * zoom} className="map-airport" /><text x={overview ? 6 * zoom : i === 0 ? -10 : 10} y={overview ? -6 * zoom : -14} textAnchor={!overview && i === 0 ? 'end' : 'start'} style={{ fontSize: `${12 * zoom}px`, strokeWidth: overview ? `${2.5 * zoom}px` : undefined, opacity: labelVisible ? 1 : 0 }}>{airport.iata}</text></g>)}
    </svg>
    <span className="map-caption">{overview ? selected === '*' ? 'ALL ROUTES' : `${selected} / ROUTES` : 'ROUTE STUDY'} <span>起终点示意</span></span>
  </div>{overview && <p className="map-hint">一些出发，一些归来。点选机场，看看沿途去过哪里。</p>}</div>
}

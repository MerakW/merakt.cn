'use client'

import AircraftLabel from './AircraftLabel'
import { useEffect, useRef, useState } from 'react'
import { aircraftModel, type FlightAircraft } from '@/lib/flights/aircraft'

export default function AircraftPortrait({ flight, detailed = false }: { flight: FlightAircraft; detailed?: boolean }) {
  const model = aircraftModel(flight)
  const root = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [model?.file])
  useEffect(() => {
    if (!root.current || !model) return
    let visible = false
    const update = () => setActive(visible && !document.hidden)
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update() }, { threshold: .25 })
    observer.observe(root.current)
    document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [detailed, model?.file])
  if (!model || failed) return null
  return <span ref={root} className={`aircraft-portrait ${detailed ? 'aircraft-detail' : 'aircraft-preview'}`} data-active={active}>
    {detailed && <><span className="aircraft-sky" aria-hidden="true"><span className="aircraft-stars" /><span className="aircraft-clouds" /><span className="aircraft-clouds aircraft-clouds-near" /></span><span className="aircraft-heading"><span><small>AIRCRAFT</small><strong><AircraftLabel aircraft={flight.aircraft} light /></strong></span><span className="aircraft-registration">{flight.registration || ''}</span></span></>}
    <span className="aircraft-window"><span className="aircraft-canvas">
      <img src={model.file} width="1600" height="800" loading="lazy" decoding="async" alt={detailed ? `${flight.aircraft} · ${model.livery}${model.family ? ' · 近似机型示意' : ''}` : ''} onError={() => setFailed(true)} />
    </span></span>
  </span>
}

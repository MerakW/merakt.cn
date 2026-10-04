'use client'

import { imageURL } from '@/lib/assets'

import AircraftLabel from './AircraftLabel'
import AircraftLights from './AircraftLights'
import { useEffect, useRef, useState } from 'react'
import { aircraftModel, type FlightAircraft } from '@/lib/flights/aircraft'
import { aircraftLightLayout } from '@/lib/flights/aircraft-lights'

export default function AircraftPortrait({ flight, detailed = false, animate = false }: { flight: FlightAircraft; detailed?: boolean; animate?: boolean }) {
  const model = aircraftModel(flight)
  const lights = animate && model ? aircraftLightLayout(model) : undefined
  const root = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadedFile, setLoadedFile] = useState('')
  useEffect(() => { setFailed(false) }, [model?.file])
  useEffect(() => {
    if (!animate || !root.current || !model || failed) return
    let visible = false
    const update = () => setActive(visible && !document.hidden)
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update() }, { threshold: .25 })
    observer.observe(root.current)
    document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [animate, failed, model?.file])
  if (!model || failed) return null
  return <span ref={root} className={`aircraft-portrait ${detailed ? 'aircraft-detail' : 'aircraft-preview'}`} data-animated={animate} data-active={animate && active} data-light-ready={loadedFile === model.file}>
    {detailed && <><span className="aircraft-sky" aria-hidden="true"><span className="aircraft-stars" /><span className="aircraft-clouds" /><span className="aircraft-clouds aircraft-clouds-near" /></span><span className="aircraft-heading"><span><small>AIRCRAFT</small><strong><AircraftLabel aircraft={flight.aircraft} light /></strong></span><span className="aircraft-registration">{flight.registration || ''}</span></span></>}
    <span className="aircraft-window"><span className="aircraft-canvas">
      <img src={imageURL(model.file)} width="1600" height="800" loading="lazy" decoding="async" alt={detailed ? `${flight.aircraft} · ${model.livery}${model.family ? ' · 近似机型示意' : ''}` : ''} onLoad={() => setLoadedFile(model.file)} onError={() => setFailed(true)} />
      {lights && <AircraftLights key={model.file} layout={lights} />}
    </span></span>
  </span>
}

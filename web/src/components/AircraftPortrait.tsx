'use client'

import { imageURL } from '@/lib/assets'

import AircraftLabel from './AircraftLabel'
import AircraftLights from './AircraftLights'
import AircraftSkeleton from './AircraftSkeleton'
import { useEffect, useRef, useState } from 'react'
import { aircraftModel, type FlightAircraft } from '@/lib/flights/aircraft'
import { aircraftLightLayout } from '@/lib/flights/aircraft-lights'

export default function AircraftPortrait({ flight, detailed = false, animate = false, previewSrc }: { flight: FlightAircraft; detailed?: boolean; animate?: boolean; previewSrc?: string }) {
  const model = aircraftModel(flight)
  const imageSource = model ? (process.env.NODE_ENV === 'development' && previewSrc ? previewSrc : imageURL(model.file)) : ''
  const lights = animate && model ? aircraftLightLayout(model) : undefined
  const root = useRef<HTMLSpanElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadedFile, setLoadedFile] = useState('')
  useEffect(() => { setFailed(false) }, [imageSource])
  useEffect(() => {
    // Cached success AND failure can finish before React attaches image handlers.
    // Check the image itself and never carry readiness across model URLs.
    const element = image.current
    if (model && element?.complete && element.getAttribute('src') === imageSource) {
      if (element.naturalWidth > 0) setLoadedFile(imageSource)
      else setFailed(true)
    }
  }, [imageSource, failed])
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
  return <span ref={root} className={`aircraft-portrait ${detailed ? 'aircraft-detail' : 'aircraft-preview'}`} data-animated={animate} data-active={animate && active} data-light-ready={loadedFile === imageSource}>
    {detailed && <><span className="aircraft-sky" aria-hidden="true"><span className="aircraft-stars" /><span className="aircraft-clouds" /><span className="aircraft-clouds aircraft-clouds-near" /></span><span className="aircraft-heading"><span><small>AIRCRAFT</small><strong><AircraftLabel aircraft={flight.aircraft} light /></strong></span><span className="aircraft-registration">{flight.registration || ''}</span></span></>}
    <span className="aircraft-window"><span className="aircraft-canvas">
      {loadedFile !== imageSource && <AircraftSkeleton />}
      <img ref={image} src={imageSource} width="1600" height="800" loading="lazy" decoding="async" style={{ opacity: loadedFile === imageSource ? 1 : 0 }} alt={detailed ? `${flight.aircraft} · ${model.livery}${model.family ? ' · 近似机型示意' : ''}` : ''} onLoad={() => setLoadedFile(imageSource)} onError={() => setFailed(true)} />
      {lights && <AircraftLights key={model.file} layout={lights} />}
    </span></span>
  </span>
}

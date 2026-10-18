'use client'
import Localized from '@/components/Localized'
import ArrowIcon from '@/components/ArrowIcon'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { imageURL } from '@/lib/assets'

export default function HomeBoardingPass({base}:{base?:string}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setArrived(true); observer.disconnect() }
    }, { threshold: .2 })
    if (ref.current) observer.observe(ref.current)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const reset = () => { ref.current?.removeAttribute('style'); if(stage.current) stage.current.dataset.hovered='false' }
    reduced.addEventListener('change', reset)
    return () => { observer.disconnect(); reduced.removeEventListener('change', reset) }
  }, [])
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0,Math.min(1,(event.clientX - rect.left) / rect.width)), y = Math.max(0,Math.min(1,(event.clientY - rect.top) / rect.height))
    event.currentTarget.dataset.hovered='true'
    ref.current?.style.setProperty('--ticket-rx', `${-(y - .5) * 8}deg`)
    ref.current?.style.setProperty('--ticket-ry', `${(x - .5) * 10}deg`)
    ref.current?.style.setProperty('--ticket-rise', '-3px')
    ref.current?.style.setProperty('--ticket-scale', '1.008')
  }
  return <Localized><div ref={stage} className="home-pass-stage" onPointerMove={move} onPointerLeave={() => { ref.current?.removeAttribute('style'); if(stage.current)stage.current.dataset.hovered='false' }}><a ref={ref} href={base?`/visitors?base=${encodeURIComponent(base)}`:"/visitors"} className="home-boarding-pass" data-arrived={arrived} aria-label="@i18n:ui.getABoardingPassWithYourName@">
    <div className="home-pass-face">
      <header><strong>MERAK AIRWAYS</strong><span>VISITOR PASS</span></header>
      <div className="home-pass-route"><b>{base||'YOU'}</b><span className="home-pass-track" aria-hidden="true"><img className="home-pass-plane" src={imageURL('/images/card/airplane.svg')} width="28" height="28" alt=""/></span><b>HGH</b></div>
      <dl><div><dt>{"@i18n:ui.passenger2@"}</dt><dd>{"@i18n:ui.yourName@"}</dd></div><div><dt>{"@i18n:ui.flight2@"}</dt><dd>MK 518</dd></div><div><dt>{"@i18n:ui.seat2@"}</dt><dd>1A</dd></div></dl>

    </div>
    <div className="home-pass-stub"><span>GATE<strong>HELLO</strong></span><div className="home-pass-barcode" aria-hidden="true"/><span className="home-pass-action">{"@i18n:ui.getYourBoardingPass@ "}<b aria-hidden="true"><ArrowIcon direction="up-right" /></b></span></div>
  </a></div></Localized>
}

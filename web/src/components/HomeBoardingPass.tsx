'use client'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { imageURL } from '@/lib/assets'

export default function HomeBoardingPass() {
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
  return <div ref={stage} className="home-pass-stage" onPointerMove={move} onPointerLeave={() => { ref.current?.removeAttribute('style'); if(stage.current)stage.current.dataset.hovered='false' }}><a ref={ref} href="/visitors" className="home-boarding-pass" data-arrived={arrived} aria-label="领取写着你名字的登机牌">
    <div className="home-pass-face">
      <header><strong>MERAK AIRWAYS</strong><span>VISITOR PASS</span></header>
      <div className="home-pass-route"><b>YOU</b><span className="home-pass-track" aria-hidden="true"><img className="home-pass-plane" src={imageURL('/images/card/sf/airplane.png')} width="28" height="28" alt=""/></span><b>HGH</b></div>
      <dl><div><dt>旅客</dt><dd>你的名字</dd></div><div><dt>航班</dt><dd>MK 518</dd></div><div><dt>座位</dt><dd>1A</dd></div></dl>
      <p>给你留了一个靠窗的位置。</p>
    </div>
    <div className="home-pass-stub"><span>GATE<strong>HELLO</strong></span><div className="home-pass-barcode" aria-hidden="true"/><span className="home-pass-action">领取登机牌 <b aria-hidden="true">↗</b></span></div>
  </a></div>
}

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function HomeTicker({ items }: { items: string[] }) {
  const [status,setStatus] = useState('TRACK CLEAR')
  useEffect(() => {
    const update = () => setStatus(document.documentElement.dataset.trackLabel || 'TRACK CLEAR')
    update(); window.addEventListener('merak-track-status',update)
    return () => window.removeEventListener('merak-track-status',update)
  },[])
  const viewport = useRef<HTMLDivElement>(null)
  const group = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(2)

  useLayoutEffect(() => {
    const box = viewport.current, first = group.current
    if (!box || !first) return
    const measure = () => {
      const width = first.getBoundingClientRect().width
      if (!width) return
      box.style.setProperty('--ticker-loop-width', `${width}px`)
      // Leave enough repeated content after one full group has moved offscreen.
      setCopies(Math.max(2, Math.ceil(box.clientWidth / width) + 1))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    observer.observe(first)
    measure()
    return () => observer.disconnect()
  }, [])

  const special = status === 'SAFETY CAR' ? ['SAFETY CAR','NO OVERTAKING','保持距离 / 禁止超车'] : status === 'FORZA FERRARI' ? ['FORZA FERRARI','P1 / VITTORIA','SEMPRE FERRARI'] : status === 'IN PIT' ? ['IN PIT','BOX BOX','PIT LANE / 51'] : status === 'VSC ENDING' ? ['VSC ENDING','GREEN FLAG NEXT','保持 DELTA'] : null
  return <div ref={viewport} className="cover-ticker" aria-label="杭州出发，航空、F1 与 Furry 的生活记录"><div className="cover-ticker-track" aria-hidden="true">{Array.from({ length: copies }, (_, copy) => <div ref={copy === 0 ? group : undefined} className="cover-ticker-group" key={copy}>{(special || [status, 'HGH / PADDOCK', ...items]).map(text => <span key={text}>{text}</span>)}</div>)}</div></div>
}

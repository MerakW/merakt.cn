'use client'

import { useLayoutEffect, useRef, useState } from 'react'

export default function HomeTicker({ items }: { items: string[] }) {
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

  return <div ref={viewport} className="cover-ticker" aria-label="杭州出发，航空、F1 与 Furry 的生活记录"><div className="cover-ticker-track" aria-hidden="true">{Array.from({ length: copies }, (_, copy) => <div ref={copy === 0 ? group : undefined} className="cover-ticker-group" key={copy}>{items.map(text => <span key={text}>{text}</span>)}</div>)}</div></div>
}

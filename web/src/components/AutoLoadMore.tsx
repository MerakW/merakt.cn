'use client'

import { useEffect, useRef, useState } from 'react'

export default function AutoLoadMore({ visible, total, onLoad }: { visible: number; total: number; onLoad: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [automatic, setAutomatic] = useState(false)
  useEffect(() => { setAutomatic('IntersectionObserver' in window) }, [])
  useEffect(() => {
    if (visible >= total || !sentinel.current || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      onLoad()
    }, { rootMargin: '0px 0px 600px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [visible, total, onLoad])
  return <div ref={sentinel} className="auto-load-more">
    <span role="status">{Math.min(visible, total)} / {total} 条{visible >= total && total > 0 ? ' · 已显示全部记录' : ''}</span>
    {visible < total && !automatic && <button onClick={onLoad}>继续加载</button>}
  </div>
}

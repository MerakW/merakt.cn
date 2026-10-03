'use client'
import { useEffect, useRef } from 'react'
export default function HomeMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const photo = root.querySelector<HTMLElement>('.home-photo')
    const reset = () => { photo?.style.removeProperty('--photo-x'); photo?.style.removeProperty('--photo-y') }
    const move = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse' || !photo) return
      const rect = photo.getBoundingClientRect()
      photo.style.setProperty('--photo-x', `${((event.clientX - rect.left) / rect.width - .5) * 3}deg`)
      photo.style.setProperty('--photo-y', `${-((event.clientY - rect.top) / rect.height - .5) * 3}deg`)
    }
    photo?.addEventListener('pointermove', move)
    photo?.addEventListener('pointerleave', reset)
    reduced.addEventListener('change', reset)
    return () => { photo?.removeEventListener('pointermove', move); photo?.removeEventListener('pointerleave', reset); reduced.removeEventListener('change', reset) }
  }, [])
  return <div className="home-page home-arrival" ref={ref}>{children}</div>
}

'use client'
import { useEffect, useRef } from 'react'
export default function HomeMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const cover = root.querySelector<HTMLElement>('.paddock-cover')
    if (!cover) return
    let frame = 0, pointerX = 0, pointerY = 0
    const paint = () => {
      frame = 0
      const rect = cover.getBoundingClientRect()
      const offset = Math.min(rect.height, Math.max(0, -rect.top))
      root.dataset.overCover = String(rect.bottom > 100)
      root.dataset.scrolled = String(rect.top < -12)
      const moving = !reduced.matches
      cover.style.setProperty('--depth-x', `${moving ? pointerX * -24 : 0}px`)
      cover.style.setProperty('--depth-y', `${moving ? pointerY * -18 - offset * .18 : 0}px`)
      cover.style.setProperty('--title-x', `${moving ? pointerX * 12 : 0}px`)
      cover.style.setProperty('--title-y', `${moving ? offset * .32 : 0}px`)
      cover.style.setProperty('--field-y', `${moving ? offset * .12 : 0}px`)
    }
    // ponytail: one frame coalesces pointer and scroll events for the three layers.
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint) }
    const reset = () => { pointerX = 0; pointerY = 0; schedule() }
    const move = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse') return
      const rect = cover.getBoundingClientRect()
      pointerX = (event.clientX - rect.left) / rect.width - .5
      pointerY = (event.clientY - rect.top) / rect.height - .5
      schedule()
    }
    cover.addEventListener('pointermove', move)
    cover.addEventListener('pointerleave', reset)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    reduced.addEventListener('change', reset)
    paint()
    return () => {
      cancelAnimationFrame(frame)
      cover.removeEventListener('pointermove', move)
      cover.removeEventListener('pointerleave', reset)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      reduced.removeEventListener('change', reset)
    }
  }, [])
  return <div className="home-page home-arrival" data-over-cover="true" data-scrolled="false" ref={ref}>{children}</div>
}

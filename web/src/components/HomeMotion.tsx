'use client'
import { useEffect, useRef } from 'react'
export default function HomeMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = matchMedia('(pointer: coarse)')
    const cover = root.querySelector<HTMLElement>('.paddock-cover')
    if (!cover) return
    const photo = cover.querySelector<HTMLElement>('.cover-photo')
    const title = cover.querySelector<HTMLElement>('.cover-wordmark')
    const field = cover.querySelector<HTMLElement>('.speed-tunnel')
    const nativeScroll = CSS.supports('animation-timeline', 'scroll(root block)') && CSS.supports('animation-range', '0px 1px')
    if (nativeScroll) cover.dataset.nativeParallax = 'true'
    let frame = 0, pointerX = 0, pointerY = 0
    let coverTop = 0, coverLeft = 0, coverWidth = 1, coverHeight = 0
    let viewportWidth = window.innerWidth
    const set = (layer: HTMLElement | null, property: string, value: number) => {
      if (!layer) return
      const next = `${value}px`
      if (layer.style.getPropertyValue(property) !== next) layer.style.setProperty(property, next)
    }
    const syncNavigation = (scroll: number) => {
      const overCover = String(coverTop + coverHeight - scroll > 100)
      const scrolled = String(scroll - coverTop > 12)
      if (root.dataset.overCover !== overCover) root.dataset.overCover = overCover
      if (root.dataset.scrolled !== scrolled) root.dataset.scrolled = scrolled
    }
    const paint = () => {
      frame = 0
      const scroll = window.scrollY
      const offset = nativeScroll ? 0 : Math.min(coverHeight, Math.max(0, scroll - coverTop))
      syncNavigation(scroll)
      const moving = !reduced.matches
      // Keep the original motion curves, but invalidate only the layer that moves.
      set(photo, '--depth-x', moving ? pointerX * -24 : 0)
      set(photo, '--depth-y', moving ? pointerY * -18 - offset * .18 : 0)
      set(title, '--title-x', moving ? pointerX * 12 : 0)
      set(title, '--title-y', moving ? offset * .32 : 0)
      set(field, '--field-y', moving ? offset * .12 : 0)
    }
    // ponytail: one frame coalesces pointer and scroll events for the three layers.
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint) }
    // Native timelines keep tracking inertial scrolling even while JS is busy.
    const onScroll = () => { if (nativeScroll) syncNavigation(window.scrollY); else schedule() }
    const measure = () => {
      const rect = cover.getBoundingClientRect()
      coverTop = rect.top + window.scrollY
      coverLeft = rect.left
      coverWidth = rect.width || 1
      coverHeight = rect.height
      // Toolbar expansion must not change the hero's height or timeline anchors.
      if (coarse.matches) set(cover, '--stable-cover-height', coverHeight)
      if (nativeScroll) {
        set(cover, '--parallax-start', coverTop)
        set(cover, '--parallax-end', coverTop + coverHeight)
        set(cover, '--parallax-height', coverHeight)
      }
      schedule()
    }
    const onResize = () => {
      const width = window.innerWidth
      if (coarse.matches && width === viewportWidth) return
      viewportWidth = width
      cover.style.removeProperty('--stable-cover-height')
      measure()
    }
    const finishEntrance = (event: AnimationEvent) => {
      if (event.animationName === 'cover-letter-arrive' && event.target === title?.lastElementChild) {
        title.dataset.entered = 'true'
      }
    }
    const reset = () => {
      pointerX = 0; pointerY = 0
      if (reduced.matches && title) title.dataset.entered = 'true'
      schedule()
    }
    const move = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse') return
      pointerX = (event.clientX - coverLeft) / coverWidth - .5
      pointerY = (event.clientY + window.scrollY - coverTop) / (coverHeight || 1) - .5
      schedule()
    }
    cover.addEventListener('pointermove', move)
    cover.addEventListener('pointerleave', reset)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    title?.addEventListener('animationend', finishEntrance)
    reduced.addEventListener('change', reset)
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || (coarse.matches && Math.abs(entry.contentRect.width - coverWidth) < .5)) return
      measure()
    })
    observer.observe(cover)
    measure()
    if (reduced.matches && title) title.dataset.entered = 'true'
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      delete cover.dataset.nativeParallax
      cover.style.removeProperty('--stable-cover-height')
      if (title) delete title.dataset.entered
      cover.removeEventListener('pointermove', move)
      cover.removeEventListener('pointerleave', reset)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      title?.removeEventListener('animationend', finishEntrance)
      reduced.removeEventListener('change', reset)
    }
  }, [])
  return <div className="home-page home-arrival" data-over-cover="true" data-scrolled="false" ref={ref}>{children}</div>
}

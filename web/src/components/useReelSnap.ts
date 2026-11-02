'use client'
import { useEffect, type RefObject } from 'react'
import { OMEGA, WheelIntent, flickZeta, nearest, nextIndex, rubber, settled, snapAt, stepSpring, touchRelease, type Spring } from '@/lib/reel-snap'

const STEP_PUSH = 36      // px of wheel travel that commits one photo
const CHAIN_AT = 0.55     // a running step must be this far along before the next one in the same direction
const RELEASE_AT = 0.96   // past the last photo, hand the wheel back to the page only once settled this much
const IDLE_MS = 150

/**
 * Damped, one-photo-at-a-time scrolling for a vertical reel inside the normal page scroll.
 * Wheel, touch and keys move the page between photo snap points with a spring; outside the
 * reel (and past its last photo) the page scrolls natively.
 */
export function useReelSnap(ref: RefObject<HTMLElement | null>, { enabled = true, frames = '[data-snap]', key = '' }: { enabled?: boolean; frames?: string; key?: string } = {}) {
  useEffect(() => {
    const reel = ref.current
    if (!reel || !enabled) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let snaps: number[] = [], lastGap = innerHeight
    let spring: Spring = { x: scrollY, v: 0, target: scrollY, omega: OMEGA, zeta: 1 }
    let raf = 0, lastFrame = 0, targetIndex = -1, from = scrollY, written = NaN
    let idle = 0, preview = 0, lastScroll = scrollY, lastScrollAt = 0, nativeFlingUntil = 0
    const intent = new WheelIntent()
    let wheelOwned = false

    const cover = () => {
      const nav = document.querySelector<HTMLElement>('.site-nav')
      if (!nav || !/sticky|fixed/.test(getComputedStyle(nav).position)) return 0
      return Math.max(0, nav.getBoundingClientRect().bottom)
    }
    const measure = () => {
      const top = cover(), view = innerHeight - top, max = document.documentElement.scrollHeight - innerHeight
      const clamp = (value: number) => Math.round(Math.min(max, Math.max(0, value)))
      const points = [clamp(reel.getBoundingClientRect().top + scrollY - top)]
      for (const frame of reel.querySelectorAll<HTMLElement>(frames)) {
        const box = frame.getBoundingClientRect(), y = box.top + scrollY
        points.push(clamp(box.height > view ? y - top : y + box.height / 2 - top - view / 2))
      }
      snaps = points.sort((a, b) => a - b).filter((point, index, list) => index === 0 || point - list[index - 1] >= 24)
      // Desktop: page top already centres the first photo, so the two collapse into one point.
      if (snaps.length > 1 && snaps[1] - snaps[0] < 48) snaps.splice(0, 1)
      lastGap = snaps.length > 1 ? snaps.at(-1)! - snaps.at(-2)! : view
      if (raf && targetIndex >= 0) spring.target = snaps[Math.min(targetIndex, snaps.length - 1)] + preview
    }

    const write = (y: number) => { written = Math.round(y); window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }) }
    const position = () => raf ? spring.x : scrollY
    /** Index currently aimed at: while moving, or while resting on a lean toward the next photo. */
    const aimed = () => raf || preview ? targetIndex : -1
    const progress = () => { const span = spring.target - from; return Math.abs(span) < 1 ? 1 : Math.min(1, Math.max(0, (spring.x - from) / span)) }
    const motion = () => Math.sign(spring.target - spring.x) as -1 | 0 | 1
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; targetIndex = -1; preview = 0 }
    const tick = (now: number) => {
      const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60
      lastFrame = now
      spring = stepSpring(spring, dt)
      if (settled(spring)) { spring = { ...spring, x: spring.target, v: 0 }; write(spring.x); raf = 0; return }
      write(spring.x)
      raf = requestAnimationFrame(tick)
    }
    /** Spring to a snap point, keeping whatever velocity the page already has. */
    const go = (index: number, { zeta = 1, velocity, offset = 0 }: { zeta?: number; velocity?: number; offset?: number } = {}) => {
      if (index < 0 || index >= snaps.length) return
      if (!raf) spring = { ...spring, x: scrollY, v: velocity ?? 0 }
      else if (velocity !== undefined) spring.v = velocity
      from = spring.x; targetIndex = index; preview = offset
      spring = { ...spring, target: snaps[index] + offset, zeta: offset ? 1 : zeta }
      if (reduced.matches) { stop(); write(snaps[index] + offset); return }
      if (!raf) { lastFrame = 0; raf = requestAnimationFrame(tick) }
    }
    /** Should input travelling in `dir` from `x` belong to the reel? */
    const captures = (x: number, dir: number) => snaps.length > 1 && (dir > 0 ? x >= snaps[0] - 2 && x < snaps.at(-1)! - 2 : x > snaps[0] + 2 && x <= snaps.at(-1)! + lastGap * 0.9)
    /** Wheel over a panel that scrolls by itself (menus, consoles) is left alone. */
    const inScroller = (target: EventTarget | null) => {
      for (let node = target instanceof Element ? target : null; node && node !== document.body; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return true
      }
      return false
    }
    const blocked = () => document.body.style.overflow === 'hidden' || !!document.querySelector('dialog[open]')

    const onWheel = (event: WheelEvent) => {
      if (blocked() || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || inScroller(event.target)) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1)
      if (!delta) return
      const read = intent.read(delta, event.timeStamp), x = position()
      if (read.gesture) wheelOwned = false
      wheelOwned ||= !!raf || captures(x, read.dir)
      // Chrome makes the rest of a natively started scroll uncancelable; let it finish and settle afterwards.
      if (!wheelOwned || !event.cancelable) { wheelOwned = false; return }
      // Inertia after a step is swallowed, even at the ends, so one flick never runs through the reel.
      // A flick reveals its speed over its first events: loosen the running spring for a slight bounce.
      if (raf && !preview && motion() === read.dir) spring.zeta = Math.min(spring.zeta, flickZeta(read.speed))
      if (read.tail) { event.preventDefault(); return }
      const next = nextIndex(snaps, x, read.dir, aimed())
      if (next < 0) {
        if (raf && progress() < RELEASE_AT) { event.preventDefault(); return }
        stop(); wheelOwned = false; intent.release(); return
      }
      event.preventDefault()
      window.clearTimeout(idle)
      const push = intent.push(read.abs)
      // A newly recognised push is intentional: retarget immediately and preserve velocity,
      // even if the previous step has not travelled far yet. Inertia remains suppressed above.
      if (push >= STEP_PUSH) { intent.stepped(); go(next, { zeta: flickZeta(read.speed) }); return }
      // Below the threshold the page leans toward the next photo, then springs back if the push stops.
      const here = aimed() >= 0 ? targetIndex : snapAt(snaps, x)
      if (here >= 0 && (!raf || preview)) {
        go(here, { offset: read.dir * rubber(push, 26) })
        idle = window.setTimeout(() => { if (preview) go(here) }, IDLE_MS)
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (blocked() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable=true], dialog')) return
      if (event.key === ' ' && target?.closest('button, a, summary')) return
      const dir = event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey) ? 1
        : event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -1 : 0
      if (!dir) return
      const x = position()
      if (!raf && !captures(x, dir)) return
      const next = nextIndex(snaps, x, dir as 1 | -1, aimed())
      if (next < 0) return
      event.preventDefault()
      if (event.repeat && raf && motion() === dir && progress() < CHAIN_AT) return
      go(next)
    }

    type Touch = { y0: number; x0: number; start: number; anchor: number; mode: 'pending' | 'drag' | 'native'; samples: [number, number][] }
    let touch: Touch | null = null
    const onTouchStart = (event: TouchEvent) => {
      if (blocked() || event.touches.length > 1) {
        // A second finger/zoom must relinquish the gesture without flinging a photo.
        if (touch?.mode === 'drag') go(nearest(snaps, spring.x))
        touch = null; return
      }
      const target = event.target instanceof Element ? event.target : null
      if (inScroller(target) || target?.closest('input, textarea, select, [contenteditable=""], [contenteditable=true]')) return
      const x = position(), point = event.touches[0]
      // A tap must not interrupt an in-flight spring; take ownership only after a drag is confirmed.
      touch = { y0: point.clientY, x0: point.clientX, start: x, anchor: nearest(snaps, x), mode: 'pending', samples: [[event.timeStamp, x]] }
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length > 1) return
      const point = event.touches[0], dy = touch.y0 - point.clientY, dx = touch.x0 - point.clientX
      if (touch.mode === 'pending') {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return
        const x = position()
        touch.mode = event.cancelable && Math.abs(dx) <= Math.abs(dy) && captures(x, Math.sign(dy)) ? 'drag' : 'native'
        if (touch.mode === 'drag') {
          stop(); spring = { ...spring, x, v: 0 }
          touch.start = x; touch.anchor = nearest(snaps, x); touch.y0 = point.clientY; touch.samples = [[event.timeStamp, x]]
        }
      }
      if (touch.mode !== 'drag') return
      // Never write scroll position while the browser owns a non-cancelable gesture.
      if (!event.cancelable) { touch.mode = 'native'; return }
      event.preventDefault()
      // The finger moves the page 1:1 up to the neighbouring photos; beyond them the reel resists.
      const anchor = snaps[touch.anchor], raw = touch.start + (touch.y0 - point.clientY) - anchor
      const low = Math.min(touch.anchor > 0 ? snaps[touch.anchor - 1] - anchor : 0, touch.start - anchor)
      const high = Math.max(touch.anchor < snaps.length - 1 ? snaps[touch.anchor + 1] - anchor : 0, touch.start - anchor)
      const offset = raw > high ? high + rubber(raw - high, lastGap * 0.18) : raw < low ? low + rubber(raw - low, lastGap * 0.18) : raw
      spring.x = anchor + offset
      write(spring.x)
      touch.samples = [...touch.samples.filter(([at]) => event.timeStamp - at < 100), [event.timeStamp, spring.x]]
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (!touch) return
      const ended = touch; touch = null
      if (ended.mode !== 'drag') { if (ended.mode === 'native') nativeFlingUntil = event.timeStamp + 2500; return }
      const { index, velocity } = touchRelease(snaps, ended.anchor, spring.x, ended.samples, event.timeStamp, event.type === 'touchcancel', lastGap)
      go(index, { velocity: Math.sign(snaps[index] - spring.x) === Math.sign(velocity) ? velocity : velocity * 0.3, zeta: flickZeta(velocity, 900, 4200) })
    }

    const onScroll = () => {
      const y = scrollY, now = performance.now()
      const ours = Math.abs(y - written) < 2
      const crossed = lastScroll > snaps.at(-1)! + 1 && y <= snaps.at(-1)! + 1 && y > snaps[0] + 2
      const velocity = (y - lastScroll) / Math.max(1, now - lastScrollAt) * 1000
      lastScroll = y; lastScrollAt = now
      if (ours || raf || touch || snaps.length < 2) return
      // A native touch fling coming back up is caught at the last photo instead of flying through the reel.
      if (crossed && now < nativeFlingUntil) { spring = { ...spring, x: y, v: velocity }; go(snaps.length - 1, { velocity, zeta: flickZeta(velocity, 900, 4200) }); return }
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        const x = scrollY
        if (raf || touch || x <= snaps[0] + 1 || x >= snaps.at(-1)! - 1 || snapAt(snaps, x) >= 0) return
        go(nearest(snaps, x))
      }, IDLE_MS)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(reel); observer.observe(document.body)
    const options = { passive: false } as const
    window.addEventListener('wheel', onWheel, options)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, options)
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      stop(); window.clearTimeout(idle); observer.disconnect()
      window.removeEventListener('wheel', onWheel); window.removeEventListener('touchstart', onTouchStart); window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd); window.removeEventListener('touchcancel', onTouchEnd); window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure)
    }
  }, [ref, enabled, frames, key])
}

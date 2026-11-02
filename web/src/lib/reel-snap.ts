/**
 * Reel snapping physics — pure and DOM-free so it can be unit tested.
 * A damped spring drives the scroll position between snap points; retargeting keeps the
 * current velocity, so reversing or chaining steps never restarts the motion from rest.
 */
export type Spring = { x: number; v: number; target: number; omega: number; zeta: number }

/** Natural frequency (rad/s): a full step settles in ~0.7 s, critically damped by default. */
export const OMEGA = 10.5
/** Fast flicks loosen the damping a little for a slight overshoot (≈2–3 % of a step). */
export const FLICK_ZETA = 0.74
const SUBSTEP = 1 / 240

/** Advance the spring by dt seconds (semi-implicit Euler, fixed sub-steps for stability). */
export function stepSpring(spring: Spring, dt: number): Spring {
  let { x, v } = spring
  const k = spring.omega * spring.omega, c = 2 * spring.zeta * spring.omega
  for (let left = Math.min(dt, 0.064); left > 1e-6; left -= SUBSTEP) {
    const h = Math.min(SUBSTEP, left)
    v += (-k * (x - spring.target) - c * v) * h
    x += v * h
  }
  return { ...spring, x, v }
}
export const settled = (spring: Spring) => Math.abs(spring.x - spring.target) < 0.5 && Math.abs(spring.v) < 12

/** Damping ratio from input speed (px/s): gentle input never overshoots; a hard flick bounces slightly. */
export function flickZeta(speed: number, gentle = 1800, hard = 7000): number {
  const t = Math.min(1, Math.max(0, (Math.abs(speed) - gentle) / (hard - gentle)))
  return 1 - (1 - FLICK_ZETA) * t * (2 - t)
}

/** Rubber-band resistance: grows with distance but never exceeds `limit`. */
export function rubber(distance: number, limit: number): number {
  if (limit <= 0) return 0
  const sign = Math.sign(distance), d = Math.abs(distance)
  return sign * limit * (1 - 1 / (d * 0.55 / limit + 1))
}

/** Index whose snap point `x` sits on (within 2 px), otherwise -1. */
export function snapAt(snaps: number[], x: number): number {
  return snaps.findIndex(point => Math.abs(point - x) <= 2)
}
export function nearest(snaps: number[], x: number): number {
  let best = 0
  for (let index = 1; index < snaps.length; index++) if (Math.abs(snaps[index] - x) < Math.abs(snaps[best] - x)) best = index
  return best
}
/** One photo onward from `x` in `dir`; `from` is the index already targeted, if any. -1 = past the end. */
export function nextIndex(snaps: number[], x: number, dir: 1 | -1, from = -1): number {
  const base = from >= 0 ? from : snapAt(snaps, x)
  const index = base >= 0 ? base + dir
    : dir > 0 ? snaps.findIndex(point => point > x + 2)
    : snaps.reduce((found, point, index) => point < x - 2 ? index : found, -1)
  return index >= 0 && index < snaps.length ? index : -1
}

/**
 * Wheel intent. Trackpads keep firing decaying "inertia" events for a second after a flick;
 * those must not flip more photos. After each step the input is "spent" until it shows a new
 * push: a pause, a reversal, deltas rising again after they had dropped (a new swipe during the
 * inertia) or a repeated mouse notch. The ramp-up of the same flick never counts twice.
 */
export class WheelIntent {
  private lastAbs = 0
  private lastTime = -Infinity
  private lastDir = 0
  private acc = 0
  private spent = false
  /** After a step: the flick's peak, whether it has started to fade, and the lowest delta since. */
  private peak = 0
  private dipped = false
  private valley = Infinity
  private recent: [number, number][] = []

  read(delta: number, time: number) {
    const dir = (delta > 0 ? 1 : -1) as 1 | -1, abs = Math.abs(delta), gap = time - this.lastTime
    const gesture = gap > 220 || dir !== this.lastDir
    let rising = false
    if (!this.dipped) { this.peak = Math.max(this.peak, abs); if (abs < this.peak * 0.6) { this.dipped = true; this.valley = abs } }
    else { rising = abs > this.valley + Math.max(4, this.valley * 0.5); this.valley = Math.min(this.valley, abs) }
    const notch = abs >= 40 && Math.abs(abs - this.lastAbs) < 0.5 && gap > 24
    if (gesture) { this.acc = 0; this.recent = [] }
    if (gesture || rising || notch) this.spent = false
    this.lastAbs = abs; this.lastTime = time; this.lastDir = dir
    this.recent = [...this.recent.filter(([at]) => time - at < 120), [time, abs]]
    const speed = this.recent.reduce((sum, [, value]) => sum + value, 0) / 0.12
    return { dir, abs, gesture, tail: this.spent, speed }
  }
  /** Accumulated push since the last step. */
  push(abs: number) { this.acc += abs; return this.acc }
  stepped() { this.acc = 0; this.spent = true; this.peak = 0; this.dipped = false; this.valley = Infinity }
  release() { this.acc = 0 }
}

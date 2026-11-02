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
  private risingEvents = 0
  private reversePush = 0
  private recent: [number, number][] = []

  read(delta: number, time: number) {
    const dir = (delta > 0 ? 1 : -1) as 1 | -1, abs = Math.abs(delta), gap = time - this.lastTime
    const reversal = dir !== this.lastDir
    // A tiny opposite-sign event is common in trackpad momentum. Do not let it
    // reset the gesture and turn the next photo when the original tail resumes.
    if (this.spent && reversal && gap <= 220) {
      this.reversePush += abs
      if (this.reversePush < 24) {
        this.lastTime = time
        return { dir, abs, gesture: false, tail: true, speed: 0 }
      }
    }
    this.reversePush = 0
    const gesture = gap > 220 || reversal
    let rising = false
    if (!gesture && this.spent) {
      if (!this.dipped) {
        this.peak = Math.max(this.peak, abs)
        if (abs < this.peak * 0.6) { this.dipped = true; this.valley = abs }
      } else {
        // Require a sustained, substantial new push, not a small bump in the tail.
        this.risingEvents = abs > this.lastAbs + 2 ? this.risingEvents + 1 : 0
        this.valley = Math.min(this.valley, abs)
        rising = this.risingEvents >= 2 && abs >= Math.max(24, this.peak * 0.55, this.valley * 2.5 + 8)
      }
    }
    // Distinct, slower mouse notches may repeat exactly; a trackpad plateau should not.
    const notch = !gesture && abs >= 80 && Math.abs(abs - this.lastAbs) < 0.5 && gap > 65
    if (gesture) { this.acc = 0; this.recent = [] }
    if (gesture || rising || notch) this.spent = false
    this.lastAbs = abs; this.lastTime = time; this.lastDir = dir
    this.recent = [...this.recent.filter(([at]) => time - at < 120), [time, abs]]
    const speed = this.recent.reduce((sum, [, value]) => sum + value, 0) / 0.12
    return { dir, abs, gesture, tail: this.spent, speed }
  }
  /** Accumulated push since the last step. */
  push(abs: number) { this.acc += abs; return this.acc }
  stepped() { this.acc = 0; this.spent = true; this.peak = 0; this.dipped = false; this.valley = Infinity; this.risingEvents = 0; this.reversePush = 0 }
  release() { this.acc = 0 }
}

/** Resolve a drag release without mistaking a held finger or cancelled gesture for a flick. */
export function touchRelease(snaps: number[], anchor: number, x: number, samples: [number, number][], time: number, cancelled: boolean, gap: number) {
  const [first, last] = [samples[0], samples.at(-1)!]
  const velocity = !cancelled && time - last[0] < 100 && last[0] - first[0] > 8 ? (last[1] - first[1]) / (last[0] - first[0]) * 1000 : 0
  const offset = x - snaps[anchor]
  const dir = cancelled ? Math.sign(nearest(snaps, x) - anchor)
    : Math.abs(velocity) > 320 ? Math.sign(velocity) : Math.abs(offset) > gap * 0.2 ? Math.sign(offset) : 0
  return { index: Math.min(snaps.length - 1, Math.max(0, anchor + dir)), velocity }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { FLICK_ZETA, OMEGA, WheelIntent, flickZeta, nearest, nextIndex, rubber, settled, stepSpring, type Spring } from '../src/lib/reel-snap'

const run = (spring: Spring, seconds: number, fps = 60) => {
  let peak = spring.x, s = spring, t = 0
  for (; t < seconds && !settled(s); t += 1 / fps) { s = stepSpring(s, 1 / fps); peak = Math.max(peak, s.x) }
  return { s, peak, t }
}

test('spring: critically damped steps settle without overshoot, flicks bounce slightly', () => {
  const calm = run({ x: 0, v: 0, target: 800, omega: OMEGA, zeta: 1 }, 3)
  assert.ok(settled(calm.s) && calm.t < 1, `settles in ${calm.t}s`)
  assert.ok(calm.peak <= 800.5, 'no overshoot when gentle')
  const flick = run({ x: 0, v: 2500, target: 800, omega: OMEGA, zeta: FLICK_ZETA }, 3)
  const overshoot = (flick.peak - 800) / 800
  assert.ok(overshoot > 0.01 && overshoot < 0.06, `slight overshoot ${overshoot}`)
  // Variable frame times (jank, 144 Hz) converge to the same place.
  assert.ok(settled(run({ x: 0, v: 0, target: 800, omega: OMEGA, zeta: 1 }, 3, 24).s))
  // Retargeting mid-flight keeps the velocity: reversing never jumps.
  let s: Spring = { x: 0, v: 0, target: 800, omega: OMEGA, zeta: 1 }
  for (let i = 0; i < 12; i++) s = stepSpring(s, 1 / 60)
  const before = s.x, back = stepSpring({ ...s, target: 0 }, 1 / 60)
  assert.ok(Math.abs(back.x - before) < 40 && back.v < s.v)
})

test('easing helpers: damping ratio, rubber band and snap lookup', () => {
  assert.equal(flickZeta(500), 1)
  assert.equal(flickZeta(20000), FLICK_ZETA)
  assert.ok(flickZeta(4000) < 1 && flickZeta(4000) > FLICK_ZETA)
  assert.ok(rubber(1000, 26) < 26 && rubber(10, 26) > 0 && rubber(-10, 26) < 0)
  const snaps = [0, 700, 1400, 2100]
  assert.equal(nextIndex(snaps, 0, 1), 1)
  assert.equal(nextIndex(snaps, 2100, 1), -1, 'past the last photo the page takes over')
  assert.equal(nextIndex(snaps, 900, -1), 1, 'between photos: the one behind')
  assert.equal(nextIndex(snaps, 900, 1), 2)
  assert.equal(nextIndex(snaps, 300, 1, 1), 2, 'chaining from the photo already targeted')
  assert.equal(nextIndex(snaps, 300, -1, 1), 0, 'reversal goes back one')
  assert.equal(nearest(snaps, 1100), 2)
})

test('wheel intent: one flick = one photo; a new push or a reversal is honoured at once', () => {
  const intent = new WheelIntent()
  let t = 0, steps = 0
  const feed = (deltas: number[], every = 16) => { for (const delta of deltas) { t += every; const read = intent.read(delta, t); if (read.tail) continue; if (intent.push(read.abs) >= 36) { intent.stepped(); steps++ } } }
  // Trackpad flick followed by a long decaying inertia tail.
  feed([8, 22, 48, 90, 120, ...Array.from({ length: 60 }, (_, i) => Math.round(118 * 0.93 ** i))])
  assert.equal(steps, 1)
  t += 400; feed([10, 30, 60]); assert.equal(steps, 2, 'a fresh swipe after a pause')
  feed([-20, -40]); assert.equal(steps, 3, 'reversal responds immediately')
  // A mouse wheel rolled notch by notch keeps turning photos.
  t += 400; feed([100, 100, 100, 100], 90); assert.equal(steps, 7)
  // A fast spin (notches 10 ms apart) is one push, not a run to the end.
  t += 400; feed(Array(12).fill(100), 10); assert.equal(steps, 8)
  // A hard flick whose very first event already commits a step: the rest of its ramp-up is the same push.
  t += 400; feed([40, 160, 320, 300, ...Array.from({ length: 40 }, (_, i) => Math.round(280 * 0.9 ** i))], 8); assert.equal(steps, 9)
})

test('wheel intent: a second swipe during the first one\'s inertia turns the next photo', () => {
  const intent = new WheelIntent()
  let t = 0, steps = 0
  for (const delta of [20, 60, 110, 90, 60, 35, 20, 12, 8, 18, 40, 80, 60, 30]) { t += 16; const read = intent.read(delta, t); if (!read.tail && intent.push(read.abs) >= 36) { intent.stepped(); steps++ } }
  assert.equal(steps, 2)
})

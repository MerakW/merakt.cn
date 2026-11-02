// West Lake walking loop via BRouter / OpenStreetMap: Beishan, Yanggong Causeway, Nanshan, Hubin.
export const westLakePath = "M153.8,10.0 L151.8,11.0 L152.0,12.7 L149.4,12.6 L137.2,17.6 L134.2,15.7 L124.5,17.6 L117.8,22.3 L110.3,30.0 L100.8,34.7 L91.0,44.6 L88.2,46.3 L83.2,47.4 L81.7,48.6 L81.0,46.3 L78.7,46.1 L76.7,48.9 L74.4,49.3 L70.3,47.8 L70.1,45.2 L70.9,44.7 L68.6,44.8 L70.9,44.7 L70.1,45.2 L70.3,47.8 L71.7,53.3 L70.8,56.0 L72.0,58.3 L69.3,60.1 L70.8,63.2 L70.9,70.5 L70.0,73.9 L68.0,75.5 L69.4,80.4 L70.7,80.1 L71.2,81.1 L72.0,84.7 L70.9,85.5 L73.1,90.9 L68.6,94.5 L71.9,91.5 L79.4,88.2 L80.5,88.6 L83.3,92.7 L85.5,99.0 L83.7,99.2 L82.3,103.9 L77.3,107.8 L79.9,114.6 L79.3,116.8 L76.0,118.3 L80.9,122.4 L83.4,126.5 L85.7,125.8 L87.4,127.3 L87.8,127.9 L86.5,128.4 L86.2,129.7 L87.4,129.5 L87.2,132.6 L91.2,140.0 L87.2,132.6 L87.4,129.5 L92.2,127.5 L95.7,124.5 L101.0,124.4 L102.5,122.1 L104.4,121.5 L109.5,132.7 L115.6,131.0 L118.4,131.8 L130.8,129.2 L136.1,130.4 L139.7,129.9 L139.8,130.7 L147.4,129.1 L145.3,121.0 L145.9,114.6 L144.2,113.3 L143.3,111.1 L143.0,107.0 L144.5,105.0 L149.1,106.1 L150.7,104.3 L149.1,96.4 L147.4,96.1 L148.2,94.8 L146.5,92.3 L147.8,90.4 L147.1,88.0 L149.4,83.8 L149.8,81.2 L159.0,71.2 L162.7,72.7 L164.8,68.6 L166.0,68.5 L165.0,70.0 L166.0,68.5 L170.9,68.5 L170.9,61.5 L169.8,61.2 L169.5,53.0 L171.5,51.8 L172.0,49.2 L171.7,45.6 L167.4,37.5 L157.8,22.1 L155.2,20.8 L153.9,17.4 L153.3,17.6 L151.8,11.0 L153.8,10.0 Z"

type Point = [number, number]
/**
 * The West Lake loop as a closed polyline for cars to run along. The walking route has a few
 * out-and-back spurs (A → B → A); those are folded away, including one across the start point.
 */
export const westLakeLoop: Point[] = (() => {
  const points = westLakePath.replace(/[MZ]/g, '').trim().split(/\s*L\s*/).map(pair => pair.split(',').map(Number) as Point)
  const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1]
  if (same(points[0], points.at(-1)!)) points.pop()
  for (let changed = true; changed;) {
    changed = false
    for (let i = 0; i < points.length && points.length > 3; i++) {
      const n = points.length, before = points[(i - 1 + n) % n], after = points[(i + 1) % n]
      if (same(before, after) || same(points[i], after)) { points.splice(i, 1); if (same(before, after)) points.splice(i % points.length, 1); changed = true; break }
    }
  }
  return points
})()
export const westLakeLoopPath = `M${westLakeLoop.map(([x, y]) => `${x},${y}`).join(' L')} Z`
const segments = westLakeLoop.map((point, index) => { const next = westLakeLoop[(index + 1) % westLakeLoop.length]; return Math.hypot(next[0] - point[0], next[1] - point[1]) })
const lapLength = segments.reduce((sum, length) => sum + length, 0)
/** Position (and heading in degrees) a fraction of the way round the loop; any real number wraps. */
export function circuitPoint(fraction: number): { x: number; y: number; angle: number } {
  let left = (((fraction % 1) + 1) % 1) * lapLength, index = 0
  while (index < segments.length - 1 && left > segments[index]) left -= segments[index++]
  const [x1, y1] = westLakeLoop[index], [x2, y2] = westLakeLoop[(index + 1) % westLakeLoop.length], t = segments[index] ? left / segments[index] : 0
  return { x: +(x1 + (x2 - x1) * t).toFixed(2), y: +(y1 + (y2 - y1) * t).toFixed(2), angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI }
}

/**
 * Pit lane along Hubin Road (the east shore): it leaves the circuit at PIT_IN, runs outside the
 * track up to the start/finish line and rejoins there. Lane positions use the same lap fraction
 * as the track (PIT_IN … 1), so a car slides from road to lane without a jump.
 */
export const PIT_IN = 0.84
const lanePoints: Point[] = [[166.3, 68.5], [171, 73.2], [176.5, 70], [176.5, 51], [176.2, 45.3], [160.2, 18.6], [156.6, 12.6], [152, 12.7]]
export const pitLanePath = `M${lanePoints.map(([x, y]) => `${x},${y}`).join(' L')}`
const laneSegments = lanePoints.slice(1).map((point, index) => Math.hypot(point[0] - lanePoints[index][0], point[1] - lanePoints[index][1]))
const laneLength = laneSegments.reduce((sum, length) => sum + length, 0)
/** Point a share `u` (0 = pit entry, 1 = pit exit) of the way down the pit lane. */
export function pitLanePoint(u: number): { x: number; y: number; angle: number } {
  let left = Math.min(1, Math.max(0, u)) * laneLength, index = 0
  while (index < laneSegments.length - 1 && left > laneSegments[index]) left -= laneSegments[index++]
  const [x1, y1] = lanePoints[index], [x2, y2] = lanePoints[index + 1], t = laneSegments[index] ? left / laneSegments[index] : 0
  return { x: +(x1 + (x2 - x1) * t).toFixed(2), y: +(y1 + (y2 - y1) * t).toFixed(2), angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI }
}
/** Where something sits on the map: a lap fraction, on the track or in the pit lane. */
export type MapSpot = { at: number; lane: boolean }
export const laneShare = (at: number) => (at - PIT_IN) / (1 - PIT_IN)
export function spotPoint(spot: MapSpot) {
  return spot.lane ? pitLanePoint(laneShare(spot.at)) : circuitPoint(spot.at)
}

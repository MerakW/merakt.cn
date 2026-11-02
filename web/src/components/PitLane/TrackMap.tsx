'use client'
import Localized from '@/components/Localized'
import type { CSSProperties } from 'react'
import { SAFETY_CAR, type PitBox } from '@/lib/pit-lane'
import { RACE_LAPS, boxSpot, trackAt, type RaceView } from '@/lib/pit-race'
import { circuitPoint, laneShare, pitLanePath, pitLanePoint, spotPoint, westLakeLoopPath, type MapSpot } from '@/lib/west-lake-circuit'

function forecast(view: RaceView): string {
  if (view.phase === 'chequered') return `WX ${view.track.toUpperCase()}`
  const lap = Math.max(1, view.lap)
  for (let next = lap + 1; next <= Math.min(RACE_LAPS, lap + 3); next++) {
    const track = trackAt(view.weather, next)
    if (track !== view.track) return track === 'dry' ? `DRYING IN ${next - lap}L` : view.track === 'dry' ? `RAIN IN ${next - lap}L` : track === 'damp' ? `EASING IN ${next - lap}L` : `HEAVY RAIN IN ${next - lap}L`
  }
  return `WX ${view.track.toUpperCase()}`
}
const place = (spot: MapSpot) => { const point = spotPoint(spot); return { transform: `translate(${point.x}px, ${point.y}px)` } }

type Props = { boxes: PitBox[]; active: string | null; view: RaceView; colors: Record<string, string> }
/** The FRIENDS GP runs round West Lake (Hangzhou), with the pit lane along Hubin Road. */
export default function TrackMap({ boxes, active, view, colors }: Props) {
  const start = circuitPoint(0)
  const target = boxes.find(box => box.tla === active), live = view.standings.find(row => row.tla === active)
  const cars = view.standings.filter(row => row.map)
  const leader = cars[0]
  const field = boxes.filter(box => box.tla !== SAFETY_CAR.tla)
  const status = target && live ? live.retired ? 'IN GARAGE' : live.inPit ? 'IN PIT' : live.finished ? `P${live.position} · IN-LAP` : view.phase === 'formation' ? 'FORMATION' : `P${live.position} · ${live.interval}` : null
  return <Localized><figure className={`pl-map${target ? ' is-locked' : ''}`} data-track={view.track} data-sc={view.safetyCar || (view.phase === 'formation' ? 'out' : undefined)} aria-label="@i18n:pitLane.scope@">
    <svg viewBox="52 0 140 146" aria-hidden="true">
      <path className="pl-map-lake" d={westLakeLoopPath}/>
      <path className="pl-map-road" d={westLakeLoopPath}/>
      <path className="pl-map-line" d={westLakeLoopPath}/>
      <path className="pl-map-pit" d={pitLanePath}/>
      {field.map((box, index) => {
        const point = pitLanePoint(laneShare(boxSpot(index, field.length)))
        return <path key={box.tla} className="pl-map-box" d="M0 1.6V4.2" transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`} style={{ stroke: box.color }}/>
      })}
      <g className="pl-map-names"><text x="112" y="10">BEISHAN RD</text><text x="62" y="98" transform="rotate(-90 62 98)">YANGGONG</text><text x="116" y="143">NANSHAN RD</text><text className="pl-map-pit-t" x="185" y="58" transform="rotate(90 185 58)">PIT LANE</text></g>
      <g className="pl-map-sf" transform={`translate(${start.x} ${start.y}) rotate(${start.angle + 90})`}><rect x="-4" y="-1.2" width="8" height="2.4"/><path d="M-4 -1.2h2v1.2h-2zM0 -1.2h2v1.2h-2zM-2 0h2v1.2h-2zM2 0h2v1.2h-2z"/></g>
      <text className="pl-map-sf-t" x={start.x - 14} y={start.y - 3}>S/F</text>
      {[...cars].reverse().map(row => {
        const on = row.tla === active, label = on || (row === leader && !row.map!.lane)
        return <g key={row.tla} className={`pl-map-car${row.map!.lane ? ' is-pit' : ''}${on ? ' is-on' : ''}`} style={{ ...place(row.map!), '--c': colors[row.tla] || '#2349ed' } as CSSProperties}>
          {on && <circle className="pl-map-ping" r="3.2"/>}
          <circle className="pl-map-dot" r={on ? 3.2 : 2.6}/>
          {on && <g className="pl-map-lock"><path d="M-7 -3.5V-7H-3.5M3.5 -7H7V-3.5M7 3.5V7H3.5M-3.5 7H-7V3.5"/></g>}
          {label && <text x="5" y="-3.5">{row.tla}</text>}
        </g>
      })}
      {view.scMap && <g className="pl-map-car pl-map-sc" style={place(view.scMap)}><rect x="-4" y="-2.6" width="8" height="5.2" rx="1"/><text y="1.5">SC</text></g>}
    </svg>
    <figcaption><span className="pl-wx-read" data-track={view.track}>{view.phase === 'formation' ? 'FORMATION LAP' : view.safetyCar ? 'SAFETY CAR' : forecast(view)}</span><span className="pl-scope-read">{status ? `${target!.tla} ${status}` : 'WEST LAKE'}</span></figcaption>
  </figure></Localized>
}

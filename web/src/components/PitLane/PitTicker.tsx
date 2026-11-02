'use client'
import Localized from '@/components/Localized'
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { SAFETY_CAR, formatLap } from '@/lib/pit-lane'
import { RACE_LAPS, type RaceView } from '@/lib/pit-race'
import { TYRE_COLORS } from './PitBoxCard'

const WEATHER: Record<RaceView['weather']['kind'], string> = { dry: 'WX DRY', shower: 'WX SHOWERS', drying: 'WX DRYING' }
/** Scroll speed of the marquee, px per second. */
const SPEED = 48

/**
 * Broadcast-style marquee across the top of the pit lane. It renders the same set twice and
 * slides by exactly -50%, so the loop is seamless whatever the content width. Decorative: the
 * flag chip next to it carries the live status for assistive tech.
 */
export default function PitTicker({ view, metar, colors, garages }: { view: RaceView; metar: string; colors: Record<string, string>; garages: number }) {
  const track = useRef<HTMLDivElement>(null)
  const race = `R${String(view.raceId % 1000).padStart(3, '0')}`
  // Only rebuild when something a reader would notice changes (not every interval tick),
  // so the moving strip never jitters.
  const grid = view.standings.map(row => `${row.tla}:${row.position ?? '-'}:${row.tyre}:${row.inPit ? 1 : 0}:${row.retired ? 1 : 0}`).join(',')
  const items = useMemo(() => {
    const phase = view.phase === 'formation' ? 'FORMATION LAP · BEHIND THE SAFETY CAR' : view.phase === 'lights' ? 'START LIGHTS · STANDING START' : view.phase === 'chequered' ? `CHEQUERED FLAG · ${view.winner} WINS` : `LAP ${view.lap} / ${RACE_LAPS}`
    return [
      view.safetyCar && view.sc && <span className="pl-tk pl-tk-sc" key="sc"><b>{view.safetyCar === 'in' ? 'SC IN THIS LAP' : 'SAFETY CAR'}</b>{SAFETY_CAR.tla} #{SAFETY_CAR.number} · {view.sc.reason}</span>,
      <span className="pl-tk" key="race"><b>FRIENDS GP</b>{race} · {phase}</span>,
      <span className="pl-tk" key="track" data-track={view.track}><b>TRACK</b>{view.track.toUpperCase()} · {WEATHER[view.weather.kind]}</span>,
      <span className="pl-tk pl-tk-grid" key="grid">{view.standings.map(row => <span key={row.tla} className="pl-tk-car" data-out={row.retired || undefined} style={{ '--c': colors[row.tla] || '#2349ed', '--tc': TYRE_COLORS[row.tyre] } as CSSProperties}>
        <small>{row.retired ? 'OUT' : `P${row.position ?? '-'}`}</small><i/>{row.tla}{row.inPit ? <em className="is-pit">PIT</em> : <em>{row.tyre}</em>}</span>)}</span>,
      view.fastest && <span className="pl-tk pl-tk-fl" key="fl"><b>FASTEST LAP</b>{view.fastest.tla} {formatLap(view.fastest.ms)}</span>,
      metar && <span className="pl-tk" key="metar" data-i18n="off"><b>METAR</b>{metar}</span>,
      <span className="pl-tk" key="tower"><b>TOWER</b>HGH {SAFETY_CAR.frequency} · {String(garages).padStart(2, '0')} GARAGES</span>,
      <span className="pl-tk pl-tk-open" key="open"><b>STEWARDS OPEN</b>{"@i18n:pitLane.ticker.apply@"}</span>,
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race, view.phase, view.lap, view.winner, view.track, view.weather.kind, view.fastest?.tla, view.fastest?.ms, view.safetyCar, view.sc, grid, metar, colors, garages])

  useLayoutEffect(() => {
    const element = track.current, set = element?.firstElementChild as HTMLElement | null
    if (!element || !set) return
    // Round to 5 s so small width changes do not restart the loop at a different speed.
    element.style.setProperty('--pl-tick', `${Math.max(30, Math.round(set.offsetWidth / SPEED / 5) * 5)}s`)
  }, [items])

  return <div className="pl-ticker" aria-hidden="true"><Localized><div className="pl-ticker-track" ref={track}>
    {[0, 1].map(copy => <div className="pl-ticker-set" key={copy}>{items}</div>)}
  </div></Localized></div>
}

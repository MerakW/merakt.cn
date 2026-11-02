'use client'
import Localized from '@/components/Localized'
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { RACE_LAPS, type RaceView } from '@/lib/pit-race'
import { TYRE_COLORS } from './PitBoxCard'
import type { Move, RaceMessage } from './useLiveRace'

/** One line of race control; long calls slide back and forth instead of being cut off. */
function FootText({ text }: { text: string }) {
  const outer = useRef<HTMLSpanElement>(null), inner = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = outer.current, line = inner.current
    if (!box || !line) return
    const fit = () => {
      const shift = line.scrollWidth - box.clientWidth
      box.style.setProperty('--shift', `${-Math.max(0, shift)}px`)
      box.style.setProperty('--dur', `${(3 + Math.max(0, shift) / 22).toFixed(1)}s`)
      box.classList.toggle('is-scroll', shift > 2)
    }
    fit()
    const observer = new ResizeObserver(fit); observer.observe(box)
    return () => observer.disconnect()
  }, [text])
  return <span className="pl-foot-text" ref={outer}><span ref={inner}>{text}</span></span>
}

type Props = { view: RaceView; colors: Record<string, string>; active: string | null; moves: Record<string, Move>; now: number; message: RaceMessage | null }
/** F1-broadcast timing tower; rows glide to their new positions (FLIP) on every overtake. */
export default function LiveTower({ view, colors, active, moves, now, message }: Props) {
  const rows = useRef(new Map<string, HTMLDivElement>()), tops = useRef(new Map<string, number>())
  const order = view.standings.map(row => row.tla).join(',')
  useLayoutEffect(() => {
    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches
    rows.current.forEach((element, tla) => {
      const top = element.offsetTop, previous = tops.current.get(tla)
      tops.current.set(tla, top)
      if (!animate || previous === undefined || previous === top) return
      element.animate([{ transform: `translateY(${previous - top}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' })
    })
  }, [order])
  const head = view.phase === 'formation' ? <><b>FORMATION</b> LAP</> : view.phase === 'lights'
    ? <span className="pl-lights" aria-label={`START LIGHTS ${view.lights}/5`}>{[0, 1, 2, 3, 4].map(index => <i key={index} data-on={index < view.lights}/>)}</span>
    : view.phase === 'chequered' ? <><b>FINAL</b> CLASSIFICATION</> : <><b>LAP</b> <span className="pl-lap-count">{view.lap}</span> / {RACE_LAPS}</>
  return <Localized><div className="pl-tower" data-phase={view.phase} data-track={view.track} role="table" aria-label="@i18n:pitLane.timing@">
    <header><span className="pl-tower-head">{head}</span><span>{(view.safetyCar || view.phase === 'formation') && <i className="pl-wx pl-wx-sc">SC</i>}{view.phase === 'green' ? <i className="pl-wx" data-track={view.track}>{view.track === 'dry' ? 'DRY' : view.track === 'damp' ? 'DAMP' : 'WET'}</i> : view.phase === 'lights' ? 'FRIENDS GP · ' : ''}R{String(view.raceId % 1000).padStart(3, '0')}</span></header>
    <div role="rowgroup" className="pl-tower-rows">
      {view.standings.map(row => {
        const move = moves[row.tla] && now - moves[row.tla].at < 4000 ? moves[row.tla].dir : undefined
        const fastest = view.fastest?.tla === row.tla
        return <div role="row" key={row.tla} ref={element => { if (element) rows.current.set(row.tla, element); else rows.current.delete(row.tla) }}
          className={[active === row.tla && 'is-on', row.retired && 'is-out', row.inPit && 'is-pit', row.finished && 'is-done'].filter(Boolean).join(' ')}
          style={{ '--c': colors[row.tla] || '#2349ed', '--tc': TYRE_COLORS[row.tyre] } as CSSProperties}>
          <span role="cell" className="pl-pos">{row.position ?? '—'}</span>
          <span className="pl-bar" aria-hidden="true"/>
          <span role="cell" className="pl-tt">{row.tla}{move && <i className="pl-move" data-dir={move} aria-label={move === 'up' ? 'GAINED' : 'LOST'}>{move === 'up' ? '▲' : '▼'}</i>}</span>
          <span role="cell" className={`pl-gap${row.position === 1 ? ' is-lead' : ''}${row.retired ? ' is-out' : ''}`}>{fastest && <i className="pl-fl" title="FASTEST LAP"/>}{row.inPit ? `PIT→${row.pitTo}` : row.finished && row.position === 1 ? '🏁 WIN' : row.interval}</span>
          <span role="cell" className="pl-ty">{row.tyre}</span>
        </div>
      })}
    </div>
    <footer data-kind={message?.kind ?? (view.safetyCar || view.phase === 'formation' ? 'sc' : undefined)}><i/><FootText key={message?.id || 0} text={message?.text || (view.phase === 'formation' ? 'FORMATION LAP · FOLLOW THE SAFETY CAR' : view.phase === 'lights' ? 'GRID FORMED · STANDING START' : view.phase === 'chequered' ? `${view.winner} WINS · NEXT RACE SOON` : view.safetyCar ? 'SAFETY CAR · NO OVERTAKING' : 'DRS ENABLED')}/></footer>
  </div></Localized>
}

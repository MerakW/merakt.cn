'use client'
import Localized, { useTranslator } from '@/components/Localized'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PIT_BOX_EVENT, SAFETY_CAR, pad3, type PitBox } from '@/lib/pit-lane'
import { RACE_LAPS, type Standing } from '@/lib/pit-race'
import PitBoxCard, { SafetyCarCard, VacantCard } from './PitBoxCard'
import LiveTower from './LiveTower'
import TrackMap from './TrackMap'
import { useLiveRace } from './useLiveRace'
import StewardsDesk from './StewardsDesk'
import PitTicker from './PitTicker'

const toast = (text: string) => window.dispatchEvent(new CustomEvent('merak-toast', { detail: text }))
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export default function PitLane({ boxes, metar, now: serverNow, email }: { boxes: PitBox[]; metar: string; now: number; email?: string }) {
  const t = useTranslator()
  const [active, setActive] = useState<string | null>(null)
  const [boxing, setBoxing] = useState<string | null>(null)
  const [lane, setLane] = useState<{ from: number; color: string; run: number } | null>(null)
  const [clock, setClock] = useState('--:--:--Z')
  const grid = useRef<HTMLDivElement>(null), laneRef = useRef<HTMLDivElement>(null), stewards = useRef<HTMLDetailsElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), pitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pitCar, setPitCar] = useState<{ color: string; tla: string; run: number } | null>(null)
  const boxingRef = useRef<string | null>(null)
  boxingRef.current = boxing
  const entries = useMemo(() => boxes.map(({ tla, state, tyre }) => ({ tla, state, tyre })), [boxes])
  const colors = useMemo(() => Object.fromEntries([[SAFETY_CAR.tla, SAFETY_CAR.color], ...boxes.map(box => [box.tla, box.color])]), [boxes])
  // A live pit stop sends that car down the pit lane strip (drive in, service, release).
  const onPit = useCallback((standing: Standing) => {
    if (boxingRef.current || reducedMotion()) return
    setPitCar(previous => ({ color: colors[standing.tla] || '#2349ed', tla: standing.tla, run: (previous?.run || 0) + 1 }))
    if (pitTimer.current) clearTimeout(pitTimer.current)
    pitTimer.current = setTimeout(() => setPitCar(null), 3400)
  }, [colors])
  useEffect(() => () => { if (pitTimer.current) clearTimeout(pitTimer.current) }, [])
  const race = useLiveRace(entries, serverNow, onPit)
  const live = useMemo(() => new Map(race.view.standings.map(row => [row.tla, row])), [race.view])
  const fastestTla = race.view.fastest?.tla
  const onTrack = boxes.filter(box => box.state !== 'red').length
  const target = boxes.find(box => box.tla === active)
  const vacantBay = Math.max(0, ...boxes.map(box => box.bay)) + 1

  const boxOut = useCallback((tla: string) => {
    const box = boxes.find(item => item.tla === tla.toUpperCase())
    if (!box) { toast(t('pitLane.toast.noTarget', [tla.toUpperCase()])); return false }
    if (box.state === 'red') { toast(t('pitLane.toast.redFlag', [box.tla])); return false }
    const card = grid.current?.querySelector<HTMLElement>(`[data-tla="${box.tla}"]`), laneBox = laneRef.current?.getBoundingClientRect()
    const rect = card?.getBoundingClientRect()
    if (card && rect && (rect.bottom < 0 || rect.top > innerHeight)) card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    setBoxing(box.tla); setActive(box.tla)
    setLane(previous => ({ from: rect && laneBox ? rect.left + rect.width / 2 - laneBox.left - 22 : -60, color: box.color, run: (previous?.run || 0) + 1 }))
    toast(t('pitLane.toast.cleared', [box.frequency]))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => window.location.assign(box.url), reducedMotion() ? 120 : 1250)
    return true
  }, [boxes, t])

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19) + 'Z')
    tick(); const id = setInterval(tick, 1000)
    const listen = (event: Event) => { const tla = String((event as CustomEvent).detail || ''); if (tla) boxOut(tla) }
    // Returning through the back/forward cache must not leave a garage mid-launch.
    const reset = () => { if (timer.current) clearTimeout(timer.current); setBoxing(null); setLane(null) }
    window.addEventListener(PIT_BOX_EVENT, listen); window.addEventListener('pageshow', reset)
    return () => { clearInterval(id); window.removeEventListener(PIT_BOX_EVENT, listen); window.removeEventListener('pageshow', reset) }
  }, [boxOut])

  // Rebinding listeners after a render must not cancel an in-flight BOX OUT.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search), requested = params.get('box')
    if ((window.location.hash === '#stewards' || params.has('ticket')) && stewards.current) { stewards.current.open = true; if (params.has('ticket')) stewards.current.scrollIntoView({ block: 'start' }) }
    if (!requested) return
    params.delete('box'); history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`)
    const id = setTimeout(() => boxOut(requested), 450)
    return () => clearTimeout(id)
  }, [boxOut])

  const focus = (event: React.SyntheticEvent) => { const tla = (event.target as HTMLElement).closest<HTMLElement>('[data-tla]')?.dataset.tla; if (tla) setActive(tla) }
  const blur = (event: React.FocusEvent | React.PointerEvent) => { const next = event.relatedTarget as HTMLElement | null; if (!next?.closest?.('[data-tla]') && !boxing) setActive(null) }
  const onBox = (event: React.MouseEvent<HTMLAnchorElement>, box: PitBox) => {
    // Modifier and middle clicks keep native link behaviour (new tab/window).
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); boxOut(box.tla)
  }
  const lockText = active === '---' ? <><b>CLEARANCE</b> // STEWARDS DESK</> : active === SAFETY_CAR.tla ? <><b>LOCKED:</b> [MRK] // SAFETY CAR</> : target ? <><b>LOCKED:</b> [{target.tla}] // BRG {pad3(target.bearing)}°</> : <><b>STANDBY</b> // TOWER HGH {SAFETY_CAR.frequency}</>

  return <Localized><section className="pl" aria-labelledby="pit-lane-title" data-boxing={boxing || undefined}>
    <svg className="pl-apron" viewBox="0 0 1400 720" preserveAspectRatio="xMaxYMin slice" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M0 150H1400M0 270H1400" strokeWidth="1.5"/>
      <path d="M0 210H1400" strokeWidth="2.5" strokeDasharray="28 14"/>
      <path d="M612 150V270M620 150V270" strokeWidth="2"/><path d="M630 150V270M638 150V270" strokeWidth="2" strokeDasharray="10 8"/>
      {[620, 790, 960, 1130, 1300].map((x, index) => <g key={x}>
        <path d={`M${x - 150} 210C${x - 40} 210 ${x} 236 ${x} 330V560`} strokeWidth="2"/>
        <path d={`M${x - 22} 520H${x + 22}`} strokeWidth="6"/>
        <path d={`M${x + 85} 300V650`} strokeWidth="1.2" strokeDasharray="6 10"/>
        <text x={x + 14} y="610" fill="currentColor" stroke="none" fontFamily="var(--mono)" fontSize="34" fontWeight="600">{51 + index}</text>
      </g>)}
      <g fill="currentColor" stroke="none" fontFamily="var(--mono)" letterSpacing="4"><text x="660" y="198" fontSize="20">TWY P</text><text x="1060" y="198" fontSize="20">TWY P</text><text x="660" y="300" fontSize="15">HGH APRON 3</text></g>
    </svg>

    <div className="pl-control">
      <span className="pl-flag" data-phase={race.view.phase} data-track={race.view.track} data-sc={race.view.safetyCar || (race.view.phase === 'formation' ? 'out' : undefined)} role="status" aria-live="off"><i/>{race.view.phase === 'formation' ? 'FORMATION LAP' : race.view.phase === 'lights' ? 'START LIGHTS' : race.view.phase === 'chequered' ? `CHEQUERED · ${race.view.winner}` : `${race.view.safetyCar ? 'SC · ' : ''}LAP ${race.view.lap}/${RACE_LAPS}`}<span className="pl-sr" data-i18n="off"> · {metar}</span></span>
      <PitTicker view={race.view} metar={metar} colors={colors} garages={boxes.length + 1}/>
      <span className="pl-utc" suppressHydrationWarning>{clock}</span>
      <span className={`pl-lock${active ? ' is-on' : ''}`}>{lockText}</span>
    </div>

    <header className="pl-head">
      <div>
        <p className="kicker">HGH APRON &amp; PIT LANE / {"@i18n:pitLane.kicker@"}</p>
        <h1 id="pit-lane-title"><span className="pl-display">Pit <em>Lane</em></span>{"@i18n:pitLane.title@"}</h1>
        <p>{"@i18n:pitLane.lede@"}</p>
        <dl className="pl-stat"><div><dt>GARAGES</dt><dd>{String(boxes.length + 1).padStart(2, '0')}</dd></div><div><dt>ON TRACK</dt><dd>{String(onTrack).padStart(2, '0')}</dd></div><div><dt>TOWER</dt><dd>{SAFETY_CAR.frequency}</dd></div></dl>
      </div>
      <div className="pl-hud">
        <TrackMap boxes={boxes} active={active} view={race.view} colors={colors}/>
        <LiveTower view={race.view} colors={colors} active={active} moves={race.moves} now={race.now} message={race.message}/>
      </div>
    </header>

    <p id="pit-lane-hint" className="pl-sr">{"@i18n:pitLane.hint@"}</p>
    <div className="pl-grid" ref={grid} onPointerOver={focus} onFocus={focus} onPointerLeave={() => !boxing && setActive(null)} onBlur={blur}>
      <SafetyCarCard view={race.view}/>
      {boxes.map((box, index) => <PitBoxCard key={box.id} box={box} index={index} boxing={boxing === box.tla} onBox={onBox} live={live.get(box.tla)} fastest={fastestTla === box.tla}/>)}
      <VacantCard bay={vacantBay} onOpen={() => { if (stewards.current) stewards.current.open = true }}/>
    </div>

    <div className={`pl-lane${lane ? ' is-go' : pitCar ? ' is-pit' : ''}`} data-track={race.view.track} ref={laneRef} aria-hidden="true" key={`${lane?.run || 0}:${lane ? 0 : pitCar?.run || 0}`} style={lane ? { '--from': `${lane.from}px`, '--car': lane.color } as CSSProperties : pitCar ? { '--car': pitCar.color } as CSSProperties : undefined}>
      <span className="pl-paint pl-p1">PIT LANE · 80 KM/H</span>
      <span className="pl-paint pl-p2">HGH APRON · TAXIWAY P</span>
      <div className="pl-car"><svg viewBox="0 0 44 16"><path className="pl-livery" d="M2 9h6l4-4h14l5 3h9l2 3H2z"/><rect className="pl-livery" x="0" y="4" width="3" height="9"/><rect className="pl-livery" x="39" y="10" width="5" height="3"/><circle cx="10" cy="12" r="3.4" fill="#111"/><circle cx="34" cy="12" r="3.4" fill="#111"/><path d="M17 5h5v2h-5z" fill="#ffd400"/></svg></div>
      {pitCar && !lane && <span className="pl-pit-call">BOX BOX · {pitCar.tla}</span>}
      <div className="pl-exit"><i/>PIT EXIT</div>
    </div>

    <StewardsDesk ref={stewards} taken={boxes.map(box => box.tla)} email={email}/>
  </section></Localized>
}

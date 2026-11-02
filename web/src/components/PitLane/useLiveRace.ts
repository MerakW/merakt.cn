'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatLap } from '@/lib/pit-lane'
import { raceView, type RaceEntry, type RaceView, type Standing } from '@/lib/pit-race'

export type RaceMessage = { id: number; kind: 'start' | 'overtake' | 'pit' | 'fastest' | 'finish' | 'weather' | 'sc'; text: string; tla?: string }
const WEATHER_CALL: Record<string, string> = { 'dry>damp': 'RAIN · TRACK DAMP · INTERS OUT', 'damp>wet': 'HEAVY RAIN · FULL WETS', 'dry>wet': 'HEAVY RAIN · FULL WETS', 'wet>damp': 'RAIN EASING · TRACK DAMP', 'damp>dry': 'TRACK DRYING · SLICKS ON', 'wet>dry': 'TRACK DRYING · SLICKS ON' }
export type Move = { dir: 'up' | 'down'; at: number }

/**
 * Drives the FRIENDS GP clock. The first render uses the server timestamp so hydration matches,
 * then the client follows the wall clock and derives broadcast events from consecutive views.
 */
export function useLiveRace(entries: RaceEntry[], initialNow: number, onPit?: (standing: Standing) => void) {
  const [now, setNow] = useState(initialNow)
  const [message, setMessage] = useState<RaceMessage | null>(null)
  const [moves, setMoves] = useState<Record<string, Move>>({})
  const previous = useRef<{ view: RaceView; at: number } | null>(null)
  const jumped = useRef(false), counter = useRef(0), pitRef = useRef(onPit)
  pitRef.current = onPit
  const key = entries.map(entry => `${entry.tla}:${entry.state}:${entry.tyre}`).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => raceView(entries, now), [key, now])

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined
    const start = () => { clearInterval(id); setNow(Date.now()); id = setInterval(() => setNow(Date.now()), matchMedia('(prefers-reduced-motion: reduce)').matches ? 2000 : 500) }
    const visibility = () => { if (document.hidden) clearInterval(id); else { jumped.current = true; start() } }
    start(); document.addEventListener('visibilitychange', visibility)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => {
    const last = previous.current
    previous.current = { view, at: now }
    // Skip broadcast events after a tab switch or on the very first client tick.
    if (!last || jumped.current || now - last.at > 4000) { jumped.current = false; return }
    const say = (kind: RaceMessage['kind'], text: string, tla?: string) => setMessage({ id: ++counter.current, kind, text, tla })
    if (last.view.raceId !== view.raceId) return
    if (last.view.phase === 'formation' && view.phase === 'lights') return say('sc', 'SAFETY CAR IN · GRID FORMED · STANDING START', 'MRK')
    if (last.view.phase === 'lights' && view.phase === 'green') return say('start', "IT'S LIGHTS OUT AND AWAY WE GO!")
    if (last.view.phase === 'green' && view.phase === 'chequered') return say('finish', `CHEQUERED FLAG · ${view.winner} WINS THE FRIENDS GP`, view.winner || undefined)
    // Safety car calls outrank everything else on the broadcast.
    if (!last.view.safetyCar && view.safetyCar && view.sc) return say('sc', `SAFETY CAR DEPLOYED · ${view.sc.reason}`, 'MRK')
    if (last.view.safetyCar === 'out' && view.safetyCar === 'in') return say('sc', 'SAFETY CAR IN THIS LAP', 'MRK')
    if (last.view.safetyCar && !view.safetyCar && view.phase === 'green') return say('start', 'GREEN FLAG · RACING RESUMES')
    const weather = last.view.track !== view.track && view.phase === 'green' ? WEATHER_CALL[`${last.view.track}>${view.track}`] : null
    const before = new Map(last.view.standings.map(row => [row.tla, row]))
    const nextMoves: Record<string, Move> = {}
    let overtake: string | null = null
    for (const row of view.standings) {
      const old = before.get(row.tla)
      if (!old || old.position === null || row.position === null || old.position === row.position) continue
      nextMoves[row.tla] = { dir: row.position < old.position ? 'up' : 'down', at: now }
      if (row.position < old.position && !overtake && view.phase === 'green') {
        const passed = view.standings.find(other => other.position === row.position! + 1)
        if (passed && !passed.inPit && !row.inPit) overtake = `${row.tla} OVERTAKES ${passed.tla} FOR P${row.position}`
      }
    }
    if (Object.keys(nextMoves).length) setMoves(current => ({ ...Object.fromEntries(Object.entries(current).filter(([, move]) => now - move.at < 4000)), ...nextMoves }))
    const pit = view.standings.find(row => row.inPit && !before.get(row.tla)?.inPit)
    if (pit) pitRef.current?.(pit)
    if (weather) return say('weather', weather)
    if (pit) return say('pit', `BOX BOX · ${pit.tla} ${pit.tyre}→${pit.pitTo} · ${(pit.stopMs / 1000).toFixed(1)}s`, pit.tla)
    if (view.fastest && last.view.fastest && (view.fastest.tla !== last.view.fastest.tla || view.fastest.ms !== last.view.fastest.ms)) return say('fastest', `FASTEST LAP · ${view.fastest.tla} ${formatLap(view.fastest.ms)}`, view.fastest.tla)
    if (overtake) say('overtake', overtake)
  }, [view, now])

  return { view, now, moves, message }
}

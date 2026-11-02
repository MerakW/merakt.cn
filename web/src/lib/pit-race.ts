/**
 * FRIENDS GP — a deterministic, time-driven live race for the pit lane.
 * Every visitor (and the server render) sees the same race at the same moment:
 * the race number comes from the wall clock, every lap time from seeded noise.
 */
import { fnv1a, formatLap, padCells, SAFETY_CAR, seeded, virtualLap, type PitState, type Tyre } from './pit-lane'
import { PIT_IN, type MapSpot } from './west-lake-circuit'

export const RACE_LAPS = 24
/**
 * The FRIENDS GP runs round West Lake: Beishan Rd, Yanggong Causeway, Nanshan Rd and Hubin Rd, about
 * 10.4 km a lap. A street circuit with long lakeside straights and slow junction corners averages
 * roughly 195 km/h, so a racing lap is ~3:12 (pole ~3:10).
 */
export const CIRCUIT_KM = 10.4
/** Simulated seconds per real second: a ~3:12 lap takes ~18 s on screen. */
export const TIME_SCALE = 10.5
/**
 * One race every 10 minutes: a 32 s formation lap out of the pit lane behind the safety car, 6 s of
 * start lights for a standing start, ~7.5 min racing, then a slow in-lap back to the garages.
 */
export const CYCLE_MS = 10 * 60_000
export const FORMATION_MS = 32_000
export const LIGHTS_MS = 6_000
/** Real time from the start of a cycle to lights out. */
export const START_MS = FORMATION_MS + LIGHTS_MS
/** The in-lap after the flag: slow, then down the pit lane to each team's own box. */
const COOL_LAP_MS = 280000

export type RaceEntry = { tla: string; state: PitState; tyre: Tyre }
export type RacePhase = 'formation' | 'lights' | 'green' | 'chequered'
export type Track = 'dry' | 'damp' | 'wet'
/** Per-race weather: half the races stay dry, the rest get a shower or start wet and dry out. */
export type Weather = { kind: 'dry' | 'shower' | 'drying'; from: number; to: number; peak: Exclude<Track, 'dry'>; heading: number }
export type PitStop = { lap: number; from: Tyre; to: Tyre; ms: number; lane: number }
/** Safety car out from the start of lap `from`; racing resumes at the start of lap `to`. */
export type SafetyCar = { from: number; to: number; reason: string }

/** [time offset ms, degradation ms per lap] for every compound on every track state. */
const PACE: Record<Track, Record<Tyre, [number, number]>> = {
  // Dry compounds balance out over a ~12 lap stint: softs are quicker early, hards quicker late.
  dry: { S: [-850, 210], M: [0, 80], H: [360, 26], I: [7700, 340], W: [16800, 410] },
  damp: { S: [10300, 0], M: [10800, 0], H: [11500, 0], I: [0, 67], W: [960, 24] },
  wet: { S: [26400, 0], M: [27100, 0], H: [27800, 0], I: [3600, 108], W: [0, 36] },
}
const TRACK_BASE: Record<Track, number> = { dry: 0, damp: 8400, wet: 15600 }
export const SUITABLE: Record<Track, Tyre[]> = { dry: ['S', 'M', 'H'], damp: ['I', 'W'], wet: ['W', 'I'] }
/** Wet-weather liveries (green/blue) run the nearest slick by hue when the track is dry. */
const DRY_FALLBACK: Record<Tyre, Tyre> = { S: 'S', M: 'M', H: 'H', I: 'M', W: 'S' }
/** Mandatory second dry compound in an all-dry race. */
const NEXT_DRY: Record<Tyre, Tyre> = { S: 'M', M: 'H', H: 'M', I: 'H', W: 'H' }
const HEALTH_PACE: Record<PitState, number> = { green: 0, inter: 1400, wet: 3400, red: 0 }
const PIT_LANE_MS = 19000
/** Behind the safety car: a slow lap, a cheaper pit stop, and the field closed up into a train. */
const SC_LAP_MS = 265000
const SC_PIT_LANE_MS = 8500
const SC_GAP_MS = 550
const SC_REASONS = ['DEBRIS ON TRACK', 'BARRIER REPAIR', 'GRAVEL ON TRACK', 'CAR RECOVERY']

/** About a third of dry races and half of wet ones see the safety car, for two to four laps. */
export function planSafetyCar(raceId: number, weather: Weather): SafetyCar | null {
  const random = seeded(fnv1a(`sc:${raceId}`))
  if (random() >= (weather.kind === 'dry' ? 0.35 : 0.5)) return null
  const from = 3 + Math.floor(random() * 14)
  return { from, to: from + 2 + Math.floor(random() * 3), reason: SC_REASONS[Math.floor(random() * SC_REASONS.length)] }
}

export function planWeather(raceId: number): Weather {
  const random = seeded(fnv1a(`weather:${raceId}`)), roll = random(), heading = Math.floor(random() * 360)
  if (roll < 0.5) return { kind: 'dry', from: 0, to: 0, peak: 'damp', heading }
  if (roll < 0.82) { const from = 5 + Math.floor(random() * 9); return { kind: 'shower', from, to: from + 4 + Math.floor(random() * 5), peak: random() < 0.55 ? 'damp' : 'wet', heading } }
  return { kind: 'drying', from: 1, to: 5 + Math.floor(random() * 6), peak: random() < 0.6 ? 'wet' : 'damp', heading }
}
/** Track state for a lap number (1-based). Heavy rain ramps through damp at either edge. */
export function trackAt(weather: Weather, lap: number): Track {
  if (weather.kind === 'dry' || lap < weather.from || lap >= weather.to) return 'dry'
  if (weather.peak === 'damp') return 'damp'
  if ((weather.kind === 'shower' && lap === weather.from) || lap === weather.to - 1) return 'damp'
  return 'wet'
}
/** The livery compound whenever it suits the track; otherwise the right tyre for the conditions. */
export function pickTyre(track: Track, preferred: Tyre): Tyre {
  if (SUITABLE[track].includes(preferred)) return preferred
  return track === 'dry' ? DRY_FALLBACK[preferred] : track === 'damp' ? 'I' : 'W'
}

type DriverPlan = { tla: string; state: PitState; grid: number; pace: number; laps: number[]; ends: number[]; tyres: Tyre[]; stops: PitStop[]; finishLap: number; finishAt: number }
export type RacePlan = { raceId: number; weather: Weather; safetyCar: SafetyCar | null; drivers: DriverPlan[]; retired: RaceEntry[]; leaderFinish: number }

export type Standing = {
  tla: string; state: PitState; position: number | null; grid: number | null
  /** Race distance in laps (fractional while running). */
  distance: number; lap: number; lastLap: number | null; bestLap: number | null
  interval: string; gap: string; tyre: Tyre; inPit: boolean; pitTo: Tyre | null; pitted: boolean; stops: number; stopMs: number; finished: boolean; retired: boolean
  /** Where the car is on the West Lake map (null: retired, still in the garage). */
  map: MapSpot | null
  /** 2026 Overtake Mode: within 1.0 s of the car ahead while OT is enabled (replaces DRS). */
  overtake: boolean
}
export type RaceView = {
  raceId: number; phase: RacePhase; lights: number; lap: number; simMs: number; standings: Standing[]; fastest: { tla: string; ms: number } | null; winner: string | null
  weather: Weather; track: Track; leaderDistance: number
  /** This race's safety car plan, and whether it is out now ('out') or coming in at the end of this lap ('in'). */
  sc: SafetyCar | null; safetyCar: 'out' | 'in' | null
  /** Overtake Mode enabled for the field: from lap 3, and again two laps after a safety-car restart. */
  overtakeMode: boolean
  /** The safety car on the map while it is leading the field (formation lap or a deployment). */
  scMap: MapSpot | null
}

export function raceClock(now: number) {
  const raceId = Math.floor(now / CYCLE_MS), real = now - raceId * CYCLE_MS
  const formation = real < FORMATION_MS ? real / FORMATION_MS : null
  return { raceId, real, formation, simMs: (real - START_MS) * TIME_SCALE, lights: real >= FORMATION_MS && real < START_MS ? Math.min(5, Math.floor((real - FORMATION_MS) / 1000)) : 0 }
}

const cache = new Map<string, RacePlan>()
/** Pre-compute every lap of one race. Grid = qualifying on the archive lap; MRK drives the safety car. */
export function planRace(entries: RaceEntry[], raceId: number): RacePlan {
  const key = `${raceId}|${entries.map(entry => `${entry.tla}:${entry.state}:${entry.tyre}`).join(',')}`
  const cached = cache.get(key)
  if (cached) return cached
  const weather = planWeather(raceId), safetyCar = planSafetyCar(raceId, weather)
  const underSC = (lap: number) => !!safetyCar && lap >= safetyCar.from && lap < safetyCar.to
  const field = entries.filter(entry => entry.tla !== SAFETY_CAR.tla)
  const quali = (entry: RaceEntry) => virtualLap(entry.tla, entry.state) ?? Infinity
  const starters = field.filter(entry => entry.state !== 'red').sort((a, b) => quali(a) - quali(b) || a.tla.localeCompare(b.tla))
  const drivers = starters.map((entry, grid): DriverPlan => {
    const random = seeded(fnv1a(`race:${raceId}:${entry.tla}`))
    const pace = 190000 + random() * 4300 + HEALTH_PACE[entry.state]
    const preferred: Tyre = entry.tyre in PACE.dry ? entry.tyre : 'M', wear = 0.85 + random() * 0.3
    let plannedLap = weather.kind === 'dry' ? 7 + Math.floor(random() * 11) : 0
    // A safety car shortly before the planned stop is a cheap pit stop: everyone dives in.
    if (safetyCar && plannedLap && safetyCar.from >= plannedLap - 4 && safetyCar.from <= plannedLap + 1) plannedLap = safetyCar.from
    let tyre = pickTyre(trackAt(weather, 1), preferred), stint = 0, wait: number | null = null
    const laps = [0], tyres: Tyre[] = [tyre], stops: PitStop[] = []
    for (let lap = 1; lap <= RACE_LAPS; lap++) {
      stint++
      const track = trackAt(weather, lap), [offset, deg] = PACE[track][tyre]
      const noise = (random() + random() + random() - 1.5) * (track === 'dry' ? 1500 : 2300)
      let time = underSC(lap) ? SC_LAP_MS : pace + TRACK_BASE[track] + offset + deg * stint * wear + noise + (lap === 1 ? 4000 : 0)
      tyres[lap] = tyre
      if (lap < RACE_LAPS) {
        const next = trackAt(weather, lap + 1)
        let target: Tyre | null = null
        if (!SUITABLE[next].includes(tyre)) {
          // Some teams gamble one more lap on the wrong tyre before boxing.
          if (wait === null) wait = random() < 0.35 ? 1 : 0
          if (wait-- <= 0) { target = pickTyre(next, preferred); wait = null }
        } else wait = null
        if (!target && lap === plannedLap) target = NEXT_DRY[tyre]
        if (target) {
          const ms = 2000 + Math.floor(random() * 1500), lane = underSC(lap) ? SC_PIT_LANE_MS : PIT_LANE_MS
          time += lane + ms; stops.push({ lap, from: tyre, to: target, ms, lane }); tyre = target; stint = 0
        }
      }
      laps[lap] = Math.round(time)
    }
    return { tla: entry.tla, state: entry.state, grid, pace, laps, ends: [grid * 350], tyres, stops, finishLap: RACE_LAPS, finishAt: 0 }
  })
  // Lap by lap, so the safety car can close the field up: no passing, the gaps shrink to a train.
  const gap = seeded(fnv1a(`sc-gap:${raceId}`))
  for (let lap = 1; lap <= RACE_LAPS; lap++) {
    for (const driver of drivers) driver.ends[lap] = driver.ends[lap - 1] + driver.laps[lap]
    if (!underSC(lap)) continue
    const queue = [...drivers].sort((a, b) => a.ends[lap] - b.ends[lap])
    queue.forEach((driver, index) => {
      if (!index) return
      const ahead = queue[index - 1].ends[lap], train = SC_GAP_MS + Math.floor(gap() * 500)
      const target = ahead + (lap === safetyCar!.from ? Math.max(train, (driver.ends[lap] - ahead) * 0.4) : train)
      // Catching the train still means lapping no quicker than racing pace.
      driver.ends[lap] = Math.round(Math.max(target, driver.ends[lap - 1] + driver.pace))
      driver.laps[lap] = driver.ends[lap] - driver.ends[lap - 1]
    })
  }
  // The first car to complete the distance takes the flag; everyone else finishes at their next crossing.
  const leaderFinish = Math.min(...drivers.map(driver => driver.ends[RACE_LAPS]))
  for (const driver of drivers) { driver.finishLap = driver.ends.findIndex((end, lap) => lap > 0 && end >= leaderFinish); driver.finishAt = driver.ends[driver.finishLap] }
  const plan = { raceId, weather, safetyCar, drivers, retired: field.filter(entry => entry.state === 'red'), leaderFinish }
  cache.set(key, plan)
  if (cache.size > 6) cache.delete(cache.keys().next().value!)
  return plan
}

/** Before a car crosses the line, distance is measured on one shared scale so the grid order holds. */
const GRID_SCALE = 192000
function distanceAt(driver: DriverPlan, time: number): { distance: number; completed: number } {
  if (time < driver.ends[0]) return { distance: (time - driver.ends[0]) / GRID_SCALE, completed: 0 }
  let completed = 0
  while (completed < RACE_LAPS && driver.ends[completed + 1] <= time) completed++
  return { distance: completed >= RACE_LAPS ? RACE_LAPS : completed + (time - driver.ends[completed]) / driver.laps[completed + 1], completed }
}
/** Inverse of distanceAt: when did this car reach a given race distance? */
function timeAt(driver: DriverPlan, distance: number): number {
  if (distance < 0) return driver.ends[0] + distance * GRID_SCALE
  const lap = Math.floor(distance)
  return lap >= RACE_LAPS ? driver.ends[RACE_LAPS] : driver.ends[lap] + (distance - lap) * driver.laps[lap + 1]
}
/** 2026 Overtake Mode detection threshold. */
export const OT_GAP_MS = 1000
const seconds = (ms: number) => ms >= 60000 ? `+${formatLap(ms)}` : `+${(ms / 1000).toFixed(3)}`

const LANE = 1 - PIT_IN
/** Grid slots sit just behind the line on the run up from Hubin Road. */
const GRID_GAP = 0.009
const gridSpot = (grid: number) => 0.99 - grid * GRID_GAP
/** Each garage has its own box along the pit lane, in bay order; the safety car parks by the exit. */
export const boxSpot = (index: number, count: number) => PIT_IN + LANE * (0.12 + 0.68 * (index + 0.5) / Math.max(1, count))
const SC_BOX = PIT_IN + LANE * 0.93
const ease = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }
const wrap = (at: number) => ((at % 1) + 1) % 1
/** Map spot for a "train coordinate": below 0 is the pit lane (1 + x), above is the circuit. */
const trainSpot = (x: number): MapSpot => x < 0 ? { at: 1 + x, lane: true } : { at: x, lane: false }

/**
 * Formation lap: the safety car leads out of the pit lane, each car leaves its box as its slot in
 * the train comes past, one slow lap, then the field closes up into the grid slots.
 */
function formationSpots(progress: number, starters: number, boxes: number[]) {
  const spacing = 0.012, head0 = -LANE + starters * spacing, headEnd = gridSpot(0) + GRID_GAP
  const head = head0 + (headEnd - head0) * ease(progress)
  const gap = spacing + (GRID_GAP - spacing) * ease((progress - 0.75) / 0.25)
  const cars = boxes.map((box, grid) => trainSpot(Math.max(head - (grid + 1) * gap, box - 1)))
  const sc: MapSpot = head < 0 ? trainSpot(head) : progress > 0.5 && head >= PIT_IN ? { at: Math.min(head, SC_BOX), lane: true } : { at: head, lane: false }
  return { cars, sc }
}

export function raceView(entries: RaceEntry[], now: number): RaceView {
  const clock = raceClock(now), plan = planRace(entries, clock.raceId)
  const field = entries.filter(entry => entry.tla !== SAFETY_CAR.tla)
  const box = new Map(field.map((entry, index) => [entry.tla, boxSpot(index, field.length)]))
  const formation = clock.formation === null ? null : formationSpots(clock.formation, plan.drivers.length, plan.drivers.map(driver => box.get(driver.tla)!))
  const spotOf = (driver: DriverPlan, time: number, finished: boolean, completed: number): MapSpot => {
    if (formation) return formation.cars[driver.grid]
    const slot = gridSpot(driver.grid), parked = box.get(driver.tla)!
    if (finished) {
      const at = (clock.simMs - driver.finishAt) / COOL_LAP_MS
      return at >= parked ? { at: parked, lane: true } : { at, lane: at >= PIT_IN }
    }
    if (time < driver.ends[0]) return { at: slot, lane: false }
    const lap = completed + 1, start = lap === 1 ? slot - 1 : 0, q = (time - driver.ends[completed]) / driver.laps[lap]
    const stop = driver.stops.find(item => item.lap === lap)
    if (!stop) return { at: wrap(start + q * (1 - start)), lane: false }
    // Box lap: the road part is squeezed so the car reaches the pit entry exactly as its stop begins.
    const window = stop.lane + stop.ms + 2500, share = window / driver.laps[lap]
    if (q < 1 - share) return { at: wrap(start + q / (1 - share) * (PIT_IN - start)), lane: false }
    const elapsed = time - (driver.ends[lap] - window), drive = stop.lane + 2500, u = (parked - PIT_IN) / LANE, reach = u * drive
    const along = elapsed < reach ? elapsed / drive : elapsed < reach + stop.ms ? u : Math.min(1, (elapsed - stop.ms) / drive)
    return { at: PIT_IN + along * LANE, lane: true }
  }
  const rows = plan.drivers.map(driver => {
    const time = Math.min(clock.simMs, driver.finishAt), finished = clock.simMs >= driver.finishAt
    const { distance: rawDistance, completed } = distanceAt(driver, time)
    const distance = finished ? driver.finishLap : rawDistance
    const done = finished ? driver.finishLap : completed
    const inLaps = new Set(driver.stops.map(stop => stop.lap))
    const clean = driver.laps.slice(2, done + 1).filter((_, index) => !inLaps.has(index + 2))
    const stop = finished ? undefined : driver.stops.find(item => item.lap === done + 1 && time >= driver.ends[item.lap] - item.lane - item.ms - 2500)
    const made = driver.stops.filter(item => item.lap <= done)
    return {
      driver, time, finished, distance,
      standing: {
        tla: driver.tla, state: driver.state, position: 0, grid: driver.grid + 1, distance, lap: Math.min(RACE_LAPS, done + (finished ? 0 : 1)),
        lastLap: done >= 1 ? driver.laps[done] : null, bestLap: clean.length ? Math.min(...clean) : null, interval: '', gap: '',
        tyre: driver.tyres[Math.min(RACE_LAPS, finished ? driver.finishLap : done + 1)] ?? driver.tyres[0],
        inPit: !!stop, pitTo: stop?.to ?? null, pitted: made.length > 0, stops: made.length, stopMs: (stop || made.at(-1))?.ms ?? 0, finished, retired: false, map: spotOf(driver, time, finished, completed), overtake: false,
      } as Standing,
      intervalMs: Infinity,
    }
  }).sort((a, b) => b.distance - a.distance || a.driver.finishAt - b.driver.finishAt || a.driver.grid - b.driver.grid)
  rows.forEach((row, index) => {
    row.standing.position = index + 1
    if (!index) { row.standing.interval = clock.simMs < 0 ? 'POLE' : 'LEADER'; row.standing.gap = row.standing.interval; return }
    const ahead = rows[index - 1], leader = rows[0]
    const behind = (other: typeof row) => {
      const laps = Math.floor(other.distance - row.distance + 1e-9)
      return laps >= 1 ? `+${laps} LAP${laps > 1 ? 'S' : ''}` : seconds(Math.max(0, row.time - timeAt(other.driver, row.distance)))
    }
    row.standing.interval = behind(ahead); row.standing.gap = behind(leader)
    if (ahead.distance - row.distance < 1) row.intervalMs = Math.max(0, row.time - timeAt(ahead.driver, row.distance))
  })
  const standings = [...rows.map(row => row.standing), ...plan.retired.map((entry): Standing => ({
    tla: entry.tla, state: entry.state, position: null, grid: null, distance: -Infinity, lap: 0, lastLap: null, bestLap: null,
    interval: 'OUT', gap: 'OUT', tyre: entry.tyre, inPit: false, pitTo: null, pitted: false, stops: 0, stopMs: 0, finished: false, retired: true, map: null, overtake: false,
  }))]
  let fastest: RaceView['fastest'] = null
  for (const standing of standings) if (standing.bestLap !== null && (!fastest || standing.bestLap < fastest.ms)) fastest = { tla: standing.tla, ms: standing.bestLap }
  const phase: RacePhase = formation ? 'formation' : clock.simMs < 0 ? 'lights' : clock.simMs >= plan.leaderFinish ? 'chequered' : 'green'
  const lap = rows[0]?.standing.lap ?? 0, sc = plan.safetyCar
  const safetyCar = phase === 'green' && sc && lap >= sc.from && lap < sc.to ? lap === sc.to - 1 ? 'in' : 'out' : null
  // Like DRS before it: armed two laps after the start and after a safety-car restart; detection gap 1.0 s.
  const overtakeMode = phase === 'green' && !safetyCar && lap >= 3 && !(sc && lap >= sc.from && lap < sc.to + 2)
  if (overtakeMode) for (const row of rows) row.standing.overtake = (row.standing.position ?? 0) > 1 && row.intervalMs <= OT_GAP_MS && !row.standing.inPit && !row.finished
  let scMap: MapSpot | null = formation?.sc ?? null
  if (safetyCar) {
    const lead = rows[0].standing.map!, at = (lead.lane ? lead.at : wrap(lead.at)) + 0.025
    scMap = safetyCar === 'in' && at >= PIT_IN ? { at: Math.min(at, SC_BOX), lane: true } : { at: wrap(at), lane: false }
  }
  return { raceId: clock.raceId, phase, lights: clock.lights, lap, simMs: clock.simMs, standings, fastest, winner: phase === 'chequered' ? rows[0]?.standing.tla ?? null : null,
    weather: plan.weather, track: phase === 'chequered' ? trackAt(plan.weather, RACE_LAPS) : trackAt(plan.weather, Math.max(1, lap)), leaderDistance: rows[0]?.distance ?? 0, sc, safetyCar, scMap, overtakeMode }
}

/** Monospace live classification for Tower Control `pit --status`. */
export function raceStatusTable(view: RaceView, names: Record<string, string>): string[] {
  const status = (row: Standing) => row.retired ? 'RED FLAG · DNF' : row.inPit ? `IN PIT → ${row.pitTo}` : row.finished ? 'FINISHED' : row.state === 'wet' ? 'WET · MAINT' : row.state === 'inter' ? 'INTER · UNSTABLE' : row.overtake ? 'ON TRACK · OT' : 'ON TRACK'
  const head = view.phase === 'formation' ? 'FORMATION LAP · SAFETY CAR' : view.phase === 'lights' ? `LIGHTS ${'●'.repeat(view.lights)}${'○'.repeat(5 - view.lights)}` : view.phase === 'chequered' ? `CHEQUERED FLAG · WINNER ${view.winner}` : `LAP ${view.lap}/${RACE_LAPS} · TRACK ${view.track.toUpperCase()}${view.safetyCar ? ' · SAFETY CAR' : ''}`
  return [
    `FRIENDS GP R${String(view.raceId % 1000).padStart(3, '0')} · ${head}${view.fastest ? ` · FASTEST ${view.fastest.tla} ${formatLap(view.fastest.ms)}` : ''}`,
    `${'POS'.padStart(3)}  TLA  ${padCells('TEAM', 22)}  TYRE  ${'LAST LAP'.padEnd(10)}  ${'INTERVAL'.padEnd(9)}  STATUS`,
    ...view.standings.map(row => `${String(row.position ?? '--').padStart(3)}  ${row.tla}  ${padCells(names[row.tla] || row.tla, 22)}  ${row.tyre}     ${formatLap(row.lastLap).padEnd(10)}  ${row.interval.padEnd(9)}  ${status(row)}`),
  ]
}

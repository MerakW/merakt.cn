import test from 'node:test'
import assert from 'node:assert/strict'
import { SAFETY_CAR, cellWidth, padCells, virtualLap } from '../src/lib/pit-lane'
import { CYCLE_MS, FORMATION_MS, LIGHTS_MS, START_MS, RACE_LAPS, SUITABLE, TIME_SCALE, pickTyre, planRace, planSafetyCar, planWeather, raceClock, raceStatusTable, raceView, trackAt, type RaceEntry } from '../src/lib/pit-race'

const entries: RaceEntry[] = [
  { tla: 'AST', state: 'green', tyre: 'S' }, { tla: 'FGP', state: 'green', tyre: 'M' }, { tla: 'PLR', state: 'red', tyre: 'H' },
  { tla: 'TGR', state: 'green', tyre: 'H' }, { tla: 'WTL', state: 'wet', tyre: 'W' }, { tla: 'KAI', state: 'inter', tyre: 'I' },
]
const raceStart = (id: number) => id * CYCLE_MS
const at = (id: number, simSeconds: number) => raceStart(id) + START_MS + simSeconds * 1000 / TIME_SCALE
const order = (now: number) => raceView(entries, now).standings.map(row => row.tla)

test('the race clock is shared and deterministic', () => {
  const id = 3_250_000
  assert.equal(raceClock(raceStart(id)).raceId, id)
  assert.equal(raceClock(raceStart(id) + FORMATION_MS + 2500).lights, 2)
  assert.ok(raceClock(raceStart(id) + START_MS - 1).simMs < 0)
  assert.equal(START_MS, FORMATION_MS + LIGHTS_MS)
  assert.deepEqual(raceView(entries, at(id, 600)), raceView([...entries], at(id, 600)))
  assert.notDeepEqual(planRace(entries, id).drivers.map(d => d.laps), planRace(entries, id + 1).drivers.map(d => d.laps))
})

test('lights: grid follows qualifying, MRK stays out of the field and red flags are out', () => {
  const view = raceView(entries, raceStart(42) + FORMATION_MS + 3000)
  assert.equal(view.phase, 'lights'); assert.equal(view.lights, 3)
  const quali = entries.filter(e => e.state !== 'red').sort((a, b) => virtualLap(a.tla, a.state)! - virtualLap(b.tla, b.state)!).map(e => e.tla)
  assert.deepEqual(view.standings.map(row => row.tla), [...quali, 'PLR'])
  assert.ok(raceView([...entries, { tla: SAFETY_CAR.tla, state: 'green', tyre: 'S' }], raceStart(42) + FORMATION_MS + 3000).standings.every(row => row.tla !== SAFETY_CAR.tla))
  assert.equal(view.standings[0].interval, 'POLE')
  const out = view.standings.at(-1)!
  assert.equal(out.position, null); assert.equal(out.interval, 'OUT'); assert.ok(out.retired)
})

test('positions change during the race and everyone takes the flag before the next race', () => {
  for (const id of [100, 101, 102, 103]) {
    let changes = 0, previous = order(at(id, 0))
    for (let s = 0; s <= RACE_LAPS * 215; s += 5) {
      const next = order(at(id, s)); if (next.join() !== previous.join()) changes++; previous = next
    }
    assert.ok(changes >= 2, `race ${id}: only ${changes} order changes`)
    const end = raceView(entries, raceStart(id + 1) - 1)
    assert.equal(end.phase, 'chequered'); assert.ok(end.winner)
    const running = end.standings.filter(row => !row.retired)
    assert.ok(running.every(row => row.finished), `race ${id}: unfinished cars at cycle end`)
    assert.deepEqual(running.map(row => row.position), running.map((_, i) => i + 1))
    for (const row of running.slice(1)) assert.match(row.interval, /^\+(\d+\.\d{3}|\d:\d{2}\.\d{3}|\d+ LAPS?)$/, row.interval)
    assert.equal(end.standings.at(-1)!.tla, 'PLR')
  }
})

const raceOf = (kind: string) => { for (let id = 1; ; id++) if (planWeather(id).kind === kind) return id }

test('dry race: livery compound at the start, one stop onto the next dry compound', () => {
  const id = raceOf('dry'), plan = planRace(entries, id)
  for (const driver of plan.drivers) {
    assert.equal(driver.stops.length, 1, driver.tla)
    const [stop] = driver.stops
    assert.ok((stop.lap >= 7 && stop.lap <= 17) || stop.lap === plan.safetyCar?.from, `${driver.tla} stops on lap ${stop.lap}`)
    assert.ok(SUITABLE.dry.includes(driver.tyres[1]) && SUITABLE.dry.includes(stop.to), driver.tla)
    assert.notEqual(stop.to, stop.from)
  }
  assert.equal(plan.drivers.find(d => d.tla === 'AST')!.tyres[1], 'S')
  assert.equal(plan.drivers.find(d => d.tla === 'TGR')!.tyres[1], 'H')
  assert.equal(plan.drivers.find(d => d.tla === 'WTL')!.tyres[1], 'S', 'blue livery runs a soft slick when dry')
  assert.ok(plan.drivers.every(d => d.tyres.every(tyre => 'SMHIW'.includes(tyre))), 'no purple ultra in the current tyre line-up')
  const ast = plan.drivers.find(d => d.tla === 'AST')!
  const row = raceView(entries, at(id, ast.ends[ast.stops[0].lap] / 1000 + 1)).standings.find(r => r.tla === 'AST')!
  assert.ok(row.pitted); assert.equal(row.tyre, 'M')
})

test('rain: everyone boxes for wet-weather tyres (livery colour first) and back to slicks', () => {
  for (const kind of ['shower', 'drying']) {
    const id = raceOf(kind), plan = planRace(entries, id), weather = plan.weather
    assert.ok(weather.to > weather.from)
    for (const driver of plan.drivers) {
      for (let lap = 1; lap <= RACE_LAPS; lap++) {
        const track = trackAt(weather, lap), previous = lap > 1 ? trackAt(weather, lap - 1) : track
        // At most one gamble lap on the wrong tyre after the conditions change.
        if (track === previous && lap > 2 && trackAt(weather, lap - 2) === track) assert.ok(SUITABLE[track].includes(driver.tyres[lap]), `${kind} ${driver.tla} lap ${lap} ${track} on ${driver.tyres[lap]}`)
      }
      assert.ok(SUITABLE.dry.includes(driver.tyres[RACE_LAPS]), `${driver.tla} finishes on slicks`)
    }
    const wtl = plan.drivers.find(d => d.tla === 'WTL')!, kai = plan.drivers.find(d => d.tla === 'KAI')!
    assert.ok(wtl.tyres.includes('W') && !wtl.tyres.includes('I'), 'blue livery picks full wets in the rain')
    assert.ok(kai.tyres.includes('I') && !kai.tyres.includes('W'), 'green livery picks inters in the rain')
  }
  assert.equal(pickTyre('damp', 'S'), 'I'); assert.equal(pickTyre('wet', 'S'), 'W'); assert.equal(pickTyre('wet', 'I'), 'I'); assert.equal(pickTyre('dry', 'I'), 'M')
})

test('pit --status table stays aligned with CJK team names', () => {
  const names = { MRK: 'Merak · 数字围场', AST: '璇迹 Astronix', FGP: '风洞 FGP', TGR: 'Tangerine', WTL: '湿地', KAI: 'Kai', PLR: 'Polar' }
  assert.equal(cellWidth(padCells('橘猫电台 Tangerine FM 超长名字', 22)), 22)
  for (const now of [raceStart(9) + 2000, at(9, 900), raceStart(10) - 1]) {
    const rows = raceStatusTable(raceView(entries, now), names)
    assert.match(rows[0], /^FRIENDS GP R009/)
    assert.equal(rows.length, 2 + entries.length)
    for (const line of rows.slice(1)) {
      let used = 0, index = 0
      const chars = [...line]
      while (used < 34) used += cellWidth(chars[index++])
      assert.equal(used, 34, line); assert.match(chars[index], /[SMHIWT]/, line)
    }
  }
})

test('safety car: random deployments, no passing behind it, a closed-up train and every race still finishes in its slot', () => {
  let deployed = 0
  for (let id = 2000; id < 2300; id++) {
    const plan = planRace(entries, id), sc = plan.safetyCar
    assert.deepEqual(sc, planSafetyCar(id, plan.weather))
    const end = raceView(entries, raceStart(id + 1) - 1)
    assert.equal(end.phase, 'chequered', `race ${id} ran out of time`)
    assert.ok(end.standings.filter(row => !row.retired).every(row => row.finished), `race ${id}: unfinished cars`)
    if (!sc) continue
    deployed++
    assert.ok(sc.from >= 3 && sc.to - sc.from >= 2 && sc.to - sc.from <= 4 && sc.to < RACE_LAPS)
    const pitted = (tla: string, lap: number) => plan.drivers.find(d => d.tla === tla)!.stops.some(stop => stop.lap === lap)
    for (let lap = sc.from + 1; lap < sc.to; lap++) {
      const before = [...plan.drivers].sort((a, b) => a.ends[lap - 1] - b.ends[lap - 1]).filter(d => !pitted(d.tla, lap)).map(d => d.tla)
      const after = [...plan.drivers].sort((a, b) => a.ends[lap] - b.ends[lap]).filter(d => !pitted(d.tla, lap)).map(d => d.tla)
      assert.deepEqual(after, before, `race ${id} lap ${lap}: overtaking behind the safety car`)
    }
    const train = [...plan.drivers].sort((a, b) => a.ends[sc.to - 1] - b.ends[sc.to - 1])
    for (let i = 1; i < train.length; i++) assert.ok(train[i].ends[sc.to - 1] - train[i - 1].ends[sc.to - 1] < 4000, `race ${id}: field not closed up`)
    const mid = plan.drivers[0].ends[sc.from] + 1000
    const live = raceView(entries, raceStart(id) + START_MS + mid / TIME_SCALE)
    assert.ok(live.safetyCar === 'out' || live.safetyCar === 'in', `race ${id}: safety car not shown`)
  }
  assert.ok(deployed > 80 && deployed < 200, `${deployed} deployments in 300 races`)
})

test('map: formation lap out of the pit lane, standing start, own pit boxes and an in-lap to the garages', () => {
  const id = 777, running = entries.filter(e => e.state !== 'red').length
  const spots = (now: number) => raceView(entries, now).standings.filter(row => !row.retired).map(row => row.map!)
  const first = raceView(entries, raceStart(id) + 10)
  assert.equal(first.phase, 'formation'); assert.ok(first.scMap)
  const boxes = spots(raceStart(id) + 10)
  assert.ok(boxes.every(spot => spot.lane), 'everyone starts in the pit lane')
  assert.equal(new Set(boxes.map(spot => spot.at.toFixed(4))).size, running, 'every team has its own box')
  assert.equal(raceView(entries, raceStart(id) + 16000).standings.find(row => row.retired)!.map, null)
  const mid = spots(raceStart(id) + FORMATION_MS / 2)
  assert.ok(mid.every(spot => !spot.lane), 'the whole field is out on the formation lap')
  const grid = spots(raceStart(id) + FORMATION_MS + 1000), later = spots(raceStart(id) + START_MS - 10)
  assert.deepEqual(grid, later, 'standing start: the grid does not creep during the lights')
  assert.ok(grid.every((spot, index) => !spot.lane && (index === 0 || spot.at < grid[index - 1].at)), 'grid order behind the line')
  // Every pit stop happens in that team's own box.
  const plan = planRace(entries, id), driver = plan.drivers[0], stop = driver.stops[0]
  const window = stop.lane + stop.ms + 2500, drive = stop.lane + 2500
  const parked = boxes[0], u = (parked.at - (1 - 0.16)) / 0.16
  const inBox = raceView(entries, at(id, (driver.ends[stop.lap] - window + u * drive + stop.ms / 2) / 1000)).standings.find(row => row.tla === driver.tla)!
  assert.ok(inBox.inPit && inBox.map!.lane); assert.ok(Math.abs(inBox.map!.at - parked.at) < 1e-6, 'stops at its own box')
  const byTla = (now: number) => Object.fromEntries(raceView(entries, now).standings.filter(row => !row.retired).map(row => [row.tla, row.map]))
  assert.deepEqual(byTla(raceStart(id + 1) - 1), byTla(raceStart(id) + 10), 'in-lap ends parked back in each box')
  assert.equal(raceView(entries, raceStart(id + 1) - 1).scMap, null)
})

test('2026 Overtake Mode replaces DRS: armed from lap 3, never under the safety car, only within 1.0 s', () => {
  let flagged = 0
  for (let race = 0; race < 12; race++) for (let t = START_MS; t < CYCLE_MS; t += 7000) {
    const view = raceView(entries, race * CYCLE_MS + t)
    if (view.phase !== 'green' || view.lap < 3 || view.safetyCar) assert.equal(view.overtakeMode, false)
    for (const row of view.standings.filter(item => item.overtake)) {
      flagged++
      assert.ok(view.overtakeMode && row.position! > 1 && !row.inPit && !row.retired)
      assert.match(row.interval, /^\+0\.\d{3}$|^\+1\.000$/)
    }
  }
  assert.ok(flagged > 0)
})

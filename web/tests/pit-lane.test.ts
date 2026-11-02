import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPitLane, cellWidth, fnv1a, nextHealth, padCells, colorTyre, resolveTyre, scopePoint, timingOrder, virtualBearing, virtualFrequency, virtualLap, type FriendInput, type Health } from '../src/lib/pit-lane'
import { discoverIcons, pngFromIco, publicTarget } from '../src/lib/pit-lane-monitor'

const now = Date.parse('2026-10-30T12:00:00Z')
const friend = (tla: string, extra: Partial<FriendInput> = {}): FriendInput => ({ id: tla, tla, name: `${tla} Team`, url: `https://${tla.toLowerCase()}.example`, ...extra })

test('virtual telemetry is deterministic and within aviation/F1 ranges', () => {
  assert.equal(fnv1a('AST'), fnv1a('AST'))
  for (const tla of ['AST', 'FGP', 'PLR', 'TGR', 'WTL', 'ZZZ']) {
    const lap = virtualLap(tla, 'green')!
    assert.ok(lap >= 190000 && lap < 202000, `${tla} lap ${lap}`)
    const wet = virtualLap(tla, 'wet')!
    assert.ok(wet - lap >= 17000 && wet - lap < 24000)
    assert.equal(virtualLap(tla, 'red'), null)
    const mhz = Number(virtualFrequency(tla))
    assert.ok(mhz >= 118 && mhz <= 136.975 && Math.round((mhz - 118) * 1000) % 25 === 0)
    assert.notEqual(virtualFrequency(tla), '121.500')
    const { bearing, distance } = virtualBearing(tla)
    assert.ok(bearing >= 0 && bearing < 360 && distance >= 5 && distance <= 900)
    assert.deepEqual(virtualBearing(tla), { bearing, distance })
  }
  const edge = scopePoint(90, 1e6)
  assert.equal(edge.x, 278); assert.equal(edge.y, 150)
})

test('tyre compound follows a manual choice, then the closest livery colour; the retired purple ultra is gone', () => {
  assert.equal(colorTyre('#e8303b'), 'S'); assert.equal(colorTyre('#ff3db4'), 'S'); assert.equal(colorTyre('#ffd400'), 'M')
  assert.equal(colorTyre('#8bc34a'), 'I'); assert.equal(colorTyre('#2349ed'), 'W'); assert.equal(colorTyre('#9b5cff'), 'W'); assert.equal(colorTyre('#c026d3'), 'S')
  for (const grey of ['#000000', '#ffffff', '#9e9e9e']) assert.equal(colorTyre(grey), 'H')
  assert.equal(resolveTyre({ teamColor: '#ffd400' }), 'M')
  assert.equal(resolveTyre({ teamColor: '#ffd400', tyreMode: 'manual', tyre: 'W' }), 'W')
  assert.equal(resolveTyre({ teamColor: '#ffd400', tyreMode: 'manual', tyre: 'U' }), 'M', 'a legacy purple ultra falls back to the livery match')
  assert.ok(buildPitLane([friend('AST', { teamColor: '#9b5cff' })], now).every(box => box.tyre === 'W' && !('life' in box)))
})

test('health machine: 3 failures raise a red flag, 2 successes clear it, 503+Retry-After is wet', () => {
  let health: Health = {}
  health = nextHealth(health, { ok: false }); assert.equal(health.state, 'inter')
  health = nextHealth(health, { ok: false }); assert.equal(health.state, 'inter')
  health = nextHealth(health, { ok: false }); assert.equal(health.state, 'red')
  health = nextHealth(health, { ok: true, latencyMs: 200 }); assert.equal(health.state, 'red')
  health = nextHealth(health, { ok: true, latencyMs: 200 }); assert.equal(health.state, 'inter', 'recent failures keep intermediates on')
  for (let i = 0; i < 8; i++) health = nextHealth(health, { ok: true, latencyMs: 200 })
  assert.equal(health.state, 'green'); assert.equal(health.history, '11111111')
  assert.equal(nextHealth(health, { ok: true, latencyMs: 3500 }).state, 'inter')
  assert.equal(nextHealth(health, { ok: false, status: 503, retryAfter: true }).state, 'wet')
})

test('pit lane ordering: grid by bay, timing tower by lap behind the MRK leader, red flags out', () => {
  const boxes = buildPitLane([
    friend('AST', { bay: 2 }), friend('FGP', { bay: 1 }), friend('PLR', { bay: 3, health: { state: 'red' } }),
    friend('WTL', { maintenance: true, teamColor: '#ffd400' }), friend('BAD', { url: 'javascript:alert(1)' }), friend('no'),
  ], now)
  assert.deepEqual(boxes.map(box => box.tla), ['FGP', 'AST', 'PLR', 'WTL'])
  const red = boxes.find(box => box.tla === 'PLR')!
  assert.equal(red.position, null); assert.equal(red.gap, 'OUT'); assert.equal(red.lap, '—:——.———')
  assert.equal(boxes.find(box => box.tla === 'WTL')!.tyre, 'M')
  const order = timingOrder(boxes)
  assert.deepEqual(order.map(box => box.position), [1, 2, 3, null])
  assert.equal(order[0].gap, 'POLE')
  for (let i = 1; i < order.length - 1; i++) assert.ok(order[i].lapMs! >= order[i - 1].lapMs!)
  assert.equal(buildPitLane([friend('AST', { teamColor: 'red' })], now)[0].color, '#2349ed')
})

test('monitor discovery: icons, ICO PNG frames and private targets', () => {
  const html = `<link rel="alternate" type="application/rss+xml" href="/blog/rss.xml"><link rel="icon" sizes="32x32" href="/i32.png"><link rel="icon" sizes="192x192" href="/i192.png"><link rel="apple-touch-icon" href="/apple.png"><link rel="manifest" href="/site.webmanifest">`
  const { icons, manifest } = discoverIcons(html, 'https://a.example/')
  assert.deepEqual(icons, ['https://a.example/apple.png', 'https://a.example/i192.png', 'https://a.example/i32.png'])
  assert.equal(manifest, 'https://a.example/site.webmanifest')
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
  const ico = Buffer.alloc(6 + 16 + png.length)
  ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = 64; ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18); png.copy(ico, 22)
  assert.deepEqual(pngFromIco(ico), png)
  for (const url of ['http://localhost/', 'https://127.0.0.1/', 'https://192.168.1.2/', 'https://[::1]/', 'ftp://a.example/']) assert.equal(publicTarget(url), null, url)
  assert.ok(publicTarget('https://friend.example/'))
})

test('BMP favicon frames decode to RGBA with the AND mask applied', async () => {
  const { rgbaFromIcoBmp } = await import('../src/lib/pit-lane-monitor')
  // 2×2, 24-bit: bottom row blue/green, top row red/white; top-right pixel masked out.
  const header = Buffer.alloc(40); header.writeUInt32LE(40, 0); header.writeInt32LE(2, 4); header.writeInt32LE(4, 8); header.writeUInt16LE(1, 12); header.writeUInt16LE(24, 14)
  const rows = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, /* bottom: blue, green + pad */ 0, 0, 255, 255, 255, 255, 0, 0 /* top: red, white + pad */])
  const mask = Buffer.from([0, 0, 0, 0, /* bottom row opaque */ 0b01000000, 0, 0, 0 /* top-right transparent */])
  const out = rgbaFromIcoBmp(Buffer.concat([header, rows, mask]))!
  assert.equal(out.width, 2); assert.equal(out.height, 2)
  assert.deepEqual([...out.data.subarray(0, 4)], [255, 0, 0, 255]) // top-left red
  assert.equal(out.data[7], 0) // top-right masked
  assert.deepEqual([...out.data.subarray(8, 12)], [0, 0, 255, 255]) // bottom-left blue
  // 8-bit palette frame: one palette entry, every pixel uses it.
  const h8 = Buffer.from(header); h8.writeUInt16LE(8, 14); h8.writeUInt32LE(1, 32)
  const pal = Buffer.from([10, 20, 30, 0]), px = Buffer.alloc(8), m8 = Buffer.alloc(8)
  assert.deepEqual([...rgbaFromIcoBmp(Buffer.concat([h8, pal, px, m8]))!.data.subarray(0, 4)], [30, 20, 10, 255])
  assert.equal(rgbaFromIcoBmp(Buffer.alloc(10)), null)
})
